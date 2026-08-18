-- ENTRY-ONB-009: Recoverable Community Registration campaign links.
--
-- Forward-only migration. Adds encrypted campaign capability recovery material
-- for campaign_access tokens only. Plaintext capabilities remain application
-- server-only and are never stored in Supabase.

alter table public.community_registration_access_tokens
  add column if not exists encrypted_token_payload text;

alter table public.community_registration_access_tokens
  drop constraint if exists cr_tokens_encrypted_campaign_payload_scope;

alter table public.community_registration_access_tokens
  add constraint cr_tokens_encrypted_campaign_payload_scope
  check (
    encrypted_token_payload is null
    or (
      token_type = 'campaign_access'
      and campaign_unit_id is null
      and submission_id is null
      and encrypted_token_payload = btrim(encrypted_token_payload)
      and encrypted_token_payload like 'v1:%:%:%'
      and length(encrypted_token_payload) >= 48
    )
  );

comment on column public.community_registration_access_tokens.encrypted_token_payload is
  'Application-layer encrypted campaign access token payload for ENTRY-ONB-009 recovery. Scoped to campaign_access only; plaintext is never stored in Supabase.';

create or replace function public.launch_community_registration_campaign_v2(
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
  v_units_result jsonb;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
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

  v_units_result := public.add_community_registration_units_v1(
    v_campaign_id,
    p_house_ids,
    coalesce(p_unit_overrides, '{}'::jsonb),
    p_actor_user_id
  );

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
    'default_resident_limit', coalesce(p_default_resident_limit, 3),
    'campaign_token_id', v_token_id,
    'requested_unit_count', array_length(p_house_ids, 1),
    'inserted_unit_count', coalesce((v_units_result ->> 'inserted_count')::integer, 0),
    'existing_unit_count', coalesce((v_units_result ->> 'existing_count')::integer, 0),
    'updated_unit_count', coalesce((v_units_result ->> 'updated_count')::integer, 0)
  );
end;
$function$;

create or replace function public.rotate_community_registration_campaign_access_v2(
  p_campaign_id uuid,
  p_campaign_token_hash text,
  p_encrypted_token_payload text,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_active_count integer := 0;
  v_token_id uuid;
  v_revoked_count integer := 0;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
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

  select * into v_campaign
    from public.community_registration_campaigns
   where id = p_campaign_id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_UNAVAILABLE');
  end if;

  if v_campaign.status <> 'open' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  update public.community_registration_access_tokens
     set status = 'revoked',
         revoked_at = now()
   where campaign_id = v_campaign.id
     and token_type = 'campaign_access'
     and status = 'active';

  get diagnostics v_revoked_count = row_count;

  insert into public.community_registration_access_tokens (
    campaign_id,
    token_type,
    token_hash,
    encrypted_token_payload,
    status,
    created_by
  )
  values (
    v_campaign.id,
    'campaign_access',
    btrim(p_campaign_token_hash),
    p_encrypted_token_payload,
    'active',
    p_actor_user_id
  )
  returning id into v_token_id;

  select count(*) into v_active_count
    from public.community_registration_access_tokens
   where campaign_id = v_campaign.id
     and token_type = 'campaign_access'
     and status = 'active';

  if v_active_count <> 1 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN_STATE');
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
    v_campaign.id,
    'campaign_access_replaced',
    'entry_admin',
    p_actor_user_id,
    v_token_id,
    jsonb_build_object(
      'campaign_status', v_campaign.status,
      'revoked_previous_count', v_revoked_count,
      'has_encrypted_token_payload', true
    )
  );

  return jsonb_build_object(
    'campaign_id', v_campaign.id,
    'community_id', v_campaign.community_id,
    'public_slug', v_campaign.public_slug,
    'campaign_status', v_campaign.status,
    'revoked_previous_count', v_revoked_count
  );
end;
$function$;

comment on function public.launch_community_registration_campaign_v2(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, text, jsonb, uuid
) is
  'ENTRY internal RPC. Atomically creates an open Community Registration campaign, campaign_access token hash, encrypted recovery payload, and selected existing units. service_role only.';

comment on function public.rotate_community_registration_campaign_access_v2(uuid, text, text, uuid) is
  'ENTRY internal RPC. Replaces a campaign_access token hash and encrypted recovery payload in one transaction, revoking previous active access. service_role only.';

revoke all on function public.launch_community_registration_campaign_v2(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, text, jsonb, uuid
) from public;
revoke all on function public.rotate_community_registration_campaign_access_v2(uuid, text, text, uuid) from public;

revoke all on function public.launch_community_registration_campaign_v2(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, text, jsonb, uuid
) from anon;
revoke all on function public.rotate_community_registration_campaign_access_v2(uuid, text, text, uuid) from anon;

revoke all on function public.launch_community_registration_campaign_v2(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, text, jsonb, uuid
) from authenticated;
revoke all on function public.rotate_community_registration_campaign_access_v2(uuid, text, text, uuid) from authenticated;

grant execute on function public.launch_community_registration_campaign_v2(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, text, jsonb, uuid
) to service_role;
grant execute on function public.rotate_community_registration_campaign_access_v2(uuid, text, text, uuid) to service_role;
