-- ENTRY Outrider public-intake QA fixes.
-- 1) Unit completion no longer depends on the removed public unit_naming_example field.
-- 2) Editable public Outrider sessions can remove their own community_data upload.

create or replace function public._outrider_complete_sections_v2(
  p_unit_types text[],
  p_unit_type_other text,
  p_unit_naming_example text,
  p_has_destinations boolean,
  p_destinations text[],
  p_has_inactive_units boolean,
  p_inactive_units_notes text,
  p_security_staff_count integer,
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text
)
returns text[]
language plpgsql
set search_path to ''
as $function$
declare
  v_sections text[] := '{}'::text[];
  v_email_present boolean := false;
  v_email_valid boolean := false;
begin
  -- unit_naming_example is retained in the signature for backwards compatibility,
  -- but the current public form no longer collects it. A selected unit type is
  -- sufficient; "otro" still requires its explicit description.
  if cardinality(coalesce(p_unit_types, '{}'::text[])) > 0
     and (
       'otro' <> all(coalesce(p_unit_types, '{}'::text[]))
       or nullif(btrim(coalesce(p_unit_type_other, '')), '') is not null
     ) then
    v_sections := array_append(v_sections, 'units');
  end if;

  if p_has_destinations = false
     or (p_has_destinations = true and cardinality(coalesce(p_destinations, '{}'::text[])) > 0) then
    v_sections := array_append(v_sections, 'destinations');
  end if;

  if p_has_inactive_units = false
     or (
       p_has_inactive_units = true
       and nullif(btrim(coalesce(p_inactive_units_notes, '')), '') is not null
     ) then
    v_sections := array_append(v_sections, 'inactive_units');
  end if;

  if p_security_staff_count is not null then
    v_sections := array_append(v_sections, 'available_information');
  end if;

  v_email_present := nullif(btrim(coalesce(p_contact_email, '')), '') is not null;
  v_email_valid :=
    v_email_present
    and p_contact_email ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';

  if nullif(btrim(coalesce(p_contact_name, '')), '') is not null
     and (
       nullif(btrim(coalesce(p_contact_phone, '')), '') is not null
       or v_email_valid
     )
     and (not v_email_present or v_email_valid) then
    v_sections := array_append(v_sections, 'contact');
  end if;

  return v_sections;
end;
$function$;

create or replace function public.delete_community_outrider_file_v1(
  p_token_hash text,
  p_file_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_file public.community_outrider_files%rowtype;
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

  select * into v_file
    from public.community_outrider_files
   where id = p_file_id
     and outrider_id = v_outrider.id
     and category = 'community_data'
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_FILE_UNAVAILABLE', 'P0409');
  end if;

  delete from public.community_outrider_files
   where id = v_file.id;

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
    'file_deleted',
    'public_token',
    jsonb_build_object(
      'category', v_file.category,
      'filename', v_file.original_filename
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'file_id', v_file.id,
    'storage_path', v_file.storage_path
  );
end;
$function$;

revoke all on function public.delete_community_outrider_file_v1(text, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_community_outrider_file_v1(text, uuid)
  to service_role;
