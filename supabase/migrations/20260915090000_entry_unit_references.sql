alter table public.houses
  add column if not exists unit_reference text;

alter table public.community_registration_units
  add column if not exists unit_reference_snapshot text;

create or replace function public.create_houses_with_references_bulk_v1(
  p_community_id uuid,
  p_units jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inserted_count integer := 0;
  v_existing_count integer := 0;
  v_updated_count integer := 0;
  v_skipped_blank_count integer := 0;
  v_conflicting_reference_count integer := 0;
  v_item jsonb;
  v_label text;
  v_reference text;
  v_normalized_label text;
  v_existing_house public.houses%rowtype;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin_required' using errcode = 'P0403';
  end if;

  if p_community_id is null or not exists (
    select 1
      from public.communities
     where id = p_community_id
  ) then
    raise exception 'community_not_found' using errcode = 'P0404';
  end if;

  if p_units is null then
    return jsonb_build_object(
      'inserted_count', 0,
      'existing_count', 0,
      'updated_reference_count', 0,
      'skipped_blank_count', 0
    );
  end if;

  if jsonb_typeof(p_units) <> 'array' then
    raise exception 'invalid_units_payload' using errcode = 'P0400';
  end if;

  with parsed as (
    select
      public._cr_normalize_unit_label_v1(value->>'unit_label') as normalized_label,
      nullif(public._cr_normalize_name_v1(value->>'unit_reference'), '') as unit_reference
    from jsonb_array_elements(p_units) as items(value)
    where public._cr_normalize_unit_label_v1(value->>'unit_label') is not null
  ),
  conflicts as (
    select normalized_label
      from parsed
     where unit_reference is not null
     group by normalized_label
    having count(distinct unit_reference) > 1
  )
  select count(*)::integer
    into v_conflicting_reference_count
    from conflicts;

  if v_conflicting_reference_count > 0 then
    raise exception 'unit_reference_conflict' using errcode = 'P0409';
  end if;

  select count(*)::integer
    into v_skipped_blank_count
    from jsonb_array_elements(p_units) as items(value)
   where public._cr_normalize_unit_label_v1(value->>'unit_label') is null;

  for v_item in
    with parsed as (
      select
        public._cr_normalize_name_v1(value->>'unit_label') as unit_label,
        public._cr_normalize_unit_label_v1(value->>'unit_label') as normalized_label,
        nullif(public._cr_normalize_name_v1(value->>'unit_reference'), '') as unit_reference
      from jsonb_array_elements(p_units) as items(value)
    ),
    deduped as (
      select
        min(unit_label) as unit_label,
        normalized_label,
        max(unit_reference) filter (where unit_reference is not null) as unit_reference
      from parsed
      where normalized_label is not null
      group by normalized_label
    )
    select jsonb_build_object(
      'unit_label', unit_label,
      'normalized_label', normalized_label,
      'unit_reference', unit_reference
    )
    from deduped
  loop
    v_label := v_item->>'unit_label';
    v_normalized_label := v_item->>'normalized_label';
    v_reference := nullif(v_item->>'unit_reference', '');

    select *
      into v_existing_house
      from public.houses h
     where h.community_id = p_community_id
       and public._cr_normalize_unit_label_v1(h.house_label) = v_normalized_label
     order by h.id
     limit 1
     for update;

    if found then
      v_existing_count := v_existing_count + 1;

      if exists (
        select 1
          from public.houses h
         where h.community_id = p_community_id
           and public._cr_normalize_unit_label_v1(h.house_label) = v_normalized_label
           and h.id <> v_existing_house.id
      ) then
        raise exception 'unit_label_conflict' using errcode = 'P0409';
      end if;

      if v_reference is not null then
        if nullif(public._cr_normalize_name_v1(v_existing_house.unit_reference), '') is not null
           and public._cr_normalize_name_v1(v_existing_house.unit_reference) is distinct from v_reference then
          raise exception 'unit_reference_conflict' using errcode = 'P0409';
        end if;

        if nullif(public._cr_normalize_name_v1(v_existing_house.unit_reference), '') is null then
          update public.houses
             set unit_reference = v_reference
           where id = v_existing_house.id;
          v_updated_count := v_updated_count + 1;
        end if;
      end if;
    else
      insert into public.houses (
        community_id,
        house_label,
        unit_reference
      )
      values (
        p_community_id,
        v_label,
        v_reference
      );

      v_inserted_count := v_inserted_count + 1;
    end if;
  end loop;

  perform public._sa_audit_log(
    'bulk_create_houses_with_references_v1',
    'community',
    p_community_id,
    jsonb_build_object(
      'submitted_count', jsonb_array_length(p_units),
      'inserted_count', v_inserted_count,
      'existing_count', v_existing_count,
      'updated_reference_count', v_updated_count,
      'skipped_blank_count', v_skipped_blank_count
    )
  );

  return jsonb_build_object(
    'inserted_count', v_inserted_count,
    'existing_count', v_existing_count,
    'updated_reference_count', v_updated_count,
    'skipped_blank_count', v_skipped_blank_count
  );
end;
$function$;

create or replace function public.add_community_registration_units_v1(
  p_campaign_id uuid,
  p_house_ids uuid[],
  p_unit_overrides jsonb default '{}'::jsonb,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign public.community_registration_campaigns%rowtype;
  v_house_id uuid;
  v_house record;
  v_override integer;
  v_existing public.community_registration_units%rowtype;
  v_unit_id uuid;
  v_inserted integer := 0;
  v_existing_count integer := 0;
  v_updated integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_override_text text;
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

  if p_campaign_id is null
     or p_house_ids is null
     or array_length(p_house_ids, 1) is null
     or coalesce(jsonb_typeof(p_unit_overrides), 'object') <> 'object' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_CAMPAIGN');
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

  if exists (
    select 1
      from unnest(p_house_ids) as input_house_id
     group by input_house_id
    having count(*) > 1
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFLICT', 'P0409');
  end if;

  if exists (
    select 1
      from public.houses h
     where h.id = any(p_house_ids)
       and h.community_id <> v_campaign.community_id
  ) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TENANT', '42501');
  end if;

  if (
    select count(*)
      from public.houses h
     where h.id = any(p_house_ids)
       and h.community_id = v_campaign.community_id
  ) <> array_length(p_house_ids, 1) then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  if exists (
    select 1
      from public.houses h
     where h.id = any(p_house_ids)
       and h.community_id = v_campaign.community_id
     group by public._cr_normalize_unit_label_v1(h.house_label)
    having count(*) > 1
  ) then
    perform public._cr_raise_v1('ENTRY_CR_CONFLICT', 'P0409');
  end if;

  foreach v_house_id in array p_house_ids loop
    select
      h.id,
      h.community_id,
      h.house_label,
      h.unit_reference,
      public._cr_normalize_unit_label_v1(h.house_label) as normalized_label
    into v_house
      from public.houses h
     where h.id = v_house_id
       and h.community_id = v_campaign.community_id
     for key share;

    if v_house.normalized_label is null then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_UNIT');
    end if;

    v_override := null;
    v_override_text := null;
    if p_unit_overrides ? v_house_id::text then
      if jsonb_typeof(p_unit_overrides -> v_house_id::text) = 'number' then
        v_override_text := p_unit_overrides ->> v_house_id::text;
      elsif jsonb_typeof(p_unit_overrides -> v_house_id::text) = 'object' then
        v_override_text := nullif(btrim(p_unit_overrides -> v_house_id::text ->> 'resident_limit_override'), '');
      else
        perform public._cr_raise_v1('ENTRY_CR_INVALID_LIMIT');
      end if;

      if v_override_text is null or v_override_text !~ '^[0-9]{1,6}$' then
        perform public._cr_raise_v1('ENTRY_CR_INVALID_LIMIT');
      end if;

      v_override := v_override_text::integer;

      if v_override <= 0 then
        perform public._cr_raise_v1('ENTRY_CR_INVALID_LIMIT');
      end if;
    end if;

    if exists (
      select 1
        from public.community_registration_units u
       where u.campaign_id = p_campaign_id
         and u.normalized_unit_label = v_house.normalized_label
         and u.house_id <> v_house.id
    ) then
      perform public._cr_raise_v1('ENTRY_CR_CONFLICT', 'P0409');
    end if;

    select * into v_existing
      from public.community_registration_units
     where campaign_id = p_campaign_id
       and house_id = v_house.id
     for update;

    if found then
      v_existing_count := v_existing_count + 1;
      v_unit_id := v_existing.id;
      if v_override is not null
         and v_existing.resident_limit_override is distinct from v_override then
        update public.community_registration_units
           set resident_limit_override = v_override
         where id = v_existing.id;
        v_updated := v_updated + 1;
      end if;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'house_id', v_house.id,
        'campaign_unit_id', v_unit_id,
        'status', case when v_override is not null then 'updated' else 'existing' end
      ));
    else
      insert into public.community_registration_units (
        campaign_id,
        community_id,
        house_id,
        unit_label_snapshot,
        unit_reference_snapshot,
        normalized_unit_label,
        resident_limit_override
      )
      values (
        p_campaign_id,
        v_campaign.community_id,
        v_house.id,
        btrim(v_house.house_label),
        nullif(public._cr_normalize_name_v1(v_house.unit_reference), ''),
        v_house.normalized_label,
        v_override
      )
      returning id into v_unit_id;

      v_inserted := v_inserted + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'house_id', v_house.id,
        'campaign_unit_id', v_unit_id,
        'status', 'inserted'
      ));
    end if;
  end loop;

  insert into public.community_registration_events (
    campaign_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    p_campaign_id,
    'units_added',
    'service_role',
    p_actor_user_id,
    jsonb_build_object(
      'house_count', array_length(p_house_ids, 1),
      'inserted_count', v_inserted,
      'existing_count', v_existing_count,
      'updated_count', v_updated
    )
  );

  return jsonb_build_object(
    'inserted_count', v_inserted,
    'existing_count', v_existing_count,
    'updated_count', v_updated,
    'units', v_results
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
      'unit_reference', null,
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
    'unit_reference', v_unit.unit_reference_snapshot,
    'effective_resident_limit', coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit),
    'registration_mode', v_campaign.registration_mode
  );
end;
$function$;

comment on column public.houses.unit_reference is
  'Optional human-readable ENTRY unit reference, such as a street/address hint. The unit label remains the canonical identifier.';

comment on column public.community_registration_units.unit_reference_snapshot is
  'Optional snapshot of houses.unit_reference captured for public Community Registration lookup.';

comment on function public.create_houses_with_references_bulk_v1(uuid, jsonb) is
  'ENTRY superadmin RPC. Creates operational houses with optional unit_reference metadata for structured imports, without creating residents, users, activation rows, emails, or PINs.';

comment on function public.lookup_community_registration_unit_v1(text, text, text) is
  'ENTRY public-registration lookup RPC. Returns neutral availability plus unit label and optional unit_reference snapshot through a service-role mediated route.';

revoke all on function public.create_houses_with_references_bulk_v1(uuid, jsonb) from public;
grant execute on function public.create_houses_with_references_bulk_v1(uuid, jsonb) to anon;
grant execute on function public.create_houses_with_references_bulk_v1(uuid, jsonb) to authenticated;
grant execute on function public.create_houses_with_references_bulk_v1(uuid, jsonb) to service_role;
