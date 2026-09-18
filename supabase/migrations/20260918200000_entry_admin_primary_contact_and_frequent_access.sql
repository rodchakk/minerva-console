-- ENTRY Admin Web operations hardening.
-- Separates legal owner metadata from the operational primary contact,
-- repairs historical primary-contact flags, and adds admin frequent-access RPCs.

-- 1) Primary-contact semantics -------------------------------------------------

alter table public.house_residents
  alter column is_primary set default false;

-- Backfill from the authoritative Community Registration traceability chain.
-- If the same operational house was registered more than once, the most recent
-- converted position=1 resident wins.
with ranked_registration_primary as (
  select
    q.house_id,
    q.activated_user_id as user_id,
    row_number() over (
      partition by q.house_id
      order by
        coalesce(cr.converted_at, q.processed_at, q.updated_at, q.created_at) desc,
        cr.created_at desc,
        cr.id desc
    ) as rn
  from public.resident_activation_queue q
  join public.community_registration_residents cr
    on cr.id = q.community_registration_resident_id
  where q.house_id is not null
    and q.activated_user_id is not null
    and q.status = 'activated'
    and cr.position = 1
),
canonical_registration_primary as (
  select house_id, user_id
  from ranked_registration_primary
  where rn = 1
)
update public.house_residents hr
   set is_primary = (hr.user_id = cp.user_id),
       updated_at = now()
  from canonical_registration_primary cp
 where hr.house_id = cp.house_id
   and hr.is_active = true
   and hr.is_primary is distinct from (hr.user_id = cp.user_id);

-- Houses without registration traceability may safely keep a sole active
-- resident as their contact. This avoids inventing a titular in multi-resident
-- houses where no authoritative signal exists.
with houses_with_registration_primary as (
  select distinct q.house_id
  from public.resident_activation_queue q
  join public.community_registration_residents cr
    on cr.id = q.community_registration_resident_id
  where q.house_id is not null
    and q.activated_user_id is not null
    and q.status = 'activated'
    and cr.position = 1
),
sole_active_resident as (
  select hr.house_id, min(hr.user_id) as user_id
  from public.house_residents hr
  where hr.is_active = true
    and not exists (
      select 1
      from houses_with_registration_primary rp
      where rp.house_id = hr.house_id
    )
  group by hr.house_id
  having count(*) = 1
)
update public.house_residents hr
   set is_primary = true,
       updated_at = now()
  from sole_active_resident sole
 where hr.house_id = sole.house_id
   and hr.user_id = sole.user_id
   and hr.is_active = true
   and hr.is_primary = false;

-- For ambiguous legacy houses with no authoritative onboarding signal, remove
-- duplicate primary flags instead of guessing.
with houses_with_registration_primary as (
  select distinct q.house_id
  from public.resident_activation_queue q
  join public.community_registration_residents cr
    on cr.id = q.community_registration_resident_id
  where q.house_id is not null
    and q.activated_user_id is not null
    and q.status = 'activated'
    and cr.position = 1
),
ambiguous_houses as (
  select hr.house_id
  from public.house_residents hr
  where hr.is_active = true
    and not exists (
      select 1
      from houses_with_registration_primary rp
      where rp.house_id = hr.house_id
    )
  group by hr.house_id
  having count(*) > 1
     and count(*) filter (where hr.is_primary = true) > 1
)
update public.house_residents hr
   set is_primary = false,
       updated_at = now()
  from ambiguous_houses ah
 where hr.house_id = ah.house_id
   and hr.is_active = true
   and hr.is_primary = true;

drop index if exists public.ux_house_residents_one_active_primary_per_house;
create unique index ux_house_residents_one_active_primary_per_house
  on public.house_residents (house_id)
  where is_active = true and is_primary = true;

create or replace function public.normalize_house_resident_primary_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_queue_id_text text;
  v_registration_position integer;
begin
  if coalesce(new.is_active, false) = false then
    new.is_primary := false;
    return new;
  end if;

  -- Community Registration activations carry queue_id in auth metadata before
  -- the house_residents row is inserted. That lets us preserve position=1.
  select au.raw_user_meta_data ->> 'queue_id'
    into v_queue_id_text
    from auth.users au
   where au.id = new.user_id;

  if v_queue_id_text is not null
     and v_queue_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select cr.position
      into v_registration_position
      from public.resident_activation_queue q
      join public.community_registration_residents cr
        on cr.id = q.community_registration_resident_id
     where q.id = v_queue_id_text::uuid
       and q.house_id = new.house_id
     limit 1;

    if v_registration_position is not null then
      new.is_primary := (v_registration_position = 1);
      return new;
    end if;
  end if;

  -- Non-registration flows may request primary=true, but they must never
  -- silently replace an existing active titular.
  if new.is_primary = true and exists (
    select 1
      from public.house_residents existing
     where existing.house_id = new.house_id
       and existing.is_active = true
       and existing.is_primary = true
       and existing.user_id <> new.user_id
  ) then
    new.is_primary := false;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_normalize_house_resident_primary_v1
  on public.house_residents;

create trigger trg_normalize_house_resident_primary_v1
before insert or update of house_id, user_id, is_primary, is_active
on public.house_residents
for each row
execute function public.normalize_house_resident_primary_v1();

comment on function public.normalize_house_resident_primary_v1() is
  'Preserves Community Registration position=1 as ENTRY unit primary contact and prevents ordinary resident writes from replacing an existing titular.';

-- 2) Admin unit read/write contracts ------------------------------------------

create or replace function public.admin_list_houses_v2(p_community_id uuid)
returns table(
  id uuid,
  community_id uuid,
  house_label text,
  owner_name text,
  primary_contact_user_id uuid,
  primary_contact_name text,
  is_active boolean,
  created_at timestamptz,
  active_residents bigint,
  active_passes bigint,
  last_access timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not (public.is_superadmin() or public.is_community_admin(p_community_id, auth.uid())) then
    raise exception 'Access denied: superadmin or community admin required'
      using errcode = '42501';
  end if;

  return query
  select
    h.id,
    h.community_id,
    h.house_label,
    h.owner_name,
    pc.user_id,
    pc.full_name,
    h.is_active,
    h.created_at,
    (
      select count(*)
      from public.house_residents hr
      where hr.house_id = h.id
        and hr.is_active = true
    )::bigint,
    (
      select count(*)
      from public.visit_passes vp
      where vp.house_id = h.id
        and vp.status in ('ACTIVE','SCHEDULED','CHECKED_IN')
    )::bigint,
    (
      select max(coalesce(el.action_at, el.created_at))
      from public.entry_logs el
      where el.house_id = h.id
    )
  from public.houses h
  left join lateral (
    select p.user_id, p.full_name
    from public.house_residents hr
    join public.profiles p
      on p.user_id = hr.user_id
    where hr.house_id = h.id
      and hr.is_active = true
      and hr.is_primary = true
      and coalesce(p.is_active, true) = true
    order by hr.updated_at desc, hr.created_at desc
    limit 1
  ) pc on true
  where h.community_id = p_community_id
  order by h.house_label;
end;
$function$;

revoke all on function public.admin_list_houses_v2(uuid) from public;
revoke all on function public.admin_list_houses_v2(uuid) from anon;
grant execute on function public.admin_list_houses_v2(uuid) to authenticated;

create or replace function public.admin_update_house_profile(
  p_house_id uuid,
  p_house_label text,
  p_owner_name text default null
)
returns table(
  id uuid,
  community_id uuid,
  house_label text,
  owner_name text,
  primary_contact_name text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_community_id uuid;
  v_role text;
  v_access_state text;
  v_house_label text := btrim(coalesce(p_house_label, ''));
  v_owner_name text := nullif(btrim(coalesce(p_owner_name, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select r.community_id, r.role, r.access_state
    into v_community_id, v_role, v_access_state
    from public.resolve_my_app_access() as r
    limit 1;

  if v_community_id is null
     or v_access_state <> 'ACTIVE'
     or v_role not in ('ADMIN', 'SUPERADMIN', 'SUPER_ADMIN') then
    raise exception 'Unauthorized';
  end if;

  if v_house_label = '' then
    raise exception 'Unit label is required';
  end if;

  if char_length(v_house_label) > 120 then
    raise exception 'Unit label is too long';
  end if;

  if v_owner_name is not null and char_length(v_owner_name) > 160 then
    raise exception 'Owner name is too long';
  end if;

  if exists (
    select 1
    from public.houses h
    where h.community_id = v_community_id
      and h.id <> p_house_id
      and lower(btrim(h.house_label)) = lower(v_house_label)
  ) then
    raise exception 'Unit label already exists';
  end if;

  update public.houses h
     set house_label = v_house_label,
         owner_name = v_owner_name
   where h.id = p_house_id
     and h.community_id = v_community_id;

  if not found then
    raise exception 'Unit not found';
  end if;

  return query
  select
    h.id,
    h.community_id,
    h.house_label,
    h.owner_name,
    pc.full_name
  from public.houses h
  left join lateral (
    select p.full_name
    from public.house_residents hr
    join public.profiles p on p.user_id = hr.user_id
    where hr.house_id = h.id
      and hr.is_active = true
      and hr.is_primary = true
      and coalesce(p.is_active, true) = true
    limit 1
  ) pc on true
  where h.id = p_house_id
    and h.community_id = v_community_id;
end;
$function$;

revoke all on function public.admin_update_house_profile(uuid, text, text) from public;
revoke all on function public.admin_update_house_profile(uuid, text, text) from anon;
grant execute on function public.admin_update_house_profile(uuid, text, text) to authenticated;

-- 3) Admin frequent-access contracts -----------------------------------------

create or replace function public.admin_list_frequent_accesses()
returns table(
  id uuid,
  community_id uuid,
  house_id uuid,
  house_label text,
  created_by uuid,
  authorized_by_name text,
  full_name text,
  identity_number text,
  phone text,
  notes text,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz,
  revoked_at timestamptz,
  is_active boolean,
  computed_status text,
  days_active integer,
  last_access timestamptz,
  access_count bigint
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_community_id uuid;
  v_role text;
  v_access_state text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select r.community_id, r.role, r.access_state
    into v_community_id, v_role, v_access_state
    from public.resolve_my_app_access() as r
    limit 1;

  if v_community_id is null
     or v_access_state <> 'ACTIVE'
     or v_role not in ('ADMIN', 'SUPERADMIN', 'SUPER_ADMIN') then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    afv.id,
    afv.community_id,
    afv.house_id,
    h.house_label,
    afv.created_by,
    creator.full_name,
    afv.full_name,
    afv.identity_number,
    afv.phone,
    afv.notes,
    afv.starts_at,
    afv.expires_at,
    afv.created_at,
    afv.revoked_at,
    afv.is_active,
    case
      when afv.revoked_at is not null or coalesce(afv.is_active, false) = false then 'REVOKED'
      when afv.starts_at is not null and afv.starts_at > now() then 'NOT_STARTED'
      when afv.expires_at is not null and afv.expires_at <= now() then 'EXPIRED'
      else 'ACTIVE'
    end,
    greatest(
      0,
      floor(
        extract(epoch from (now() - coalesce(afv.starts_at, afv.created_at))) / 86400
      )::integer
    ),
    activity.last_access,
    coalesce(activity.access_count, 0)::bigint
  from public.authorized_frequent_visitors afv
  join public.houses h
    on h.id = afv.house_id
   and h.community_id = afv.community_id
  left join public.profiles creator
    on creator.user_id = afv.created_by
  left join lateral (
    select
      max(coalesce(el.action_at, el.created_at)) as last_access,
      count(*) as access_count
    from public.entry_logs el
    where el.frequent_visitor_id = afv.id
      and el.community_id = afv.community_id
  ) activity on true
  where afv.community_id = v_community_id;
end;
$function$;

revoke all on function public.admin_list_frequent_accesses() from public;
revoke all on function public.admin_list_frequent_accesses() from anon;
grant execute on function public.admin_list_frequent_accesses() to authenticated;

create or replace function public.admin_get_frequent_access_detail(
  p_frequent_visitor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_community_id uuid;
  v_role text;
  v_access_state text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select r.community_id, r.role, r.access_state
    into v_community_id, v_role, v_access_state
    from public.resolve_my_app_access() as r
    limit 1;

  if v_community_id is null
     or v_access_state <> 'ACTIVE'
     or v_role not in ('ADMIN', 'SUPERADMIN', 'SUPER_ADMIN') then
    raise exception 'Unauthorized';
  end if;

  select jsonb_build_object(
    'id', afv.id,
    'community_id', afv.community_id,
    'house_id', afv.house_id,
    'house_label', h.house_label,
    'created_by', afv.created_by,
    'authorized_by_name', creator.full_name,
    'full_name', afv.full_name,
    'identity_number', afv.identity_number,
    'phone', afv.phone,
    'notes', afv.notes,
    'starts_at', afv.starts_at,
    'expires_at', afv.expires_at,
    'created_at', afv.created_at,
    'updated_at', afv.updated_at,
    'revoked_at', afv.revoked_at,
    'is_active', afv.is_active,
    'computed_status', case
      when afv.revoked_at is not null or coalesce(afv.is_active, false) = false then 'REVOKED'
      when afv.starts_at is not null and afv.starts_at > now() then 'NOT_STARTED'
      when afv.expires_at is not null and afv.expires_at <= now() then 'EXPIRED'
      else 'ACTIVE'
    end,
    'days_active', greatest(
      0,
      floor(extract(epoch from (now() - coalesce(afv.starts_at, afv.created_at))) / 86400)::integer
    ),
    'recent_entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', recent.id,
          'action', recent.action,
          'action_at', recent.action_at,
          'method', recent.method,
          'guard_name', guard_profile.full_name,
          'plate', recent.vehicle_plate_text,
          'has_evidence', (
            recent.photo_path is not null
            or recent.vehicle_photo_path is not null
          )
        )
        order by recent.action_at desc
      )
      from (
        select el.*
        from public.entry_logs el
        where el.frequent_visitor_id = afv.id
          and el.community_id = afv.community_id
        order by coalesce(el.action_at, el.created_at) desc
        limit 20
      ) recent
      left join public.profiles guard_profile
        on guard_profile.user_id = recent.guard_id
    ), '[]'::jsonb)
  )
  into v_result
  from public.authorized_frequent_visitors afv
  join public.houses h
    on h.id = afv.house_id
   and h.community_id = afv.community_id
  left join public.profiles creator
    on creator.user_id = afv.created_by
  where afv.id = p_frequent_visitor_id
    and afv.community_id = v_community_id;

  if v_result is null then
    raise exception 'Frequent access not found';
  end if;

  return v_result;
end;
$function$;

revoke all on function public.admin_get_frequent_access_detail(uuid) from public;
revoke all on function public.admin_get_frequent_access_detail(uuid) from anon;
grant execute on function public.admin_get_frequent_access_detail(uuid) to authenticated;

create or replace function public.admin_revoke_authorized_frequent_visitor(
  p_frequent_visitor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_community_id uuid;
  v_role text;
  v_access_state text;
  v_affected integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select r.community_id, r.role, r.access_state
    into v_community_id, v_role, v_access_state
    from public.resolve_my_app_access() as r
    limit 1;

  if v_community_id is null
     or v_access_state <> 'ACTIVE'
     or v_role not in ('ADMIN', 'SUPERADMIN', 'SUPER_ADMIN') then
    raise exception 'Unauthorized';
  end if;

  update public.authorized_frequent_visitors afv
     set is_active = false,
         revoked_at = coalesce(afv.revoked_at, now()),
         revoked_by = coalesce(afv.revoked_by, auth.uid()),
         updated_at = now()
   where afv.id = p_frequent_visitor_id
     and afv.community_id = v_community_id
     and afv.revoked_at is null
     and afv.is_active = true;

  get diagnostics v_affected = row_count;
  return v_affected > 0;
end;
$function$;

revoke all on function public.admin_revoke_authorized_frequent_visitor(uuid) from public;
revoke all on function public.admin_revoke_authorized_frequent_visitor(uuid) from anon;
grant execute on function public.admin_revoke_authorized_frequent_visitor(uuid) to authenticated;

comment on function public.admin_revoke_authorized_frequent_visitor(uuid) is
  'Community-admin-only revocation. Keeps the frequent visitor and all entry history for audit/investigation.';
