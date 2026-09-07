-- Collapse new public Outrider uploads to one generic community-information file.
-- Legacy categories remain valid for existing handoffs and exports.

alter table public.community_outrider_files
  drop constraint if exists community_outrider_files_category_check;

alter table public.community_outrider_files
  add constraint community_outrider_files_category_check
  check (
    category in (
      'community_data',
      'units',
      'residents',
      'security_staff',
      'common_areas'
    )
  );

create unique index if not exists community_outrider_files_one_community_data_idx
  on public.community_outrider_files (outrider_id)
  where category = 'community_data';

create or replace function public.record_community_outrider_file_v1(
  p_token_hash text,
  p_category text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text default null,
  p_byte_size bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_file_id uuid;
begin
  perform public._outrider_service_role_only_v1();

  select * into v_outrider
    from public.community_outrider_sessions
   where token_hash = btrim(coalesce(p_token_hash, ''))
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE', '42501');
  end if;

  if v_outrider.status in ('ready_for_review', 'approved') then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_READ_ONLY', 'P0409');
  end if;

  if p_category not in (
       'community_data',
       'units',
       'residents',
       'security_staff',
       'common_areas'
     )
     or p_storage_path is null
     or btrim(p_storage_path) = ''
     or p_storage_path not like v_outrider.id::text || '/' || p_category || '/%'
     or p_original_filename is null
     or btrim(p_original_filename) = ''
     or length(btrim(p_original_filename)) > 180
     or coalesce(p_byte_size, 0) <= 0
     or coalesce(p_byte_size, 0) > 20971520 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_FILE');
  end if;

  insert into public.community_outrider_files (
    outrider_id,
    category,
    storage_path,
    original_filename,
    mime_type,
    byte_size
  )
  values (
    v_outrider.id,
    p_category,
    p_storage_path,
    btrim(p_original_filename),
    nullif(btrim(coalesce(p_mime_type, '')), ''),
    p_byte_size
  )
  returning id into v_file_id;

  update public.community_outrider_sessions
     set last_activity_at = now()
   where id = v_outrider.id;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'file_uploaded',
    'public_token',
    jsonb_build_object('category', p_category)
  );

  return jsonb_build_object(
    'accepted', true,
    'file_id', v_file_id,
    'storage_path', p_storage_path
  );
exception
  when unique_violation then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_FILE_CONFLICT', 'P0409');
end;
$function$;

revoke all on function public.record_community_outrider_file_v1(
  text, text, text, text, text, bigint
) from public, anon, authenticated;

grant execute on function public.record_community_outrider_file_v1(
  text, text, text, text, text, bigint
) to service_role;
