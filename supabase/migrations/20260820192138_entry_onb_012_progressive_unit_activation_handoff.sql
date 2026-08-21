-- ENTRY-ONB-012: Progressive Community Registration unit activation handoff.
--
-- Forward-only local migration. Do not apply to live Supabase until reviewed.
-- Keeps campaign-level confirmation semantics intact while allowing one
-- reviewed unit/current submission to be externally approved and converted
-- without finalizing the whole campaign.

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
  where campaign_id = v_campaign.id;

  select count(r.id)::integer
    into v_resident_count
    from public.community_registration_submissions s
    join public.community_registration_residents r
      on r.submission_id = s.id
   where s.campaign_id = v_campaign.id
     and s.status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted');

  select count(*)::integer into v_pending_observations
    from public.community_registration_reviews
   where campaign_id = v_campaign.id
     and decision = 'correction_requested'
     and is_current
     and resolution_status = 'pending';

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
       'processed'
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
       and (p_status is null or u.status = p_status)
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

create or replace function public.get_community_registration_review_unit_v1(
  p_campaign_id uuid,
  p_campaign_unit_id uuid,
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
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_residents jsonb;
  v_review public.community_registration_reviews%rowtype;
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

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and campaign_id = v_campaign.id
     and status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted')
   order by version_number desc
   limit 1;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', r.position,
    'full_name', r.full_name,
    'phone', r.phone,
    'email', r.email,
    'relationship_to_house', r.relationship_to_house,
    'is_owner_reference', r.is_owner_reference
  ) order by r.position), '[]'::jsonb)
  into v_residents
  from public.community_registration_residents r
  where r.submission_id = v_submission.id;

  select * into v_review
    from public.community_registration_reviews
   where campaign_unit_id = v_unit.id
     and is_current
   order by created_at desc
   limit 1;

  return jsonb_build_object(
    'unit_label', v_unit.unit_label_snapshot,
    'status', v_unit.status,
    'version', v_submission.version_number,
    'effective_resident_limit', coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit),
    'submitted_at', v_submission.submitted_at,
    'reviewed_at', v_unit.reviewed_at,
    'patronato_confirmed_at', v_unit.patronato_confirmed_at,
    'review', case
      when v_review.id is null then null
      else jsonb_build_object(
        'decision', v_review.decision,
        'observation', v_review.observation_text,
        'resolution_status', v_review.resolution_status,
        'created_at', v_review.created_at
      )
    end,
    'residents', v_residents
  );
end;
$function$;

create or replace function public.mark_community_registration_unit_reviewed_v1(
  p_campaign_unit_id uuid,
  p_actor_user_id uuid
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
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

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

  if v_campaign.status not in ('open', 'review') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if exists (
    select 1
      from public.community_registration_access_tokens
     where campaign_id = v_campaign.id
       and campaign_unit_id = p_campaign_unit_id
       and token_type = 'resident_edit'
       and status = 'active'
       and (expires_at is null or expires_at > now())
       and revoked_at is null
       and consumed_at is null
  ) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and campaign_id = v_campaign.id
     and status = 'submitted'
   order by version_number desc
   limit 1
   for update;

  if not found or v_unit.status <> 'submitted' then
    perform public._cr_raise_v1('ENTRY_CR_REVIEW_NOT_READY', 'P0409');
  end if;

  perform public._cr_replace_current_review_v1(v_unit.id);

  update public.community_registration_submissions
     set status = 'reviewed',
         reviewed_at = now(),
         reviewed_by = p_actor_user_id
   where id = v_submission.id;

  update public.community_registration_units
     set status = 'reviewed',
         reviewed_at = now(),
         reviewed_by = p_actor_user_id,
         patronato_confirmed_at = null,
         patronato_confirmed_by = null
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
    'reviewed',
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
    'unit_reviewed',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'version', v_submission.version_number,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'reviewed',
      'campaign_status_preserved', v_campaign.status
    )
  );

  return jsonb_build_object(
    'status', 'reviewed',
    'unit_label', v_unit.unit_label_snapshot,
    'version', v_submission.version_number,
    'campaign_status', v_campaign.status
  );
end;
$function$;

create or replace function public.request_community_registration_correction_v1(
  p_campaign_id uuid,
  p_campaign_unit_id uuid,
  p_observation text,
  p_actor_user_id uuid default null,
  p_patronato_token_hash text default null
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
  v_observation text := public._cr_validate_observation_v1(p_observation);
  v_actor_type text;
begin
  perform public._cr_service_role_only_v1();

  if p_patronato_token_hash is null then
    perform public._cr_validate_actor_v1(p_actor_user_id);
    if p_actor_user_id is null then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
    end if;
    v_actor_type := 'entry_admin';
  else
    v_actor_type := 'patronato';
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found or v_campaign.status not in ('open', 'review') then
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

  if v_unit.status = 'confirmed' then
    perform public._cr_raise_v1('ENTRY_CR_ALREADY_CONFIRMED', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and campaign_id = v_campaign.id
     and status in ('submitted', 'reviewed')
   order by version_number desc
   limit 1
   for update;

  if not found or v_unit.status not in ('submitted', 'reviewed') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_REVIEW_STATE', 'P0409');
  end if;

  if p_patronato_token_hash is not null then
    v_token := public._cr_patronato_token_v1(v_campaign.id, p_patronato_token_hash);
  end if;

  perform public._cr_replace_current_review_v1(v_unit.id);

  insert into public.community_registration_reviews (
    campaign_id,
    campaign_unit_id,
    submission_id,
    decision,
    actor_type,
    actor_user_id,
    access_token_id,
    observation_text,
    resolution_status
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'correction_requested',
    v_actor_type,
    case when v_actor_type = 'entry_admin' then p_actor_user_id else null end,
    case when v_actor_type = 'patronato' then v_token.id else null end,
    v_observation,
    'pending'
  );

  update public.community_registration_units
     set status = 'needs_correction',
         patronato_confirmed_at = null,
         patronato_confirmed_by = null
   where id = v_unit.id;

  insert into public.community_registration_events (
    campaign_id,
    campaign_unit_id,
    submission_id,
    event_type,
    actor_type,
    actor_user_id,
    access_token_id,
    metadata
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'correction_requested',
    case when v_actor_type = 'patronato' then 'patronato_token' else 'entry_admin' end,
    case when v_actor_type = 'entry_admin' then p_actor_user_id else null end,
    case when v_actor_type = 'patronato' then v_token.id else null end,
    jsonb_build_object(
      'version', v_submission.version_number,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'needs_correction',
      'observation_length', length(v_observation),
      'campaign_status_preserved', v_campaign.status
    )
  );

  return jsonb_build_object(
    'status', 'needs_correction',
    'unit_label', v_unit.unit_label_snapshot,
    'version', v_submission.version_number,
    'campaign_status', v_campaign.status
  );
end;
$function$;

create or replace function public.record_community_registration_unit_external_approval_v1(
  p_campaign_unit_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
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

  if v_unit.status = 'processed' then
    return jsonb_build_object(
      'status', 'processed',
      'already_confirmed', true,
      'unit_label', v_unit.unit_label_snapshot,
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
       or v_submission.house_id <> v_unit.house_id then
      perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_STALE', 'P0409');
    end if;

    return jsonb_build_object(
      'status', 'confirmed',
      'already_confirmed', true,
      'unit_label', v_unit.unit_label_snapshot,
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
      'reason_length', length(v_reason)
    )
  );

  return jsonb_build_object(
    'status', 'confirmed',
    'already_confirmed', false,
    'unit_label', v_unit.unit_label_snapshot,
    'version', v_submission.version_number,
    'campaign_status', v_campaign.status
  );
end;
$function$;

create or replace function public._cr_classify_unit_conversion_v1(
  p_campaign_unit_id uuid
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_results jsonb := '[]'::jsonb;
  v_blocking_count integer := 0;
  v_resident record;
  v_email text;
  v_phone text;
  v_name text;
  v_method text;
  v_category text;
  v_action text;
  v_code text;
  v_blocking boolean;
  v_related_queue_id uuid;
  v_related_queue_status text;
  v_queue_count integer;
  v_failed_queue_count integer;
  v_partial_queue_count integer;
  v_claimed_queue_ids uuid[] := array[]::uuid[];
  v_active_auth_user_count integer;
  v_active_same_house_count integer;
  v_active_other_context_count integer;
  v_active_other_community_count integer;
  v_active_phone_count integer;
  v_is_valid boolean;
begin
  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if not found then
    return jsonb_build_object(
      'eligible', false,
      'blocking_count', 1,
      'code', 'ENTRY_CR_CONVERSION_NOT_READY',
      'residents', '[]'::jsonb
    );
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_unit.campaign_id;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed')
   order by version_number desc
   limit 1;

  if v_campaign.status not in ('open', 'review', 'confirmed')
     or v_unit.status not in ('confirmed', 'processed')
     or v_submission.id is null
     or v_submission.status <> 'confirmed'
     or v_submission.patronato_confirmed_at is null
     or v_submission.house_id <> v_unit.house_id
     or v_submission.community_id <> v_campaign.community_id
     or exists (
       select 1
         from public.community_registration_submissions newer
        where newer.campaign_unit_id = v_unit.id
          and newer.status in ('draft', 'submitted', 'edit_enabled', 'reviewed')
          and newer.version_number > v_submission.version_number
     )
     or exists (
       select 1
         from public.community_registration_access_tokens t
        where t.campaign_id = v_campaign.id
          and t.campaign_unit_id = v_unit.id
          and t.token_type = 'resident_edit'
          and t.status = 'active'
     )
     or exists (
       select 1
         from public.community_registration_reviews rv
        where rv.campaign_id = v_campaign.id
          and rv.campaign_unit_id = v_unit.id
          and rv.is_current
          and rv.decision = 'correction_requested'
          and rv.resolution_status = 'pending'
     ) then
    return jsonb_build_object(
      'campaign_id', v_campaign.id,
      'campaign_unit_id', v_unit.id,
      'submission_id', v_submission.id,
      'community_id', v_unit.community_id,
      'house_id', v_unit.house_id,
      'unit_label', v_unit.unit_label_snapshot,
      'eligible', false,
      'blocking_count', 1,
      'code', 'ENTRY_CR_CONVERSION_NOT_READY',
      'residents', '[]'::jsonb
    );
  end if;

  if not exists (
    select 1
      from public.community_registration_residents
     where submission_id = v_submission.id
  ) then
    return jsonb_build_object(
      'campaign_id', v_campaign.id,
      'campaign_unit_id', v_unit.id,
      'submission_id', v_submission.id,
      'community_id', v_unit.community_id,
      'house_id', v_unit.house_id,
      'unit_label', v_unit.unit_label_snapshot,
      'eligible', false,
      'blocking_count', 1,
      'code', 'ENTRY_CR_RESIDENT_INVALID',
      'residents', '[]'::jsonb
    );
  end if;

  for v_resident in
    select r.*
      from public.community_registration_residents r
     where r.submission_id = v_submission.id
     order by r.position, r.id
  loop
    v_email := public._cr_conversion_normalize_email_v1(v_resident.email);
    v_phone := public._cr_conversion_normalize_phone_v1(v_resident.phone);
    v_name := public._cr_conversion_normalize_name_v1(v_resident.full_name);
    v_method := public._cr_conversion_activation_method_v1(v_resident.email, v_resident.phone);
    v_related_queue_id := null;
    v_related_queue_status := null;
    v_category := 'ready_new';
    v_action := 'insert_queue';
    v_code := null;
    v_blocking := false;

    v_is_valid := v_name is not null
      and v_resident.community_id = v_campaign.community_id
      and v_resident.campaign_id = v_campaign.id
      and v_resident.campaign_unit_id = v_unit.id
      and v_resident.house_id = v_unit.house_id
      and (
        v_email is null
        or v_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
      )
      and (
        v_phone is null
        or v_phone ~ '^\+?[0-9]+$'
      );

    if not v_is_valid then
      v_category := 'invalid';
      v_action := 'block';
      v_code := 'ENTRY_CR_RESIDENT_INVALID';
      v_blocking := true;
    end if;

    if not v_blocking then
      select q.id, q.status
        into v_related_queue_id, v_related_queue_status
        from public.resident_activation_queue q
       where q.community_registration_resident_id = v_resident.id
       order by q.id
       limit 1;

      if found then
        if exists (
          select 1
            from public.resident_activation_queue q
           where q.id = v_related_queue_id
             and (
               q.community_id <> v_campaign.community_id
               or (q.house_id is not null and q.house_id <> v_unit.house_id)
               or (
                 q.house_id is null
                 and public.normalize_unit_label(q.unit_label)
                     <> public.normalize_unit_label(v_unit.unit_label_snapshot)
               )
               or (q.status = 'activated' and q.activated_user_id is null)
             )
        ) then
          v_category := 'traceability_conflict';
          v_action := 'block';
          v_code := 'ENTRY_CR_TRACEABILITY_CONFLICT';
          v_blocking := true;
        else
          v_category := 'already_linked';
          v_action := 'reuse_linked_queue';
          v_code := case
            when v_related_queue_status = 'activated' then 'ENTRY_CR_ALREADY_ACTIVE'
            else 'ENTRY_CR_ALREADY_QUEUED'
          end;
        end if;
      end if;
    end if;

    if not v_blocking and v_related_queue_id is null then
      with matching_queue as (
        select q.id, q.status
          from public.resident_activation_queue q
         where q.community_id = v_campaign.community_id
           and q.status in ('pending', 'invited', 'pin_generated', 'activated')
           and (
             q.house_id = v_unit.house_id
             or (
               q.house_id is null
               and public.normalize_unit_label(q.unit_label) = public.normalize_unit_label(v_unit.unit_label_snapshot)
             )
           )
           and public._cr_conversion_normalize_name_v1(q.resident_name) = v_name
           and (
             (v_email is not null and public._cr_conversion_normalize_email_v1(q.email) = v_email)
             or (
               v_email is null
               and v_phone is not null
               and q.email is null
               and public._cr_conversion_normalize_phone_v1(q.phone) = v_phone
             )
             or (
               v_email is null
               and v_phone is null
               and q.email is null
               and q.phone is null
             )
           )
      ),
      queue_count as (
        select count(*)::integer as value
          from matching_queue
      ),
      queue_candidate as (
        select id, status
          from matching_queue
         order by id
         limit 1
      )
      select queue_count.value,
             queue_candidate.id,
             queue_candidate.status
        into v_queue_count, v_related_queue_id, v_related_queue_status
        from queue_count
        left join queue_candidate on true;

      if v_queue_count > 1 then
        v_category := 'queue_conflict';
        v_action := 'block';
        v_code := 'ENTRY_CR_QUEUE_CONFLICT';
        v_blocking := true;
        v_related_queue_id := null;
        v_related_queue_status := null;
      elsif v_queue_count = 1 then
        if v_related_queue_status = 'activated' and exists (
          select 1
            from public.resident_activation_queue q
           where q.id = v_related_queue_id
             and q.activated_user_id is null
        ) then
          v_category := 'queue_conflict';
          v_action := 'block';
          v_code := 'ENTRY_CR_QUEUE_CONFLICT';
          v_blocking := true;
          v_related_queue_id := null;
          v_related_queue_status := null;
        else
          v_category := 'reuse_queue';
          v_action := 'reuse_queue';
          v_code := case
            when v_related_queue_status = 'activated' then 'ENTRY_CR_ALREADY_ACTIVE'
            else 'ENTRY_CR_ALREADY_QUEUED'
          end;
        end if;
      end if;
    end if;

    if not v_blocking and v_category = 'ready_new' then
      select count(*)::integer
        into v_failed_queue_count
        from public.resident_activation_queue q
       where q.community_id = v_campaign.community_id
         and q.status in ('skipped', 'failed')
         and (
           q.house_id = v_unit.house_id
           or public.normalize_unit_label(q.unit_label) = public.normalize_unit_label(v_unit.unit_label_snapshot)
         )
         and public._cr_conversion_normalize_name_v1(q.resident_name) = v_name;

      if v_failed_queue_count > 0 then
        v_category := 'queue_conflict';
        v_action := 'block';
        v_code := 'ENTRY_CR_QUEUE_CONFLICT';
        v_blocking := true;
      end if;
    end if;

    if not v_blocking and v_category = 'ready_new' then
      select count(*)::integer
        into v_partial_queue_count
        from public.resident_activation_queue q
       where q.community_id = v_campaign.community_id
         and q.status in ('pending', 'invited', 'pin_generated', 'activated')
         and (
           q.house_id = v_unit.house_id
           or public.normalize_unit_label(q.unit_label) = public.normalize_unit_label(v_unit.unit_label_snapshot)
         )
         and public._cr_conversion_normalize_name_v1(q.resident_name) = v_name
         and (
           (v_email is not null and q.email is not null and public._cr_conversion_normalize_email_v1(q.email) <> v_email)
           or (v_phone is not null and q.phone is not null and public._cr_conversion_normalize_phone_v1(q.phone) <> v_phone)
         );

      if v_partial_queue_count > 0 then
        v_category := 'identity_ambiguous';
        v_action := 'block';
        v_code := 'ENTRY_CR_IDENTITY_AMBIGUOUS';
        v_blocking := true;
      end if;
    end if;

    if not v_blocking and v_category = 'ready_new' and v_email is not null then
      select
        count(distinct au.id)::integer,
        count(*) filter (
          where coalesce(p.community_id, cm.community_id) = v_campaign.community_id
            and coalesce(p.is_active, true)
            and coalesce(cm.is_active, false)
            and cm.role = 'resident'
            and coalesce(hr.is_active, false)
            and hr.house_id = v_unit.house_id
        )::integer,
        count(*) filter (
          where coalesce(p.community_id, cm.community_id) = v_campaign.community_id
            and coalesce(p.is_active, true)
            and coalesce(cm.is_active, false)
            and (
              hr.id is null
              or hr.house_id <> v_unit.house_id
            )
        )::integer,
        count(*) filter (
          where coalesce(p.community_id, cm.community_id) <> v_campaign.community_id
        )::integer
        into v_active_auth_user_count,
             v_active_same_house_count,
             v_active_other_context_count,
             v_active_other_community_count
        from auth.users au
        left join public.profiles p
          on p.user_id = au.id
        left join public.community_members cm
          on cm.user_id = au.id
        left join public.house_residents hr
          on hr.user_id = au.id
         and hr.community_id = coalesce(cm.community_id, p.community_id)
         and hr.is_active
       where public._cr_conversion_normalize_email_v1(au.email::text) = v_email;

      if v_active_same_house_count = 1
         and v_active_auth_user_count = 1
         and v_active_other_context_count = 0
         and v_active_other_community_count = 0 then
        v_category := 'already_active_same_house';
        v_action := 'already_active';
        v_code := 'ENTRY_CR_ALREADY_ACTIVE';
      elsif v_active_auth_user_count > 0
         or v_active_same_house_count > 1
         or v_active_other_context_count > 0
         or v_active_other_community_count > 0 then
        v_category := case
          when v_active_other_context_count > 0 or v_active_other_community_count > 0
            then 'active_identity_other_context'
          else 'identity_ambiguous'
        end;
        v_action := 'block';
        v_code := case
          when v_category = 'active_identity_other_context'
            then 'ENTRY_CR_RESIDENT_CONFLICT'
          else 'ENTRY_CR_IDENTITY_AMBIGUOUS'
        end;
        v_blocking := true;
      end if;
    end if;

    if not v_blocking
       and v_related_queue_id is not null
       and v_category in ('reuse_queue', 'already_linked') then
      if v_related_queue_id = any(v_claimed_queue_ids) then
        v_category := 'queue_conflict';
        v_action := 'block';
        v_code := 'ENTRY_CR_QUEUE_CONFLICT';
        v_blocking := true;
        v_related_queue_id := null;
        v_related_queue_status := null;
      else
        v_claimed_queue_ids := array_append(v_claimed_queue_ids, v_related_queue_id);
      end if;
    end if;

    if not v_blocking
       and v_category = 'ready_new'
       and v_email is null
       and v_phone is not null then
      select count(*)::integer
        into v_active_phone_count
        from auth.users au
        left join public.profiles p
          on p.user_id = au.id
        left join public.community_members cm
          on cm.user_id = au.id
        left join public.house_residents hr
          on hr.user_id = au.id
        where v_phone in (
          public._cr_conversion_normalize_phone_v1(au.phone),
          public._cr_conversion_normalize_phone_v1(p.phone)
        )
          and (
            p.user_id is not null
            or cm.user_id is not null
            or hr.user_id is not null
            or au.phone is not null
          );

      if v_active_phone_count > 1 then
        v_category := 'identity_ambiguous';
        v_action := 'block';
        v_code := 'ENTRY_CR_IDENTITY_AMBIGUOUS';
        v_blocking := true;
      elsif v_active_phone_count = 1 then
        v_category := 'identity_ambiguous';
        v_action := 'block';
        v_code := 'ENTRY_CR_IDENTITY_AMBIGUOUS';
        v_blocking := true;
      end if;
    end if;

    if v_blocking then
      v_blocking_count := v_blocking_count + 1;
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'resident_id', v_resident.id,
      'position', v_resident.position,
      'full_name', v_resident.full_name,
      'email', v_resident.email,
      'phone', v_resident.phone,
      'activation_method', v_method,
      'planned_action', v_action,
      'category', v_category,
      'contract_code', v_code,
      'related_activation_queue_id', v_related_queue_id,
      'related_activation_queue_status', v_related_queue_status,
      'blocking', v_blocking
    ));
  end loop;

  return jsonb_build_object(
    'campaign_id', v_campaign.id,
    'campaign_unit_id', v_unit.id,
    'submission_id', v_submission.id,
    'community_id', v_unit.community_id,
    'house_id', v_unit.house_id,
    'unit_label', v_unit.unit_label_snapshot,
    'eligible', v_blocking_count = 0,
    'blocking_count', v_blocking_count,
    'resident_count', jsonb_array_length(v_results),
    'residents', v_results
  );
end;
$function$;

create or replace function public.convert_community_registration_unit_to_activation_v1(
  p_campaign_unit_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
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
  v_preview jsonb;
  v_item jsonb;
  v_resident public.community_registration_residents%rowtype;
  v_queue public.resident_activation_queue%rowtype;
  v_queue_id uuid;
  v_method text;
  v_username text;
  v_conversion_status text;
  v_results jsonb := '[]'::jsonb;
  v_converted integer := 0;
  v_already_queued integer := 0;
  v_already_active integer := 0;
  v_blocked integer := 0;
  v_reason text := nullif(btrim(p_reason), '');
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
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_campaign_id
   for update;

  if not found or v_campaign.status not in ('open', 'review', 'confirmed') then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  if v_unit.status = 'processed' then
    return public.get_community_registration_conversion_result_v1(p_campaign_unit_id, p_actor_user_id)
      || jsonb_build_object('already_complete', true);
  end if;

  if v_unit.status <> 'confirmed' then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_NOT_READY', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and status = 'confirmed'
   order by version_number desc
   limit 1
   for update;

  if not found
     or v_submission.community_id <> v_campaign.community_id
     or v_submission.house_id <> v_unit.house_id
     or v_submission.patronato_confirmed_at is null then
    perform public._cr_raise_v1('ENTRY_CR_CONFIRMATION_STALE', 'P0409');
  end if;

  perform 1
    from public.community_registration_residents r
   where r.submission_id = v_submission.id
   order by r.position, r.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_RESIDENT_INVALID', 'P0409');
  end if;

  for v_resident in
    select *
      from public.community_registration_residents
     where submission_id = v_submission.id
     order by position, id
  loop
    perform public._cr_conversion_lock_identity_v1(
      v_campaign.community_id,
      v_unit.house_id,
      v_unit.unit_label_snapshot,
      v_resident.full_name,
      v_resident.email,
      v_resident.phone
    );
  end loop;

  perform 1
    from public.resident_activation_queue q
   where q.community_id = v_campaign.community_id
     and (
       q.community_registration_resident_id in (
         select r.id
           from public.community_registration_residents r
          where r.submission_id = v_submission.id
       )
       or (
         q.status in ('pending', 'invited', 'pin_generated', 'activated', 'skipped', 'failed')
         and exists (
           select 1
             from public.community_registration_residents r
            where r.submission_id = v_submission.id
              and public._cr_conversion_normalize_name_v1(q.resident_name)
                  = public._cr_conversion_normalize_name_v1(r.full_name)
              and (
                q.house_id = v_unit.house_id
                or public.normalize_unit_label(q.unit_label) = public.normalize_unit_label(v_unit.unit_label_snapshot)
              )
         )
       )
     )
   order by q.id
   for update;

  v_preview := public._cr_classify_unit_conversion_v1(p_campaign_unit_id);

  perform public._cr_conversion_event_v1(
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'unit_conversion_attempted',
    p_actor_user_id,
    jsonb_build_object(
      'resident_count', coalesce((v_preview->>'resident_count')::integer, 0),
      'blocking_count', coalesce((v_preview->>'blocking_count')::integer, 0),
      'reason_present', v_reason is not null
    )
  );

  if coalesce((v_preview->>'blocking_count')::integer, 0) > 0
     or coalesce((v_preview->>'eligible')::boolean, false) = false then
    for v_item in
      select value from jsonb_array_elements(coalesce(v_preview->'residents', '[]'::jsonb))
    loop
      if coalesce((v_item->>'blocking')::boolean, false) then
        v_blocked := v_blocked + 1;

        update public.community_registration_residents
           set conversion_status = case v_item->>'category'
                 when 'queue_conflict' then 'queue_conflict'
                 when 'identity_ambiguous' then 'identity_ambiguous'
                 when 'active_identity_other_context' then 'active_identity_other_context'
                 when 'traceability_conflict' then 'traceability_conflict'
                 else 'invalid'
               end,
               conversion_attempt_count = conversion_attempt_count + 1,
               conversion_last_error = coalesce(v_item->>'contract_code', 'ENTRY_CR_CONVERSION_NOT_READY'),
               conversion_last_attempted_at = now(),
               conversion_actor_user_id = p_actor_user_id
         where id = (v_item->>'resident_id')::uuid;

        perform public._cr_conversion_event_v1(
          v_campaign.id,
          v_unit.id,
          v_submission.id,
          'resident_conversion_blocked',
          p_actor_user_id,
          jsonb_build_object(
            'resident_id', (v_item->>'resident_id')::uuid,
            'category', v_item->>'category',
            'contract_code', coalesce(v_item->>'contract_code', 'ENTRY_CR_CONVERSION_NOT_READY'),
            'position', (v_item->>'position')::integer
          )
        );
      end if;
    end loop;

    return jsonb_build_object(
      'campaign_unit_id', v_unit.id,
      'submission_id', v_submission.id,
      'status', 'blocked',
      'blocking_count', v_blocked,
      'results', v_preview->'residents'
    );
  end if;

  for v_item in
    select value from jsonb_array_elements(v_preview->'residents')
  loop
    select * into v_resident
      from public.community_registration_residents
     where id = (v_item->>'resident_id')::uuid
     for update;

    v_queue_id := nullif(v_item->>'related_activation_queue_id', '')::uuid;
    v_method := public._cr_conversion_activation_method_v1(v_resident.email, v_resident.phone);

    if v_item->>'category' = 'ready_new' then
      v_username := null;
      if v_method = 'username_pin' then
        v_username := public._cr_conversion_suggest_username_v1(
          v_resident.full_name,
          v_campaign.community_id,
          v_resident.id
        );
      end if;

      begin
        insert into public.resident_activation_queue (
          community_id,
          house_id,
          unit_label,
          resident_name,
          phone,
          email,
          is_owner_reference,
          suggested_username,
          activation_method,
          status,
          source,
          raw_data,
          created_by,
          community_registration_resident_id
        )
        values (
          v_campaign.community_id,
          v_unit.house_id,
          v_unit.unit_label_snapshot,
          v_resident.full_name,
          v_resident.phone,
          public._cr_conversion_normalize_email_v1(v_resident.email),
          coalesce(v_resident.is_owner_reference, false),
          v_username,
          v_method,
          'pending',
          'community_registration_v1',
          jsonb_build_object(
            'source_version', 'v1',
            'campaign_id', v_campaign.id,
            'campaign_unit_id', v_unit.id,
            'submission_id', v_submission.id,
            'community_registration_resident_id', v_resident.id,
            'resident_position', v_resident.position,
            'relationship_to_house', v_resident.relationship_to_house
          ),
          p_actor_user_id,
          v_resident.id
        )
        returning id into v_queue_id;
      exception
        when unique_violation then
          select *
            into v_queue
            from public.resident_activation_queue
           where community_registration_resident_id = v_resident.id
           for update;

          if not found
             or v_queue.community_id <> v_campaign.community_id
             or (
               v_queue.house_id is not null
               and v_queue.house_id <> v_unit.house_id
             )
             or (
               v_queue.house_id is null
               and public.normalize_unit_label(v_queue.unit_label)
                   <> public.normalize_unit_label(v_unit.unit_label_snapshot)
             ) then
            perform public._cr_raise_v1('ENTRY_CR_TRACEABILITY_CONFLICT', 'P0409');
          end if;

          v_queue_id := v_queue.id;
      end;

      if v_queue_id is null then
        select id
          into v_queue_id
          from public.resident_activation_queue
         where community_registration_resident_id = v_resident.id
         for update;
      end if;

      update public.community_registration_residents
         set activation_queue_id = v_queue_id,
             conversion_status = 'converted',
             conversion_attempt_count = conversion_attempt_count + 1,
             conversion_last_error = null,
             conversion_last_attempted_at = now(),
             conversion_actor_user_id = p_actor_user_id,
             converted_at = now()
       where id = v_resident.id;

      v_converted := v_converted + 1;
      perform public._cr_conversion_event_v1(
        v_campaign.id,
        v_unit.id,
        v_submission.id,
        'resident_conversion_created',
        p_actor_user_id,
        jsonb_build_object(
          'resident_id', v_resident.id,
          'activation_queue_id', v_queue_id,
          'activation_method', v_method,
          'position', v_resident.position
        )
      );
    elsif v_item->>'category' in ('reuse_queue', 'already_linked') then
      select *
        into v_queue
        from public.resident_activation_queue
       where id = v_queue_id
       for update;

      if not found
         or v_queue.community_id <> v_campaign.community_id
         or v_queue.status not in ('pending', 'invited', 'pin_generated', 'activated')
         or (
           v_queue.house_id is not null
           and v_queue.house_id <> v_unit.house_id
         )
         or (
           v_queue.house_id is null
           and public.normalize_unit_label(v_queue.unit_label)
               <> public.normalize_unit_label(v_unit.unit_label_snapshot)
         )
         or (
           v_queue.community_registration_resident_id is not null
           and v_queue.community_registration_resident_id <> v_resident.id
         )
         or (v_queue.status = 'activated' and v_queue.activated_user_id is null) then
        perform public._cr_raise_v1('ENTRY_CR_TRACEABILITY_CONFLICT', 'P0409');
      end if;

      update public.resident_activation_queue
         set community_registration_resident_id = v_resident.id
       where id = v_queue_id
         and community_id = v_campaign.community_id
         and (
           community_registration_resident_id is null
           or community_registration_resident_id = v_resident.id
         );

      if not found then
        perform public._cr_raise_v1('ENTRY_CR_TRACEABILITY_CONFLICT', 'P0409');
      end if;

      v_conversion_status := case
        when v_queue.status = 'activated' then 'already_active'
        else 'already_queued'
      end;

      update public.community_registration_residents
         set activation_queue_id = v_queue_id,
             conversion_status = v_conversion_status,
             conversion_attempt_count = conversion_attempt_count + 1,
             conversion_last_error = null,
             conversion_last_attempted_at = now(),
             conversion_actor_user_id = p_actor_user_id,
             converted_at = now()
       where id = v_resident.id;

      if v_conversion_status = 'already_active' then
        v_already_active := v_already_active + 1;
        perform public._cr_conversion_event_v1(
          v_campaign.id,
          v_unit.id,
          v_submission.id,
          'resident_conversion_already_active',
          p_actor_user_id,
          jsonb_build_object(
            'resident_id', v_resident.id,
            'activation_queue_id', v_queue_id,
            'queue_status', v_queue.status,
            'position', v_resident.position
          )
        );
      else
        v_already_queued := v_already_queued + 1;
        perform public._cr_conversion_event_v1(
          v_campaign.id,
          v_unit.id,
          v_submission.id,
          'resident_conversion_reused_queue',
          p_actor_user_id,
          jsonb_build_object(
            'resident_id', v_resident.id,
            'activation_queue_id', v_queue_id,
            'queue_status', v_queue.status,
            'position', v_resident.position
          )
        );
      end if;
    elsif v_item->>'category' = 'already_active_same_house' then
      update public.community_registration_residents
         set activation_queue_id = null,
             conversion_status = 'already_active',
             conversion_attempt_count = conversion_attempt_count + 1,
             conversion_last_error = null,
             conversion_last_attempted_at = now(),
             conversion_actor_user_id = p_actor_user_id,
             converted_at = now()
       where id = v_resident.id;

      v_already_active := v_already_active + 1;
      perform public._cr_conversion_event_v1(
        v_campaign.id,
        v_unit.id,
        v_submission.id,
        'resident_conversion_already_active',
        p_actor_user_id,
        jsonb_build_object(
          'resident_id', v_resident.id,
          'position', v_resident.position
        )
      );
    else
      perform public._cr_raise_v1('ENTRY_CR_CONVERSION_INCOMPLETE', 'P0409');
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'resident_id', v_resident.id,
      'position', v_resident.position,
      'category', v_item->>'category',
      'activation_queue_id', v_queue_id,
      'activation_method', v_method
    ));
  end loop;

  if exists (
    select 1
      from public.community_registration_residents r
     where r.submission_id = v_submission.id
       and r.conversion_status not in ('converted', 'already_queued', 'already_active')
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONVERSION_INCOMPLETE', 'P0409');
  end if;

  update public.community_registration_submissions
     set status = 'converted',
         converted_at = now()
   where id = v_submission.id;

  update public.community_registration_units
     set status = 'processed',
         processed_at = now()
   where id = v_unit.id;

  perform public._cr_conversion_event_v1(
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'unit_conversion_completed',
    p_actor_user_id,
    jsonb_build_object(
      'converted_count', v_converted,
      'already_queued_count', v_already_queued,
      'already_active_count', v_already_active,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'processed'
    )
  );

  return jsonb_build_object(
    'campaign_unit_id', v_unit.id,
    'submission_id', v_submission.id,
    'status', 'processed',
    'converted_count', v_converted,
    'already_queued_count', v_already_queued,
    'already_active_count', v_already_active,
    'results', v_results
  );
end;
$function$;

comment on function public.record_community_registration_unit_external_approval_v1(uuid, uuid, text) is
  'ENTRY internal RPC. Records external Patronato approval for one current reviewed unit without finalizing the campaign. service_role only.';

comment on function public.mark_community_registration_unit_reviewed_v1(uuid, uuid) is
  'ENTRY internal RPC. Marks one submitted unit as reviewed while preserving open/review campaign status. service_role only.';

comment on function public.convert_community_registration_unit_to_activation_v1(uuid, uuid, text) is
  'ENTRY internal RPC. Atomically converts one confirmed campaign unit into resident_activation_queue rows without finalizing the campaign. Does not create PINs or users. service_role only.';

revoke all on function public.record_community_registration_unit_external_approval_v1(uuid, uuid, text) from public;
revoke all on function public.record_community_registration_unit_external_approval_v1(uuid, uuid, text) from anon;
revoke all on function public.record_community_registration_unit_external_approval_v1(uuid, uuid, text) from authenticated;
grant execute on function public.record_community_registration_unit_external_approval_v1(uuid, uuid, text) to service_role;
