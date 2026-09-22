-- ENTRY Resident Registration duplicate detection/resolution foundation.
--
-- Adds an auditable "merged" terminal state for duplicate staging units and
-- service-role-only RPCs to dismiss a candidate or consolidate two Submitted
-- resident-provided units before Activation Queue handoff.
--
-- Safety:
-- - merge is limited to resident_provided_units campaigns
-- - both units must still be Submitted
-- - neither unit may have reached resident_activation_queue
-- - source submissions remain as immutable history (superseded/invalidated)
-- - shared family email alone never drives the merge; the operator explicitly
--   chooses the canonical unit in Minerva Console

alter table public.community_registration_units
  drop constraint if exists cr_units_status_check;

alter table public.community_registration_units
  add constraint cr_units_status_check
  check (status in (
    'unregistered',
    'submitted',
    'edit_enabled',
    'needs_correction',
    'reviewed',
    'confirmed',
    'processed',
    'merged'
  ));

create table if not exists public.community_registration_duplicate_resolutions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.community_registration_campaigns(id) on delete restrict,
  community_id uuid not null references public.communities(id) on delete restrict,
  unit_low_id uuid not null references public.community_registration_units(id) on delete restrict,
  unit_high_id uuid not null references public.community_registration_units(id) on delete restrict,
  resolution_type text not null
    check (resolution_type in ('dismissed', 'merged', 'resolved_duplicate')),
  canonical_unit_id uuid references public.community_registration_units(id) on delete restrict,
  duplicate_unit_id uuid references public.community_registration_units(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cr_duplicate_resolution_pair_order
    check (unit_low_id::text < unit_high_id::text),
  constraint cr_duplicate_resolution_distinct_pair
    check (unit_low_id <> unit_high_id),
  constraint cr_duplicate_resolution_merge_shape
    check (
      (resolution_type = 'dismissed' and canonical_unit_id is null and duplicate_unit_id is null)
      or
      (
        resolution_type in ('merged', 'resolved_duplicate')
        and canonical_unit_id is not null
        and duplicate_unit_id is not null
        and canonical_unit_id <> duplicate_unit_id
        and canonical_unit_id in (unit_low_id, unit_high_id)
        and duplicate_unit_id in (unit_low_id, unit_high_id)
      )
    ),
  constraint cr_duplicate_resolution_pair_unique
    unique (campaign_id, unit_low_id, unit_high_id)
);

create index if not exists idx_cr_duplicate_resolutions_campaign
  on public.community_registration_duplicate_resolutions (
    campaign_id,
    resolution_type,
    resolved_at desc
  );

create index if not exists idx_cr_duplicate_resolutions_duplicate_unit
  on public.community_registration_duplicate_resolutions (duplicate_unit_id)
  where resolution_type in ('merged', 'resolved_duplicate');

alter table public.community_registration_duplicate_resolutions enable row level security;

revoke all on public.community_registration_duplicate_resolutions from public;
revoke all on public.community_registration_duplicate_resolutions from anon;
revoke all on public.community_registration_duplicate_resolutions from authenticated;
grant select, insert, update on public.community_registration_duplicate_resolutions to service_role;

create or replace function public.resolve_community_registration_duplicate_v1(
  p_campaign_id uuid,
  p_left_unit_id uuid,
  p_right_unit_id uuid,
  p_resolution text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_left public.community_registration_units%rowtype;
  v_right public.community_registration_units%rowtype;
  v_low uuid;
  v_high uuid;
  v_existing public.community_registration_duplicate_resolutions%rowtype;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_UNAUTHORIZED', '42501');
  end if;

  if p_campaign_id is null
     or p_left_unit_id is null
     or p_right_unit_id is null
     or p_left_unit_id = p_right_unit_id
     or lower(btrim(coalesce(p_resolution, ''))) <> 'dismissed' then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_PAIR', 'P0409');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_DIFFERENT_CAMPAIGN', 'P0409');
  end if;

  perform 1
    from public.community_registration_units
   where id in (p_left_unit_id, p_right_unit_id)
   order by id
   for update;

  select * into v_left
    from public.community_registration_units
   where id = p_left_unit_id;

  select * into v_right
    from public.community_registration_units
   where id = p_right_unit_id;

  if v_left.id is null
     or v_right.id is null
     or v_left.campaign_id <> v_campaign.id
     or v_right.campaign_id <> v_campaign.id
     or v_left.community_id <> v_campaign.community_id
     or v_right.community_id <> v_campaign.community_id then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_DIFFERENT_CAMPAIGN', 'P0409');
  end if;

  if v_left.status = 'merged' or v_right.status = 'merged' then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  if p_left_unit_id::text < p_right_unit_id::text then
    v_low := p_left_unit_id;
    v_high := p_right_unit_id;
  else
    v_low := p_right_unit_id;
    v_high := p_left_unit_id;
  end if;

  select * into v_existing
    from public.community_registration_duplicate_resolutions
   where campaign_id = v_campaign.id
     and unit_low_id = v_low
     and unit_high_id = v_high
   for update;

  if found and v_existing.resolution_type = 'merged' then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

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
    'dismissed',
    null,
    null,
    jsonb_build_object(
      'left_label', v_left.unit_label_snapshot,
      'right_label', v_right.unit_label_snapshot
    ),
    p_actor_user_id,
    now(),
    now()
  )
  on conflict (campaign_id, unit_low_id, unit_high_id)
  do update set
    resolution_type = excluded.resolution_type,
    canonical_unit_id = null,
    duplicate_unit_id = null,
    metadata = excluded.metadata,
    resolved_by = excluded.resolved_by,
    resolved_at = excluded.resolved_at,
    updated_at = now();

  return jsonb_build_object(
    'resolution', 'dismissed',
    'left_unit_id', p_left_unit_id,
    'right_unit_id', p_right_unit_id
  );
end;
$function$;

drop function if exists public.merge_community_registration_units_v1(uuid, uuid, uuid, uuid);

create or replace function public._cr_text_one_edit_apart_v1(
  p_left text,
  p_right text
)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_left text := coalesce(p_left, '');
  v_right text := coalesce(p_right, '');
  v_left_len integer := length(v_left);
  v_right_len integer := length(v_right);
  v_left_index integer := 1;
  v_right_index integer := 1;
  v_edits integer := 0;
begin
  if v_left = v_right or abs(v_left_len - v_right_len) > 1 then
    return false;
  end if;

  while v_left_index <= v_left_len and v_right_index <= v_right_len loop
    if substr(v_left, v_left_index, 1) = substr(v_right, v_right_index, 1) then
      v_left_index := v_left_index + 1;
      v_right_index := v_right_index + 1;
    else
      v_edits := v_edits + 1;
      if v_edits > 1 then
        return false;
      end if;

      if v_left_len > v_right_len then
        v_left_index := v_left_index + 1;
      elsif v_right_len > v_left_len then
        v_right_index := v_right_index + 1;
      else
        v_left_index := v_left_index + 1;
        v_right_index := v_right_index + 1;
      end if;
    end if;
  end loop;

  if v_left_index <= v_left_len or v_right_index <= v_right_len then
    v_edits := v_edits + 1;
  end if;

  return v_edits = 1;
end;
$function$;

create or replace function public._cr_duplicate_names_compatible_v1(
  p_left text,
  p_right text
)
returns boolean
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_left text := public._cr_normalize_name_v1(p_left);
  v_right text := public._cr_normalize_name_v1(p_right);
  v_left_tokens text[];
  v_right_tokens text[];
  v_small text[];
  v_large text[];
  v_differences integer := 0;
  v_index integer;
begin
  if v_left is null or v_right is null or v_left = '' or v_right = '' then
    return false;
  end if;

  if v_left = v_right then
    return true;
  end if;

  v_left_tokens := regexp_split_to_array(v_left, '\\s+');
  v_right_tokens := regexp_split_to_array(v_right, '\\s+');

  if array_length(v_left_tokens, 1) >= 2
     and array_length(v_right_tokens, 1) >= 2 then
    if array_length(v_left_tokens, 1) <= array_length(v_right_tokens, 1) then
      v_small := v_left_tokens;
      v_large := v_right_tokens;
    else
      v_small := v_right_tokens;
      v_large := v_left_tokens;
    end if;

    if v_small <@ v_large then
      return true;
    end if;
  end if;

  if array_length(v_left_tokens, 1) = array_length(v_right_tokens, 1)
     and array_length(v_left_tokens, 1) >= 2 then
    for v_index in 1..array_length(v_left_tokens, 1) loop
      if v_left_tokens[v_index] <> v_right_tokens[v_index] then
        if not public._cr_text_one_edit_apart_v1(
          v_left_tokens[v_index],
          v_right_tokens[v_index]
        ) then
          return false;
        end if;
        v_differences := v_differences + 1;
      end if;
    end loop;

    return v_differences = 1;
  end if;

  return false;
end;
$function$;

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
           source.normalized_phone is not null
           and source.normalized_phone = v_resident.normalized_phone
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
      v_same_name :=
        v_source_match.normalized_full_name is not null
        and v_source_match.normalized_full_name = v_resident.normalized_full_name;
      v_names_compatible := public._cr_duplicate_names_compatible_v1(
        v_source_match.full_name,
        v_resident.full_name
      );
      v_same_email :=
        v_source_match.normalized_email is not null
        and v_source_match.normalized_email = v_resident.normalized_email;
      v_same_phone :=
        v_source_match.normalized_phone is not null
        and v_source_match.normalized_phone = v_resident.normalized_phone;

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
         and public._cr_normalize_phone_v1(v_source_match.phone)
             <> public._cr_normalize_phone_v1(v_resident.phone) then
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
     set status = 'superseded',
         updated_at = now()
   where id = v_canonical_submission.id;

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

revoke all on function public.resolve_community_registration_duplicate_v1(uuid, uuid, uuid, text, uuid) from public;
revoke all on function public.resolve_community_registration_duplicate_v1(uuid, uuid, uuid, text, uuid) from anon;
revoke all on function public.resolve_community_registration_duplicate_v1(uuid, uuid, uuid, text, uuid) from authenticated;
grant execute on function public.resolve_community_registration_duplicate_v1(uuid, uuid, uuid, text, uuid) to service_role;

revoke all on function public.merge_community_registration_units_v1(uuid, uuid, uuid, uuid, jsonb) from public;
revoke all on function public.merge_community_registration_units_v1(uuid, uuid, uuid, uuid, jsonb) from anon;
revoke all on function public.merge_community_registration_units_v1(uuid, uuid, uuid, uuid, jsonb) from authenticated;
grant execute on function public.merge_community_registration_units_v1(uuid, uuid, uuid, uuid, jsonb) to service_role;

create or replace function public.get_community_registration_review_summary_v1(
  p_campaign_id uuid,
  p_patronato_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_counts jsonb;
  v_resident_count integer := 0;
  v_pending_observations integer := 0;
begin
  perform public._cr_service_role_only_v1();

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  if p_patronato_token_hash is not null then
    v_token := public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);
  end if;

  select jsonb_build_object(
    'total_units', count(*)::integer,
    'unregistered', count(*) filter (where status = 'unregistered')::integer,
    'submitted', count(*) filter (where status = 'submitted')::integer,
    'edit_enabled', count(*) filter (where status = 'edit_enabled')::integer,
    'needs_correction', count(*) filter (where status = 'needs_correction')::integer,
    'reviewed', count(*) filter (where status = 'reviewed')::integer,
    'confirmed', count(*) filter (where status = 'confirmed')::integer,
    'processed', count(*) filter (where status = 'processed')::integer
  )
  into v_counts
  from public.community_registration_units
  where campaign_id = v_campaign.id
    and status <> 'merged';

  select count(r.id)::integer
    into v_resident_count
    from public.community_registration_submissions s
    join public.community_registration_residents r
      on r.submission_id = s.id
   where s.campaign_id = v_campaign.id
     and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted');

  select count(*)::integer into v_pending_observations
    from public.community_registration_reviews cr
    join public.community_registration_units u
      on u.id = cr.campaign_unit_id
   where cr.campaign_id = v_campaign.id
     and u.status <> 'merged'
     and cr.decision = 'correction_requested'
     and cr.is_current
     and cr.resolution_status = 'pending';

  return v_counts
    || jsonb_build_object(
      'current_resident_count', v_resident_count,
      'pending_observations', v_pending_observations,
      'campaign_status', v_campaign.status
    );
end;
$function$;

create or replace function public.list_community_registration_review_units_v1(
  p_campaign_id uuid,
  p_patronato_token_hash text default null,
  p_status text default null,
  p_unit_label_prefix text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_label_prefix text := public._cr_normalize_unit_label_v1(p_unit_label_prefix);
  v_units jsonb;
begin
  perform public._cr_service_role_only_v1();

  if p_status is not null
     and p_status not in (
       'unregistered',
       'submitted',
       'edit_enabled',
       'needs_correction',
       'reviewed',
       'confirmed',
       'processed',
       'merged'
     ) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  if p_patronato_token_hash is not null then
    v_token := public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'unit_id', row_data.id,
    'unit_label', row_data.unit_label_snapshot,
    'status', row_data.status,
    'resident_count', row_data.resident_count,
    'submitted_at', row_data.submitted_at,
    'reviewed_at', row_data.reviewed_at,
    'patronato_confirmed_at', row_data.patronato_confirmed_at,
    'has_pending_observation', row_data.has_pending_observation
  ) order by row_data.unit_label_snapshot, row_data.id), '[]'::jsonb)
  into v_units
  from (
    select u.id,
           u.unit_label_snapshot,
           u.status,
           s.submitted_at,
           u.reviewed_at,
           u.patronato_confirmed_at,
           coalesce(count(r.id), 0)::integer as resident_count,
           exists (
             select 1
               from public.community_registration_reviews cr
              where cr.campaign_unit_id = u.id
                and cr.decision = 'correction_requested'
                and cr.is_current
                and cr.resolution_status = 'pending'
           ) as has_pending_observation
      from public.community_registration_units u
      left join public.community_registration_submissions s
        on s.campaign_unit_id = u.id
       and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted')
      left join public.community_registration_residents r
        on r.submission_id = s.id
     where u.campaign_id = v_campaign.id
       and (
         (p_status is null and u.status <> 'merged')
         or (p_status is not null and u.status = p_status)
       )
       and (v_label_prefix is null or u.normalized_unit_label like v_label_prefix || '%')
     group by u.id, u.unit_label_snapshot, u.status, s.submitted_at, u.reviewed_at, u.patronato_confirmed_at
     order by u.unit_label_snapshot, u.id
     limit v_limit
     offset v_offset
  ) row_data;

  return jsonb_build_object(
    'campaign_status', v_campaign.status,
    'limit', v_limit,
    'offset', v_offset,
    'units', v_units
  );
end;
$function$;

create or replace function public.resolve_community_registration_patronato_access_v1(
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
  v_total_units integer := 0;
  v_confirmed_units integer := 0;
  v_pending_observations integer := 0;
begin
  perform public._cr_service_role_only_v1();

  select * into v_token
    from public.community_registration_access_tokens
   where token_hash = btrim(coalesce(p_patronato_token_hash, ''))
     and token_type = 'patronato_review'
   for update;

  if not found
     or v_token.status <> 'active'
     or v_token.revoked_at is not null
     or v_token.consumed_at is not null then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_INVALID', '42501');
  end if;

  if v_token.expires_at is not null and v_token.expires_at <= now() then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_EXPIRED', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_token.campaign_id;

  if not found or v_campaign.status not in ('open', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_PATRONATO_ACCESS_INVALID', '42501');
  end if;

  select name into v_community_name
    from public.communities
   where id = v_campaign.community_id;

  select count(*)::integer,
         count(*) filter (where status = 'confirmed')::integer
    into v_total_units, v_confirmed_units
    from public.community_registration_units
   where campaign_id = v_campaign.id
     and status <> 'merged';

  select count(*)::integer into v_pending_observations
    from public.community_registration_reviews cr
    join public.community_registration_units u
      on u.id = cr.campaign_unit_id
   where cr.campaign_id = v_campaign.id
     and u.status <> 'merged'
     and cr.decision = 'correction_requested'
     and cr.is_current
     and cr.resolution_status = 'pending';

  return jsonb_build_object(
    'valid', true,
    'campaign', jsonb_build_object(
      'public_title', v_campaign.public_title,
      'community_name', v_community_name,
      'status', v_campaign.status,
      'closes_at', v_campaign.closes_at
    ),
    'summary', jsonb_build_object(
      'total_units', v_total_units,
      'confirmed_units', v_confirmed_units,
      'pending_observations', v_pending_observations
    ),
    'capabilities', jsonb_build_array(
      'view_progress',
      'view_unit',
      'request_correction',
      'confirm_unit',
      'confirm_campaign'
    ),
    'expires_at', v_token.expires_at
  );
end;
$function$;

create or replace function public.confirm_community_registration_campaign_v1(
  p_campaign_id uuid,
  p_patronato_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_authorization public.community_registration_incomplete_confirmation_authorizations%rowtype;
  v_total_units integer := 0;
  v_confirmed_units integer := 0;
  v_unregistered_units integer := 0;
  v_pending_units integer := 0;
  v_resident_count integer := 0;
begin
  perform public._cr_service_role_only_v1();

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  if v_campaign.status = 'confirmed' then
    perform public._cr_raise_v1('ENTRY_CR_ALREADY_CONFIRMED', 'P0409');
  end if;

  if v_campaign.status <> 'review' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  perform 1
    from public.community_registration_units
   where campaign_id = v_campaign.id
   order by id
   for update;

  v_token := public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);

  select count(*)::integer,
         count(*) filter (where status = 'confirmed')::integer,
         count(*) filter (where status = 'unregistered')::integer,
         count(*) filter (where status in ('submitted', 'edit_enabled', 'needs_correction', 'reviewed'))::integer
    into v_total_units, v_confirmed_units, v_unregistered_units, v_pending_units
    from public.community_registration_units
   where campaign_id = v_campaign.id
     and status <> 'merged';

  if v_pending_units > 0 then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_INCOMPLETE', 'P0409');
  end if;

  if v_confirmed_units = 0 then
    perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
  end if;

  if exists (
    select 1
      from public.community_registration_units u
      left join lateral (
        select s.id,
               s.status,
               s.patronato_confirmed_at
          from public.community_registration_submissions s
         where s.campaign_unit_id = u.id
           and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed')
         order by s.version_number desc
         limit 1
      ) current_submission on true
     where u.campaign_id = v_campaign.id
       and u.status <> 'merged'
       and (
         (
           u.status = 'confirmed'
           and (
             current_submission.id is null
             or current_submission.status <> 'confirmed'
             or current_submission.patronato_confirmed_at is null
           )
         )
         or (
           u.status = 'unregistered'
           and current_submission.id is not null
         )
       )
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_CONFLICT', 'P0409');
  end if;

  if v_unregistered_units > 0 then
    select * into v_authorization
      from public.community_registration_incomplete_confirmation_authorizations
     where campaign_id = v_campaign.id
       and status = 'active'
     for update;

    if not found or v_authorization.unregistered_count <> v_unregistered_units then
      perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_INCOMPLETE', 'P0409');
    end if;

    update public.community_registration_incomplete_confirmation_authorizations
       set status = 'consumed',
           consumed_at = now()
     where id = v_authorization.id;
  end if;

  select count(r.id)::integer
    into v_resident_count
    from public.community_registration_submissions s
    join public.community_registration_residents r
      on r.submission_id = s.id
   where s.campaign_id = v_campaign.id
     and s.status = 'confirmed';

  update public.community_registration_campaigns
     set status = 'confirmed',
         confirmed_at = now()
   where id = v_campaign.id;

  update public.community_registration_access_tokens
     set status = 'consumed',
         consumed_at = now()
   where id = v_token.id;

  insert into public.community_registration_events (
    campaign_id,
    event_type,
    actor_type,
    access_token_id,
    metadata
  )
  values (
    v_campaign.id,
    'campaign_confirmed',
    'patronato_token',
    v_token.id,
    jsonb_build_object(
      'previous_campaign_status', v_campaign.status,
      'new_campaign_status', 'confirmed',
      'total_units', v_total_units,
      'confirmed_units', v_confirmed_units,
      'authorized_unregistered_units', v_unregistered_units,
      'approved_resident_count', v_resident_count,
      'authorization_id', case when v_authorization.id is null then null else v_authorization.id end
    )
  );

  return jsonb_build_object(
    'campaign_status', 'confirmed',
    'total_units', v_total_units,
    'confirmed_units', v_confirmed_units,
    'authorized_unregistered_units', v_unregistered_units,
    'approved_resident_count', v_resident_count
  );
end;
$function$;

comment on table public.community_registration_duplicate_resolutions is
  'Auditable operator decisions for Resident Registration duplicate candidates. merged rows identify the surviving canonical unit; dismissed rows suppress a reviewed false positive.';

comment on function public.merge_community_registration_units_v1(uuid, uuid, uuid, uuid, jsonb) is
  'ENTRY internal RPC. Consolidates two Submitted resident-provided registration units into one canonical unit using an explicit reviewed resident resolution plan while preserving both original submissions as history. Blocks after Activation Queue handoff. service_role only.';



-- Final duplicate-resolution hardening: archive-style resolution for a lower-stage
-- duplicate when the canonical registration has already crossed into operational
-- activation. The duplicate staging record is terminalized using status='merged',
-- while resolution_type='resolved_duplicate' is the authoritative business meaning.
create or replace function public.resolve_community_registration_archived_duplicate_v1(
  p_campaign_id uuid,
  p_canonical_unit_id uuid,
  p_duplicate_unit_id uuid,
  p_actor_user_id uuid,
  p_unique_data_acknowledged boolean default false
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
  v_low uuid;
  v_high uuid;
  v_canonical_operational boolean := false;
  v_duplicate_operational boolean := false;
  v_canonical_activated boolean := false;
  v_unique_count integer := 0;
  v_unique_residents integer := 0;
  v_unique_contacts integer := 0;
  v_unique_reference boolean := false;
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

  select exists (
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
       and q.status in ('pending', 'invited', 'pin_generated', 'activated', 'failed', 'skipped')
  ) or v_canonical.status = 'processed'
  into v_canonical_operational;

  select exists (
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
       and q.status in ('pending', 'invited', 'pin_generated', 'activated', 'failed', 'skipped')
  ) or v_duplicate.status = 'processed'
  into v_duplicate_operational;

  select exists (
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
       and q.status = 'activated'
  )
  into v_canonical_activated;

  if v_canonical_operational and v_duplicate_operational then
    perform public._cr_raise_v1(
      'ENTRY_CR_DUPLICATE_MANUAL_IDENTITY_REVIEW_REQUIRED',
      'P0409'
    );
  end if;

  if not v_canonical_operational
     or v_duplicate_operational
     or v_duplicate.status <> 'submitted'
     or v_duplicate.house_id is not null then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  select * into v_canonical_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_canonical.id
     and status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted')
   order by version_number desc
   limit 1;

  select * into v_duplicate_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_duplicate.id
     and status = 'submitted'
   order by version_number desc
   limit 1;

  if v_duplicate_submission.id is null then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  if v_canonical_submission.id is not null then
    select count(*)::integer
      into v_unique_residents
      from public.community_registration_residents duplicate_resident
     where duplicate_resident.submission_id = v_duplicate_submission.id
       and not exists (
         select 1
           from public.community_registration_residents canonical_resident
          where canonical_resident.submission_id = v_canonical_submission.id
            and public._cr_duplicate_names_compatible_v1(
              canonical_resident.full_name,
              duplicate_resident.full_name
            )
            and (
              (
                canonical_resident.normalized_email is not null
                and canonical_resident.normalized_email = duplicate_resident.normalized_email
              )
              or
              (
                canonical_resident.normalized_phone is not null
                and canonical_resident.normalized_phone = duplicate_resident.normalized_phone
              )
            )
       );

    select count(*)::integer
      into v_unique_contacts
      from public.community_registration_residents duplicate_resident
      join lateral (
        select canonical_resident.*
          from public.community_registration_residents canonical_resident
         where canonical_resident.submission_id = v_canonical_submission.id
           and public._cr_duplicate_names_compatible_v1(
             canonical_resident.full_name,
             duplicate_resident.full_name
           )
           and (
             (
               canonical_resident.normalized_email is not null
               and canonical_resident.normalized_email = duplicate_resident.normalized_email
             )
             or
             (
               canonical_resident.normalized_phone is not null
               and canonical_resident.normalized_phone = duplicate_resident.normalized_phone
             )
           )
         order by canonical_resident.position
         limit 1
      ) canonical_match on true
     where duplicate_resident.submission_id = v_duplicate_submission.id
       and (
         (canonical_match.email is null and duplicate_resident.email is not null)
         or (canonical_match.phone is null and duplicate_resident.phone is not null)
         or (
           length(public._cr_normalize_name_v1(duplicate_resident.full_name))
           > length(public._cr_normalize_name_v1(canonical_match.full_name))
         )
       );
  else
    select count(*)::integer
      into v_unique_residents
      from public.community_registration_residents
     where submission_id = v_duplicate_submission.id;
  end if;

  v_unique_reference :=
    nullif(btrim(coalesce(v_duplicate.unit_reference_snapshot, '')), '') is not null
    and (
      nullif(btrim(coalesce(v_canonical.unit_reference_snapshot, '')), '') is null
      or public._cr_normalize_unit_label(v_duplicate.unit_reference_snapshot)
         <> public._cr_normalize_unit_label(v_canonical.unit_reference_snapshot)
    );

  v_unique_count :=
    coalesce(v_unique_residents, 0)
    + coalesce(v_unique_contacts, 0)
    + case when v_unique_reference then 1 else 0 end;

  if v_unique_count > 0 and not coalesce(p_unique_data_acknowledged, false) then
    perform public._cr_raise_v1(
      'ENTRY_CR_DUPLICATE_UNIQUE_DATA_REVIEW_REQUIRED',
      'P0409'
    );
  end if;

  if p_canonical_unit_id::text < p_duplicate_unit_id::text then
    v_low := p_canonical_unit_id;
    v_high := p_duplicate_unit_id;
  else
    v_low := p_duplicate_unit_id;
    v_high := p_canonical_unit_id;
  end if;

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
    'resolved_duplicate',
    v_canonical.id,
    v_duplicate.id,
    jsonb_build_object(
      'canonical_label', v_canonical.unit_label_snapshot,
      'duplicate_label', v_duplicate.unit_label_snapshot,
      'canonical_status_at_resolution', v_canonical.status,
      'duplicate_status_at_resolution', v_duplicate.status,
      'canonical_lifecycle', case
        when v_canonical_activated then 'Activated'
        else 'Prepared for activation'
      end,
      'duplicate_lifecycle', 'Submitted',
      'resolution_reason', 'Advanced registration retained; lower-stage duplicate archived without operational identity mutation',
      'unique_data_detected', v_unique_count > 0,
      'unique_data_count', v_unique_count,
      'unique_resident_count', v_unique_residents,
      'unique_contact_or_name_count', v_unique_contacts,
      'unique_reference', v_unique_reference,
      'unique_data_acknowledged', coalesce(p_unique_data_acknowledged, false)
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
    'resolution', 'resolved_duplicate',
    'canonical_unit_id', v_canonical.id,
    'duplicate_unit_id', v_duplicate.id,
    'canonical_lifecycle', case
      when v_canonical_activated then 'Activated'
      else 'Prepared for activation'
    end,
    'unique_data_detected', v_unique_count > 0,
    'unique_data_count', v_unique_count
  );
end;
$function$;

revoke all on function public.resolve_community_registration_archived_duplicate_v1(
  uuid, uuid, uuid, uuid, boolean
) from public;
revoke all on function public.resolve_community_registration_archived_duplicate_v1(
  uuid, uuid, uuid, uuid, boolean
) from anon;
revoke all on function public.resolve_community_registration_archived_duplicate_v1(
  uuid, uuid, uuid, uuid, boolean
) from authenticated;
grant execute on function public.resolve_community_registration_archived_duplicate_v1(
  uuid, uuid, uuid, uuid, boolean
) to service_role;

comment on function public.resolve_community_registration_archived_duplicate_v1(
  uuid, uuid, uuid, uuid, boolean
) is
  'ENTRY internal RPC. Archives a lower-stage Submitted duplicate when the canonical registration is already operational. Does not mutate auth, Activation Queue, house identity, or canonical resident records. resolution_type=resolved_duplicate is authoritative; unit status=merged is only the terminal staging state.';

comment on table public.community_registration_duplicate_resolutions is
  'Auditable operator decisions for Resident Registration duplicate candidates. resolution_type=merged means a true registration merge; resolution_type=resolved_duplicate means the duplicate was archived without merging operational identity/data; dismissed suppresses a false positive.';
