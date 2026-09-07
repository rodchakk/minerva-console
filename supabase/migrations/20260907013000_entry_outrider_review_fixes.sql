-- ENTRY-OUTRIDER-001 final review fixes.
-- Keeps autosave activity curated, aligns server limits with the app,
-- preserves submit progress, and tightens file-path integrity.

create or replace function public.save_community_outrider_v1(
  p_token_hash text,
  p_payload jsonb,
  p_completed_sections text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_previous_status text;
  v_previous_completed_sections text[];
  v_unit_types text[];
  v_unit_type_other text;
  v_unit_naming_example text;
  v_has_destinations boolean;
  v_destinations text[];
  v_has_inactive_units boolean;
  v_inactive_units_notes text;
  v_contact_name text;
  v_contact_phone text;
  v_contact_email text;
  v_completed_sections text[];
begin
  perform public._outrider_service_role_only_v1();

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;

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

  v_previous_status := v_outrider.status;
  v_previous_completed_sections := coalesce(v_outrider.completed_sections, '{}'::text[]);

  v_unit_types := public._outrider_text_array_from_json_v1(p_payload, 'unit_types', 5, 40);
  if not v_unit_types <@ array['casas','apartamentos','condominios','oficinas','otro']::text[] then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;

  v_unit_type_other := public._outrider_normalize_text_v1(p_payload ->> 'unit_type_other');
  v_unit_naming_example := public._outrider_normalize_text_v1(p_payload ->> 'unit_naming_example');
  v_has_destinations := public._outrider_boolean_from_json_v1(p_payload, 'has_destinations');
  v_destinations := public._outrider_text_array_from_json_v1(p_payload, 'destinations', 75, 180);
  v_has_inactive_units := public._outrider_boolean_from_json_v1(p_payload, 'has_inactive_units');
  v_inactive_units_notes := nullif(btrim(coalesce(p_payload ->> 'inactive_units_notes', '')), '');
  v_contact_name := public._outrider_normalize_text_v1(p_payload ->> 'contact_name');
  v_contact_phone := public._outrider_normalize_text_v1(p_payload ->> 'contact_phone');
  v_contact_email := lower(public._outrider_normalize_text_v1(p_payload ->> 'contact_email'));

  if v_unit_type_other is not null and length(v_unit_type_other) > 120 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_unit_naming_example is not null and length(v_unit_naming_example) > 160 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_inactive_units_notes is not null and length(v_inactive_units_notes) > 1000 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_contact_name is not null and length(v_contact_name) > 180 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_contact_phone is not null and length(v_contact_phone) > 80 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_contact_email is not null
     and (length(v_contact_email) > 254 or v_contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;

  v_completed_sections := public._outrider_complete_sections_v1(
    v_unit_types,
    v_unit_type_other,
    v_unit_naming_example,
    v_has_destinations,
    v_destinations,
    v_has_inactive_units,
    v_inactive_units_notes,
    v_contact_name,
    v_contact_phone,
    v_contact_email,
    p_completed_sections
  );

  update public.community_outrider_sessions
     set status = case
           when status = 'not_started' then 'in_progress'
           else status
         end,
         unit_types = v_unit_types,
         unit_type_other = v_unit_type_other,
         unit_naming_example = v_unit_naming_example,
         has_destinations = v_has_destinations,
         destinations = case when v_has_destinations = true then v_destinations else '{}'::text[] end,
         has_inactive_units = v_has_inactive_units,
         inactive_units_notes = case when v_has_inactive_units = true then v_inactive_units_notes else null end,
         contact_name = v_contact_name,
         contact_phone = v_contact_phone,
         contact_email = v_contact_email,
         completed_sections = v_completed_sections,
         last_activity_at = now()
   where id = v_outrider.id
   returning * into v_outrider;

  -- Do not emit an event for every debounced keystroke. Keep activity meaningful:
  -- first persisted save, or a change in completed-section state.
  if v_previous_status = 'not_started'
     or v_previous_completed_sections is distinct from v_completed_sections then
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
      'outrider_saved',
      'public_token',
      jsonb_build_object(
        'completed_sections', cardinality(v_completed_sections),
        'previous_completed_sections', cardinality(v_previous_completed_sections)
      )
    );
  end if;

  return jsonb_build_object(
    'accepted', true,
    'status', v_outrider.status,
    'completed_sections', v_outrider.completed_sections,
    'progress_percent', cardinality(v_outrider.completed_sections) * 20,
    'updated_at', v_outrider.updated_at,
    'last_activity_at', v_outrider.last_activity_at
  );
end;
$function$;

create or replace function public.submit_community_outrider_v1(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
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

  if cardinality(v_outrider.completed_sections) <> 5 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INCOMPLETE', 'P0409');
  end if;

  update public.community_outrider_sessions
     set status = 'ready_for_review',
         submitted_at = now(),
         last_activity_at = now()
   where id = v_outrider.id
   returning * into v_outrider;

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
    'outrider_submitted',
    'public_token',
    jsonb_build_object('progress_percent', 100)
  );

  return jsonb_build_object(
    'accepted', true,
    'status', v_outrider.status,
    'completed_sections', v_outrider.completed_sections,
    'progress_percent', 100,
    'submitted_at', v_outrider.submitted_at
  );
end;
$function$;

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

  if p_category not in ('units', 'residents', 'security_staff', 'common_areas')
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

revoke all on function public.save_community_outrider_v1(text, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.submit_community_outrider_v1(text) from public, anon, authenticated;
revoke all on function public.record_community_outrider_file_v1(text, text, text, text, text, bigint) from public, anon, authenticated;

grant execute on function public.save_community_outrider_v1(text, jsonb, text[]) to service_role;
grant execute on function public.submit_community_outrider_v1(text) to service_role;
grant execute on function public.record_community_outrider_file_v1(text, text, text, text, text, bigint) to service_role;
