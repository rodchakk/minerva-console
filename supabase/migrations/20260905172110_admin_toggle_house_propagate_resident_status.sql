create or replace function public.admin_toggle_house(
  p_house_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_label text;
  v_cid uuid;
  v_affected_users uuid[] := array[]::uuid[];
  v_affected_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_house_id is null or p_is_active is null then
    raise exception 'house_id and is_active are required' using errcode = '22023';
  end if;

  select h.community_id, h.house_label
    into v_cid, v_label
  from public.houses h
  where h.id = p_house_id;

  if not found then
    raise exception 'House not found' using errcode = 'P0002';
  end if;

  if not (public.is_superadmin() or public.is_community_admin(v_cid, auth.uid())) then
    raise exception 'Access denied: superadmin or community admin required' using errcode = '42501';
  end if;

  update public.houses
  set is_active = p_is_active,
      updated_at = now()
  where id = p_house_id;

  if p_is_active = false then
    select coalesce(array_agg(p.user_id), array[]::uuid[])
      into v_affected_users
    from public.profiles p
    where p.house_id = p_house_id
      and p.community_id = v_cid
      and p.role = 'RESIDENT'::public.user_role
      and p.is_active = true;

    update public.profiles p
    set is_active = false,
        deactivated_by_unit = true
    where p.user_id = any(v_affected_users);

    get diagnostics v_affected_count = row_count;

    if cardinality(v_affected_users) > 0 then
      update public.community_members cm
      set is_active = false,
          updated_at = now()
      where cm.community_id = v_cid
        and cm.user_id = any(v_affected_users)
        and cm.role = 'RESIDENT'::public.user_role;
    end if;
  else
    select coalesce(array_agg(p.user_id), array[]::uuid[])
      into v_affected_users
    from public.profiles p
    where p.house_id = p_house_id
      and p.community_id = v_cid
      and p.role = 'RESIDENT'::public.user_role
      and p.deactivated_by_unit = true;

    update public.profiles p
    set is_active = true,
        deactivated_by_unit = false
    where p.user_id = any(v_affected_users);

    get diagnostics v_affected_count = row_count;

    if cardinality(v_affected_users) > 0 then
      update public.community_members cm
      set is_active = true,
          updated_at = now()
      where cm.community_id = v_cid
        and cm.user_id = any(v_affected_users)
        and cm.role = 'RESIDENT'::public.user_role;
    end if;
  end if;

  insert into public.system_event_log (
    severity, module, event_type, message, details, community_id, actor_id, source
  )
  values (
    'INFO',
    'admin',
    'HOUSE_TOGGLED',
    'House status changed',
    jsonb_build_object(
      'house_label', v_label,
      'is_active', p_is_active,
      'resident_accounts_changed', v_affected_count
    ),
    v_cid,
    auth.uid(),
    'admin'
  );

  return jsonb_build_object(
    'ok', true,
    'house_id', p_house_id,
    'house_label', v_label,
    'is_active', p_is_active,
    'resident_accounts_changed', v_affected_count
  );
end;
$function$;

revoke all on function public.admin_toggle_house(uuid, boolean) from public;
revoke all on function public.admin_toggle_house(uuid, boolean) from anon;
grant execute on function public.admin_toggle_house(uuid, boolean) to authenticated;
grant execute on function public.admin_toggle_house(uuid, boolean) to service_role;
