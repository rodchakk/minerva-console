-- ENTRY Patronato progressive mobile review.
--
-- Keeps Resident Registration campaigns open while individual reviewed units are
-- approved by Patronato, adds an auditable "hold" decision, and exposes one
-- privacy-minimized service-role RPC for the mobile Patronato review surface.
--
-- Security:
-- - all RPCs remain service_role-only; the browser never receives Supabase keys
-- - public access is mediated by a high-entropy patronato_review token hash
-- - Patronato receives names/unit context only, never email/phone credentials
-- - approval binds resident-provided units to an operational house before RAQ

alter table public.community_registration_reviews
  drop constraint if exists cr_reviews_decision_check;

alter table public.community_registration_reviews
  add constraint cr_reviews_decision_check
  check (decision in ('reviewed', 'correction_requested', 'confirmed', 'patronato_hold'));

alter table public.community_registration_reviews
  drop constraint if exists cr_reviews_pending_only_for_correction;

alter table public.community_registration_reviews
  add constraint cr_reviews_pending_only_for_correction
  check (
    resolution_status <> 'pending'
    or decision in ('correction_requested', 'patronato_hold')
  );

alter table public.community_registration_events
  drop constraint if exists cr_events_type_check;

alter table public.community_registration_events
  add constraint cr_events_type_check
  check (event_type in (
    'campaign_created',
    'campaign_opened',
    'campaign_paused',
    'campaign_closed',
    'campaign_cancelled',
    'units_added',
    'household_submitted',
    'resident_edit_enabled',
    'resident_edit_token_revoked',
    'resident_edit_access_replaced',
    'household_resubmitted',
    'registration_reset',
    'unit_submitted',
    'edit_enabled',
    'edit_revoked',
    'submission_resubmitted',
    'unit_reset',
    'internal_correction',
    'marked_for_correction',
    'internal_reviewed',
    'patronato_confirmed',
    'conversion_prepared',
    'conversion_failed',
    'patronato_access_created',
    'patronato_access_revoked',
    'campaign_review_started',
    'unit_reviewed',
    'correction_requested',
    'unit_confirmed',
    'patronato_hold',
    'incomplete_confirmation_authorized',
    'campaign_confirmed',
    'resident_conversion_created',
    'resident_conversion_reused_queue',
    'resident_conversion_already_active',
    'resident_conversion_blocked',
    'unit_conversion_attempted',
    'unit_conversion_completed',
    'campaign_processing_completed',
    'campaign_access_replaced'
  ));

create or replace function public.confirm_community_registration_unit_v1(
  p_campaign_id uuid,
  p_campaign_unit_id uuid,
  p_patronato_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_house_binding jsonb := '{}'::jsonb;
begin
  perform public._cr_service_role_only_v1();

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found or v_campaign.status not in ('open', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  v_token := public._cr_patronato_token_v1(
    v_campaign.id,
    p_patronato_token_hash
  );

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  if v_unit.status in ('confirmed', 'processed') then
    return jsonb_build_object(
      'status', v_unit.status,
      'already_confirmed', true,
      'unit_label', v_unit.unit_label_snapshot,
      'house_id', v_unit.house_id
    );
  end if;

  if v_unit.status <> 'reviewed' then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_CONFLICT', 'P0409');
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
     where t.campaign_id = v_unit.campaign_id
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

  if v_unit.house_id is null then
    if v_campaign.registration_mode = 'resident_provided_units' then
      v_house_binding := public._cr_bind_operational_house_v1(v_unit.id);

      select * into v_unit
        from public.community_registration_units
       where id = p_campaign_unit_id
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
         patronato_confirmed_by = v_token.id::text
   where id = v_submission.id;

  update public.community_registration_units
     set status = 'confirmed',
         patronato_confirmed_at = now(),
         patronato_confirmed_by = v_token.id::text
   where id = v_unit.id;

  insert into public.community_registration_reviews (
    campaign_id,
    campaign_unit_id,
    submission_id,
    decision,
    actor_type,
    access_token_id,
    resolution_status,
    resolved_at
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'confirmed',
    'patronato',
    v_token.id,
    'resolved',
    now()
  );

  insert into public.community_registration_events (
    campaign_id,
    campaign_unit_id,
    submission_id,
    event_type,
    actor_type,
    access_token_id,
    metadata
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'unit_confirmed',
    'patronato_token',
    v_token.id,
    jsonb_build_object(
      'version', v_submission.version_number,
      'previous_unit_status', 'reviewed',
      'new_unit_status', 'confirmed',
      'campaign_status_preserved', v_campaign.status,
      'operational_house_id', v_unit.house_id,
      'operational_house_action', nullif(v_house_binding->>'action', '')
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

create or replace function public.set_community_registration_unit_patronato_hold_v1(
  p_campaign_id uuid,
  p_campaign_unit_id uuid,
  p_patronato_token_hash text,
  p_observation text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_current public.community_registration_reviews%rowtype;
  v_observation text := nullif(btrim(coalesce(p_observation, '')), '');
begin
  perform public._cr_service_role_only_v1();

  if v_observation is not null and length(v_observation) > 1000 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_OBSERVATION', 'P0409');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found or v_campaign.status not in ('open', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  v_token := public._cr_patronato_token_v1(
    v_campaign.id,
    p_patronato_token_hash
  );

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found or v_unit.status <> 'reviewed' then
    perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
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

  select * into v_current
    from public.community_registration_reviews
   where campaign_unit_id = v_unit.id
     and is_current
   order by created_at desc
   limit 1;

  if found
     and v_current.decision = 'patronato_hold'
     and v_current.resolution_status = 'pending'
     and coalesce(v_current.observation_text, '') = coalesce(v_observation, '') then
    return jsonb_build_object(
      'status', 'reviewed',
      'review_state', 'hold',
      'already_held', true,
      'unit_label', v_unit.unit_label_snapshot
    );
  end if;

  perform public._cr_replace_current_review_v1(v_unit.id);

  insert into public.community_registration_reviews (
    campaign_id,
    campaign_unit_id,
    submission_id,
    decision,
    actor_type,
    access_token_id,
    observation_text,
    resolution_status
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'patronato_hold',
    'patronato',
    v_token.id,
    v_observation,
    'pending'
  );

  insert into public.community_registration_events (
    campaign_id,
    campaign_unit_id,
    submission_id,
    event_type,
    actor_type,
    access_token_id,
    metadata
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'patronato_hold',
    'patronato_token',
    v_token.id,
    jsonb_build_object(
      'version', v_submission.version_number,
      'campaign_status_preserved', v_campaign.status,
      'observation_present', v_observation is not null
    )
  );

  return jsonb_build_object(
    'status', 'reviewed',
    'review_state', 'hold',
    'already_held', false,
    'unit_label', v_unit.unit_label_snapshot
  );
end;
$function$;

create or replace function public.confirm_community_registration_units_v2(
  p_campaign_id uuid,
  p_campaign_unit_ids uuid[],
  p_patronato_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_ids uuid[];
  v_id uuid;
  v_status text;
  v_confirmed integer := 0;
  v_already_complete integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  perform public._cr_service_role_only_v1();

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id;

  if not found or v_campaign.status not in ('open', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  perform public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);

  select array_agg(id order by id)
    into v_ids
    from (
      select distinct unnest(coalesce(p_campaign_unit_ids, '{}'::uuid[])) as id
    ) deduped
   where id is not null;

  if coalesce(array_length(v_ids, 1), 0) = 0
     or array_length(v_ids, 1) > 100 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT', 'P0409');
  end if;

  foreach v_id in array v_ids loop
    select status into v_status
      from public.community_registration_units
     where id = v_id
       and campaign_id = v_campaign.id;

    if not found then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT', 'P0409');
    end if;

    if v_status in ('confirmed', 'processed') then
      v_already_complete := v_already_complete + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object('campaign_unit_id', v_id, 'status', v_status)
      );
    elsif v_status = 'reviewed' then
      v_result := public.confirm_community_registration_unit_v1(
        v_campaign.id,
        v_id,
        p_patronato_token_hash
      );
      v_confirmed := v_confirmed + 1;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'campaign_unit_id', v_id,
          'status', coalesce(v_result->>'status', 'confirmed')
        )
      );
    else
      perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
    end if;
  end loop;

  return jsonb_build_object(
    'confirmed_count', v_confirmed,
    'already_complete_count', v_already_complete,
    'results', v_results
  );
end;
$function$;

create or replace function public.set_community_registration_units_patronato_hold_v1(
  p_campaign_id uuid,
  p_campaign_unit_ids uuid[],
  p_patronato_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_ids uuid[];
  v_id uuid;
  v_status text;
  v_current_decision text;
  v_current_resolution text;
  v_held integer := 0;
  v_already_held integer := 0;
begin
  perform public._cr_service_role_only_v1();

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id;

  if not found or v_campaign.status not in ('open', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  perform public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);

  select array_agg(id order by id)
    into v_ids
    from (
      select distinct unnest(coalesce(p_campaign_unit_ids, '{}'::uuid[])) as id
    ) deduped
   where id is not null;

  if coalesce(array_length(v_ids, 1), 0) = 0
     or array_length(v_ids, 1) > 100 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT', 'P0409');
  end if;

  foreach v_id in array v_ids loop
    select status into v_status
      from public.community_registration_units
     where id = v_id
       and campaign_id = v_campaign.id;

    if not found or v_status <> 'reviewed' then
      perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
    end if;

    select decision, resolution_status
      into v_current_decision, v_current_resolution
      from public.community_registration_reviews
     where campaign_unit_id = v_id
       and is_current
     order by created_at desc
     limit 1;

    if found
       and v_current_decision = 'patronato_hold'
       and v_current_resolution = 'pending' then
      v_already_held := v_already_held + 1;
    else
      perform public.set_community_registration_unit_patronato_hold_v1(
        v_campaign.id,
        v_id,
        p_patronato_token_hash,
        null
      );
      v_held := v_held + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'held_count', v_held,
    'already_held_count', v_already_held
  );
end;
$function$;

create or replace function public.list_community_registration_patronato_units_v1(
  p_patronato_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token public.community_registration_access_tokens%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_community_name text;
  v_units jsonb := '[]'::jsonb;
  v_pending integer := 0;
  v_hold integer := 0;
  v_approved integer := 0;
  v_processed integer := 0;
begin
  perform public._cr_service_role_only_v1();

  select * into v_token
    from public.community_registration_access_tokens
   where token_hash = btrim(coalesce(p_patronato_token_hash, ''))
     and token_type = 'patronato_review'
   limit 1;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_INVALID', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_token.campaign_id;

  if not found or v_campaign.status not in ('open', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_INVALID', '42501');
  end if;

  v_token := public._cr_patronato_token_v1(
    v_campaign.id,
    p_patronato_token_hash
  );

  select name into v_community_name
    from public.communities
   where id = v_campaign.community_id;

  with review_units as (
    select
      u.id,
      u.unit_label_snapshot,
      coalesce(u.unit_reference_snapshot, u.public_reference) as unit_reference,
      u.status,
      u.reviewed_at,
      u.patronato_confirmed_at,
      s.id as submission_id,
      cr.decision as current_decision,
      cr.resolution_status as current_resolution,
      cr.observation_text as current_observation,
      case
        when u.status = 'processed' then 'processed'
        when u.status = 'confirmed' then 'approved'
        when cr.decision = 'patronato_hold'
             and cr.resolution_status = 'pending' then 'hold'
        else 'pending'
      end as review_state,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'full_name', r.full_name,
            'position', r.position,
            'is_primary', coalesce(r.is_owner_reference, false)
          )
          order by r.position, r.id
        )
        from public.community_registration_residents r
        where r.submission_id = s.id
      ), '[]'::jsonb) as residents
    from public.community_registration_units u
    left join lateral (
      select sub.*
        from public.community_registration_submissions sub
       where sub.campaign_unit_id = u.id
         and sub.status in ('reviewed', 'confirmed', 'converted')
       order by sub.version_number desc
       limit 1
    ) s on true
    left join lateral (
      select review.*
        from public.community_registration_reviews review
       where review.campaign_unit_id = u.id
         and review.is_current
       order by review.created_at desc
       limit 1
    ) cr on true
    where u.campaign_id = v_campaign.id
      and u.status in ('reviewed', 'confirmed', 'processed')
      and s.id is not null
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'unit_id', ru.id,
        'unit_label', ru.unit_label_snapshot,
        'unit_reference', ru.unit_reference,
        'status', ru.status,
        'review_state', ru.review_state,
        'reviewed_at', ru.reviewed_at,
        'patronato_confirmed_at', ru.patronato_confirmed_at,
        'hold_note', case when ru.review_state = 'hold' then ru.current_observation else null end,
        'resident_count', jsonb_array_length(ru.residents),
        'residents', ru.residents
      )
      order by
        case ru.review_state
          when 'pending' then 1
          when 'hold' then 2
          when 'approved' then 3
          else 4
        end,
        public.normalize_unit_label(ru.unit_label_snapshot),
        ru.id
    ), '[]'::jsonb),
    count(*) filter (where ru.review_state = 'pending')::integer,
    count(*) filter (where ru.review_state = 'hold')::integer,
    count(*) filter (where ru.review_state = 'approved')::integer,
    count(*) filter (where ru.review_state = 'processed')::integer
  into v_units, v_pending, v_hold, v_approved, v_processed
  from review_units ru;

  return jsonb_build_object(
    'valid', true,
    'campaign_id', v_campaign.id,
    'community_id', v_campaign.community_id,
    'community_name', v_community_name,
    'public_title', v_campaign.public_title,
    'campaign_status', v_campaign.status,
    'expires_at', v_token.expires_at,
    'summary', jsonb_build_object(
      'pending', v_pending,
      'hold', v_hold,
      'approved', v_approved,
      'processed', v_processed
    ),
    'units', v_units
  );
end;
$function$;

revoke execute on function public.confirm_community_registration_unit_v1(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.confirm_community_registration_unit_v1(uuid, uuid, text)
  to service_role;

revoke execute on function public.set_community_registration_unit_patronato_hold_v1(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.set_community_registration_unit_patronato_hold_v1(uuid, uuid, text, text)
  to service_role;

revoke execute on function public.confirm_community_registration_units_v2(uuid, uuid[], text)
  from public, anon, authenticated;
grant execute on function public.confirm_community_registration_units_v2(uuid, uuid[], text)
  to service_role;

revoke execute on function public.set_community_registration_units_patronato_hold_v1(uuid, uuid[], text)
  from public, anon, authenticated;
grant execute on function public.set_community_registration_units_patronato_hold_v1(uuid, uuid[], text)
  to service_role;

revoke execute on function public.list_community_registration_patronato_units_v1(text)
  from public, anon, authenticated;
grant execute on function public.list_community_registration_patronato_units_v1(text)
  to service_role;

comment on function public.list_community_registration_patronato_units_v1(text) is
  'Privacy-minimized mobile Patronato review read model. Returns only reviewed/approved/processed units and resident names through a validated patronato_review token.';

comment on function public.confirm_community_registration_units_v2(uuid, uuid[], text) is
  'Atomic progressive Patronato approval for up to 100 reviewed units while the Resident Registration campaign remains open or in review.';
