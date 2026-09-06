create or replace function public.sa_set_community_unit_active_status(
  p_community_id uuid,
  p_house_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_house public.houses%rowtype;
  v_community_is_active boolean := true;
  v_target_user_ids uuid[] := array[]::uuid[];
  v_restore_user_ids uuid[] := array[]::uuid[];
  v_houses_updated int := 0;
  v_profiles_updated int := 0;
  v_memberships_updated int := 0;
  v_house_residents_updated int := 0;
  v_result jsonb;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not public.is_superadmin(v_actor_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  select h.*
    into v_house
  from public.houses h
  where h.id = p_house_id
    and h.community_id = p_community_id
  limit 1;

  if not found then
    raise exception 'Unit not found in this community';
  end if;

  select coalesce(c.is_active, true)
    into v_community_is_active
  from public.communities c
  where c.id = p_community_id
  limit 1;

  if p_is_active = false then
    select coalesce(array_agg(distinct hr.user_id), array[]::uuid[])
      into v_target_user_ids
    from public.house_residents hr
    where hr.community_id = p_community_id
      and hr.house_id = p_house_id
      and hr.is_active = true;

    update public.houses h
       set is_active = false,
           updated_at = now()
     where h.id = p_house_id
       and h.community_id = p_community_id
       and h.is_active is distinct from false;
    get diagnostics v_houses_updated = row_count;

    update public.profiles p
       set is_active = false,
           deactivated_by_unit = true
     where p.community_id = p_community_id
       and p.user_id = any(v_target_user_ids)
       and p.is_active = true
       and coalesce(p.deactivated_by_community, false) = false;
    get diagnostics v_profiles_updated = row_count;

    update public.community_members cm
       set is_active = false,
           updated_at = now()
     where cm.community_id = p_community_id
       and cm.user_id = any(v_target_user_ids)
       and cm.is_active = true;
    get diagnostics v_memberships_updated = row_count;

    update public.house_residents hr
       set is_active = false,
           updated_at = now()
     where hr.community_id = p_community_id
       and hr.house_id = p_house_id
       and hr.user_id = any(v_target_user_ids)
       and hr.is_active = true;
    get diagnostics v_house_residents_updated = row_count;
  else
    select coalesce(array_agg(distinct p.user_id), array[]::uuid[])
      into v_restore_user_ids
    from public.profiles p
    where p.community_id = p_community_id
      and p.house_id = p_house_id
      and coalesce(p.deactivated_by_unit, false) = true;

    update public.houses h
       set is_active = true,
           updated_at = now()
     where h.id = p_house_id
       and h.community_id = p_community_id
       and h.is_active is distinct from true;
    get diagnostics v_houses_updated = row_count;

    if cardinality(v_restore_user_ids) > 0 then
      update public.house_residents hr
         set is_active = true,
             updated_at = now()
       where hr.community_id = p_community_id
         and hr.house_id = p_house_id
         and hr.user_id = any(v_restore_user_ids)
         and v_community_is_active = true;
      get diagnostics v_house_residents_updated = row_count;

      update public.community_members cm
         set is_active = true,
             updated_at = now()
       where cm.community_id = p_community_id
         and cm.user_id = any(v_restore_user_ids)
         and v_community_is_active = true
         and exists (
           select 1
           from public.profiles p
           where p.community_id = p_community_id
             and p.user_id = cm.user_id
             and coalesce(p.deactivated_by_community, false) = false
         );
      get diagnostics v_memberships_updated = row_count;

      update public.profiles p
         set is_active = case
               when v_community_is_active = true
                and coalesce(p.deactivated_by_community, false) = false
               then true
               else p.is_active
             end,
             deactivated_by_unit = false
       where p.community_id = p_community_id
         and p.user_id = any(v_restore_user_ids);
      get diagnostics v_profiles_updated = row_count;
    end if;
  end if;

  v_result := jsonb_build_object(
    'ok', true,
    'community_id', p_community_id,
    'house_id', p_house_id,
    'house_label', v_house.house_label,
    'is_active', p_is_active,
    'houses_updated', v_houses_updated,
    'profiles_updated', v_profiles_updated,
    'memberships_updated', v_memberships_updated,
    'house_residents_updated', v_house_residents_updated
  );

  insert into public.system_event_log (
    severity,
    module,
    event_type,
    message,
    details,
    community_id,
    actor_id,
    entity_type,
    entity_id,
    source
  ) values (
    'INFO',
    'superadmin',
    case when p_is_active then 'UNIT_REACTIVATED_BY_SUPERADMIN' else 'UNIT_DEACTIVATED_BY_SUPERADMIN' end,
    'Community unit status changed by superadmin',
    v_result,
    p_community_id,
    v_actor_id,
    'house',
    p_house_id,
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
    case when p_is_active then 'community_unit.reactivate' else 'community_unit.deactivate' end,
    'house',
    p_house_id,
    v_result
  );

  return v_result;
end;
$function$;

revoke all on function public.sa_set_community_unit_active_status(uuid, uuid, boolean) from public;
grant execute on function public.sa_set_community_unit_active_status(uuid, uuid, boolean) to authenticated;
grant execute on function public.sa_set_community_unit_active_status(uuid, uuid, boolean) to service_role;
