-- ENTRY protected duplicate merge for an operational canonical household.
-- The operational household, its existing residents, queue rows, PINs, users and
-- access identity are never rewritten. Only explicitly selected residents from
-- the lower-stage Submitted duplicate are copied into the canonical registration
-- and added to Activation Queue as new pending residents.

create or replace function public.protected_merge_community_registration_duplicate_v1(
  p_campaign_id uuid,
  p_canonical_unit_id uuid,
  p_duplicate_unit_id uuid,
  p_actor_user_id uuid,
  p_selected_resident_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_canonical public.community_registration_units%rowtype;
  v_duplicate public.community_registration_units%rowtype;
  v_canonical_submission public.community_registration_submissions%rowtype;
  v_duplicate_submission public.community_registration_submissions%rowtype;
  v_source public.community_registration_residents%rowtype;
  v_new_resident_id uuid;
  v_queue_id uuid;
  v_next_position integer;
  v_method text;
  v_username text;
  v_low uuid;
  v_high uuid;
  v_added integer := 0;
  v_selected uuid;
  v_selected_ids uuid[] := array[]::uuid[];
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_UNAUTHORIZED', '42501');
  end if;

  if p_campaign_id is null
     or p_canonical_unit_id is null
     or p_duplicate_unit_id is null
     or p_canonical_unit_id = p_duplicate_unit_id then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_PAIR', 'P0409');
  end if;

  if coalesce(array_length(p_selected_resident_ids, 1), 0) < 1 then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_PROTECTED_SELECTION_REQUIRED', 'P0409');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found
     or v_campaign.registration_mode <> 'resident_provided_units'
     or v_campaign.status not in ('open', 'review', 'confirmed') then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  perform 1
    from public.community_registration_units
   where id in (p_canonical_unit_id, p_duplicate_unit_id)
   order by id
   for update;

  select * into v_canonical from public.community_registration_units
   where id = p_canonical_unit_id;
  select * into v_duplicate from public.community_registration_units
   where id = p_duplicate_unit_id;

  if v_canonical.id is null
     or v_duplicate.id is null
     or v_canonical.campaign_id <> v_campaign.id
     or v_duplicate.campaign_id <> v_campaign.id
     or v_canonical.community_id <> v_campaign.community_id
     or v_duplicate.community_id <> v_campaign.community_id
     or v_duplicate.status <> 'submitted'
     or v_duplicate.house_id is not null then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  -- Canonical must already be operational; duplicate must not be.
  if not (
    v_canonical.status = 'processed'
    or exists (
      select 1
        from public.resident_activation_queue q
        left join public.community_registration_residents r
          on r.id = q.community_registration_resident_id
       where q.community_id = v_campaign.community_id
         and (
           r.campaign_unit_id = v_canonical.id
           or public.normalize_unit_label(q.unit_label)
              = public.normalize_unit_label(v_canonical.unit_label_snapshot)
         )
         and q.status in ('pending','invited','pin_generated','activated','failed','skipped')
    )
  ) then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  if exists (
    select 1
      from public.resident_activation_queue q
      left join public.community_registration_residents r
        on r.id = q.community_registration_resident_id
     where q.community_id = v_campaign.community_id
       and (
         r.campaign_unit_id = v_duplicate.id
         or public.normalize_unit_label(q.unit_label)
            = public.normalize_unit_label(v_duplicate.unit_label_snapshot)
       )
       and q.status in ('pending','invited','pin_generated','activated','failed','skipped')
  ) then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_MANUAL_IDENTITY_REVIEW_REQUIRED', 'P0409');
  end if;

  select * into v_canonical_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_canonical.id
     and status in ('submitted','edit_enabled','reviewed','confirmed','converted')
   order by version_number desc
   limit 1
   for update;

  select * into v_duplicate_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_duplicate.id
     and status = 'submitted'
   order by version_number desc
   limit 1
   for update;

  if v_canonical_submission.id is null or v_duplicate_submission.id is null then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  select coalesce(max(position), 0)
    into v_next_position
    from public.community_registration_residents
   where submission_id = v_canonical_submission.id;

  foreach v_selected in array p_selected_resident_ids loop
    if v_selected = any(v_selected_ids) then
      continue;
    end if;
    v_selected_ids := array_append(v_selected_ids, v_selected);

    select * into v_source
      from public.community_registration_residents
     where id = v_selected
       and submission_id = v_duplicate_submission.id
     for update;

    if not found then
      perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_PROTECTED_SELECTION_REQUIRED', 'P0409');
    end if;

    -- Never add a resident that already matches a canonical resident.
    if exists (
      select 1
        from public.community_registration_residents c
       where c.submission_id = v_canonical_submission.id
         and public._cr_duplicate_names_compatible_v1(c.full_name, v_source.full_name)
         and (
           (c.normalized_email is not null and c.normalized_email = v_source.normalized_email)
           or
           (c.normalized_phone is not null and c.normalized_phone = v_source.normalized_phone)
         )
    ) then
      perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_PROTECTED_RESIDENT_CONFLICT', 'P0409');
    end if;

    -- New residents must not already own operational identity or queue state.
    if exists (
      select 1 from public.resident_activation_queue q
       where q.community_id = v_campaign.community_id
         and q.status in ('pending','invited','pin_generated','activated','failed','skipped')
         and (
           (v_source.normalized_email is not null
             and public._cr_conversion_normalize_email_v1(q.email) = v_source.normalized_email)
           or
           (v_source.normalized_phone is not null
             and public._cr_conversion_normalize_phone_v1(q.phone) = v_source.normalized_phone)
         )
    ) or exists (
      select 1 from auth.users au
       where v_source.normalized_email is not null
         and public._cr_conversion_normalize_email_v1(au.email::text) = v_source.normalized_email
    ) then
      perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_PROTECTED_RESIDENT_CONFLICT', 'P0409');
    end if;

    v_next_position := v_next_position + 1;
    if v_next_position > 20 then
      perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_LIMIT', 'P0409');
    end if;

    insert into public.community_registration_residents (
      submission_id, campaign_id, community_id, campaign_unit_id, house_id,
      position, full_name, email, phone, normalized_full_name, normalized_email,
      normalized_phone, relationship_to_house, is_owner_reference,
      validation_status, conversion_status
    ) values (
      v_canonical_submission.id, v_campaign.id, v_campaign.community_id,
      v_canonical.id, v_canonical.house_id, v_next_position, v_source.full_name,
      v_source.email, v_source.phone, v_source.normalized_full_name,
      v_source.normalized_email, v_source.normalized_phone,
      v_source.relationship_to_house, v_source.is_owner_reference,
      'valid', 'pending'
    )
    returning id into v_new_resident_id;

    v_method := public._cr_conversion_activation_method_v1(v_source.email, v_source.phone);
    v_username := public._cr_conversion_suggest_username_v1(
      v_source.full_name, v_campaign.community_id, v_new_resident_id
    );

    insert into public.resident_activation_queue (
      community_id, house_id, unit_label, resident_name, phone, email,
      is_owner_reference, suggested_username, activation_method, status,
      source, raw_data, created_by, community_registration_resident_id
    ) values (
      v_campaign.community_id, v_canonical.house_id,
      v_canonical.unit_label_snapshot, v_source.full_name, v_source.phone,
      public._cr_conversion_normalize_email_v1(v_source.email),
      coalesce(v_source.is_owner_reference, false), v_username, v_method,
      'pending', 'community_registration_protected_merge_v1',
      jsonb_build_object(
        'source_version','protected_merge_v1',
        'campaign_id',v_campaign.id,
        'canonical_campaign_unit_id',v_canonical.id,
        'duplicate_campaign_unit_id',v_duplicate.id,
        'source_duplicate_resident_id',v_source.id,
        'community_registration_resident_id',v_new_resident_id
      ),
      p_actor_user_id, v_new_resident_id
    )
    returning id into v_queue_id;

    update public.community_registration_residents
       set activation_queue_id = v_queue_id,
           conversion_status = 'converted',
           conversion_attempt_count = conversion_attempt_count + 1,
           conversion_last_error = null,
           conversion_last_attempted_at = now(),
           conversion_actor_user_id = p_actor_user_id,
           converted_at = now(),
           updated_at = now()
     where id = v_new_resident_id;

    v_added := v_added + 1;
  end loop;

  if v_added < 1 then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_PROTECTED_SELECTION_REQUIRED', 'P0409');
  end if;

  update public.community_registration_submissions
     set status = 'invalidated',
         invalidated_at = now(),
         invalidated_reason = 'Protected merge into operational household ' || v_canonical.id::text,
         updated_at = now()
   where id = v_duplicate_submission.id;

  update public.community_registration_units
     set status = 'merged', updated_at = now()
   where id = v_duplicate.id;

  if p_canonical_unit_id::text < p_duplicate_unit_id::text then
    v_low := p_canonical_unit_id; v_high := p_duplicate_unit_id;
  else
    v_low := p_duplicate_unit_id; v_high := p_canonical_unit_id;
  end if;

  insert into public.community_registration_duplicate_resolutions (
    campaign_id, community_id, unit_low_id, unit_high_id, resolution_type,
    canonical_unit_id, duplicate_unit_id, metadata, resolved_by, resolved_at, updated_at
  ) values (
    v_campaign.id, v_campaign.community_id, v_low, v_high, 'resolved_duplicate',
    v_canonical.id, v_duplicate.id,
    jsonb_build_object(
      'resolution_path','protected_merge',
      'canonical_lifecycle','Operational protected',
      'added_resident_count',v_added,
      'selected_source_resident_ids',to_jsonb(v_selected_ids),
      'canonical_identity_preserved',true,
      'activation_queue_preserved',true
    ),
    p_actor_user_id, now(), now()
  )
  on conflict (campaign_id, unit_low_id, unit_high_id)
  do update set
    resolution_type = excluded.resolution_type,
    canonical_unit_id = excluded.canonical_unit_id,
    duplicate_unit_id = excluded.duplicate_unit_id,
    metadata = excluded.metadata,
    resolved_by = excluded.resolved_by,
    resolved_at = excluded.resolved_at,
    updated_at = now();

  return jsonb_build_object(
    'resolution','protected_merge',
    'canonical_unit_id',v_canonical.id,
    'duplicate_unit_id',v_duplicate.id,
    'added_resident_count',v_added
  );
end;
$function$;

revoke all on function public.protected_merge_community_registration_duplicate_v1(
  uuid, uuid, uuid, uuid, uuid[]
) from public, anon, authenticated;
grant execute on function public.protected_merge_community_registration_duplicate_v1(
  uuid, uuid, uuid, uuid, uuid[]
) to service_role;

comment on function public.protected_merge_community_registration_duplicate_v1(
  uuid, uuid, uuid, uuid, uuid[]
) is
  'ENTRY internal RPC. Adds explicitly selected unique residents from a Submitted duplicate into an operational canonical household without rewriting existing canonical identity, queue rows, PINs, users or access state; new residents enter Activation Queue as pending and the duplicate is archived.';
