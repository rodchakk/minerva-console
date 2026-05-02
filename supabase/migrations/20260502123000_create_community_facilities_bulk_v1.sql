create or replace function public.create_community_facilities_bulk_v1(
  p_community_id uuid,
  p_facilities text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inserted_count integer := 0;
  v_skipped_duplicates_count integer := 0;
  v_skipped_blank_count integer := 0;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin_required' using errcode = 'P0403';
  end if;

  if not exists (
    select 1
    from public.communities
    where id = p_community_id
  ) then
    raise exception 'community_not_found' using errcode = 'P0404';
  end if;

  if p_facilities is null or array_length(p_facilities, 1) is null then
    return jsonb_build_object(
      'inserted_count', 0,
      'skipped_duplicates_count', 0,
      'skipped_blank_count', 0
    );
  end if;

  select count(*)
  into v_skipped_blank_count
  from unnest(p_facilities) as facility_name
  where trim(coalesce(facility_name, '')) = '';

  with normalized_input as (
    select
      min(trim(facility_name)) as facility_name,
      lower(trim(facility_name)) as facility_key
    from unnest(p_facilities) as facility_name
    where trim(coalesce(facility_name, '')) <> ''
    group by lower(trim(facility_name))
  ),
  existing as (
    select lower(name) as facility_key
    from public.community_facilities
    where community_id = p_community_id
  ),
  to_insert as (
    select ni.facility_name
    from normalized_input ni
    where ni.facility_key not in (select facility_key from existing)
  )
  insert into public.community_facilities (
    community_id,
    name,
    is_active
  )
  select
    p_community_id,
    facility_name,
    true
  from to_insert;

  get diagnostics v_inserted_count = row_count;

  select count(*) - v_inserted_count
  into v_skipped_duplicates_count
  from (
    select distinct lower(trim(facility_name)) as facility_key
    from unnest(p_facilities) as facility_name
    where trim(coalesce(facility_name, '')) <> ''
  ) deduped_input;

  perform public._sa_audit_log(
    'bulk_create_community_facilities',
    'community',
    p_community_id,
    jsonb_build_object(
      'submitted_count', coalesce(array_length(p_facilities, 1), 0),
      'inserted_count', v_inserted_count,
      'skipped_duplicates_count', v_skipped_duplicates_count,
      'skipped_blank_count', v_skipped_blank_count
    )
  );

  return jsonb_build_object(
    'inserted_count', v_inserted_count,
    'skipped_duplicates_count', v_skipped_duplicates_count,
    'skipped_blank_count', v_skipped_blank_count
  );
end;
$function$;

revoke all on function public.create_community_facilities_bulk_v1(uuid, text[]) from public;
grant execute on function public.create_community_facilities_bulk_v1(uuid, text[]) to anon;
grant execute on function public.create_community_facilities_bulk_v1(uuid, text[]) to authenticated;
grant execute on function public.create_community_facilities_bulk_v1(uuid, text[]) to service_role;
