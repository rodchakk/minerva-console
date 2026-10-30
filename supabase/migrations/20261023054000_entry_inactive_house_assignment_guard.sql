-- ENTRY: prevent NEW resident assignments and activations into inactive units.
-- Does not alter existing memberships, profiles, PINs, invites or house statuses.
-- IMPORTANT: prepare/review migration in staging before production release.
--
-- All new active assignments must reference an active house in the SAME
-- community. FOR SHARE serializes this check with a concurrent house toggle.
-- Pending queue imports remain possible; PIN issue and account activation do not.

create or replace function public.entry_assert_active_house_assignment_v1(
  p_house_id uuid,
  p_community_id uuid
)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_active boolean;
begin
  select h.is_active into v_active
  from public.houses h
  where h.id = p_house_id
    and h.community_id = p_community_id
  for share;

  if not found then
    raise exception 'house_not_in_community' using errcode = '23514';
  end if;

  if v_active is distinct from true then
    raise exception 'house_inactive' using errcode = '23514';
  end if;
end;
$function$;

create or replace function public.entry_guard_inactive_house_assignment_v1()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_house_id uuid;
  v_community_id uuid;
begin
  if tg_table_name = 'profiles' then
    -- Keep existing historical/inactive profiles untouched.
    if new.house_id is null or coalesce(new.is_active, false) = false then
      return new;
    end if;

    if tg_op = 'UPDATE' then
      if new.house_id is not distinct from old.house_id
         and new.community_id is not distinct from old.community_id
         and new.is_active is not distinct from old.is_active then
        return new;
      end if;
    end if;

    perform public.entry_assert_active_house_assignment_v1(
      new.house_id, new.community_id
    );

  elsif tg_table_name = 'house_residents' then
    if coalesce(new.is_active, false) = false then
      return new;
    end if;

    if tg_op = 'UPDATE' then
      if new.house_id is not distinct from old.house_id
         and new.community_id is not distinct from old.community_id
         and new.is_active is not distinct from old.is_active
         and new.is_primary is not distinct from old.is_primary then
        return new;
      end if;
    end if;

    perform public.entry_assert_active_house_assignment_v1(
      new.house_id, new.community_id
    );

  elsif tg_table_name = 'resident_activation_pins' then
    -- Prevent issuing or refreshing a PIN against an inactive/missing house.
    -- A PIN becoming used or expired is not blocked.
    if new.status <> 'pending' then
      return new;
    end if;

    select q.house_id, q.community_id
      into v_house_id, v_community_id
    from public.resident_activation_queue q
    where q.id = new.queue_id and q.community_id = new.community_id;

    if not found then
      raise exception 'activation_queue_not_found'
        using errcode = '23514';
    end if;

    perform public.entry_assert_active_house_assignment_v1(
      v_house_id, v_community_id
    );

  elsif tg_table_name = 'resident_invites' then
    -- Pending invitations are actionable credentials; do not issue them for
    -- inactive units. Allow cancelling/claiming old invites.
    if new.status <> 'PENDING' then
      return new;
    end if;

    if tg_op = 'UPDATE' then
      if new.house_id is not distinct from old.house_id
         and new.community_id is not distinct from old.community_id
         and new.status is not distinct from old.status then
        return new;
      end if;
    end if;

    perform public.entry_assert_active_house_assignment_v1(
      new.house_id, new.community_id
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_entry_guard_active_profile_house_v1 on public.profiles;
create trigger trg_entry_guard_active_profile_house_v1
before insert or update of house_id, community_id, is_active
on public.profiles
for each row execute function public.entry_guard_inactive_house_assignment_v1();

drop trigger if exists trg_entry_guard_active_membership_house_v1 on public.house_residents;
create trigger trg_entry_guard_active_membership_house_v1
before insert or update of house_id, community_id, is_active, is_primary
on public.house_residents
for each row execute function public.entry_guard_inactive_house_assignment_v1();

drop trigger if exists trg_entry_guard_pending_pin_house_v1 on public.resident_activation_pins;
create trigger trg_entry_guard_pending_pin_house_v1
before insert or update of queue_id, community_id, status, pin_hash, expires_at
on public.resident_activation_pins
for each row execute function public.entry_guard_inactive_house_assignment_v1();

drop trigger if exists trg_entry_guard_pending_invite_house_v1 on public.resident_invites;
create trigger trg_entry_guard_pending_invite_house_v1
before insert or update of house_id, community_id, status
on public.resident_invites
for each row execute function public.entry_guard_inactive_house_assignment_v1();

-- Only trigger owners execute these SECURITY DEFINER helpers. Never publish
-- them as callable RPCs to anon/authenticated clients.
revoke all on function public.entry_assert_active_house_assignment_v1(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.entry_guard_inactive_house_assignment_v1()
  from public, anon, authenticated;
