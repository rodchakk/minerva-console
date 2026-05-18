-- Enforce community feature flags for frequent visitors and reservations at
-- the database boundary. Disabled features remain stored, but become hidden
-- and unusable until re-enabled for the community.

create or replace function public.create_authorized_frequent_visitor(
  p_full_name text,
  p_identity_number text,
  p_phone text default null,
  p_notes text default null,
  p_duration_days integer default null,
  p_expires_at timestamptz default null,
  p_starts_at timestamptz default null,
  p_access_schedule_type text default 'always',
  p_allowed_weekdays smallint[] default null,
  p_all_day boolean default true,
  p_allowed_start_time time default null,
  p_allowed_end_time time default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_membership record;
  v_house record;
  v_new_id uuid;
  v_pin_code text;
  v_qr_token text;
  v_starts_at timestamptz;
  v_expires_at timestamptz;
  v_identity text;
  v_access_schedule_type text;
  v_allowed_weekdays smallint[];
  v_all_day boolean;
  v_allowed_start time;
  v_allowed_end time;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.assert_no_pin_pending();

  select cm.community_id, cm.role, cm.is_active
  into v_membership
  from public.community_members cm
  where cm.user_id = v_user_id
    and upper(cm.role::text) in ('RESIDENT', 'ADMIN')
    and cm.is_active = true
  order by cm.updated_at desc nulls last, cm.created_at desc
  limit 1;

  if v_membership.community_id is null then
    raise exception 'Active resident or admin membership not found';
  end if;

  if coalesce((
    select cs.allow_frequent_access
    from public.community_settings cs
    where cs.community_id = v_membership.community_id
  ), true) = false then
    raise exception 'Frequent access is disabled for this community'
      using hint = 'FEATURE_DISABLED';
  end if;

  select hr.community_id, hr.house_id, hr.is_primary, hr.is_active
  into v_house
  from public.house_residents hr
  where hr.user_id = v_user_id
    and hr.community_id = v_membership.community_id
    and hr.is_active = true
  order by hr.is_primary desc, hr.updated_at desc nulls last, hr.created_at desc
  limit 1;

  if v_house.house_id is null then
    raise exception 'User has no active house assigned in this community';
  end if;

  if p_full_name is null or length(trim(p_full_name)) = 0 then
    raise exception 'Full name is required';
  end if;

  if p_identity_number is null or length(trim(p_identity_number)) = 0 then
    raise exception 'Identity number is required';
  end if;

  if p_duration_days is not null and p_duration_days <= 0 then
    raise exception 'Duration days must be greater than zero';
  end if;

  if p_duration_days is not null
     and p_duration_days not in (1, 3, 7, 15)
     and p_expires_at is null then
    raise exception 'Allowed preset durations are 1, 3, 7, or 15 days unless manual expiration is provided';
  end if;

  v_access_schedule_type := coalesce(p_access_schedule_type, 'always');
  v_all_day := coalesce(p_all_day, true);
  v_allowed_weekdays := p_allowed_weekdays;
  v_allowed_start := p_allowed_start_time;
  v_allowed_end := p_allowed_end_time;

  if v_access_schedule_type not in ('always', 'specific_days') then
    raise exception 'Tipo de horario invalido'
      using hint = 'INVALID_SCHEDULE_TYPE';
  end if;

  if v_access_schedule_type = 'always' then
    v_allowed_weekdays := null;
  else
    if v_allowed_weekdays is null
       or array_length(v_allowed_weekdays, 1) is null
       or array_length(v_allowed_weekdays, 1) < 1 then
      raise exception 'Debes seleccionar al menos un dia permitido'
        using hint = 'WEEKDAYS_REQUIRED';
    end if;

    if not (v_allowed_weekdays <@ array[1,2,3,4,5,6,7]::smallint[]) then
      raise exception 'Dias permitidos invalidos'
        using hint = 'INVALID_WEEKDAYS';
    end if;
  end if;

  if v_all_day = false then
    if v_allowed_start is null or v_allowed_end is null then
      raise exception 'Debes definir hora de inicio y fin'
        using hint = 'HOURS_REQUIRED';
    end if;
    if v_allowed_start >= v_allowed_end then
      raise exception 'La hora de inicio debe ser menor que la hora de fin'
        using hint = 'INVALID_HOURS_RANGE';
    end if;
  else
    v_allowed_start := null;
    v_allowed_end := null;
  end if;

  v_identity := trim(p_identity_number);

  if exists (
    select 1
    from public.authorized_frequent_visitors afv
    where afv.house_id = v_house.house_id
      and afv.identity_number = v_identity
      and afv.is_active = true
  ) then
    raise exception 'Ya existe un acceso frecuente activo para esta persona en esta unidad. Revoca el existente antes de crear uno nuevo.'
      using hint = 'DUPLICATE_FREQUENT_ACCESS';
  end if;

  v_starts_at := p_starts_at;

  if p_expires_at is not null then
    v_expires_at := p_expires_at;
  elsif p_duration_days is not null then
    v_expires_at := coalesce(v_starts_at, now()) + make_interval(days => p_duration_days);
  else
    v_expires_at := null;
  end if;

  if v_expires_at is not null and v_expires_at <= now() then
    raise exception 'Expiration must be in the future';
  end if;

  if v_starts_at is not null and v_expires_at is not null and v_starts_at >= v_expires_at then
    raise exception 'Start date must be earlier than expiration date';
  end if;

  loop
    v_pin_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from public.authorized_frequent_visitors where pin_code = v_pin_code
    );
  end loop;

  v_qr_token := md5(random()::text || clock_timestamp()::text || v_user_id::text)
             || md5(clock_timestamp()::text || p_identity_number || p_full_name);

  begin
    insert into public.authorized_frequent_visitors (
      community_id, house_id, created_by, full_name, identity_number,
      phone, notes, pin_code, qr_token, is_active, starts_at, expires_at,
      access_schedule_type, allowed_weekdays, all_day,
      allowed_start_time, allowed_end_time
    ) values (
      v_membership.community_id, v_house.house_id, v_user_id,
      trim(p_full_name), v_identity,
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_notes, '')), ''),
      v_pin_code, v_qr_token, true, v_starts_at, v_expires_at,
      v_access_schedule_type, v_allowed_weekdays, v_all_day,
      v_allowed_start, v_allowed_end
    )
    returning id into v_new_id;
  exception
    when unique_violation then
      raise exception 'Ya existe un acceso frecuente activo para esta persona en esta unidad. Revoca el existente antes de crear uno nuevo.'
        using hint = 'DUPLICATE_FREQUENT_ACCESS';
  end;

  return v_new_id;
end;
$function$;

create or replace function public.get_authorized_frequent_visitor_detail(
  p_frequent_visitor_id uuid
)
returns table(
  id uuid,
  community_id uuid,
  house_id uuid,
  created_by uuid,
  full_name text,
  identity_number text,
  phone text,
  notes text,
  pin_code text,
  qr_token text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  starts_at timestamptz,
  expires_at timestamptz,
  computed_status text,
  recent_entries jsonb,
  access_schedule_type text,
  allowed_weekdays smallint[],
  all_day boolean,
  allowed_start_time time,
  allowed_end_time time
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_profile record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select p.user_id, p.community_id, p.house_id, p.role, p.is_active
  into v_profile
  from public.profiles p
  where p.user_id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
  if v_profile.role <> 'RESIDENT' then
    raise exception 'Only residents can access this resource';
  end if;
  if coalesce(v_profile.is_active, false) = false then
    raise exception 'Inactive profile';
  end if;

  if coalesce((
    select cs.allow_frequent_access
    from public.community_settings cs
    where cs.community_id = v_profile.community_id
  ), true) = false then
    return;
  end if;

  return query
  select
    afv.id, afv.community_id, afv.house_id, afv.created_by,
    afv.full_name, afv.identity_number, afv.phone, afv.notes,
    afv.pin_code, afv.qr_token, afv.is_active,
    afv.created_at, afv.updated_at, afv.revoked_at, afv.revoked_by,
    afv.starts_at, afv.expires_at,
    case
      when coalesce(afv.is_active, false) = false then 'REVOKED'
      when afv.starts_at is not null and afv.starts_at > now() then 'NOT_STARTED'
      when afv.expires_at is not null and afv.expires_at <= now() then 'EXPIRED'
      else 'ACTIVE'
    end as computed_status,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', el.id,
          'action', el.action,
          'action_at', el.action_at,
          'method', el.method,
          'guard_id', el.guard_id,
          'photo_path', el.photo_path,
          'vehicle_photo_path', el.vehicle_photo_path
        )
        order by el.action_at desc
      )
      from (
        select e.id, e.action, e.action_at, e.method, e.guard_id,
               e.photo_path, e.vehicle_photo_path
        from public.entry_logs e
        where e.frequent_visitor_id = afv.id
        order by e.action_at desc
        limit 10
      ) el
    ), '[]'::jsonb) as recent_entries,
    afv.access_schedule_type,
    afv.allowed_weekdays,
    afv.all_day,
    afv.allowed_start_time,
    afv.allowed_end_time
  from public.authorized_frequent_visitors afv
  where afv.id = p_frequent_visitor_id
    and afv.created_by = v_user_id
    and afv.community_id = v_profile.community_id
    and afv.house_id = v_profile.house_id;
end;
$function$;

create or replace function public.is_frequent_access_allowed_now(
  p_frequent_visitor_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_afv public.authorized_frequent_visitors%rowtype;
  v_timezone text;
  v_local_now timestamp;
  v_local_dow smallint;
  v_local_time time;
begin
  if p_frequent_visitor_id is null then
    return false;
  end if;

  select *
  into v_afv
  from public.authorized_frequent_visitors
  where id = p_frequent_visitor_id;

  if not found then
    return false;
  end if;

  if coalesce((
    select cs.allow_frequent_access
    from public.community_settings cs
    where cs.community_id = v_afv.community_id
  ), true) = false then
    return false;
  end if;

  if coalesce(v_afv.is_active, false) = false then
    return false;
  end if;

  if v_afv.starts_at is not null and v_afv.starts_at > now() then
    return false;
  end if;

  if v_afv.expires_at is not null and v_afv.expires_at <= now() then
    return false;
  end if;

  if v_afv.access_schedule_type = 'always' then
    return true;
  end if;

  select cs.timezone
  into v_timezone
  from public.community_settings cs
  where cs.community_id = v_afv.community_id;

  if v_timezone is null or length(trim(v_timezone)) = 0 then
    v_timezone := 'America/Tegucigalpa';
  end if;

  v_local_now := now() at time zone v_timezone;
  v_local_dow := extract(isodow from v_local_now)::smallint;
  v_local_time := v_local_now::time;

  if v_afv.allowed_weekdays is null
     or not (v_local_dow = any (v_afv.allowed_weekdays)) then
    return false;
  end if;

  if v_afv.all_day = false then
    if v_afv.allowed_start_time is null or v_afv.allowed_end_time is null then
      return false;
    end if;
    if v_local_time < v_afv.allowed_start_time
       or v_local_time >= v_afv.allowed_end_time then
      return false;
    end if;
  end if;

  return true;
end;
$function$;

create or replace function public.list_my_authorized_frequent_visitors()
returns table(
  id uuid,
  full_name text,
  identity_number text,
  phone text,
  notes text,
  is_active boolean,
  pin_code text,
  qr_token text,
  created_at timestamptz,
  updated_at timestamptz,
  revoked_at timestamptz,
  starts_at timestamptz,
  expires_at timestamptz,
  computed_status text,
  last_entry_at timestamptz,
  access_schedule_type text,
  allowed_weekdays smallint[],
  all_day boolean,
  allowed_start_time time,
  allowed_end_time time
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_membership record;
  v_house record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select cm.community_id, cm.role, cm.is_active
  into v_membership
  from public.community_members cm
  where cm.user_id = v_user_id
    and upper(cm.role::text) in ('RESIDENT', 'ADMIN')
    and cm.is_active = true
  order by cm.updated_at desc nulls last, cm.created_at desc
  limit 1;

  if v_membership.community_id is null then
    raise exception 'Active resident or admin membership not found';
  end if;

  if coalesce((
    select cs.allow_frequent_access
    from public.community_settings cs
    where cs.community_id = v_membership.community_id
  ), true) = false then
    return;
  end if;

  select hr.community_id, hr.house_id, hr.is_primary, hr.is_active
  into v_house
  from public.house_residents hr
  where hr.user_id = v_user_id
    and hr.community_id = v_membership.community_id
    and hr.is_active = true
  order by hr.is_primary desc, hr.updated_at desc nulls last, hr.created_at desc
  limit 1;

  if v_house.house_id is null then
    raise exception 'User has no active house assigned in this community';
  end if;

  return query
  select
    afv.id, afv.full_name, afv.identity_number, afv.phone, afv.notes,
    afv.is_active, afv.pin_code, afv.qr_token,
    afv.created_at, afv.updated_at, afv.revoked_at,
    afv.starts_at, afv.expires_at,
    case
      when coalesce(afv.is_active, false) = false then 'REVOKED'
      when afv.starts_at is not null and afv.starts_at > now() then 'NOT_STARTED'
      when afv.expires_at is not null and afv.expires_at <= now() then 'EXPIRED'
      else 'ACTIVE'
    end as computed_status,
    (
      select max(el.action_at)
      from public.entry_logs el
      where el.frequent_visitor_id = afv.id
        and el.action = 'CHECK_IN'
    ) as last_entry_at,
    afv.access_schedule_type,
    afv.allowed_weekdays,
    afv.all_day,
    afv.allowed_start_time,
    afv.allowed_end_time
  from public.authorized_frequent_visitors afv
  where afv.created_by = v_user_id
    and afv.community_id = v_membership.community_id
    and afv.house_id = v_house.house_id
  order by
    case
      when coalesce(afv.is_active, false) = false then 4
      when afv.starts_at is not null and afv.starts_at > now() then 2
      when afv.expires_at is not null and afv.expires_at <= now() then 3
      else 1
    end,
    afv.full_name asc;
end;
$function$;

create or replace function public.guard_authorized_frequent_visitors_by_setting()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_allow_frequent_access boolean;
begin
  if coalesce(new.is_active, true) = false then
    return new;
  end if;

  select cs.allow_frequent_access
  into v_allow_frequent_access
  from public.community_settings cs
  where cs.community_id = new.community_id;

  if coalesce(v_allow_frequent_access, true) = false then
    raise exception 'Frequent visitors are disabled for community %', new.community_id
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_authorized_frequent_visitors_by_setting
on public.authorized_frequent_visitors;

create trigger trg_guard_authorized_frequent_visitors_by_setting
before insert or update on public.authorized_frequent_visitors
for each row
execute function public.guard_authorized_frequent_visitors_by_setting();

drop policy if exists authorized_frequent_visitors_feature_enabled_select
on public.authorized_frequent_visitors;

create policy authorized_frequent_visitors_feature_enabled_select
on public.authorized_frequent_visitors
as restrictive
for select
to authenticated
using (
  is_superadmin()
  or coalesce((
    select cs.allow_frequent_access
    from public.community_settings cs
    where cs.community_id = authorized_frequent_visitors.community_id
  ), true)
);

drop policy if exists authorized_frequent_visitors_feature_enabled_insert
on public.authorized_frequent_visitors;

create policy authorized_frequent_visitors_feature_enabled_insert
on public.authorized_frequent_visitors
as restrictive
for insert
to authenticated
with check (
  is_superadmin()
  or coalesce((
    select cs.allow_frequent_access
    from public.community_settings cs
    where cs.community_id = authorized_frequent_visitors.community_id
  ), true)
);

drop policy if exists authorized_frequent_visitors_feature_enabled_update
on public.authorized_frequent_visitors;

create policy authorized_frequent_visitors_feature_enabled_update
on public.authorized_frequent_visitors
as restrictive
for update
to authenticated
using (
  is_superadmin()
  or coalesce((
    select cs.allow_frequent_access
    from public.community_settings cs
    where cs.community_id = authorized_frequent_visitors.community_id
  ), true)
)
with check (
  is_superadmin()
  or coalesce((
    select cs.allow_frequent_access
    from public.community_settings cs
    where cs.community_id = authorized_frequent_visitors.community_id
  ), true)
  or coalesce(authorized_frequent_visitors.is_active, false) = false
);

create or replace function public.guard_community_facilities_by_setting()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_allow_reservations boolean;
begin
  if coalesce(new.is_active, true) = false then
    return new;
  end if;

  select cs.allow_reservations
  into v_allow_reservations
  from public.community_settings cs
  where cs.community_id = new.community_id;

  if coalesce(v_allow_reservations, true) = false then
    raise exception 'Reservations are disabled for community %', new.community_id
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_community_facilities_by_setting
on public.community_facilities;

create trigger trg_guard_community_facilities_by_setting
before insert or update on public.community_facilities
for each row
execute function public.guard_community_facilities_by_setting();

drop policy if exists community_facilities_feature_enabled_select
on public.community_facilities;

create policy community_facilities_feature_enabled_select
on public.community_facilities
as restrictive
for select
to authenticated
using (
  is_superadmin()
  or coalesce((
    select cs.allow_reservations
    from public.community_settings cs
    where cs.community_id = community_facilities.community_id
  ), true)
);

create or replace function public.guard_facility_reservations_by_setting()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_allow_reservations boolean;
  v_status text;
begin
  select cs.allow_reservations
  into v_allow_reservations
  from public.community_settings cs
  where cs.community_id = new.community_id;

  if coalesce(v_allow_reservations, true) = true then
    return new;
  end if;

  v_status := upper(coalesce(new.status, ''));

  if tg_op = 'UPDATE' and v_status in ('CANCELLED', 'REJECTED') then
    return new;
  end if;

  raise exception 'Reservations are disabled for community %', new.community_id
    using errcode = '23514';
end;
$function$;

drop trigger if exists trg_guard_facility_reservations_by_setting
on public.facility_reservations;

create trigger trg_guard_facility_reservations_by_setting
before insert or update on public.facility_reservations
for each row
execute function public.guard_facility_reservations_by_setting();

drop policy if exists facility_reservations_feature_enabled_select
on public.facility_reservations;

create policy facility_reservations_feature_enabled_select
on public.facility_reservations
as restrictive
for select
to authenticated
using (
  is_superadmin()
  or coalesce((
    select cs.allow_reservations
    from public.community_settings cs
    where cs.community_id = facility_reservations.community_id
  ), true)
);
