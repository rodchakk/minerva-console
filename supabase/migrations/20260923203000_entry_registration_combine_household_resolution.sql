-- ENTRY Resident Registration duplicate resolution: combine household.
--
-- Adds an explicit operator-selected resolution path for two pre-operational
-- registrations that represent one physical household with different residents.
-- Unlike merge_community_registration_units_v1, this preserves resident
-- identities as separate residents and returns the canonical household to review.

alter table public.community_registration_duplicate_resolutions
  drop constraint if exists cr_duplicate_resolution_merge_shape;

alter table public.community_registration_duplicate_resolutions
  drop constraint if exists community_registration_duplicate_resolutions_resolution_type_check;

-- The original schema migration used an auto-generated constraint name that
-- PostgreSQL truncated differently from the explicit replacement name above.
-- Drop that legacy name too so combine_household is not rejected by an older
-- three-value CHECK constraint.
alter table public.community_registration_duplicate_resolutions
  drop constraint if exists community_registration_duplicate_resoluti_resolution_type_check;

alter table public.community_registration_duplicate_resolutions
  add constraint community_registration_duplicate_resolutions_resolution_type_check
  check (resolution_type in (
    'dismissed',
    'merged',
    'resolved_duplicate',
    'combine_household'
  ));

alter table public.community_registration_duplicate_resolutions
  add constraint cr_duplicate_resolution_merge_shape
  check (
    (resolution_type = 'dismissed' and canonical_unit_id is null and duplicate_unit_id is null)
    or
    (
      resolution_type in ('merged', 'resolved_duplicate', 'combine_household')
      and canonical_unit_id is not null
      and duplicate_unit_id is not null
      and canonical_unit_id <> duplicate_unit_id
      and canonical_unit_id in (unit_low_id, unit_high_id)
      and duplicate_unit_id in (unit_low_id, unit_high_id)
    )
  );

drop index if exists public.idx_cr_duplicate_resolutions_duplicate_unit;
create index idx_cr_duplicate_resolutions_duplicate_unit
  on public.community_registration_duplicate_resolutions (duplicate_unit_id)
  where resolution_type in ('merged', 'resolved_duplicate', 'combine_household');

create or replace function public.combine_community_registration_households_v1(
  p_campaign_id uuid,
  p_canonical_unit_id uuid,
  p_duplicate_unit_id uuid,
  p_actor_user_id uuid
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
  v_combined_resident_count integer := 0;
  v_canonical_rank integer := 0;
  v_duplicate_rank integer := 0;
  v_preserved_residents jsonb := '[]'::jsonb;
  v_appended_residents jsonb := '[]'::jsonb;
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

  if v_canonical.status not in ('submitted', 'reviewed')
     or v_duplicate.status not in ('submitted', 'reviewed')
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

  v_canonical_rank := case v_canonical.status
    when 'reviewed' then 2
    when 'submitted' then 1
    else 0
  end;
  v_duplicate_rank := case v_duplicate.status
    when 'reviewed' then 2
    when 'submitted' then 1
    else 0
  end;

  if v_duplicate_rank > v_canonical_rank then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_CANONICAL_REQUIRED', 'P0409');
  end if;

  select * into v_canonical_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_canonical.id
     and status in ('submitted', 'reviewed')
   order by version_number desc
   limit 1
   for update;

  select * into v_duplicate_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_duplicate.id
     and status in ('submitted', 'reviewed')
   order by version_number desc
   limit 1
   for update;

  if v_canonical_submission.id is null
     or v_duplicate_submission.id is null
     or v_canonical_submission.status <> v_canonical.status
     or v_duplicate_submission.status <> v_duplicate.status then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_INVALID_STATE', 'P0409');
  end if;

  select count(*)::integer
    into v_combined_resident_count
    from public.community_registration_residents
   where submission_id in (v_canonical_submission.id, v_duplicate_submission.id);

  if v_combined_resident_count < 1 or v_combined_resident_count > 20 then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_LIMIT', 'P0409');
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

  if found and v_existing_resolution.resolution_type in (
    'merged',
    'resolved_duplicate',
    'combine_household'
  ) then
    if v_existing_resolution.resolution_type = 'combine_household'
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
    row_number() over (order by r.position, r.id)::integer,
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

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'resident_id', r.id,
               'full_name', r.full_name,
               'email', r.email,
               'phone', r.phone,
               'source', 'canonical'
             )
             order by r.position, r.id
           ),
           '[]'::jsonb
         )
    into v_preserved_residents
    from public.community_registration_residents r
   where r.submission_id = v_canonical_submission.id;

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
    v_next_position + row_number() over (order by r.position, r.id)::integer,
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
  where r.submission_id = v_duplicate_submission.id
  order by r.position, r.id;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'resident_id', r.id,
               'full_name', r.full_name,
               'email', r.email,
               'phone', r.phone,
               'source', 'archived_registration'
             )
             order by r.position, r.id
           ),
           '[]'::jsonb
         )
    into v_appended_residents
    from public.community_registration_residents r
   where r.submission_id = v_duplicate_submission.id;

  select count(*)::integer
    into v_combined_resident_count
    from public.community_registration_residents
   where submission_id = v_new_submission_id;

  if v_combined_resident_count < 1 or v_combined_resident_count > 20 then
    perform public._cr_raise_v1('ENTRY_CR_DUPLICATE_RESIDENT_LIMIT', 'P0409');
  end if;

  update public.community_registration_submissions
     set status = 'invalidated',
         invalidated_at = now(),
         invalidated_reason = 'Combined household registration into ' || v_canonical.id::text,
         updated_at = now()
   where id = v_duplicate_submission.id;

  update public.community_registration_units
     set status = 'submitted',
         last_submitted_at = now(),
         reviewed_at = null,
         reviewed_by = null,
         patronato_confirmed_at = null,
         patronato_confirmed_by = null,
         processed_at = null,
         unit_reference_snapshot = coalesce(
           nullif(btrim(v_canonical.unit_reference_snapshot), ''),
           nullif(btrim(v_duplicate.unit_reference_snapshot), '')
         ),
         resident_limit_override = case
           when v_combined_resident_count > coalesce(
             v_canonical.resident_limit_override,
             v_campaign.default_resident_limit
           )
             then v_combined_resident_count
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
    'combine_household',
    v_canonical.id,
    v_duplicate.id,
    jsonb_build_object(
      'resolution_path', 'combine_household',
      'canonical_unit_id', v_canonical.id,
      'combined_unit_id', v_duplicate.id,
      'archived_unit_id', v_duplicate.id,
      'canonical_label', v_canonical.unit_label_snapshot,
      'archived_label', v_duplicate.unit_label_snapshot,
      'canonical_previous_status', v_canonical.status,
      'archived_previous_status', v_duplicate.status,
      'canonical_previous_submission_id', v_canonical_submission.id,
      'archived_submission_id', v_duplicate_submission.id,
      'resulting_submission_id', v_new_submission_id,
      'resulting_status', 'submitted',
      'status_label', 'Needs review',
      'resulting_resident_count', v_combined_resident_count,
      'residents_preserved', v_preserved_residents,
      'residents_appended', v_appended_residents,
      'review_reset', true,
      'reviewed_at_cleared', v_canonical.reviewed_at is not null,
      'patronato_confirmed_at_cleared', v_canonical.patronato_confirmed_at is not null
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
    'resolution', 'combine_household',
    'canonical_unit_id', v_canonical.id,
    'archived_unit_id', v_duplicate.id,
    'resulting_submission_id', v_new_submission_id,
    'combined_resident_count', v_combined_resident_count,
    'resulting_status', 'submitted'
  );
end;
$function$;

revoke all on function public.combine_community_registration_households_v1(
  uuid, uuid, uuid, uuid
) from public;
revoke all on function public.combine_community_registration_households_v1(
  uuid, uuid, uuid, uuid
) from anon;
revoke all on function public.combine_community_registration_households_v1(
  uuid, uuid, uuid, uuid
) from authenticated;
grant execute on function public.combine_community_registration_households_v1(
  uuid, uuid, uuid, uuid
) to service_role;

comment on function public.combine_community_registration_households_v1(
  uuid, uuid, uuid, uuid
) is
  'ENTRY internal RPC. Combines two Submitted/Reviewed pre-operational resident-provided registrations into one household, preserves residents as separate identities, resets the canonical household to Submitted for review, archives the secondary registration, and records resolution_type=combine_household.';

comment on table public.community_registration_duplicate_resolutions is
  'Auditable operator decisions for Resident Registration duplicate candidates. resolution_type=merged means a true registration merge; resolution_type=combine_household means distinct residents were combined under one pre-operational household and returned to review; resolution_type=resolved_duplicate means the duplicate was archived without merging operational identity/data; dismissed suppresses a false positive.';
