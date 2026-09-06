create or replace function public.sa_move_community_resident_unit(
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
  v_target_house public.houses%rowtype;
  v_source_house_id uuid;
  v_source_was_primary boolean := false;
  v_target_has_primary boolean := false;
  v_target_assignment_id uuid;
  v_replacement_primary_user_id uuid;
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
    select coalesce(bool_or(hr.is_primary), false)
      into v_source_was_primary
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
      and hr.is_primary = true
  ) into v_target_has_primary;

  update public.house_residents hr
     set is_active = false,
         is_primary = false,
         updated_at = now()
   where hr.user_id = p_target_user_id
     and hr.community_id = p_community_id
     and hr.house_id <> p_target_house_id
     and (hr.is_active = true or hr.is_primary = true);

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
           is_primary = v_profile.is_active and not v_target_has_primary,
           updated_at = now()
     where id = v_target_assignment_id;
  else
    insert into public.house_residents (
      community_id,
      house_id,
      user_id,
      is_primary,
      is_active
    ) values (
      p_community_id,
      p_target_house_id,
      p_target_user_id,
      v_profile.is_active and not v_target_has_primary,
      v_profile.is_active
    );
  end if;

  update public.profiles p
     set house_id = p_target_house_id,
         updated_at = now()
   where p.user_id = p_target_user_id
     and p.community_id = p_community_id;

  if v_source_was_primary and v_source_house_id is not null then
    if not exists (
      select 1
      from public.house_residents hr
      where hr.community_id = p_community_id
        and hr.house_id = v_source_house_id
        and hr.is_active = true
        and hr.is_primary = true
    ) then
      select hr.user_id
        into v_replacement_primary_user_id
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

      if v_replacement_primary_user_id is not null then
        update public.house_residents hr
           set is_primary = (hr.user_id = v_replacement_primary_user_id),
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
$$;

revoke all on function public.sa_move_community_resident_unit(uuid, uuid, uuid) from public;
revoke all on function public.sa_move_community_resident_unit(uuid, uuid, uuid) from anon;
grant execute on function public.sa_move_community_resident_unit(uuid, uuid, uuid) to authenticated;
grant execute on function public.sa_move_community_resident_unit(uuid, uuid, uuid) to service_role;

comment on function public.sa_move_community_resident_unit(uuid, uuid, uuid)
is 'Moves a resident/admin profile to another active unit in the same community while preserving account status and primary-resident consistency.';
