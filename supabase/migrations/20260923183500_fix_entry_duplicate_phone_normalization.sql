-- Hotfix: duplicate resolution must compare Honduras phone identities the same
-- way the Console review UI does. Resident registration intentionally preserves
-- the submitted phone format, so +50433049112 and 33049112 can coexist in old
-- submissions even though they refer to the same number.
--
-- Keep this duplicate-specific instead of changing _cr_normalize_phone_v1
-- globally; that avoids rewriting historical registration normalization rules.

create or replace function public._cr_duplicate_normalize_phone_v1(
  p_phone text
)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  with normalized as (
    select regexp_replace(btrim(coalesce(p_phone, '')), '[^0-9]', '', 'g') as digits
  )
  select nullif(
    case
      when length(digits) = 11 and left(digits, 3) = '504'
        then substring(digits from 4)
      else digits
    end,
    ''
  )
  from normalized;
$function$;

revoke all on function public._cr_duplicate_normalize_phone_v1(text) from public;
revoke all on function public._cr_duplicate_normalize_phone_v1(text) from anon;
revoke all on function public._cr_duplicate_normalize_phone_v1(text) from authenticated;

create or replace function public.merge_community_registration_units_v1(
  p_campaign_id uuid,
  p_canonical_unit_id uuid,
  p_duplicate_unit_id uuid,
  p_actor_user_id uuid,
  p_resident_plan jsonb default '{}'::jsonb
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
  v_existing_resolution public.community_registration_duplicate_resolutions%rowtype;
  v_low uuid;
  v_high uuid;
  v_new_submission_id uuid;
  v_next_version integer;
  v_next_position integer := 0;
  v_merged_resident_count integer := 0;
  v_unified_count integer := 0;
  v_appended_count integer := 0;
  v_match_id uuid;
  v_plan_decision jsonb;
  v_plan_decisions jsonb;
  v_decision text;
  v_resident public.community_registration_residents%rowtype;
  v_source_match public.community_registration_residents%rowtype;
  v_auto_merge boolean;
  v_ambiguous boolean;
  v_same_email boolean;
  v_same_phone boolean;
  v_same_name boolean;
  v_names_compatible boolean;
  v_email_choice text;
  v_phone_choice text;
  v_result_email text;
  v_result_phone text;
  v_result_full_name text;
  v_server_plan jsonb := '[]'::jsonb;
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

  if p_resident_plan is null or jsonb_typeof(p_resident_plan) <> 'object' then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_PLAN_REQUIRED', 'P0409');
  end if;

  v_plan_decisions := coalesce(p_resident_plan->'decisions', '[]'::jsonb);
  if jsonb_typeof(v_plan_decisions) <> 'array' then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_PLAN_REQUIRED', 'P0409');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_DIFFERENT_CAMPAIGN', 'P0409');
  end if;

  if v_campaign.registration_mode <> 'resident_provided_units' then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_NOT_RESIDENT_PROVIDED', 'P0409');
  end if;

  if v_campaign.status not in ('open', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  perform 1
    from public.community_registration_units
   where id in (p_canonical_unit_id, p_duplicate_unit_id)
   order by id
   for update;

  select * into v_canonical
    from public.community_registration_units
   where id = p_canonical_unit_id;

  select * into v_duplicate
    from public.community_registration_units
   where id = p_duplicate_unit_id;

  if v_canonical.id is null
     or v_duplicate.id is null
     or v_canonical.campaign_id <> v_campaign.id
     or v_duplicate.campaign_id <> v_campaign.id
     or v_canonical.community_id <> v_campaign.community_id
     or v_duplicate.community_id <> v_campaign.community_id then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_DIFFERENT_CAMPAIGN', 'P0409');
  end if;

  if v_canonical.status <> 'submitted'
     or v_duplicate.status <> 'submitted'
     or v_canonical.house_id is not null
     or v_duplicate.house_id is not null then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  if exists (
    select 1
      from public.resident_activation_queue q
      join public.community_registration_residents r
        on r.id = q.community_registration_resident_id
     where r.campaign_unit_id in (p_canonical_unit_id, p_duplicate_unit_id)
  ) or exists (
    select 1
      from public.resident_activation_queue q
     where q.community_id = v_campaign.community_id
       and q.status in ('pending', 'invited', 'pin_generated', 'activated', 'failed', 'skipped')
       and public.normalize_unit_label(q.unit_label) in (
         public.normalize_unit_label(v_canonical.unit_label_snapshot),
         public.normalize_unit_label(v_duplicate.unit_label_snapshot)
       )
  ) then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_ALREADY_ACTIVATED', 'P0409');
  end if;

  select * into v_canonical_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_canonical.id
     and status = 'submitted'
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

  if exists (
    select 1
      from jsonb_array_elements(v_plan_decisions) item(value)
      left join public.community_registration_residents duplicate_resident
        on duplicate_resident.id = nullif(item.value->>'duplicateResidentId', '')::uuid
       and duplicate_resident.submission_id = v_duplicate_submission.id
      left join public.community_registration_residents canonical_resident
        on canonical_resident.id = nullif(item.value->>'canonicalResidentId', '')::uuid
       and canonical_resident.submission_id = v_canonical_submission.id
     where coalesce(item.value->>'decision', '') not in ('merge', 'keep_separate')
        or duplicate_resident.id is null
        or canonical_resident.id is null
  ) then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_PLAN_REQUIRED', 'P0409');
  end if;

  if p_canonical_unit_id::text < p_duplicate_unit_id::text then
    v_low := p_canonical_unit_id;
    v_high := p_duplicate_unit_id;
  else
    v_low := p_duplicate_unit_id;
    v_high := p_canonical_unit_id;
  end if;

  select * into v_existing_resolution
    from public.community_registration_duplicate_resolutions
   where campaign_id = v_campaign.id
     and unit_low_id = v_low
     and unit_high_id = v_high
   for update;

  if found and v_existing_resolution.resolution_type in ('merged', 'resolved_duplicate') then
    if v_existing_resolution.resolution_type = 'merged'
       and v_existing_resolution.canonical_unit_id = p_canonical_unit_id
       and v_existing_resolution.duplicate_unit_id = p_duplicate_unit_id then
      return jsonb_build_object(
        'already_complete', true,
        'canonical_unit_id', p_canonical_unit_id,
        'duplicate_unit_id', p_duplicate_unit_id
      );
    end if;

    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_version
    from public.community_registration_submissions
   where campaign_unit_id = v_canonical.id;

  -- Free the one-active-submission slot before inserting the merged version.
  -- This is transaction-safe: any later failure rolls this status change back.
  update public.community_registration_submissions
     set status = 'superseded',
         updated_at = now()
   where id = v_canonical_submission.id;

  insert into public.community_registration_submissions (
    campaign_unit_id,
    campaign_id,
    community_id,
    house_id,
    version_number,
    status,
    submitted_at,
    locked_at,
    previous_submission_id
  )
  values (
    v_canonical.id,
    v_campaign.id,
    v_campaign.community_id,
    null,
    v_next_version,
    'submitted',
    now(),
    now(),
    v_canonical_submission.id
  )
  returning id into v_new_submission_id;

  insert into public.community_registration_residents (
    submission_id,
    campaign_id,
    community_id,
    campaign_unit_id,
    house_id,
    position,
    full_name,
    email,
    phone,
    normalized_full_name,
    normalized_email,
    normalized_phone,
    relationship_to_house,
    is_owner_reference,
    validation_status
  )
  select
    v_new_submission_id,
    v_campaign.id,
    v_campaign.community_id,
    v_canonical.id,
    null,
    r.position,
    r.full_name,
    r.email,
    r.phone,
    r.normalized_full_name,
    r.normalized_email,
    r.normalized_phone,
    r.relationship_to_house,
    r.is_owner_reference,
    'valid'
  from public.community_registration_residents r
  where r.submission_id = v_canonical_submission.id
  order by r.position, r.id;

  select coalesce(max(position), 0)
    into v_next_position
    from public.community_registration_residents
   where submission_id = v_new_submission_id;

  for v_resident in
    select *
      from public.community_registration_residents
     where submission_id = v_duplicate_submission.id
     order by position, id
  loop
    v_source_match := null;
    v_plan_decision := null;
    v_decision := 'keep_separate';
    v_auto_merge := false;
    v_ambiguous := false;

    select source.*
      into v_source_match
      from public.community_registration_residents source
     where source.submission_id = v_canonical_submission.id
       and public._cr_duplicate_names_compatible_v1(
         source.full_name,
         v_resident.full_name
       )
       and (
         (
           source.normalized_email is not null
           and source.normalized_email = v_resident.normalized_email
         )
         or
         (
           public._cr_duplicate_normalize_phone_v1(source.phone) is not null
           and public._cr_duplicate_normalize_phone_v1(source.phone)
               = public._cr_duplicate_normalize_phone_v1(v_resident.phone)
         )
       )
     order by
       case
         when source.normalized_full_name = v_resident.normalized_full_name
              and source.normalized_email is not null
              and source.normalized_email = v_resident.normalized_email
              and source.normalized_phone is not null
              and source.normalized_phone = v_resident.normalized_phone then 100
         when source.normalized_full_name = v_resident.normalized_full_name then 90
         when source.normalized_email is not null
              and source.normalized_email = v_resident.normalized_email
              and source.normalized_phone is not null
              and source.normalized_phone = v_resident.normalized_phone then 80
         else 60
       end desc,
       source.position,
       source.id
     limit 1;

    if v_source_match.id is not null then
      v_same_name := coalesce(
        v_source_match.normalized_full_name = v_resident.normalized_full_name,
        false
      );
      v_names_compatible := public._cr_duplicate_names_compatible_v1(
        v_source_match.full_name,
        v_resident.full_name
      );
      v_same_email := coalesce(
        v_source_match.normalized_email = v_resident.normalized_email,
        false
      );
      v_same_phone := coalesce(
        public._cr_duplicate_normalize_phone_v1(v_source_match.phone)
          = public._cr_duplicate_normalize_phone_v1(v_resident.phone),
        false
      );

      v_auto_merge :=
        (v_same_name and (v_same_email or v_same_phone))
        or (v_names_compatible and v_same_email and v_same_phone);
      v_ambiguous :=
        not v_auto_merge
        and v_names_compatible
        and (v_same_email or v_same_phone);

      select item.value
        into v_plan_decision
        from jsonb_array_elements(v_plan_decisions) item(value)
       where item.value->>'duplicateResidentId' = v_resident.id::text
       limit 1;

      if v_auto_merge then
        if v_plan_decision is not null
           and v_plan_decision->>'decision' = 'keep_separate' then
          v_decision := 'keep_separate';
        else
          v_decision := 'merge';
        end if;
      elsif v_ambiguous then
        if v_plan_decision is null then
          perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_UNRESOLVED', 'P0409');
        end if;
        v_decision := v_plan_decision->>'decision';
      else
        v_decision := 'keep_separate';
      end if;

      if v_decision = 'merge'
         and (
           v_plan_decision is not null
           and nullif(v_plan_decision->>'canonicalResidentId', '')::uuid <> v_source_match.id
         ) then
        perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_PLAN_REQUIRED', 'P0409');
      end if;
    end if;

    if v_decision = 'merge' and v_source_match.id is not null then
      if not public._cr_duplicate_names_compatible_v1(
        v_source_match.full_name,
        v_resident.full_name
      ) then
        perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_CONFLICT', 'P0409');
      end if;

      v_email_choice := lower(btrim(coalesce(v_plan_decision->>'emailChoice', '')));
      v_phone_choice := lower(btrim(coalesce(v_plan_decision->>'phoneChoice', '')));

      if v_source_match.email is not null
         and v_resident.email is not null
         and public._cr_normalize_email_v1(v_source_match.email)
             <> public._cr_normalize_email_v1(v_resident.email) then
        if v_email_choice not in ('canonical', 'duplicate') then
          perform public._cr_raise_v1(
            'ENTRY_CR_DUPLICATE_RESIDENT_FIELD_CONFLICT_UNRESOLVED',
            'P0409'
          );
        end if;

        v_result_email := case
          when v_email_choice = 'duplicate' then v_resident.email
          else v_source_match.email
        end;
      else
        v_result_email := coalesce(v_source_match.email, v_resident.email);
        v_email_choice := null;
      end if;

      if v_source_match.phone is not null
         and v_resident.phone is not null
         and public._cr_duplicate_normalize_phone_v1(v_source_match.phone)
             <> public._cr_duplicate_normalize_phone_v1(v_resident.phone) then
        if v_phone_choice not in ('canonical', 'duplicate') then
          perform public._cr_raise_v1(
            'ENTRY_CR_DUPLICATE_RESIDENT_FIELD_CONFLICT_UNRESOLVED',
            'P0409'
          );
        end if;

        v_result_phone := case
          when v_phone_choice = 'duplicate' then v_resident.phone
          else v_source_match.phone
        end;
      else
        v_result_phone := coalesce(v_source_match.phone, v_resident.phone);
        v_phone_choice := null;
      end if;
      v_result_full_name := case
        when length(public._cr_normalize_name_v1(v_resident.full_name))
             > length(public._cr_normalize_name_v1(v_source_match.full_name))
          then v_resident.full_name
        else v_source_match.full_name
      end;

      select copied.id
        into v_match_id
        from public.community_registration_residents copied
       where copied.submission_id = v_new_submission_id
         and copied.position = v_source_match.position
       order by copied.id
       limit 1;

      if v_match_id is null then
        perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_PLAN_REQUIRED', 'P0409');
      end if;

      update public.community_registration_residents
         set full_name = v_result_full_name,
             email = v_result_email,
             phone = v_result_phone,
             normalized_full_name = public._cr_normalize_name_v1(v_result_full_name),
             normalized_email = public._cr_normalize_email_v1(v_result_email),
             normalized_phone = public._cr_normalize_phone_v1(v_result_phone),
             is_owner_reference = is_owner_reference or v_resident.is_owner_reference,
             validation_status = 'valid',
             updated_at = now()
       where id = v_match_id;

      v_unified_count := v_unified_count + 1;
      v_server_plan := v_server_plan || jsonb_build_array(jsonb_build_object(
        'canonical_resident_id', v_source_match.id,
        'duplicate_resident_id', v_resident.id,
        'decision', 'merge',
        'result_full_name', v_result_full_name,
        'result_email', v_result_email,
        'result_phone', v_result_phone,
        'email_choice', v_email_choice,
        'phone_choice', v_phone_choice,
        'auto', v_auto_merge
      ));
    else
      v_next_position := v_next_position + 1;
      if v_next_position > 20 then
        perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_LIMIT', 'P0409');
      end if;

      insert into public.community_registration_residents (
        submission_id,
        campaign_id,
        community_id,
        campaign_unit_id,
        house_id,
        position,
        full_name,
        email,
        phone,
        normalized_full_name,
        normalized_email,
        normalized_phone,
        relationship_to_house,
        is_owner_reference,
        validation_status
      )
      values (
        v_new_submission_id,
        v_campaign.id,
        v_campaign.community_id,
        v_canonical.id,
        null,
        v_next_position,
        v_resident.full_name,
        v_resident.email,
        v_resident.phone,
        v_resident.normalized_full_name,
        v_resident.normalized_email,
        v_resident.normalized_phone,
        v_resident.relationship_to_house,
        v_resident.is_owner_reference,
        'valid'
      );

      v_appended_count := v_appended_count + 1;
      v_server_plan := v_server_plan || jsonb_build_array(jsonb_build_object(
        'duplicate_resident_id', v_resident.id,
        'decision', 'keep_separate',
        'auto', not v_ambiguous
      ));
    end if;
  end loop;

  select count(*)::integer
    into v_merged_resident_count
    from public.community_registration_residents
   where submission_id = v_new_submission_id;

  if v_merged_resident_count < 1 or v_merged_resident_count > 20 then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_LIMIT', 'P0409');
  end if;

  update public.community_registration_submissions
     set status = 'invalidated',
         invalidated_at = now(),
         invalidated_reason = 'Merged duplicate registration into ' || v_canonical.id::text,
         updated_at = now()
   where id = v_duplicate_submission.id;

  update public.community_registration_units
     set status = 'submitted',
         last_submitted_at = now(),
         unit_reference_snapshot = coalesce(
           nullif(btrim(v_canonical.unit_reference_snapshot), ''),
           nullif(btrim(v_duplicate.unit_reference_snapshot), '')
         ),
         resident_limit_override = case
           when v_merged_resident_count > coalesce(
             v_canonical.resident_limit_override,
             v_campaign.default_resident_limit
           )
             then v_merged_resident_count
           else v_canonical.resident_limit_override
         end,
         updated_at = now()
   where id = v_canonical.id;

  update public.community_registration_units
     set status = 'merged',
         updated_at = now()
   where id = v_duplicate.id;

  insert into public.community_registration_duplicate_resolutions (
    campaign_id,
    community_id,
    unit_low_id,
    unit_high_id,
    resolution_type,
    canonical_unit_id,
    duplicate_unit_id,
    metadata,
    resolved_by,
    resolved_at,
    updated_at
  )
  values (
    v_campaign.id,
    v_campaign.community_id,
    v_low,
    v_high,
    'merged',
    v_canonical.id,
    v_duplicate.id,
    jsonb_build_object(
      'canonical_label', v_canonical.unit_label_snapshot,
      'duplicate_label', v_duplicate.unit_label_snapshot,
      'canonical_previous_submission_id', v_canonical_submission.id,
      'duplicate_submission_id', v_duplicate_submission.id,
      'merged_submission_id', v_new_submission_id,
      'merged_resident_count', v_merged_resident_count,
      'unified_resident_count', v_unified_count,
      'appended_resident_count', v_appended_count,
      'client_resident_plan', p_resident_plan,
      'server_resolved_plan', v_server_plan
    ),
    p_actor_user_id,
    now(),
    now()
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
    'canonical_unit_id', v_canonical.id,
    'duplicate_unit_id', v_duplicate.id,
    'canonical_unit_label', v_canonical.unit_label_snapshot,
    'duplicate_unit_label', v_duplicate.unit_label_snapshot,
    'merged_submission_id', v_new_submission_id,
    'merged_resident_count', v_merged_resident_count,
    'unified_resident_count', v_unified_count,
    'appended_resident_count', v_appended_count
  );
end;
$function$;

comment on function public._cr_duplicate_normalize_phone_v1(text) is
  'ENTRY duplicate-review phone identity normalizer. Treats Honduras local 8-digit numbers and +504-prefixed equivalents as the same identity without changing stored registration formatting.';

comment on function public.merge_community_registration_units_v1(
  uuid, uuid, uuid, uuid, jsonb
) is
  'ENTRY internal RPC. Merges safe Submitted registration duplicates and compares duplicate resident phone identity through the Honduras-aware duplicate normalizer so equivalent +504/local formats do not require a false manual contact choice.';
