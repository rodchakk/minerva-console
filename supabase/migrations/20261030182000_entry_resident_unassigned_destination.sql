-- ENTRY: superadmin-only, audited, transactional UNASSIGNED destination.
-- No pseudo-house and no deletion of profile/auth/historical household rows.
create or replace function public.sa_unassign_community_resident_unit_v1(
  p_community_id uuid,
  p_target_user_id uuid,
  p_expected_house_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_actor_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_member public.community_members%rowtype;
  v_old_house_id uuid;
  v_was_primary_contact boolean := false;
  v_replacement_contact_id uuid;
  v_result jsonb;
begin
  if v_actor_id is null or not public.is_superadmin(v_actor_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;
  if p_target_user_id is null or p_community_id is null or p_expected_house_id is null
     or p_target_user_id = v_actor_id then
    raise exception 'Invalid resident or community' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.superadmin_users s
    where s.user_id = p_target_user_id and s.is_active
  ) then
    raise exception 'Cannot unassign an active superadmin' using errcode = '42501';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.user_id = p_target_user_id and p.community_id = p_community_id
  for update;
  if not found then
    raise exception 'Resident not found in this community' using errcode = 'P0002';
  end if;

  select cm.* into v_member
  from public.community_members cm
  where cm.user_id = p_target_user_id and cm.community_id = p_community_id
  for update;
  if not found or v_member.role::text <> 'RESIDENT' or v_profile.role::text <> 'RESIDENT' then
    raise exception 'Only resident accounts can be unassigned' using errcode = '22023';
  end if;

  v_old_house_id := v_profile.house_id;
  if v_old_house_id is null then
    raise exception 'Resident already has no assigned unit' using errcode = '22023';
  end if;
  if v_old_house_id <> p_expected_house_id then
    raise exception 'Resident assignment changed. Refresh and try again.' using errcode = 'P0409';
  end if;

  select coalesce(bool_or(hr.is_primary_contact), false)
  into v_was_primary_contact
  from public.house_residents hr
  where hr.user_id = p_target_user_id
    and hr.community_id = p_community_id
    and hr.house_id = v_old_house_id
    and hr.is_active = true;

  -- Revoke every active household relation, preserving historical rows.
  update public.house_residents hr
  set is_active = false,
      is_primary = false,
      is_primary_contact = false,
      updated_at = now()
  where hr.user_id = p_target_user_id
    and hr.community_id = p_community_id
    and (hr.is_active or hr.is_primary or hr.is_primary_contact);

  -- Do not leave the account active without a home.
  update public.profiles
  set house_id = null,
      role = 'UNASSIGNED'::public.user_role,
      is_active = false,
      deactivated_by_unit = false
  where user_id = p_target_user_id and community_id = p_community_id;

  update public.community_members
  set role = 'UNASSIGNED'::public.user_role,
      is_active = false,
      updated_at = now()
  where user_id = p_target_user_id and community_id = p_community_id;

  -- Restore the source home's primary contact if an eligible resident remains.
  if v_was_primary_contact and not exists (
    select 1 from public.house_residents hr
    where hr.community_id = p_community_id
      and hr.house_id = v_old_house_id
      and hr.is_active and hr.is_primary_contact
  ) then
    select hr.user_id into v_replacement_contact_id
    from public.house_residents hr
    join public.profiles p on p.user_id = hr.user_id and p.community_id = hr.community_id
    join public.community_members cm on cm.user_id = hr.user_id and cm.community_id = hr.community_id
    where hr.community_id = p_community_id
      and hr.house_id = v_old_house_id
      and hr.user_id <> p_target_user_id
      and hr.is_active and p.is_active and cm.is_active
    order by hr.created_at asc
    limit 1
    for update of hr;

    if v_replacement_contact_id is not null then
      update public.house_residents hr
      set is_primary_contact = (hr.user_id = v_replacement_contact_id),
          updated_at = now()
      where hr.community_id = p_community_id
        and hr.house_id = v_old_house_id
        and hr.is_active;
    end if;
  end if;

  v_result := jsonb_build_object(
    'ok', true, 'community_id', p_community_id,
    'user_id', p_target_user_id, 'from_house_id', v_old_house_id,
    'to_house_id', null, 'new_role', 'UNASSIGNED',
    'is_active', false
  );

  insert into public.system_event_log (
    severity, module, event_type, message, details, community_id,
    user_id, actor_id, entity_type, entity_id, source
  ) values (
    'INFO', 'superadmin', 'RESIDENT_UNASSIGNED_FROM_UNIT',
    'Resident removed from unit by superadmin',
    v_result, p_community_id, p_target_user_id,
    v_actor_id, 'user', p_target_user_id, 'minerva_console'
  );
  insert into public.superadmin_audit_log (
    actor_user_id, action, target_type, target_id, metadata
  ) values (
    v_actor_id, 'community_resident.unassign_unit', 'user', p_target_user_id, v_result
  );

  return v_result;
end;
$$;

-- Reassignment is explicit and does NOT reactivate a previously disabled account.
create or replace function public.sa_reassign_unassigned_community_resident_v1(
  p_community_id uuid,
  p_target_user_id uuid,
  p_target_house_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_actor_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_member public.community_members%rowtype;
  v_house public.houses%rowtype;
  v_result jsonb;
begin
  if v_actor_id is null or not public.is_superadmin(v_actor_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;
  if p_target_user_id is null or p_community_id is null or p_target_house_id is null then
    raise exception 'Community, resident, and target unit are required' using errcode = '22023';
  end if;

  select p.* into v_profile from public.profiles p
  where p.user_id = p_target_user_id and p.community_id = p_community_id for update;
  select cm.* into v_member from public.community_members cm
  where cm.user_id = p_target_user_id and cm.community_id = p_community_id for update;
  if v_profile.user_id is null or v_member.user_id is null
     or v_profile.role::text <> 'UNASSIGNED' or v_member.role::text <> 'UNASSIGNED'
     or v_profile.house_id is not null then
    raise exception 'User is not an unassigned resident in this community' using errcode = '22023';
  end if;
  if v_profile.is_active or v_member.is_active then
    raise exception 'Unassigned account must be inactive before reassignment' using errcode = '22023';
  end if;

  select h.* into v_house from public.houses h
  where h.id = p_target_house_id and h.community_id = p_community_id for update;
  if not found or not v_house.is_active then
    raise exception 'Select an active unit in this community' using errcode = '22023';
  end if;

  update public.profiles
  set house_id = p_target_house_id, role = 'RESIDENT'::public.user_role
  where user_id = p_target_user_id and community_id = p_community_id;
  update public.community_members
  set role = 'RESIDENT'::public.user_role, updated_at = now()
  where user_id = p_target_user_id and community_id = p_community_id;

  -- Keep the household link inactive until a separate explicit reactivation.
  insert into public.house_residents (
    community_id, house_id, user_id, is_primary, is_primary_contact, is_active
  ) values (
    p_community_id, p_target_house_id, p_target_user_id, false, false, false
  )
  on conflict (user_id, community_id, house_id)
  do update set
    is_active = false,
    is_primary = false,
    is_primary_contact = false,
    updated_at = now();

  v_result := jsonb_build_object(
    'ok', true, 'community_id', p_community_id, 'user_id', p_target_user_id,
    'to_house_id', p_target_house_id, 'to_house_label', v_house.house_label,
    'new_role', 'RESIDENT', 'is_active', false
  );
  insert into public.system_event_log (
    severity, module, event_type, message, details, community_id,
    user_id, actor_id, entity_type, entity_id, source
  ) values (
    'INFO', 'superadmin', 'UNASSIGNED_RESIDENT_ASSIGNED_TO_UNIT',
    'Unassigned resident linked to unit by superadmin, account remains inactive',
    v_result, p_community_id, p_target_user_id,
    v_actor_id, 'user', p_target_user_id, 'minerva_console'
  );
  insert into public.superadmin_audit_log (
    actor_user_id, action, target_type, target_id, metadata
  ) values (
    v_actor_id, 'community_resident.reassign_unit', 'user', p_target_user_id, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.sa_unassign_community_resident_unit_v1(uuid, uuid, uuid) from public, anon;
grant execute on function public.sa_unassign_community_resident_unit_v1(uuid, uuid, uuid) to authenticated, service_role;
revoke all on function public.sa_reassign_unassigned_community_resident_v1(uuid, uuid, uuid) from public, anon;
grant execute on function public.sa_reassign_unassigned_community_resident_v1(uuid, uuid, uuid) to authenticated, service_role;

comment on function public.sa_unassign_community_resident_unit_v1(uuid, uuid, uuid) is
'Superadmin-only: remove resident from all active households, disable access and move to UNASSIGNED, retaining account and history.';
comment on function public.sa_reassign_unassigned_community_resident_v1(uuid, uuid, uuid) is
'Superadmin-only: restore UNASSIGNED resident to one active unit without reactivating account.';
