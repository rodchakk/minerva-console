create or replace function public.admin_delete_empty_houses_bulk_v1(
  p_community_id uuid,
  p_house_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_house_ids uuid[];
  v_requested_count integer := 0;
  v_deleted_campaign_units integer := 0;
  v_deleted_houses integer := 0;
begin
  if not public.is_superadmin() then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if p_community_id is null then
    raise exception 'Community is required' using errcode = 'P0400';
  end if;

  select coalesce(array_agg(distinct house_id), '{}'::uuid[])
    into v_house_ids
    from unnest(coalesce(p_house_ids, '{}'::uuid[])) as house_id
   where house_id is not null;

  v_requested_count := coalesce(array_length(v_house_ids, 1), 0);

  if v_requested_count = 0 then
    return jsonb_build_object(
      'deleted_count', 0,
      'deleted_campaign_units', 0,
      'requested_count', 0
    );
  end if;

  if (
    select count(*)
      from public.houses h
     where h.community_id = p_community_id
       and h.id = any(v_house_ids)
  ) <> v_requested_count then
    raise exception 'One or more units do not belong to this community' using errcode = 'P0404';
  end if;

  if exists (
    select 1
      from public.community_registration_units u
     where u.house_id = any(v_house_ids)
       and u.status <> 'unregistered'
  ) then
    raise exception 'One or more units already have registration history and cannot be deleted' using errcode = 'P0409';
  end if;

  if exists (select 1 from public.house_residents x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.profiles x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.resident_activation_queue x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.resident_invites x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.resident_financial_statuses x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.visit_passes x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.visit_groups x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.invite_codes x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.authorized_frequent_visitors x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.emergency_alerts x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.facility_reservations x where x.house_id = any(v_house_ids))
     or exists (select 1 from public.entry_logs x where x.house_id = any(v_house_ids)) then
    raise exception 'One or more units have operational activity and cannot be deleted' using errcode = 'P0409';
  end if;

  delete from public.community_registration_units u
   where u.house_id = any(v_house_ids)
     and u.community_id = p_community_id
     and u.status = 'unregistered';
  get diagnostics v_deleted_campaign_units = row_count;

  delete from public.houses h
   where h.community_id = p_community_id
     and h.id = any(v_house_ids);
  get diagnostics v_deleted_houses = row_count;

  return jsonb_build_object(
    'deleted_count', v_deleted_houses,
    'deleted_campaign_units', v_deleted_campaign_units,
    'requested_count', v_requested_count
  );
end;
$function$;

comment on function public.admin_delete_empty_houses_bulk_v1(uuid, uuid[]) is
  'ENTRY superadmin RPC. Permanently deletes selected empty units and removes only their unregistered campaign-unit rows. Blocks units with residents, activations, registration history, passes, financial history, reservations, alerts, logs, or other operational activity.';

revoke all on function public.admin_delete_empty_houses_bulk_v1(uuid, uuid[]) from public;
grant execute on function public.admin_delete_empty_houses_bulk_v1(uuid, uuid[]) to authenticated;
grant execute on function public.admin_delete_empty_houses_bulk_v1(uuid, uuid[]) to service_role;
