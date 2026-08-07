-- ENTRY-ONB-002: Community Registration transactional backend v1.
--
-- Forward-only local migration. Do not apply to live Supabase without the
-- required disposable PostgreSQL/Supabase gate.
--
-- Lock order for mutating RPCs:
--   campaign row -> campaign unit row -> current submission row -> token row.
-- Token-driven resident correction first identifies the token without a row
-- lock, then follows the same order and revalidates the token under lock.

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
    'conversion_failed'
  ));

create or replace function public._cr_service_role_only_v1()
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'ENTRY_CR_UNAUTHORIZED' using errcode = '42501';
  end if;
end;
$function$;

revoke all on function public._cr_service_role_only_v1() from public;
revoke all on function public._cr_service_role_only_v1() from anon;
revoke all on function public._cr_service_role_only_v1() from authenticated;

create or replace function public._cr_raise_v1(
  p_code text,
  p_sqlstate text default 'P0001'
)
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  raise exception '%', p_code using errcode = p_sqlstate;
end;
$function$;

revoke all on function public._cr_raise_v1(text, text) from public;
revoke all on function public._cr_raise_v1(text, text) from anon;
revoke all on function public._cr_raise_v1(text, text) from authenticated;

create or replace function public._cr_validate_actor_v1(p_actor_user_id uuid)
returns void
language plpgsql
set search_path to 'public'
as $function$
begin
  if p_actor_user_id is not null
     and not exists (select 1 from auth.users where id = p_actor_user_id) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_ACTOR', '42501');
  end if;
end;
$function$;

revoke all on function public._cr_validate_actor_v1(uuid) from public;
revoke all on function public._cr_validate_actor_v1(uuid) from anon;
revoke all on function public._cr_validate_actor_v1(uuid) from authenticated;

create or replace function public._cr_normalize_slug_v1(p_slug text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(lower(btrim(coalesce(p_slug, ''))), '[^a-z0-9-]+', '-', 'g'),
        '-+', '-', 'g'
      ),
      '-'
    ),
    ''
  );
$function$;

revoke all on function public._cr_normalize_slug_v1(text) from public;
revoke all on function public._cr_normalize_slug_v1(text) from anon;
revoke all on function public._cr_normalize_slug_v1(text) from authenticated;

create or replace function public._cr_normalize_unit_label_v1(p_label text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(regexp_replace(lower(btrim(coalesce(p_label, ''))), '[^a-z0-9]+', '', 'g'), '');
$function$;

revoke all on function public._cr_normalize_unit_label_v1(text) from public;
revoke all on function public._cr_normalize_unit_label_v1(text) from anon;
revoke all on function public._cr_normalize_unit_label_v1(text) from authenticated;

create or replace function public._cr_normalize_name_v1(p_name text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
$function$;

revoke all on function public._cr_normalize_name_v1(text) from public;
revoke all on function public._cr_normalize_name_v1(text) from anon;
revoke all on function public._cr_normalize_name_v1(text) from authenticated;

create or replace function public._cr_normalize_email_v1(p_email text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(lower(btrim(coalesce(p_email, ''))), '');
$function$;

revoke all on function public._cr_normalize_email_v1(text) from public;
revoke all on function public._cr_normalize_email_v1(text) from anon;
revoke all on function public._cr_normalize_email_v1(text) from authenticated;

create or replace function public._cr_normalize_phone_v1(p_phone text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(regexp_replace(btrim(coalesce(p_phone, '')), '[\s().-]+', '', 'g'), '');
$function$;

revoke all on function public._cr_normalize_phone_v1(text) from public;
revoke all on function public._cr_normalize_phone_v1(text) from anon;
revoke all on function public._cr_normalize_phone_v1(text) from authenticated;

create or replace function public._cr_validate_residents_v1(
  p_residents jsonb,
  p_effective_limit integer
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_item jsonb;
  v_ordinal integer;
  v_count integer;
  v_position integer;
  v_positions integer[] := array[]::integer[];
  v_name text;
  v_email text;
  v_phone text;
  v_digits text;
  v_relationship text;
  v_owner_reference boolean;
  v_owner_count integer := 0;
  v_key text;
  v_keys text[] := array[]::text[];
  v_rows jsonb := '[]'::jsonb;
begin
  if p_effective_limit is null or p_effective_limit <= 0 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_LIMIT');
  end if;

  if p_residents is null or jsonb_typeof(p_residents) <> 'array' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  v_count := jsonb_array_length(p_residents);

  if v_count < 1 then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
  end if;

  if v_count > p_effective_limit then
    perform public._cr_raise_v1('ENTRY_CR_LIMIT_EXCEEDED');
  end if;

  for v_item, v_ordinal in
    select value, ordinality::integer
      from jsonb_array_elements(p_residents) with ordinality
  loop
    if jsonb_typeof(v_item) <> 'object' then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
    end if;

    if exists (
      select 1
        from jsonb_object_keys(v_item) as payload_key(key_name)
       where payload_key.key_name not in (
         'position',
         'full_name',
         'email',
         'phone',
         'relationship_to_house',
         'is_owner_reference'
       )
    ) then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
    end if;

    if v_item ? 'position' and nullif(btrim(v_item->>'position'), '') is not null then
      if (v_item->>'position') !~ '^[0-9]{1,6}$' then
        perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
      end if;
      v_position := (v_item->>'position')::integer;
    else
      v_position := v_ordinal;
    end if;

    if v_position <= 0 or v_position > v_count or v_position = any(v_positions) then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
    end if;
    v_positions := array_append(v_positions, v_position);

    v_name := public._cr_normalize_name_v1(v_item->>'full_name');
    if v_name is null or length(v_name) > 160 then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
    end if;

    v_email := public._cr_normalize_email_v1(v_item->>'email');
    if v_email is not null
       and (length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
    end if;

    v_phone := public._cr_normalize_phone_v1(v_item->>'phone');
    if v_phone is not null then
      v_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
      if length(v_phone) > 32 or v_phone !~ '^\+?[0-9]+$' or length(v_digits) < 7 then
        perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
      end if;
    end if;

    v_relationship := lower(coalesce(nullif(btrim(v_item->>'relationship_to_house'), ''), 'unknown'));
    if v_relationship not in ('owner', 'tenant', 'family', 'other', 'unknown') then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
    end if;

    v_owner_reference := false;
    if v_item ? 'is_owner_reference' then
      if jsonb_typeof(v_item->'is_owner_reference') = 'boolean' then
        v_owner_reference := (v_item->>'is_owner_reference')::boolean;
      elsif lower(v_item->>'is_owner_reference') in ('true', 'false') then
        v_owner_reference := (v_item->>'is_owner_reference')::boolean;
      else
        perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
      end if;
    end if;

    if v_owner_reference and v_relationship <> 'owner' then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
    end if;

    if v_owner_reference then
      v_owner_count := v_owner_count + 1;
      if v_owner_count > 1 then
        perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
      end if;
    end if;

    v_key := lower(v_name) || '|' || coalesce(v_email, '') || '|' || coalesce(v_phone, '');
    if v_key = any(v_keys) then
      perform public._cr_raise_v1('ENTRY_CR_INVALID_RESIDENT');
    end if;
    v_keys := array_append(v_keys, v_key);

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'position', v_position,
      'full_name', v_name,
      'email', v_email,
      'phone', v_phone,
      'normalized_full_name', lower(v_name),
      'normalized_email', v_email,
      'normalized_phone', v_phone,
      'relationship_to_house', v_relationship,
      'is_owner_reference', v_owner_reference
    ));
  end loop;

  return jsonb_build_object(
    'resident_count', v_count,
    'residents', v_rows
  );
end;
$function$;

revoke all on function public._cr_validate_residents_v1(jsonb, integer) from public;
revoke all on function public._cr_validate_residents_v1(jsonb, integer) from anon;
revoke all on function public._cr_validate_residents_v1(jsonb, integer) from authenticated;

create or replace function public.create_community_registration_campaign_v1(
  p_community_id uuid,
  p_internal_name text,
  p_public_title text,
  p_public_instructions text default null,
  p_public_slug text default null,
  p_default_resident_limit integer default 3,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null,
  p_campaign_token_hash text default null,
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
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

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

  if p_campaign_token_hash is not null and length(btrim(p_campaign_token_hash)) < 32 then
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

  if p_campaign_token_hash is not null then
    insert into public.community_registration_access_tokens (
      campaign_id,
      token_type,
      token_hash,
      status,
      created_by
    )
    values (
      v_campaign_id,
      'campaign_access',
      btrim(p_campaign_token_hash),
      'active',
      p_actor_user_id
    )
    returning id into v_token_id;
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
    null,
    jsonb_build_object(
      'community_id', p_community_id,
      'default_resident_limit', coalesce(p_default_resident_limit, 3),
      'has_campaign_token', p_campaign_token_hash is not null
    )
  );

  return jsonb_build_object(
    'campaign_id', v_campaign_id,
    'community_id', p_community_id,
    'public_slug', v_slug,
    'status', 'open',
    'default_resident_limit', coalesce(p_default_resident_limit, 3),
    'campaign_token_id', v_token_id
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
        normalized_unit_label,
        resident_limit_override
      )
      values (
        p_campaign_id,
        v_campaign.community_id,
        v_house.id,
        btrim(v_house.house_label),
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
      'requested_count', array_length(p_house_ids, 1),
      'inserted_count', v_inserted,
      'existing_count', v_existing_count,
      'updated_count', v_updated
    )
  );

  return jsonb_build_object(
    'campaign_id', p_campaign_id,
    'inserted_count', v_inserted,
    'existing_count', v_existing_count,
    'updated_count', v_updated,
    'results', v_results
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
      'message', 'No fue posible iniciar el registro para esa vivienda. Verifica el numero o comunicate con la administracion.'
    );
  end if;

  select * into v_unit
    from public.community_registration_units
   where campaign_id = v_campaign.id
     and normalized_unit_label = v_label;

  if not found or v_unit.status <> 'unregistered' then
    return jsonb_build_object(
      'can_start', false,
      'message', 'No fue posible iniciar el registro para esa vivienda. Verifica el numero o comunicate con la administracion.'
    );
  end if;

  return jsonb_build_object(
    'can_start', true,
    'unit_label', v_unit.unit_label_snapshot,
    'effective_resident_limit', coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit)
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

  select * into v_unit
    from public.community_registration_units
   where campaign_id = v_campaign.id
     and normalized_unit_label = v_label
   for update;

  if not found or v_unit.status <> 'unregistered' then
    return jsonb_build_object('accepted', false, 'error_code', 'ENTRY_CR_UNIT_UNAVAILABLE');
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

create or replace function public.enable_community_registration_edit_v1(
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
  v_unit public.community_registration_units%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_token_id uuid;
  v_revoked_count integer;
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

  if v_campaign.status <> 'open'
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now()) then
    perform public._cr_raise_v1('ENTRY_CR_CAMPAIGN_UNAVAILABLE', 'P0409');
  end if;

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and status in ('submitted', 'reviewed')
   order by version_number desc
   limit 1
   for update;

  if not found or v_unit.status not in ('submitted', 'needs_correction', 'reviewed') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  update public.community_registration_access_tokens
     set status = 'revoked',
         revoked_at = now()
   where campaign_id = v_unit.campaign_id
     and campaign_unit_id = v_unit.id
     and token_type = 'resident_edit'
     and status = 'active';

  get diagnostics v_revoked_count = row_count;

  if v_revoked_count > 0 then
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
      v_unit.campaign_id,
      v_unit.id,
      v_submission.id,
      'resident_edit_token_revoked',
      'service_role',
      p_actor_user_id,
      jsonb_build_object('revoked_count', v_revoked_count)
    );
  end if;

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
    v_unit.campaign_id,
    v_unit.id,
    v_submission.id,
    'resident_edit',
    btrim(p_edit_token_hash),
    'active',
    p_expires_at,
    p_actor_user_id
  )
  returning id into v_token_id;

  update public.community_registration_submissions
     set status = 'edit_enabled'
   where id = v_submission.id;

  update public.community_registration_units
     set status = 'edit_enabled'
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
    v_unit.campaign_id,
    v_unit.id,
    v_submission.id,
    'resident_edit_enabled',
    'service_role',
    p_actor_user_id,
    v_token_id,
    jsonb_build_object(
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'edit_enabled',
      'version', v_submission.version_number,
      'reason', nullif(btrim(p_reason), '')
    )
  );

  return jsonb_build_object(
    'campaign_id', v_unit.campaign_id,
    'campaign_unit_id', v_unit.id,
    'submission_id', v_submission.id,
    'edit_token_id', v_token_id,
    'public_slug', v_campaign.public_slug,
    'expires_at', p_expires_at
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

  select * into v_submission
    from public.community_registration_submissions
   where id = v_token.submission_id
     and campaign_unit_id = v_token.campaign_unit_id
     and campaign_id = v_token.campaign_id;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_token.campaign_id;

  if not found
     or v_unit.status <> 'edit_enabled'
     or v_submission.status <> 'edit_enabled'
     or v_campaign.status <> 'open'
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now()) then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

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
    'residents', v_residents
  );
end;
$function$;

create or replace function public.resubmit_community_registration_household_v1(
  p_edit_token_hash text,
  p_residents jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_token_hint record;
  v_campaign public.community_registration_campaigns%rowtype;
  v_unit public.community_registration_units%rowtype;
  v_old_submission public.community_registration_submissions%rowtype;
  v_token public.community_registration_access_tokens%rowtype;
  v_effective_limit integer;
  v_validated jsonb;
  v_resident jsonb;
  v_new_submission_id uuid;
  v_new_version integer;
begin
  perform public._cr_service_role_only_v1();

  select id, campaign_id, campaign_unit_id, submission_id
    into v_token_hint
    from public.community_registration_access_tokens
   where token_hash = btrim(coalesce(p_edit_token_hash, ''))
     and token_type = 'resident_edit';

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN', '42501');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_token_hint.campaign_id
   for update;

  select * into v_unit
    from public.community_registration_units
   where id = v_token_hint.campaign_unit_id
     and campaign_id = v_token_hint.campaign_id
   for update;

  select * into v_old_submission
    from public.community_registration_submissions
   where id = v_token_hint.submission_id
     and campaign_unit_id = v_token_hint.campaign_unit_id
     and campaign_id = v_token_hint.campaign_id
   for update;

  select * into v_token
    from public.community_registration_access_tokens
   where id = v_token_hint.id
   for update;

  if not found
     or v_token.status <> 'active'
     or v_token.expires_at is null
     or v_token.expires_at <= now()
     or v_token.revoked_at is not null
     or v_token.consumed_at is not null then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_TOKEN', '42501');
  end if;

  if v_campaign.status <> 'open'
     or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
     or (v_campaign.closes_at is not null and v_campaign.closes_at <= now())
     or v_unit.status <> 'edit_enabled'
     or v_old_submission.status <> 'edit_enabled' then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  v_effective_limit := coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit);
  v_validated := public._cr_validate_residents_v1(p_residents, v_effective_limit);

  select coalesce(max(version_number), 0) + 1
    into v_new_version
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id;

  update public.community_registration_submissions
     set status = 'superseded'
   where id = v_old_submission.id;

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
    v_unit.id,
    v_campaign.id,
    v_campaign.community_id,
    v_unit.house_id,
    v_new_version,
    'submitted',
    now(),
    now(),
    v_old_submission.id
  )
  returning id into v_new_submission_id;

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
      v_new_submission_id,
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

  update public.community_registration_access_tokens
     set status = 'consumed',
         consumed_at = now()
   where id = v_token.id;

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
    v_new_submission_id,
    'household_resubmitted',
    'resident_token',
    v_token.id,
    jsonb_build_object(
      'resident_count', (v_validated->>'resident_count')::integer,
      'previous_submission_id', v_old_submission.id,
      'previous_version', v_old_submission.version_number,
      'version', v_new_version,
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'submitted'
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'receipt', jsonb_build_object(
      'version', v_new_version,
      'unit_label', v_unit.unit_label_snapshot,
      'resident_count', (v_validated->>'resident_count')::integer,
      'submitted_at', now()
    )
  );
end;
$function$;

create or replace function public.reset_community_registration_unit_v1(
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
  v_unit public.community_registration_units%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_submission public.community_registration_submissions%rowtype;
  v_revoked_count integer := 0;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'registration_reset');
begin
  perform public._cr_service_role_only_v1();
  perform public._cr_validate_actor_v1(p_actor_user_id);

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

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id
     and campaign_id = v_campaign.id
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  if v_unit.status = 'unregistered' then
    return jsonb_build_object(
      'campaign_unit_id', v_unit.id,
      'status', 'unregistered',
      'already_unregistered', true,
      'invalidated_submission_id', null,
      'revoked_token_count', 0
    );
  end if;

  if v_unit.status not in ('submitted', 'edit_enabled', 'needs_correction', 'reviewed', 'confirmed') then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  select * into v_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed')
   order by version_number desc
   limit 1
   for update;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_INVALID_STATE', 'P0409');
  end if;

  update public.community_registration_submissions
     set status = 'invalidated',
         invalidated_at = now(),
         invalidated_reason = v_reason
   where id = v_submission.id;

  update public.community_registration_access_tokens
     set status = 'revoked',
         revoked_at = now()
   where campaign_id = v_unit.campaign_id
     and campaign_unit_id = v_unit.id
     and status = 'active';

  get diagnostics v_revoked_count = row_count;

  update public.community_registration_units
     set status = 'unregistered',
         last_submitted_at = null,
         reviewed_at = null,
         reviewed_by = null,
         patronato_confirmed_at = null,
         patronato_confirmed_by = null,
         processed_at = null
   where id = v_unit.id;

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
    v_unit.campaign_id,
    v_unit.id,
    case when v_submission.id is null then null else v_submission.id end,
    'registration_reset',
    'service_role',
    p_actor_user_id,
    jsonb_build_object(
      'previous_unit_status', v_unit.status,
      'new_unit_status', 'unregistered',
      'invalidated_submission_id', v_submission.id,
      'revoked_token_count', v_revoked_count,
      'reason', v_reason,
      'community_id', v_campaign.community_id
    )
  );

  return jsonb_build_object(
    'campaign_unit_id', v_unit.id,
    'status', 'unregistered',
    'invalidated_submission_id', v_submission.id,
    'revoked_token_count', v_revoked_count
  );
end;
$function$;

create or replace function public.get_community_registration_unit_state_v1(
  p_campaign_unit_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_unit public.community_registration_units%rowtype;
  v_campaign public.community_registration_campaigns%rowtype;
  v_current_submission public.community_registration_submissions%rowtype;
  v_versions jsonb;
  v_residents jsonb;
  v_tokens jsonb;
  v_events jsonb;
begin
  perform public._cr_service_role_only_v1();

  select * into v_unit
    from public.community_registration_units
   where id = p_campaign_unit_id;

  if not found then
    perform public._cr_raise_v1('ENTRY_CR_UNIT_UNAVAILABLE');
  end if;

  select * into v_campaign
    from public.community_registration_campaigns
   where id = v_unit.campaign_id;

  select * into v_current_submission
    from public.community_registration_submissions
   where campaign_unit_id = v_unit.id
     and status in ('submitted', 'edit_enabled', 'reviewed', 'confirmed')
   order by version_number desc
   limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'submission_id', s.id,
    'version', s.version_number,
    'status', s.status,
    'submitted_at', s.submitted_at,
    'locked_at', s.locked_at,
    'invalidated_at', s.invalidated_at,
    'previous_submission_id', s.previous_submission_id
  ) order by s.version_number desc), '[]'::jsonb)
  into v_versions
  from (
    select *
      from public.community_registration_submissions
     where campaign_unit_id = v_unit.id
     order by version_number desc
     limit 25
  ) s;

  select coalesce(jsonb_agg(jsonb_build_object(
    'resident_id', r.id,
    'position', r.position,
    'full_name', r.full_name,
    'email', r.email,
    'phone', r.phone,
    'relationship_to_house', r.relationship_to_house,
    'is_owner_reference', r.is_owner_reference,
    'validation_status', r.validation_status,
    'conversion_status', r.conversion_status
  ) order by r.position), '[]'::jsonb)
  into v_residents
  from public.community_registration_residents r
  where r.submission_id = v_current_submission.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'token_id', t.id,
    'token_type', t.token_type,
    'status', t.status,
    'expires_at', t.expires_at,
    'created_at', t.created_at,
    'consumed_at', t.consumed_at,
    'revoked_at', t.revoked_at
  ) order by t.created_at desc), '[]'::jsonb)
  into v_tokens
  from public.community_registration_access_tokens t
  where t.campaign_id = v_unit.campaign_id
    and (t.campaign_unit_id = v_unit.id or t.campaign_unit_id is null)
    and t.status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', e.id,
    'event_type', e.event_type,
    'actor_type', e.actor_type,
    'actor_user_id', e.actor_user_id,
    'access_token_id', e.access_token_id,
    'metadata', e.metadata,
    'created_at', e.created_at
  ) order by e.created_at desc), '[]'::jsonb)
  into v_events
  from (
    select *
      from public.community_registration_events
     where campaign_id = v_unit.campaign_id
       and (campaign_unit_id = v_unit.id or campaign_unit_id is null)
     order by created_at desc
     limit 25
  ) e;

  return jsonb_build_object(
    'campaign_unit_id', v_unit.id,
    'campaign_id', v_unit.campaign_id,
    'community_id', v_unit.community_id,
    'house_id', v_unit.house_id,
    'unit_label', v_unit.unit_label_snapshot,
    'status', v_unit.status,
    'effective_resident_limit', coalesce(v_unit.resident_limit_override, v_campaign.default_resident_limit),
    'last_submitted_at', v_unit.last_submitted_at,
    'reviewed_at', v_unit.reviewed_at,
    'patronato_confirmed_at', v_unit.patronato_confirmed_at,
    'processed_at', v_unit.processed_at,
    'current_submission', case
      when v_current_submission.id is null then null
      else jsonb_build_object(
        'submission_id', v_current_submission.id,
        'version', v_current_submission.version_number,
        'status', v_current_submission.status,
        'submitted_at', v_current_submission.submitted_at,
        'locked_at', v_current_submission.locked_at,
        'previous_submission_id', v_current_submission.previous_submission_id
      )
    end,
    'versions', v_versions,
    'current_residents', coalesce(v_residents, '[]'::jsonb),
    'active_tokens', v_tokens,
    'recent_events', v_events
  );
end;
$function$;

comment on function public.create_community_registration_campaign_v1(uuid, text, text, text, text, integer, timestamptz, timestamptz, text, uuid) is
  'ENTRY internal RPC. Creates an open Community Registration campaign and optional hash-only campaign access token. service_role only.';
comment on function public.add_community_registration_units_v1(uuid, uuid[], jsonb, uuid) is
  'ENTRY internal RPC. Associates existing houses to a campaign, snapshots labels, validates tenant isolation and positive overrides. service_role only.';
comment on function public.resolve_community_registration_campaign_v1(text, text) is
  'Backend RPC for future public route. Resolves a campaign by slug plus campaign token hash and returns only non-sensitive public campaign data. service_role only.';
comment on function public.lookup_community_registration_unit_v1(text, text, text) is
  'Backend RPC for future public route. Exact normalized unit lookup with neutral unavailable response. Web-layer rate limiting is deferred. service_role only.';
comment on function public.submit_community_registration_household_v1(text, text, text, jsonb, jsonb) is
  'Backend RPC for future public route. Atomically creates submission version, residents, unit state, and audit event under row locks. service_role only.';
comment on function public.enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text) is
  'ENTRY internal RPC. Revokes active edit tokens, creates one hash-only resident edit token, and moves current submission/unit to edit_enabled. service_role only.';
comment on function public.resolve_community_registration_edit_v1(text) is
  'Backend RPC for future public route. Resolves an active resident edit token hash and returns only that authorized household version. service_role only.';
comment on function public.resubmit_community_registration_household_v1(text, jsonb) is
  'Backend RPC for future public route. Revalidates resident edit token under locks, creates a new submission version, supersedes prior version, consumes token. service_role only.';
comment on function public.reset_community_registration_unit_v1(uuid, uuid, text) is
  'ENTRY internal RPC. Invalidates the active submission, revokes active tokens, preserves resident history, and returns unit to unregistered. service_role only.';
comment on function public.get_community_registration_unit_state_v1(uuid) is
  'ENTRY internal RPC. Returns unit operational state, current and historical submissions, current residents, active token metadata without hashes, and recent events. service_role only.';

revoke all on function public.create_community_registration_campaign_v1(uuid, text, text, text, text, integer, timestamptz, timestamptz, text, uuid) from public;
revoke all on function public.add_community_registration_units_v1(uuid, uuid[], jsonb, uuid) from public;
revoke all on function public.resolve_community_registration_campaign_v1(text, text) from public;
revoke all on function public.lookup_community_registration_unit_v1(text, text, text) from public;
revoke all on function public.submit_community_registration_household_v1(text, text, text, jsonb, jsonb) from public;
revoke all on function public.enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text) from public;
revoke all on function public.resolve_community_registration_edit_v1(text) from public;
revoke all on function public.resubmit_community_registration_household_v1(text, jsonb) from public;
revoke all on function public.reset_community_registration_unit_v1(uuid, uuid, text) from public;
revoke all on function public.get_community_registration_unit_state_v1(uuid) from public;

revoke all on function public.create_community_registration_campaign_v1(uuid, text, text, text, text, integer, timestamptz, timestamptz, text, uuid) from anon;
revoke all on function public.add_community_registration_units_v1(uuid, uuid[], jsonb, uuid) from anon;
revoke all on function public.resolve_community_registration_campaign_v1(text, text) from anon;
revoke all on function public.lookup_community_registration_unit_v1(text, text, text) from anon;
revoke all on function public.submit_community_registration_household_v1(text, text, text, jsonb, jsonb) from anon;
revoke all on function public.enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text) from anon;
revoke all on function public.resolve_community_registration_edit_v1(text) from anon;
revoke all on function public.resubmit_community_registration_household_v1(text, jsonb) from anon;
revoke all on function public.reset_community_registration_unit_v1(uuid, uuid, text) from anon;
revoke all on function public.get_community_registration_unit_state_v1(uuid) from anon;

revoke all on function public.create_community_registration_campaign_v1(uuid, text, text, text, text, integer, timestamptz, timestamptz, text, uuid) from authenticated;
revoke all on function public.add_community_registration_units_v1(uuid, uuid[], jsonb, uuid) from authenticated;
revoke all on function public.resolve_community_registration_campaign_v1(text, text) from authenticated;
revoke all on function public.lookup_community_registration_unit_v1(text, text, text) from authenticated;
revoke all on function public.submit_community_registration_household_v1(text, text, text, jsonb, jsonb) from authenticated;
revoke all on function public.enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text) from authenticated;
revoke all on function public.resolve_community_registration_edit_v1(text) from authenticated;
revoke all on function public.resubmit_community_registration_household_v1(text, jsonb) from authenticated;
revoke all on function public.reset_community_registration_unit_v1(uuid, uuid, text) from authenticated;
revoke all on function public.get_community_registration_unit_state_v1(uuid) from authenticated;

grant execute on function public.create_community_registration_campaign_v1(uuid, text, text, text, text, integer, timestamptz, timestamptz, text, uuid) to service_role;
grant execute on function public.add_community_registration_units_v1(uuid, uuid[], jsonb, uuid) to service_role;
grant execute on function public.resolve_community_registration_campaign_v1(text, text) to service_role;
grant execute on function public.lookup_community_registration_unit_v1(text, text, text) to service_role;
grant execute on function public.submit_community_registration_household_v1(text, text, text, jsonb, jsonb) to service_role;
grant execute on function public.enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text) to service_role;
grant execute on function public.resolve_community_registration_edit_v1(text) to service_role;
grant execute on function public.resubmit_community_registration_household_v1(text, jsonb) to service_role;
grant execute on function public.reset_community_registration_unit_v1(uuid, uuid, text) to service_role;
grant execute on function public.get_community_registration_unit_state_v1(uuid) to service_role;
