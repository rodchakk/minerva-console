-- ENTRY Resident Registration modes + cancellation.
--
-- Adds explicit campaign mode selection and a cancellation state while keeping
-- public submissions in Community Registration staging tables. Resident-provided
-- unit submissions intentionally do not create operational houses.

alter table public.community_registration_campaigns
  add column if not exists registration_mode text not null default 'existing_units';

alter table public.community_registration_campaigns
  drop constraint if exists cr_campaigns_registration_mode_check;

alter table public.community_registration_campaigns
  add constraint cr_campaigns_registration_mode_check
  check (registration_mode in ('existing_units', 'resident_provided_units'));

alter table public.community_registration_campaigns
  drop constraint if exists cr_campaigns_status_check;

alter table public.community_registration_campaigns
  add constraint cr_campaigns_status_check
  check (status in (
    'draft', 'open', 'paused',
    'review', 'confirmed',
    'processed', 'closed', 'cancelled'
  ));

drop index if exists public.idx_cr_campaigns_one_active_per_community;
create unique index if not exists idx_cr_campaigns_one_active_per_community
  on public.community_registration_campaigns (community_id)
  where status in ('open', 'paused', 'review', 'confirmed');

alter table public.community_registration_residents
  drop constraint if exists cr_residents_submission_identity_fk;

alter table public.community_registration_submissions
  drop constraint if exists cr_submissions_unit_identity_fk;

alter table public.community_registration_units
  drop constraint if exists cr_units_house_community_fk;

alter table public.community_registration_units
  alter column house_id drop not null;

alter table public.community_registration_submissions
  alter column house_id drop not null;

alter table public.community_registration_residents
  alter column house_id drop not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'cr_units_identity_without_house_unique'
       and conrelid = 'public.community_registration_units'::regclass
  ) then
    alter table public.community_registration_units
      add constraint cr_units_identity_without_house_unique
      unique (id, campaign_id, community_id);
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'cr_submissions_identity_without_house_unique'
       and conrelid = 'public.community_registration_submissions'::regclass
  ) then
    alter table public.community_registration_submissions
      add constraint cr_submissions_identity_without_house_unique
      unique (id, campaign_id, community_id, campaign_unit_id);
  end if;
end;
$$;

alter table public.community_registration_units
  add constraint cr_units_house_community_fk
  foreign key (house_id, community_id)
  references public.houses(id, community_id)
  on delete restrict;

alter table public.community_registration_submissions
  add constraint cr_submissions_unit_identity_fk
  foreign key (campaign_unit_id, campaign_id, community_id)
  references public.community_registration_units(id, campaign_id, community_id)
  on delete restrict;

alter table public.community_registration_residents
  add constraint cr_residents_submission_identity_fk
  foreign key (submission_id, campaign_id, community_id, campaign_unit_id)
  references public.community_registration_submissions(id, campaign_id, community_id, campaign_unit_id)
  on delete restrict;

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

create or replace function public.launch_community_registration_campaign_v3(
  p_community_id uuid,
  p_house_ids uuid[],
  p_internal_name text,
  p_public_title text,
  p_public_instructions text default null,
  p_public_slug text default null,
  p_default_resident_limit integer default 3,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null,
  p_campaign_token_hash text default null,
  p_encrypted_token_payload text default null,
  p_registration_mode text default 'existing_units',
  p_unit_overrides jsonb default '{}'::jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_slug text;
  v_campaign_id uuid;
  v_token_id uuid;
  v_units_result jsonb := '{}'::jsonb;
  v_registration_mode text := lower(btrim(coalesce(p_registration_mode, 'existing_units')));
  v_requested_unit_count integer := coalesce(array_length(p_house_ids, 1), 0);
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  if v_registration_mode not in ('existing_units', 'resident_provided_units') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  if v_registration_mode = 'existing_units' and v_requested_unit_count = 0 then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  if v_registration_mode = 'resident_provided_units' and v_requested_unit_count > 0 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  if p_community_id is null or not exists (
    select 1 from public.communities where id = p_community_id
  ) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TENANT', '42501');
  end if;

  if public._cr_normalize_name_v1(p_internal_name) is null
     or public._cr_normalize_name_v1(p_public_title) is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  if coalesce(p_default_resident_limit, 3) <= 0 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_LIMIT');
  end if;

  if p_opens_at is not null and p_closes_at is not null and p_closes_at <= p_opens_at then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  v_slug := public._cr_normalize_slug_v1(p_public_slug);
  if v_slug is null or v_slug !~ '^[a-z0-9][a-z0-9-]{5,95}$' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  if p_campaign_token_hash is null or length(btrim(p_campaign_token_hash)) < 32 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN');
  end if;

  if p_encrypted_token_payload is null
     or btrim(p_encrypted_token_payload) <> p_encrypted_token_payload
     or p_encrypted_token_payload not like 'v1:%:%:%'
     or length(p_encrypted_token_payload) < 48 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN');
  end if;

  if exists (
    select 1
      from public.community_registration_campaigns
     where lower(public_slug) = v_slug
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFLICT', 'P0409');
  end if;

  if exists (
    select 1
      from public.community_registration_campaigns
     where community_id = p_community_id
       and status in ('open', 'paused', 'review', 'confirmed')
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFLICT', 'P0409');
  end if;

  insert into public.community_registration_campaigns (
    community_id,
    internal_name,
    public_title,
    public_instructions,
    public_slug,
    status,
    registration_mode,
    default_resident_limit,
    opens_at,
    closes_at,
    created_by,
    updated_by
  )
  values (
    p_community_id,
    public._cr_normalize_name_v1(p_internal_name),
    public._cr_normalize_name_v1(p_public_title),
    nullif(btrim(p_public_instructions), ''),
    v_slug,
    'open',
    v_registration_mode,
    coalesce(p_default_resident_limit, 3),
    p_opens_at,
    p_closes_at,
    p_actor_user_id,
    p_actor_user_id
  )
  returning id into v_campaign_id;

  insert into public.community_registration_access_tokens (
    campaign_id,
    token_type,
    token_hash,
    encrypted_token_payload,
    status,
    created_by
  )
  values (
    v_campaign_id,
    'campaign_access',
    btrim(p_campaign_token_hash),
    p_encrypted_token_payload,
    'active',
    p_actor_user_id
  )
  returning id into v_token_id;

  if v_registration_mode = 'existing_units' then
    v_units_result := public.add_community_registration_units_v1(
      v_campaign_id,
      p_house_ids,
      coalesce(p_unit_overrides, '{}'::jsonb),
      p_actor_user_id
    );
  end if;

  insert into public.community_registration_events (
    campaign_id,
    event_type,
    actor_type,
    actor_user_id,
    access_token_id,
    metadata
  )
  values (
    v_campaign_id,
    'campaign_created',
    'service_role',
    p_actor_user_id,
    v_token_id,
    jsonb_build_object(
      'community_id', p_community_id,
      'registration_mode', v_registration_mode,
      'default_resident_limit', coalesce(p_default_resident_limit, 3),
      'has_campaign_token', true,
      'has_encrypted_token_payload', true
    )
  );

  return jsonb_build_object(
    'campaign_id', v_campaign_id,
    'community_id', p_community_id,
    'public_slug', v_slug,
    'status', 'open',
    'registration_mode', v_registration_mode,
    'default_resident_limit', coalesce(p_default_resident_limit, 3),
    'campaign_token_id', v_token_id,
    'requested_unit_count', v_requested_unit_count,
    'inserted_unit_count', coalesce((v_units_result ->> 'inserted_count')::integer, 0),
    'existing_unit_count', coalesce((v_units_result ->> 'existing_count')::integer, 0),
    'updated_unit_count', coalesce((v_units_result ->> 'updated_count')::integer, 0)
  );
end;
$function$;

create or replace function public.resolve_community_registration_campaign_v1(
  p_public_slug text,
  p_campaign_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_slug text := public._cr_normalize_slug_v1(p_public_slug);
  v_campaign public.community_registration_campaigns%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_community_name text;
begin
  perform public._cr_service_role_only_v1();

  select c.*
    into v_campaign
    from public.community_registration_campaigns c
   where lower(c.public_slug) = v_slug
     and exists (
       select 1
         from public.community_registration_access_tokens t
        where t.campaign_id = c.id
          and t.token_type = 'campaign_access'
          and t.token_hash = btrim(coalesce(p_campaign_token_hash, ''))
     )
   limit 1;

  if not found then
    return jsonb_build_object(
      'available', false,
      'error_code', 'ENTRY_CR_CAMPAIGN_UNAVAILABLE'
    );
  end if;

  select * into v_token
    from public.community_registration_access_tokens
   where campaign_id = v_campaign.id
     and token_type = 'campaign_access'
     and token_hash = btrim(coalesce(p_campaign_token_hash, ''))
   limit 1;

  if v_token.status <> 'active'
     or (v_token.expires_at is not null and v_token.expires_at <= now())
     or v_campaign.status <> 'open'
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now()) then
    return jsonb_build_object(
      'available', false,
      'error_code', 'ENTRY_CR_CAMPAIGN_UNAVAILABLE'
    );
  end if;

  select name into v_community_name
    from public.communities
   where id = v_campaign.community_id;

  return jsonb_build_object(
    'available', true,
    'public_title', v_campaign.public_title,
    'public_instructions', v_campaign.public_instructions,
    'community_name', v_community_name,
    'registration_mode', v_campaign.registration_mode,
    'default_resident_limit', v_campaign.default_resident_limit,
    'closes_at', v_campaign.closes_at
  );
end;
$function$;

create or replace function public.lookup_community_registration_unit_v1(
  p_public_slug text,
  p_campaign_token_hash text,
  p_unit_label text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_slug text := public._cr_normalize_slug_v1(p_public_slug);
  v_label text := public._cr_normalize_unit_label_v1(p_unit_label);
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
begin
  perform public._cr_service_role_only_v1();

  select c.* into v_campaign
    from public.community_registration_campaigns c
    join public.community_registration_access_tokens t
      on t.campaign_id = c.id
     and t.token_type = 'campaign_access'
     and t.token_hash = btrim(coalesce(p_campaign_token_hash, ''))
     and t.status = 'active'
     and (t.expires_at is null or t.expires_at > now())
     and t.consumed_at is null
     and t.revoked_at is null
   where lower(c.public_slug) = v_slug
     and c.status = 'open'
     and (c.opens_at is null or c.opens_at <= now())
     and (c.closes_at is null or c.closes_at > now())
   limit 1;

  if not found or v_label is null then
    return jsonb_build_object(
      'can_start', false,
      'error_code', 'ENTRY_CR_UNIT_UNAVAILABLE'
    );
  end if;

  select * into v_unit
    from public.community_registration_units
   where campaign_id = v_campaign.id
     and normalized_unit_label = v_label;

  if v_campaign.registration_mode = 'resident_provided_units' then
    if found then
      return jsonb_build_object(
        'can_start', false,
        'error_code', 'ENTRY_CR_UNIT_ALREADY_REGISTERED'
      );
    end if;

    return jsonb_build_object(
      'can_start', true,
      'unit_label', public._cr_normalize_name_v1(p_unit_label),
      'effective_resident_limit', v_campaign.default_resident_limit,
      'registration_mode', v_campaign.registration_mode
    );
  end if;

  if not found or v_unit.status <> 'unregistered' then
    return jsonb_build_object(
      'can_start', false,
      'error_code', 'ENTRY_CR_UNIT_UNAVAILABLE'
    );
  end if;

  return jsonb_build_object(
    'can_start', true,
    'unit_label', v_unit.unit_label_snapshot,
    'effective_resident_limit', coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit),
    'registration_mode', v_campaign.registration_mode
  );
end;
$function$;

create or replace function public.submit_community_registration_household_v1(
  p_public_slug text,
  p_campaign_token_hash text,
  p_unit_label text,
  p_residents jsonb,
  p_technical_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_slug text := public._cr_normalize_slug_v1(p_public_slug);
  v_label text := public._cr_normalize_unit_label_v1(p_unit_label);
  v_display_label text := public._cr_normalize_name_v1(p_unit_label);
  v_campaign public.community_registration_campaigns%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_effective_limit integer;
  v_validated jsonb;
  v_resident jsonb;
  v_submission_id uuid;
  v_version integer;
begin
  perform public._cr_service_role_only_v1();

  if coalesce(jsonb_typeof(p_technical_metadata), 'object') <> 'object' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_METADATA');
  end if;

  select c.* into v_campaign
    from public.community_registration_campaigns c
   where lower(c.public_slug) = v_slug
   for update;

  if not found then
    return jsonb_build_object('accepted', false, 'error_code', 'ENTRY_CR_CAMPAIGN_UNAVAILABLE');
  end if;

  select * into v_token
    from public.community_registration_access_tokens
   where campaign_id = v_campaign.id
     and token_type = 'campaign_access'
     and token_hash = btrim(coalesce(p_campaign_token_hash, ''))
   for update;

  if not found
     or v_token.status <> 'active'
     or (v_token.expires_at is not null and v_token.expires_at <= now())
     or v_token.consumed_at is not null
     or v_token.revoked_at is not null
     or v_campaign.status <> 'open'
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now()) then
    return jsonb_build_object('accepted', false, 'error_code', 'ENTRY_CR_CAMPAIGN_UNAVAILABLE');
  end if;

  if v_label is null or v_display_label is null then
    return jsonb_build_object('accepted', false, 'error_code', 'ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  if v_campaign.registration_mode = 'resident_provided_units' then
    insert into public.community_registration_units (
      campaign_id,
      community_id,
      house_id,
      unit_label_snapshot,
      normalized_unit_label,
      status
    )
    values (
      v_campaign.id,
      v_campaign.community_id,
      null,
      v_display_label,
      v_label,
      'unregistered'
    )
    on conflict (campaign_id, normalized_unit_label) do nothing
    returning * into v_unit;

    if not found then
      select * into v_unit
        from public.community_registration_units
       where campaign_id = v_campaign.id
         and normalized_unit_label = v_label
       for update;

      return jsonb_build_object('accepted', false, 'error_code', 'ENTRY_CR_UNIT_ALREADY_REGISTERED');
    end if;
  else
    select * into v_unit
      from public.community_registration_units
     where campaign_id = v_campaign.id
       and normalized_unit_label = v_label
     for update;

    if not found or v_unit.status <> 'unregistered' then
      return jsonb_build_object(
        'accepted', false,
        'error_code', 'ENTRY_CR_UNIT_UNAVAILABLE'
      );
    end if;
  end if;

  v_effective_limit := coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit);
  v_validated := public._cr_validate_residents_v1(p_residents, v_effective_limit);

  select coalesce(max(version_number), 0) + 1
    into v_version
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id;

  insert into public.community_registration_submissions (
    campaign_unit_id,
    campaign_id,
    community_id,
    house_id,
    version_number,
    status,
    submitted_at,
    locked_at
  )
  values (
    v_unit.id,
    v_campaign.id,
    v_campaign.community_id,
    v_unit.house_id,
    v_version,
    'submitted',
    now(),
    now()
  )
  returning id into v_submission_id;

  for v_resident in
    select value from jsonb_array_elements(v_validated->'residents')
  loop
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
      v_submission_id,
      v_campaign.id,
      v_campaign.community_id,
      v_unit.id,
      v_unit.house_id,
      (v_resident->>'position')::integer,
      v_resident->>'full_name',
      v_resident->>'email',
      v_resident->>'phone',
      v_resident->>'normalized_full_name',
      v_resident->>'normalized_email',
      v_resident->>'normalized_phone',
      v_resident->>'relationship_to_house',
      (v_resident->>'is_owner_reference')::boolean,
      'valid'
    );
  end loop;

  update public.community_registration_units
     set status = 'submitted',
         last_submitted_at = now()
   where id = v_unit.id;

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
    v_submission_id,
    'household_submitted',
    'resident_token',
    v_token.id,
    jsonb_build_object(
      'resident_count', (v_validated->>'resident_count')::integer,
      'version', v_version,
      'registration_mode', v_campaign.registration_mode,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'submitted',
      'metadata_keys', coalesce((
        select jsonb_agg(key)
          from jsonb_object_keys(coalesce(p_technical_metadata, '{}'::jsonb)) as key
      ), '[]'::jsonb)
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'receipt', jsonb_build_object(
      'version', v_version,
      'unit_label', v_unit.unit_label_snapshot,
      'resident_count', (v_validated->>'resident_count')::integer,
      'submitted_at', now()
    )
  );
end;
$function$;

create or replace function public.cancel_community_registration_campaign_v1(
  p_campaign_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_submission_count integer := 0;
  v_unit_count integer := 0;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_UNAVAILABLE');
  end if;

  if v_campaign.status not in ('open', 'paused') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  select count(*)::integer into v_unit_count
    from public.community_registration_units
   where campaign_id = v_campaign.id;

  select count(*)::integer into v_submission_count
    from public.community_registration_submissions
   where campaign_id = v_campaign.id
     and status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted');

  update public.community_registration_campaigns
     set status = 'cancelled',
         closed_at = coalesce(closed_at, now()),
         updated_by = p_actor_user_id
   where id = v_campaign.id;

  insert into public.community_registration_events (
    campaign_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_campaign.id,
    'campaign_cancelled',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'previous_status', v_campaign.status,
      'registration_mode', v_campaign.registration_mode,
      'preserved_unit_count', v_unit_count,
      'preserved_submission_count', v_submission_count
    )
  );

  return jsonb_build_object(
    'campaign_id', v_campaign.id,
    'community_id', v_campaign.community_id,
    'status', 'cancelled',
    'registration_mode', v_campaign.registration_mode,
    'preserved_unit_count', v_unit_count,
    'preserved_submission_count', v_submission_count
  );
end;
$function$;

comment on column public.community_registration_campaigns.registration_mode is
  'ENTRY resident registration mode. existing_units preserves legacy house lookup; resident_provided_units stages resident-proposed unit labels without creating operational houses.';

comment on function public.launch_community_registration_campaign_v3(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, text, text, jsonb, uuid
) is
  'ENTRY internal RPC. Atomically creates an open Community Registration campaign with explicit registration mode. Resident-provided unit mode creates no operational house rows. service_role only.';

comment on function public.cancel_community_registration_campaign_v1(uuid, uuid) is
  'ENTRY internal RPC. Cancels an open or paused Community Registration campaign, preserving submitted staging data and historical access-token rows. service_role only.';

revoke all on function public.launch_community_registration_campaign_v3(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, text, text, jsonb, uuid
) from public;
revoke all on function public.cancel_community_registration_campaign_v1(uuid, uuid) from public;

revoke all on function public.launch_community_registration_campaign_v3(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, text, text, jsonb, uuid
) from anon;
revoke all on function public.cancel_community_registration_campaign_v1(uuid, uuid) from anon;

revoke all on function public.launch_community_registration_campaign_v3(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, text, text, jsonb, uuid
) from authenticated;
revoke all on function public.cancel_community_registration_campaign_v1(uuid, uuid) from authenticated;

grant execute on function public.launch_community_registration_campaign_v3(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, text, text, jsonb, uuid
) to service_role;
grant execute on function public.cancel_community_registration_campaign_v1(uuid, uuid) to service_role;
