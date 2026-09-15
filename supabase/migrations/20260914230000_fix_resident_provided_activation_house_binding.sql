-- ENTRY resident-provided registration activation bridge hardening.
-- Resident-submitted units stay staging-only until explicit review/confirmation.
-- At confirmation time, bind the verified staging unit to an operational house,
-- then propagate that house identity through the submission/resident/activation records.

create or replace function public._cr_bind_operational_house_v1(
  p_campaign_unit_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_unit public.community_registration_units%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_house_id uuid;
  v_house_active boolean;
  v_match_count integer := 0;
  v_normalized_label text;
  v_action text := 'already_bound';
begin
  select *
    into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  select *
    into v_campaign
    from public.community_registration_campaigns
   where id = v_unit.campaign_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_UNAVAILABLE', 'P0409');
  end if;

  if v_unit.house_id is not null then
    return jsonb_build_object(
      'house_id', v_unit.house_id,
      'action', v_action,
      'unit_label', v_unit.unit_label_snapshot
    );
  end if;

  if v_campaign.registration_mode <> 'resident_provided_units' then
    perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_REQUIRED', 'P0409');
  end if;

  if v_unit.status not in ('reviewed', 'confirmed', 'processed') then
    perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
  end if;

  v_normalized_label := public.normalize_unit_label(v_unit.unit_label_snapshot);
  if v_normalized_label is null or btrim(v_normalized_label) = '' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT', 'P0409');
  end if;

  -- Serialize create/match decisions for the same community + normalized label.
  perform pg_advisory_xact_lock(
    hashtext(v_unit.community_id::text),
    hashtext(v_normalized_label)
  );

  select count(*)::integer
    into v_match_count
    from public.houses h
   where h.community_id = v_unit.community_id
     and public.normalize_unit_label(h.house_label) = v_normalized_label;

  if v_match_count > 1 then
    perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_AMBIGUOUS', 'P0409');
  end if;

  if v_match_count = 1 then
    select h.id, h.is_active
      into v_house_id, v_house_active
      from public.houses h
     where h.community_id = v_unit.community_id
       and public.normalize_unit_label(h.house_label) = v_normalized_label
     for update;

    if not coalesce(v_house_active, false) then
      perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_INACTIVE', 'P0409');
    end if;

    v_action := 'matched_existing';
  else
    begin
      insert into public.houses (
        community_id,
        house_label,
        is_active
      )
      values (
        v_unit.community_id,
        v_unit.unit_label_snapshot,
        true
      )
      returning id into v_house_id;
      v_action := 'created';
    exception
      when unique_violation then
        select h.id, h.is_active
          into v_house_id, v_house_active
          from public.houses h
         where h.community_id = v_unit.community_id
           and public.normalize_unit_label(h.house_label) = v_normalized_label
         order by h.created_at, h.id
         limit 1
         for update;

        if v_house_id is null then
          raise;
        end if;

        if not coalesce(v_house_active, false) then
          perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_INACTIVE', 'P0409');
        end if;

        v_action := 'matched_existing';
    end;
  end if;

  if exists (
    select 1
      from public.community_registration_units other_unit
     where other_unit.campaign_id = v_unit.campaign_id
       and other_unit.id <> v_unit.id
       and other_unit.house_id = v_house_id
  ) then
    perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_ALREADY_LINKED', 'P0409');
  end if;

  if exists (
    select 1
      from public.resident_activation_queue q
      join public.community_registration_residents r
        on r.id = q.community_registration_resident_id
     where r.campaign_unit_id = v_unit.id
       and q.house_id is not null
       and q.house_id is distinct from v_house_id
  ) then
    perform public._cr_raise_v1('ENTRY_CR_TRACEABILITY_CONFLICT', 'P0409');
  end if;

  update public.community_registration_units
     set house_id = v_house_id
   where id = v_unit.id;

  update public.community_registration_submissions
     set house_id = v_house_id
   where campaign_unit_id = v_unit.id;

  update public.community_registration_residents
     set house_id = v_house_id
   where campaign_unit_id = v_unit.id;

  update public.resident_activation_queue q
     set house_id = v_house_id,
         last_error = case
           when q.last_error = 'activation_blocked_missing_house' then null
           else q.last_error
         end,
         updated_at = now()
    from public.community_registration_residents r
   where r.id = q.community_registration_resident_id
     and r.campaign_unit_id = v_unit.id
     and q.community_id = v_unit.community_id
     and (q.house_id is null or q.house_id = v_house_id);

  return jsonb_build_object(
    'house_id', v_house_id,
    'action', v_action,
    'unit_label', v_unit.unit_label_snapshot
  );
end;
$function$;

revoke all on function public._cr_bind_operational_house_v1(uuid) from public;
revoke all on function public._cr_bind_operational_house_v1(uuid) from anon;
revoke all on function public._cr_bind_operational_house_v1(uuid) from authenticated;
grant execute on function public._cr_bind_operational_house_v1(uuid) to service_role;

create or replace function public.record_community_registration_unit_external_approval_v1(
  p_campaign_unit_id uuid,
  p_actor_user_id uuid,
  p_reason text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign_id uuid;
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_house_binding jsonb := '{}'::jsonb;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  select campaign_id into v_campaign_id
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_campaign_id
   for update;

  if not found or v_campaign.status not in ('open', 'review', 'confirmed') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  -- Legacy repair path: processed/confirmed resident-provided units created before
  -- this bridge may still lack an operational house.
  if v_unit.status in ('processed', 'confirmed') and v_unit.house_id is null then
    if v_campaign.registration_mode = 'resident_provided_units' then
      v_house_binding := public._cr_bind_operational_house_v1(v_unit.id);
      select * into v_unit
        from public.community_registration_units
       where id = v_unit.id
       for update;
    else
      perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_REQUIRED', 'P0409');
    end if;
  end if;

  if v_unit.status = 'processed' then
    return jsonb_build_object(
      'status', 'processed',
      'already_confirmed', true,
      'unit_label', v_unit.unit_label_snapshot,
      'house_id', v_unit.house_id,
      'campaign_status', v_campaign.status
    );
  end if;

  if v_unit.status = 'confirmed' then
    select * into v_submission
      from public.community_registration_submissions
     where campaign_unit_id = v_unit.id
       and campaign_id = v_campaign.id
       and status = 'confirmed'
     order by version_number desc
     limit 1;

    if not found
       or v_submission.patronato_confirmed_at is null
       or v_submission.community_id <> v_campaign.community_id
       or v_submission.house_id is distinct from v_unit.house_id then
      perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_STALE', 'P0409');
    end if;

    return jsonb_build_object(
      'status', 'confirmed',
      'already_confirmed', true,
      'unit_label', v_unit.unit_label_snapshot,
      'house_id', v_unit.house_id,
      'version', v_submission.version_number,
      'campaign_status', v_campaign.status
    );
  end if;

  if v_unit.status <> 'reviewed' then
    perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
  end if;

  if exists (
    select 1
      from public.community_registration_reviews cr
     where cr.campaign_unit_id = v_unit.id
       and cr.decision = 'correction_requested'
       and cr.is_current
       and cr.resolution_status = 'pending'
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CORRECTION_REQUIRED', 'P0409');
  end if;

  if exists (
    select 1
      from public.community_registration_access_tokens t
     where t.campaign_id = v_campaign.id
       and t.campaign_unit_id = v_unit.id
       and t.token_type = 'resident_edit'
       and t.status = 'active'
       and (t.expires_at is null or t.expires_at > now())
       and t.revoked_at is null
       and t.consumed_at is null
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_CONFLICT', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and campaign_id = v_campaign.id
     and status = 'reviewed'
   order by version_number desc
   limit 1
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_CONFLICT', 'P0409');
  end if;

  if exists (
    select 1
      from public.community_registration_submissions s
     where s.campaign_unit_id = v_unit.id
       and s.version_number > v_submission.version_number
       and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed')
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_CONFLICT', 'P0409');
  end if;

  -- Only now, once review is truly ready for external approval, promote the
  -- resident-provided unit identity into an operational house match/create.
  if v_unit.house_id is null then
    if v_campaign.registration_mode = 'resident_provided_units' then
      v_house_binding := public._cr_bind_operational_house_v1(v_unit.id);

      select * into v_unit
        from public.community_registration_units
       where id = v_unit.id
       for update;

      select * into v_submission
        from public.community_registration_submissions
       where id = v_submission.id
       for update;
    else
      perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_REQUIRED', 'P0409');
    end if;
  end if;

  if v_unit.house_id is null
     or v_submission.house_id is distinct from v_unit.house_id then
    perform public._cr_raise_v1('ENTRY_CR_OPERATIONAL_HOUSE_REQUIRED', 'P0409');
  end if;

  perform public._cr_replace_current_review_v1(v_unit.id);

  update public.community_registration_submissions
     set status = 'confirmed',
         patronato_confirmed_at = now(),
         patronato_confirmed_by = p_actor_user_id::text
   where id = v_submission.id;

  update public.community_registration_units
     set status = 'confirmed',
         patronato_confirmed_at = now(),
         patronato_confirmed_by = p_actor_user_id::text
   where id = v_unit.id;

  insert into public.community_registration_reviews (
    campaign_id,
    campaign_unit_id,
    submission_id,
    decision,
    actor_type,
    actor_user_id,
    resolution_status,
    resolved_at
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'confirmed',
    'entry_admin',
    p_actor_user_id,
    'resolved',
    now()
  );

  insert into public.community_registration_events (
    campaign_id,
    campaign_unit_id,
    submission_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'unit_confirmed',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'version', v_submission.version_number,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'confirmed',
      'campaign_status_preserved', v_campaign.status,
      'external_patronato_approval', true,
      'operational_house_id', v_unit.house_id,
      'operational_house_action', nullif(v_house_binding->>'action', ''),
      'reason_length', length(v_reason)
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'already_confirmed', false,
    'unit_label', v_unit.unit_label_snapshot,
    'house_id', v_unit.house_id,
    'house_binding_action', nullif(v_house_binding->>'action', ''),
    'version', v_submission.version_number,
    'campaign_status', v_campaign.status
  );
end;
$function$;

-- Repair any already-confirmed/processed resident-provided units that were
-- allowed through before the operational-house bridge existed.
do $block$
declare
  v_row record;
begin
  for v_row in
    select u.id
      from public.community_registration_units u
      join public.community_registration_campaigns c
        on c.id = u.campaign_id
     where c.registration_mode = 'resident_provided_units'
       and u.house_id is null
       and u.status in ('confirmed', 'processed')
       and exists (
         select 1
           from public.community_registration_submissions s
          where s.campaign_unit_id = u.id
            and s.patronato_confirmed_at is not null
            and s.status in ('confirmed', 'converted')
       )
  loop
    perform public._cr_bind_operational_house_v1(v_row.id);
  end loop;
end;
$block$;

-- Defense in depth: no confirmed/processed registration or registration-created
-- activation queue row may exist without an operational house identity.
alter table public.community_registration_units
  drop constraint if exists cr_units_terminal_requires_house;
alter table public.community_registration_units
  add constraint cr_units_terminal_requires_house
  check (status not in ('confirmed', 'processed') or house_id is not null)
  not valid;
alter table public.community_registration_units
  validate constraint cr_units_terminal_requires_house;

alter table public.community_registration_submissions
  drop constraint if exists cr_submissions_terminal_requires_house;
alter table public.community_registration_submissions
  add constraint cr_submissions_terminal_requires_house
  check (status not in ('confirmed', 'converted') or house_id is not null)
  not valid;
alter table public.community_registration_submissions
  validate constraint cr_submissions_terminal_requires_house;

alter table public.resident_activation_queue
  drop constraint if exists raq_registration_source_requires_house;
alter table public.resident_activation_queue
  add constraint raq_registration_source_requires_house
  check (source is distinct from 'community_registration_v1' or house_id is not null)
  not valid;
alter table public.resident_activation_queue
  validate constraint raq_registration_source_requires_house;
