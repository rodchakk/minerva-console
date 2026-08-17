-- ENTRY-ONB-008: Internal review UI backend hardening v1.
--
-- Adds recoverable resident correction-link rotation and exposes the current
-- correction observation only through the already-authorized edit-token RPC.
-- No auth/profile/activation writes are introduced.

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
    'campaign_access_replaced',
    'resident_edit_access_replaced'
  ));

create or replace function public.rotate_community_registration_edit_access_v1(
  p_campaign_unit_id uuid,
  p_edit_token_hash text,
  p_expires_at timestamptz,
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
  v_token_id uuid;
  v_revoked_count integer := 0;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_edit_token_hash is null or length(btrim(p_edit_token_hash)) < 32 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN');
  end if;

  if p_expires_at is null or p_expires_at <= now() then
    perform public._cr_raise_v1('ENTRY_CR_TOKEN_EXPIRED');
  end if;

  select campaign_id into v_campaign_id
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_campaign_id
   for update;

  if not found
     or v_campaign.status not in ('open', 'review')
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now()) then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_UNAVAILABLE', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found or v_unit.status <> 'edit_enabled' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and campaign_id = v_campaign.id
     and status = 'edit_enabled'
   order by version_number desc
   limit 1
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  update public.community_registration_access_tokens
     set status = 'revoked',
         revoked_at = now()
   where campaign_id = v_campaign.id
     and campaign_unit_id = v_unit.id
     and token_type = 'resident_edit'
     and status = 'active';

  get diagnostics v_revoked_count = row_count;

  insert into public.community_registration_access_tokens (
    campaign_id,
    campaign_unit_id,
    submission_id,
    token_type,
    token_hash,
    status,
    expires_at,
    created_by
  )
  values (
    v_campaign.id,
    v_unit.id,
    v_submission.id,
    'resident_edit',
    btrim(p_edit_token_hash),
    'active',
    p_expires_at,
    p_actor_user_id
  )
  returning id into v_token_id;

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
    'resident_edit_access_replaced',
    'entry_admin',
    p_actor_user_id,
    v_token_id,
    jsonb_build_object(
      'campaign_status', v_campaign.status,
      'version', v_submission.version_number,
      'revoked_previous_count', v_revoked_count,
      'reason_length', length(nullif(btrim(p_reason), ''))
    )
  );

  return jsonb_build_object(
    'campaign_id', v_campaign.id,
    'campaign_unit_id', v_unit.id,
    'submission_id', v_submission.id,
    'public_slug', v_campaign.public_slug,
    'expires_at', p_expires_at,
    'revoked_previous_count', v_revoked_count
  );
end;
$function$;

create or replace function public.resolve_community_registration_edit_v1(
  p_edit_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token public.community_registration_access_tokens%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_residents jsonb;
  v_correction_observation text;
begin
  perform public._cr_service_role_only_v1();

  select * into v_token
    from public.community_registration_access_tokens
   where token_hash = btrim(coalesce(p_edit_token_hash, ''))
     and token_type = 'resident_edit'
   for update;

  if not found
     or v_token.status <> 'active'
     or v_token.expires_at is null
     or v_token.expires_at <= now()
     or v_token.revoked_at is not null
     or v_token.consumed_at is not null
     or v_token.campaign_unit_id is null
     or v_token.submission_id is null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN', '42501');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = v_token.campaign_unit_id
     and campaign_id = v_token.campaign_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where id = v_token.submission_id
     and campaign_unit_id = v_token.campaign_unit_id
     and campaign_id = v_token.campaign_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_token.campaign_id;

  if not found
     or v_unit.status <> 'edit_enabled'
     or v_submission.status <> 'edit_enabled'
     or v_campaign.status not in ('open', 'review')
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now()) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  select observation_text
    into v_correction_observation
    from public.community_registration_reviews
   where campaign_unit_id = v_unit.id
     and submission_id = v_submission.id
     and decision = 'correction_requested'
     and is_current
     and resolution_status = 'pending'
   order by created_at desc
   limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position', r.position,
    'full_name', r.full_name,
    'email', r.email,
    'phone', r.phone,
    'relationship_to_house', r.relationship_to_house,
    'is_owner_reference', r.is_owner_reference
  ) order by r.position), '[]'::jsonb)
  into v_residents
  from public.community_registration_residents r
  where r.submission_id = v_submission.id;

  return jsonb_build_object(
    'campaign', jsonb_build_object(
      'public_title', v_campaign.public_title,
      'public_instructions', v_campaign.public_instructions,
      'public_slug', v_campaign.public_slug
    ),
    'unit_label', v_unit.unit_label_snapshot,
    'effective_resident_limit', coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit),
    'expires_at', v_token.expires_at,
    'correction_observation', v_correction_observation,
    'residents', v_residents
  );
end;
$function$;

revoke all on function public.rotate_community_registration_edit_access_v1(uuid, text, timestamptz, uuid, text) from public;
revoke all on function public.rotate_community_registration_edit_access_v1(uuid, text, timestamptz, uuid, text) from anon;
revoke all on function public.rotate_community_registration_edit_access_v1(uuid, text, timestamptz, uuid, text) from authenticated;
grant execute on function public.rotate_community_registration_edit_access_v1(uuid, text, timestamptz, uuid, text) to service_role;

revoke all on function public.resolve_community_registration_edit_v1(text) from public;
revoke all on function public.resolve_community_registration_edit_v1(text) from anon;
revoke all on function public.resolve_community_registration_edit_v1(text) from authenticated;
grant execute on function public.resolve_community_registration_edit_v1(text) to service_role;
