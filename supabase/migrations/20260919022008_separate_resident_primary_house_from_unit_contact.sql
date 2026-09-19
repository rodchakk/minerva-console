-- Definitive compatibility fix:
-- house_residents.is_primary = this user's primary/current unit assignment.
-- house_residents.is_primary_contact = the unit's titular/primary contact.
-- These are different concepts and must never share one flag.

alter table public.house_residents
  add column if not exists is_primary_contact boolean not null default false;

comment on column public.house_residents.is_primary is
  'Primary/current unit assignment for this user within the community. Multiple residents of the same house may each have is_primary=true.';

comment on column public.house_residents.is_primary_contact is
  'Operational titular/primary contact for the unit. At most one active primary contact per house.';

-- Preserve the contact decisions produced by the prior primary-contact migration
-- before restoring is_primary to its original user-centric meaning.
update public.house_residents
   set is_primary_contact = is_primary
 where is_primary_contact is distinct from is_primary;

-- Remove the trigger/index that incorrectly forced is_primary to be one-per-house.
drop trigger if exists trg_normalize_house_resident_primary_v1
  on public.house_residents;

drop function if exists public.normalize_house_resident_primary_v1();

drop index if exists public.ux_house_residents_one_active_primary_per_house;

-- Restore user-centric primary-house semantics from the authoritative profile house.
-- Clear first so the existing unique(user_id, community_id) partial index remains safe.
update public.house_residents
   set is_primary = false
 where is_primary = true;

update public.house_residents hr
   set is_primary = true,
       updated_at = now()
  from public.profiles p
 where p.user_id = hr.user_id
   and p.community_id = hr.community_id
   and p.house_id = hr.house_id
   and hr.is_active = true
   and hr.is_primary = false;

-- Inactive assignments can never be either type of primary.
update public.house_residents
   set is_primary = false,
       is_primary_contact = false,
       updated_at = now()
 where is_active = false
   and (is_primary = true or is_primary_contact = true);

-- Keep exactly one operational primary contact per active house, independent
-- from each resident's own primary-house assignment.
create unique index if not exists ux_house_residents_one_active_primary_contact_per_house
  on public.house_residents (house_id)
  where is_active = true and is_primary_contact = true;

create or replace function public.normalize_house_resident_primary_contact_v1()
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
    new.is_primary_contact := false;
    return new;
  end if;

  -- Community Registration activations carry queue_id in auth metadata.
  -- position=1 defines the operational contact, but every activated resident
  -- still keeps is_primary=true for their own current unit.
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
      if v_registration_position = 1 then
        update public.house_residents existing
           set is_primary_contact = false,
               updated_at = now()
         where existing.house_id = new.house_id
           and existing.user_id <> new.user_id
           and existing.is_active = true
           and existing.is_primary_contact = true;

        new.is_primary_contact := true;
      else
        new.is_primary_contact := false;
      end if;

      return new;
    end if;
  end if;

  -- Non-registration flows: preserve an existing unit contact. If the unit
  -- has none, the first active resident becomes the operational contact.
  if exists (
    select 1
      from public.house_residents existing
     where existing.house_id = new.house_id
       and existing.user_id <> new.user_id
       and existing.is_active = true
       and existing.is_primary_contact = true
  ) then
    new.is_primary_contact := false;
  else
    new.is_primary_contact := true;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_normalize_house_resident_primary_contact_v1
  on public.house_residents;

create trigger trg_normalize_house_resident_primary_contact_v1
before insert or update of house_id, user_id, is_active
on public.house_residents
for each row
execute function public.normalize_house_resident_primary_contact_v1();

comment on function public.normalize_house_resident_primary_contact_v1() is
  'Maintains a unit-level primary contact without changing the resident user primary-house flag.';

-- Admin unit contracts must read the unit-contact flag, never the user's
-- primary-house flag.
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
      and hr.is_primary_contact = true
      and coalesce(p.is_active, true) = true
    order by hr.updated_at desc, hr.created_at desc
    limit 1
  ) pc on true
  where h.community_id = p_community_id
  order by h.house_label;
end;
$function$;

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
      and hr.is_primary_contact = true
      and coalesce(p.is_active, true) = true
    limit 1
  ) pc on true
  where h.id = p_house_id
    and h.community_id = v_community_id;
end;
$function$;

-- Self-access must resolve the resident's current house, not require them to
-- be the sole/titular contact of that house.
create or replace function public.create_self_access_pass()
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_community_id uuid;
  v_house_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
  v_token text;
  v_pin text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform public.assert_no_pin_pending();

  select hr.community_id, hr.house_id
    into v_community_id, v_house_id
  from public.house_residents hr
  join public.community_members cm
    on cm.user_id = hr.user_id
   and cm.community_id = hr.community_id
  left join public.profiles p
    on p.user_id = hr.user_id
   and p.community_id = hr.community_id
  join public.houses h
    on h.id = hr.house_id
   and h.community_id = hr.community_id
  where hr.user_id = v_user_id
    and hr.is_active = true
    and cm.is_active = true
    and cm.role in ('RESIDENT', 'ADMIN')
    and h.is_active = true
  order by
    case
      when p.house_id = hr.house_id then 0
      when hr.is_primary = true then 1
      else 2
    end,
    hr.created_at desc
  limit 1;

  if v_community_id is null or v_house_id is null then
    raise exception 'No active resident-house assignment found.';
  end if;

  update public.visit_passes
     set status = 'EXPIRED'
   where created_by = v_user_id
     and pass_type = 'SELF_ACCESS'
     and status = 'ACTIVE'
     and expires_at <= now();

  select id into v_existing_id
  from public.visit_passes
  where created_by = v_user_id
    and community_id = v_community_id
    and house_id = v_house_id
    and pass_type = 'SELF_ACCESS'
    and status = 'ACTIVE'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  v_pin := floor(random() * 900000 + 100000)::text;
  v_token := gen_random_uuid()::text;

  insert into public.visit_passes (
    created_by, community_id, house_id, pass_type, status,
    capacity, expires_at, visitor_name, qr_token, pin_code
  ) values (
    v_user_id, v_community_id, v_house_id, 'SELF_ACCESS', 'ACTIVE',
    1, now() + interval '5 minutes', null, v_token, v_pin
  )
  returning id into v_new_id;

  return v_new_id;
end;
$function$;

-- Moving a resident must move their user-primary house while independently
-- maintaining the unit-level contact.
create or replace function public.sa_move_community_resident_unit(
  p_community_id uuid,
  p_target_user_id uuid,
  p_target_house_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_target_house public.houses%rowtype;
  v_source_house_id uuid;
  v_source_was_primary_contact boolean := false;
  v_target_has_primary_contact boolean := false;
  v_target_assignment_id uuid;
  v_replacement_contact_user_id uuid;
  v_result jsonb;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not public.is_superadmin(v_actor_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  select p.*
    into v_profile
  from public.profiles p
  where p.user_id = p_target_user_id
    and p.community_id = p_community_id
  limit 1
  for update;

  if not found then
    raise exception 'Resident not found in this community';
  end if;

  if v_profile.role::text not in ('RESIDENT', 'ADMIN') then
    raise exception 'Only resident accounts can be moved between units';
  end if;

  select h.*
    into v_target_house
  from public.houses h
  where h.id = p_target_house_id
    and h.community_id = p_community_id
  limit 1
  for update;

  if not found then
    raise exception 'Target unit not found in this community';
  end if;

  if v_target_house.is_active = false then
    raise exception 'Activate the target unit before moving a resident';
  end if;

  v_source_house_id := v_profile.house_id;

  if v_source_house_id = p_target_house_id then
    raise exception 'Resident is already assigned to this unit';
  end if;

  if v_source_house_id is not null then
    select coalesce(bool_or(hr.is_primary_contact), false)
      into v_source_was_primary_contact
    from public.house_residents hr
    where hr.user_id = p_target_user_id
      and hr.community_id = p_community_id
      and hr.house_id = v_source_house_id
      and hr.is_active = true;
  end if;

  select exists (
    select 1
    from public.house_residents hr
    where hr.community_id = p_community_id
      and hr.house_id = p_target_house_id
      and hr.user_id <> p_target_user_id
      and hr.is_active = true
      and hr.is_primary_contact = true
  ) into v_target_has_primary_contact;

  update public.house_residents hr
     set is_active = false,
         is_primary = false,
         is_primary_contact = false,
         updated_at = now()
   where hr.user_id = p_target_user_id
     and hr.community_id = p_community_id
     and hr.house_id <> p_target_house_id
     and (hr.is_active = true or hr.is_primary = true or hr.is_primary_contact = true);

  select hr.id
    into v_target_assignment_id
  from public.house_residents hr
  where hr.user_id = p_target_user_id
    and hr.community_id = p_community_id
    and hr.house_id = p_target_house_id
  order by hr.created_at desc
  limit 1
  for update;

  if v_target_assignment_id is not null then
    update public.house_residents
       set is_active = v_profile.is_active,
           is_primary = v_profile.is_active,
           is_primary_contact = v_profile.is_active and not v_target_has_primary_contact,
           updated_at = now()
     where id = v_target_assignment_id;
  else
    insert into public.house_residents (
      community_id,
      house_id,
      user_id,
      is_primary,
      is_primary_contact,
      is_active
    ) values (
      p_community_id,
      p_target_house_id,
      p_target_user_id,
      v_profile.is_active,
      v_profile.is_active and not v_target_has_primary_contact,
      v_profile.is_active
    );
  end if;

  update public.profiles p
     set house_id = p_target_house_id
   where p.user_id = p_target_user_id
     and p.community_id = p_community_id;

  if v_source_was_primary_contact and v_source_house_id is not null then
    if not exists (
      select 1
      from public.house_residents hr
      where hr.community_id = p_community_id
        and hr.house_id = v_source_house_id
        and hr.is_active = true
        and hr.is_primary_contact = true
    ) then
      select hr.user_id
        into v_replacement_contact_user_id
      from public.house_residents hr
      join public.profiles p
        on p.user_id = hr.user_id
       and p.community_id = hr.community_id
      where hr.community_id = p_community_id
        and hr.house_id = v_source_house_id
        and hr.user_id <> p_target_user_id
        and hr.is_active = true
        and p.is_active = true
      order by hr.created_at asc
      limit 1
      for update of hr;

      if v_replacement_contact_user_id is not null then
        update public.house_residents hr
           set is_primary_contact = (hr.user_id = v_replacement_contact_user_id),
               updated_at = now()
         where hr.community_id = p_community_id
           and hr.house_id = v_source_house_id
           and hr.is_active = true;
      end if;
    end if;
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'community_id', p_community_id,
    'user_id', p_target_user_id,
    'from_house_id', v_source_house_id,
    'to_house_id', p_target_house_id,
    'to_house_label', v_target_house.house_label,
    'is_active', v_profile.is_active
  );

  insert into public.system_event_log (
    severity,
    module,
    event_type,
    message,
    details,
    community_id,
    user_id,
    actor_id,
    entity_type,
    entity_id,
    source
  ) values (
    'INFO',
    'superadmin',
    'RESIDENT_MOVED_BETWEEN_UNITS',
    'Resident moved between units by superadmin',
    v_result,
    p_community_id,
    p_target_user_id,
    v_actor_id,
    'user',
    p_target_user_id,
    'minerva_console'
  );

  insert into public.superadmin_audit_log (
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    v_actor_id,
    'community_resident.move_unit',
    'user',
    p_target_user_id,
    v_result
  );

  return v_result;
end;
$function$;
