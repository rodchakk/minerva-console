-- Emergency production hotfix applied while investigating the primary-house/contact regression.
-- A resident with an active house assignment must be able to create access even when
-- they are not the unit-level primary contact.

create or replace function public.create_pass_v2(
  p_community_id uuid,
  p_pass_type public.pass_type,
  p_visitor_name text default null,
  p_delivery_company text default null,
  p_delivery_category text default null,
  p_vehicle_plate text default null,
  p_note text default null,
  p_expiration_mode text default '12H',
  p_expires_at timestamptz default null,
  p_capacity integer default 1,
  p_starts_at timestamptz default null
)
returns table(
  pass_id uuid,
  pin_code text,
  qr_token text,
  expires_at timestamptz,
  status public.pass_status
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid;
  v_membership record;
  v_house record;
  v_expires_at timestamptz;
  v_starts_at timestamptz;
  v_pin text;
  v_qr text;
  v_rand_bytes bytea;
  v_pin_num bigint;
  v_status public.pass_status;
begin
  v_user_id := auth.uid();

  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_community_id is null then raise exception 'Community is required'; end if;

  perform public.assert_no_pin_pending();
  perform public.check_rpc_rate_limit('create_pass', p_community_id, 20, 3600);

  select cm.user_id, cm.community_id, cm.role, cm.is_active
    into v_membership
  from public.community_members cm
  where cm.user_id = v_user_id
    and cm.community_id = p_community_id
    and cm.role in ('RESIDENT', 'ADMIN')
    and cm.is_active = true
  limit 1;

  if not found then
    raise exception 'Active community membership not found or not allowed for this community';
  end if;

  if not exists (
    select 1
    from public.communities c
    where c.id = p_community_id and c.is_active = true
  ) then
    raise exception 'Community is inactive or not found';
  end if;

  select hr.house_id, h.house_label
    into v_house
  from public.house_residents hr
  join public.houses h
    on h.id = hr.house_id
   and h.community_id = hr.community_id
  left join public.profiles p
    on p.user_id = hr.user_id
   and p.community_id = hr.community_id
  where hr.user_id = v_user_id
    and hr.community_id = p_community_id
    and hr.is_active = true
    and h.is_active = true
  order by
    case
      when p.house_id = hr.house_id then 0
      when hr.is_primary = true then 1
      else 2
    end,
    hr.created_at asc
  limit 1;

  if not found then
    raise exception 'Active house assignment not found for this user in this community';
  end if;

  if p_capacity is null or p_capacity < 1 then
    raise exception 'Capacity must be at least 1';
  end if;

  if p_pass_type = 'EVENT' then
    p_visitor_name := 'Evento ' || v_house.house_label;
  end if;

  v_starts_at := coalesce(p_starts_at, now());

  if p_pass_type = 'SELF_ACCESS' then
    v_starts_at := now();
    v_expires_at := now() + interval '10 minutes';
    v_status := 'ACTIVE';
  else
    case upper(coalesce(p_expiration_mode, '12H'))
      when '1H' then v_expires_at := v_starts_at + interval '1 hour';
      when '12H' then v_expires_at := v_starts_at + interval '12 hours';
      when 'DATETIME' then v_expires_at := p_expires_at;
      else raise exception 'Invalid expiration mode';
    end case;
    v_status := case when v_starts_at > now() then 'SCHEDULED' else 'ACTIVE' end;
  end if;

  if v_expires_at is null then raise exception 'Expiration could not be resolved'; end if;
  if v_expires_at <= v_starts_at then raise exception 'Expiration must be later than start'; end if;
  if v_expires_at <= now() then raise exception 'Expiration must be in the future'; end if;

  v_qr := extensions.gen_random_uuid()::text;

  loop
    v_rand_bytes := extensions.gen_random_bytes(4);
    v_pin_num :=
      (get_byte(v_rand_bytes,0)::bigint * 16777216 +
       get_byte(v_rand_bytes,1)::bigint * 65536 +
       get_byte(v_rand_bytes,2)::bigint * 256 +
       get_byte(v_rand_bytes,3)::bigint) % 1000000::bigint;
    v_pin := lpad(v_pin_num::text, 6, '0');

    exit when not exists (
      select 1
      from public.visit_passes vp
      where vp.community_id = p_community_id
        and vp.pin_code = v_pin
        and vp.status in ('ACTIVE', 'SCHEDULED', 'CHECKED_IN')
    );
  end loop;

  return query
  insert into public.visit_passes (
    community_id, house_id, created_by, pass_type,
    visitor_name, delivery_company, delivery_category, vehicle_plate, note,
    pin_code, qr_token, status, starts_at, expires_at, capacity
  ) values (
    p_community_id, v_house.house_id, v_user_id, p_pass_type,
    nullif(trim(p_visitor_name),''),
    nullif(trim(p_delivery_company),''),
    nullif(trim(p_delivery_category),''),
    nullif(trim(p_vehicle_plate),''),
    nullif(trim(p_note),''),
    v_pin, v_qr, v_status, v_starts_at, v_expires_at, p_capacity
  )
  returning
    public.visit_passes.id,
    public.visit_passes.pin_code,
    public.visit_passes.qr_token,
    public.visit_passes.expires_at,
    public.visit_passes.status;
end;
$function$;

create or replace function public.create_visit_group_v2(
  p_community_id uuid,
  p_group_label text default null,
  p_note text default null,
  p_visitor_names text[] default null,
  p_duration_days integer default null,
  p_group_type text default 'VISIT',
  p_starts_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_capacity integer default null
)
returns table(
  group_id uuid,
  pin_code text,
  qr_token text,
  starts_at timestamptz,
  expires_at timestamptz,
  status text,
  group_type text,
  capacity integer
)
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_user_id uuid;
  v_membership record;
  v_house record;
  v_pin text;
  v_qr text;
  v_rand_bytes bytea;
  v_group_id uuid;
  v_valid_names text[];
  v_pin_num bigint;
  v_group_type text;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_capacity integer;
  v_name_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_community_id is null then
    raise exception 'Community is required';
  end if;

  perform public.assert_no_pin_pending();

  v_group_type := upper(coalesce(trim(p_group_type), 'VISIT'));

  if v_group_type not in ('VISIT', 'EVENT') then
    raise exception 'Invalid group type. Allowed: VISIT, EVENT';
  end if;

  select cm.user_id, cm.community_id, cm.role, cm.is_active
    into v_membership
  from public.community_members cm
  where cm.user_id = v_user_id
    and cm.community_id = p_community_id
    and cm.role in ('RESIDENT', 'ADMIN')
    and cm.is_active = true
  limit 1;

  if not found then
    raise exception 'Active community membership not found or not allowed for this community';
  end if;

  if not exists (
    select 1
    from public.communities c
    where c.id = p_community_id and c.is_active = true
  ) then
    raise exception 'Community is inactive or not found';
  end if;

  select hr.house_id, hr.community_id
    into v_house
  from public.house_residents hr
  join public.houses h
    on h.id = hr.house_id
   and h.community_id = hr.community_id
  left join public.profiles p
    on p.user_id = hr.user_id
   and p.community_id = hr.community_id
  where hr.user_id = v_user_id
    and hr.community_id = p_community_id
    and hr.is_active = true
    and h.is_active = true
  order by
    case
      when p.house_id = hr.house_id then 0
      when hr.is_primary = true then 1
      else 2
    end,
    hr.created_at asc
  limit 1;

  if not found then
    raise exception 'Active house assignment not found for this user in this community';
  end if;

  select coalesce(array_agg(trim(x)), '{}')
    into v_valid_names
  from unnest(coalesce(p_visitor_names, '{}')) as x
  where coalesce(trim(x), '') <> '';

  v_name_count := coalesce(array_length(v_valid_names, 1), 0);

  if v_name_count = 0 then
    raise exception 'At least one visitor name is required';
  end if;

  if p_capacity is not null and p_capacity < 1 then
    raise exception 'Capacity must be at least 1';
  end if;

  v_capacity := p_capacity;

  if v_capacity is not null and v_name_count > v_capacity then
    raise exception 'Guest list exceeds event capacity';
  end if;

  if p_starts_at is not null and p_expires_at is not null and p_starts_at >= p_expires_at then
    raise exception 'Start must be earlier than expiration';
  end if;

  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiration must be in the future';
  end if;

  v_starts_at := coalesce(p_starts_at, now());

  if p_expires_at is not null then
    v_expires_at := p_expires_at;
  elsif p_duration_days is not null and p_duration_days >= 1 then
    v_expires_at := v_starts_at + make_interval(days => p_duration_days);
  else
    raise exception 'Either expires_at or duration_days must be provided';
  end if;

  if v_expires_at <= v_starts_at then
    raise exception 'Expiration must be later than start';
  end if;

  v_qr := extensions.gen_random_uuid()::text;

  loop
    v_rand_bytes := extensions.gen_random_bytes(4);
    v_pin_num :=
      (get_byte(v_rand_bytes, 0)::bigint * 16777216 +
       get_byte(v_rand_bytes, 1)::bigint * 65536 +
       get_byte(v_rand_bytes, 2)::bigint * 256 +
       get_byte(v_rand_bytes, 3)::bigint) % 1000000::bigint;
    v_pin := lpad(v_pin_num::text, 6, '0');

    exit when not exists (
      select 1
      from public.visit_groups vg
      where vg.community_id = p_community_id
        and vg.pin_code = v_pin
        and vg.status in ('ACTIVE', 'PARTIAL')
        and vg.is_active = true
    )
    and not exists (
      select 1
      from public.visit_passes vp
      where vp.community_id = p_community_id
        and vp.pin_code = v_pin
        and vp.status in ('ACTIVE', 'CHECKED_IN')
    );
  end loop;

  insert into public.visit_groups (
    community_id, house_id, created_by, group_label, note,
    pin_code, qr_token, status, starts_at, expires_at,
    group_type, capacity, is_active, updated_at
  ) values (
    p_community_id, v_house.house_id, v_user_id,
    nullif(trim(p_group_label), ''), nullif(trim(p_note), ''),
    v_pin, v_qr, 'ACTIVE', v_starts_at, v_expires_at,
    v_group_type, v_capacity, true, now()
  )
  returning id into v_group_id;

  insert into public.visit_group_members (
    visit_group_id, visitor_name, status, updated_at
  )
  select v_group_id, trim(x), 'ACTIVE', now()
  from unnest(v_valid_names) as x;

  return query
  select
    vg.id, vg.pin_code, vg.qr_token, vg.starts_at, vg.expires_at,
    vg.status, vg.group_type, vg.capacity
  from public.visit_groups vg
  where vg.id = v_group_id;
end;
$function$;
