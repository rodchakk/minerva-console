-- ENTRY unit resident-facing references.
--
-- Adds durable, presentation-only metadata to operational houses and keeps the
-- currently available Resident Registration campaign unit snapshot in sync.
-- The reference is never part of unit identity or normalization.

alter table public.houses
  add column if not exists public_reference text;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'houses_public_reference_format'
       and conrelid = 'public.houses'::regclass
  ) then
    alter table public.houses
      add constraint houses_public_reference_format
      check (
        public_reference is null
        or (
          public_reference = btrim(public_reference)
          and public_reference <> ''
          and char_length(public_reference) <= 160
        )
      );
  end if;
end;
$$;

comment on column public.houses.public_reference is
  'Optional resident-facing location/reference text used to help identify a unit during registration. Not part of unit identity.';

create or replace function public.protect_house_columns_on_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_id uuid := auth.uid();
  v_is_admin boolean := false;
begin
  -- service_role (Edge Functions, crons, internal SECURITY DEFINER RPCs) passes freely.
  if v_caller_id is null then
    return new;
  end if;

  -- Superadmins pass freely.
  if exists (
    select 1
      from public.superadmin_users
     where user_id = v_caller_id
       and is_active = true
  ) then
    return new;
  end if;

  -- Community admins pass freely except for tenant ownership.
  select exists (
    select 1
      from public.community_members cm
     where cm.user_id = v_caller_id
       and cm.community_id = old.community_id
       and cm.role = 'ADMIN'
       and cm.is_active = true
  ) into v_is_admin;

  if v_is_admin then
    if new.community_id is distinct from old.community_id then
      raise exception 'permission_denied: cannot change community_id'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Residents may only update location fields.
  if new.house_label is distinct from old.house_label then
    raise exception 'permission_denied: residents cannot change house_label'
      using errcode = '42501';
  end if;

  if new.owner_name is distinct from old.owner_name then
    raise exception 'permission_denied: residents cannot change owner_name'
      using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'permission_denied: residents cannot change is_active'
      using errcode = '42501';
  end if;

  if new.community_id is distinct from old.community_id then
    raise exception 'permission_denied: residents cannot change community_id'
      using errcode = '42501';
  end if;

  if new.public_reference is distinct from old.public_reference then
    raise exception 'permission_denied: residents cannot change public_reference'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

create or replace function public._inherit_house_public_reference_for_registration_unit_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.house_id is not null and new.public_reference is null then
    select h.public_reference
      into new.public_reference
      from public.houses h
     where h.id = new.house_id
       and h.community_id = new.community_id;
  end if;

  return new;
end;
$function$;

revoke all on function public._inherit_house_public_reference_for_registration_unit_v1() from public;
revoke all on function public._inherit_house_public_reference_for_registration_unit_v1() from anon;
revoke all on function public._inherit_house_public_reference_for_registration_unit_v1() from authenticated;

drop trigger if exists tg_cr_units_inherit_house_public_reference_v1
  on public.community_registration_units;

create trigger tg_cr_units_inherit_house_public_reference_v1
before insert on public.community_registration_units
for each row
execute function public._inherit_house_public_reference_for_registration_unit_v1();

create or replace function public._sync_house_public_reference_to_registration_units_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.public_reference is not distinct from old.public_reference then
    return new;
  end if;

  update public.community_registration_units u
     set public_reference = new.public_reference
    from public.community_registration_campaigns c
   where u.campaign_id = c.id
     and u.house_id = new.id
     and u.community_id = new.community_id
     and u.status = 'unregistered'
     and c.id = u.campaign_id
     and c.community_id = new.community_id
     and c.registration_mode = 'existing_units'
     and c.status in ('draft', 'open', 'paused', 'review');

  return new;
end;
$function$;

revoke all on function public._sync_house_public_reference_to_registration_units_v1() from public;
revoke all on function public._sync_house_public_reference_to_registration_units_v1() from anon;
revoke all on function public._sync_house_public_reference_to_registration_units_v1() from authenticated;

drop trigger if exists tg_houses_sync_public_reference_to_registration_units_v1
  on public.houses;

create trigger tg_houses_sync_public_reference_to_registration_units_v1
after update of public_reference on public.houses
for each row
execute function public._sync_house_public_reference_to_registration_units_v1();
