-- ENTRY-ONB-007: Community Registration launch UI hardening.
--
-- Forward-only migration. Adds service-role-only RPCs for:
-- 1. atomic campaign launch (campaign + access token hash + units); and
-- 2. campaign-access token replacement after plaintext link loss.
--
-- The RPCs receive only token hashes. They never receive, store, return, log,
-- or derive plaintext campaign capabilities.

alter table public.community_registration_events
  drop constraint if exists cr_events_type_check;

alter table public.community_registration_events
  add constraint cr_events_type_check
  check (event_type in (
    'campaign_created',
    'campaign_opened',
    'campaign_paused',
    'campaign_closed',
    'units_added',
    'household_submitted',
    'resident_edit_enabled',
    'resident_edit_token_revoked',
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

create or replace function public.launch_community_registration_campaign_v1(
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
  p_unit_overrides jsonb default '{}'::jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign_result jsonb;
  v_units_result jsonb;
  v_campaign_id uuid;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_actor_user_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;

  if p_campaign_token_hash is null or length(btrim(p_campaign_token_hash)) < 32 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN');
  end if;

  v_campaign_result := public.create_community_registration_campaign_v1(
    p_community_id,
    p_internal_name,
    p_public_title,
    p_public_instructions,
    p_public_slug,
    p_default_resident_limit,
    p_opens_at,
    p_closes_at,
    p_campaign_token_hash,
    p_actor_user_id
  );

  v_campaign_id := nullif(v_campaign_result ->> 'campaign_id', '')::uuid;

  if v_campaign_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
  end if;

  v_units_result := public.add_community_registration_units_v1(
    v_campaign_id,
    p_house_ids,
    coalesce(p_unit_overrides, '{}'::jsonb),
    p_actor_user_id
  );

  return jsonb_build_object(
    'campaign_id', v_campaign_id,
    'community_id', p_community_id,
    'public_slug', v_campaign_result ->> 'public_slug',
    'status', v_campaign_result ->> 'status',
    'default_resident_limit', (v_campaign_result ->> 'default_resident_limit')::integer,
    'requested_unit_count', array_length(p_house_ids, 1),
    'inserted_unit_count', coalesce((v_units_result ->> 'inserted_count')::integer, 0),
    'existing_unit_count', coalesce((v_units_result ->> 'existing_count')::integer, 0),
    'updated_unit_count', coalesce((v_units_result ->> 'updated_count')::integer, 0)
  );
end;
$function$;

create or replace function public.rotate_community_registration_campaign_access_v1(
  p_campaign_id uuid,
  p_campaign_token_hash text,
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
    status,
    created_by
  )
  values (
    v_campaign.id,
    'campaign_access',
    btrim(p_campaign_token_hash),
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
      'revoked_previous_count', v_revoked_count
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

comment on function public.launch_community_registration_campaign_v1(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, jsonb, uuid
) is
  'ENTRY internal RPC. Atomically creates an open Community Registration campaign, hash-only campaign access token, and selected existing units. service_role only.';

comment on function public.rotate_community_registration_campaign_access_v1(uuid, text, uuid) is
  'ENTRY internal RPC. Replaces a campaign_access token hash for plaintext-link loss recovery, revoking the previous active hash and inserting exactly one replacement in one transaction. service_role only.';

revoke all on function public.launch_community_registration_campaign_v1(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, jsonb, uuid
) from public;
revoke all on function public.rotate_community_registration_campaign_access_v1(uuid, text, uuid) from public;

revoke all on function public.launch_community_registration_campaign_v1(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, jsonb, uuid
) from anon;
revoke all on function public.rotate_community_registration_campaign_access_v1(uuid, text, uuid) from anon;

revoke all on function public.launch_community_registration_campaign_v1(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, jsonb, uuid
) from authenticated;
revoke all on function public.rotate_community_registration_campaign_access_v1(uuid, text, uuid) from authenticated;

grant execute on function public.launch_community_registration_campaign_v1(
  uuid, uuid[], text, text, text, text, integer, timestamptz, timestamptz, text, jsonb, uuid
) to service_role;
grant execute on function public.rotate_community_registration_campaign_access_v1(uuid, text, uuid) to service_role;
