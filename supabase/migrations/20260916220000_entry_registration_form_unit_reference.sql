-- ENTRY public registration form hardening.
--
-- A resident-provided unit may include an optional human-readable reference
-- (street/block/location hint). The canonical unit label remains unchanged.
-- The reference stays in Community Registration staging until the unit is
-- reviewed/confirmed; it is not used as an ownership marker.

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
  v_unit_reference text;
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

  if p_technical_metadata ? 'unit_reference' then
    if jsonb_typeof(p_technical_metadata->'unit_reference') <> 'string' then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_METADATA');
    end if;

    v_unit_reference := nullif(
      public._cr_normalize_name_v1(p_technical_metadata->>'unit_reference'),
      ''
    );

    if v_unit_reference is not null and char_length(v_unit_reference) > 160 then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_METADATA');
    end if;
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
      unit_reference_snapshot,
      normalized_unit_label,
      status
    )
    values (
      v_campaign.id,
      v_campaign.community_id,
      null,
      v_display_label,
      v_unit_reference,
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

revoke all on function public.submit_community_registration_household_v1(text, text, text, jsonb, jsonb) from public;
revoke all on function public.submit_community_registration_household_v1(text, text, text, jsonb, jsonb) from anon;
revoke all on function public.submit_community_registration_household_v1(text, text, text, jsonb, jsonb) from authenticated;
grant execute on function public.submit_community_registration_household_v1(text, text, text, jsonb, jsonb) to service_role;

comment on function public.submit_community_registration_household_v1(text, text, text, jsonb, jsonb) is
  'ENTRY Community Registration submission RPC. Resident-provided units may carry optional unit_reference metadata into unit_reference_snapshot; ownership semantics remain separate.';
