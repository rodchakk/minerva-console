-- Migration: Add support for establishments, contacts array, and security staff names in Outrider intake sessions

alter table public.community_outrider_sessions
  add column if not exists has_establishments boolean,
  add column if not exists establishments text[] not null default '{}'::text[],
  add column if not exists contacts jsonb not null default '[]'::jsonb,
  add column if not exists security_staff_names text[] not null default '{}'::text[];

comment on column public.community_outrider_sessions.has_establishments is
  'Whether commercial establishments or businesses exist inside the community.';
comment on column public.community_outrider_sessions.establishments is
  'List of commercial establishment or business names within the community.';
comment on column public.community_outrider_sessions.contacts is
  'Structured list of administrative/operational contact entries (up to 3).';
comment on column public.community_outrider_sessions.security_staff_names is
  'List of security personnel names.';

create or replace function public._save_community_outrider_without_admins_v1(
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
  v_has_establishments boolean;
  v_establishments text[];
  v_has_inactive_units boolean;
  v_inactive_units_notes text;
  v_security_staff_count integer;
  v_security_staff_names text[];
  v_security_staff_notes text;
  v_contact_name text;
  v_contact_phone text;
  v_contact_email text;
  v_contacts jsonb := '[]'::jsonb;
  v_contact jsonb;
  v_cname text;
  v_cphone text;
  v_cemail text;
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
  v_has_establishments := public._outrider_boolean_from_json_v1(p_payload, 'has_establishments');
  v_establishments := public._outrider_text_array_from_json_v1(p_payload, 'establishments', 75, 180);
  v_has_inactive_units := public._outrider_boolean_from_json_v1(p_payload, 'has_inactive_units');
  v_inactive_units_notes := nullif(btrim(coalesce(p_payload ->> 'inactive_units_notes', '')), '');

  if not (p_payload ? 'security_staff_count')
     or p_payload -> 'security_staff_count' = 'null'::jsonb then
    v_security_staff_count := null;
  elsif jsonb_typeof(p_payload -> 'security_staff_count') <> 'number'
     or (p_payload ->> 'security_staff_count') !~ '^\d+$' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  else
    v_security_staff_count := (p_payload ->> 'security_staff_count')::integer;
  end if;

  v_security_staff_names := public._outrider_text_array_from_json_v1(p_payload, 'security_staff_names', 75, 180);
  v_security_staff_notes := public._outrider_normalize_text_v1(p_payload ->> 'security_staff_notes');

  v_contact_name := public._outrider_normalize_text_v1(p_payload ->> 'contact_name');
  v_contact_phone := public._outrider_normalize_text_v1(p_payload ->> 'contact_phone');
  v_contact_email := lower(public._outrider_normalize_text_v1(p_payload ->> 'contact_email'));

  if p_payload ? 'contacts' and jsonb_typeof(p_payload -> 'contacts') = 'array' then
    for v_contact in select value from jsonb_array_elements(p_payload -> 'contacts')
    loop
      if jsonb_typeof(v_contact) = 'object' and jsonb_array_length(v_contacts) < 3 then
        v_cname := public._outrider_normalize_text_v1(v_contact ->> 'name');
        v_cphone := public._outrider_normalize_text_v1(v_contact ->> 'phone');
        v_cemail := lower(public._outrider_normalize_text_v1(v_contact ->> 'email'));
        if v_cname is not null or v_cphone is not null or v_cemail is not null then
          v_contacts := v_contacts || jsonb_build_array(jsonb_build_object(
            'name', v_cname,
            'phone', v_cphone,
            'email', v_cemail
          ));
        end if;
      end if;
    end loop;
  end if;

  if jsonb_array_length(v_contacts) = 0 and (v_contact_name is not null or v_contact_phone is not null or v_contact_email is not null) then
    v_contacts := jsonb_build_array(jsonb_build_object(
      'name', v_contact_name,
      'phone', v_contact_phone,
      'email', v_contact_email
    ));
  end if;

  if jsonb_array_length(v_contacts) > 0 then
    if v_contact_name is null then v_contact_name := v_contacts->0->>'name'; end if;
    if v_contact_phone is null then v_contact_phone := v_contacts->0->>'phone'; end if;
    if v_contact_email is null then v_contact_email := v_contacts->0->>'email'; end if;
  end if;

  if v_unit_type_other is not null and length(v_unit_type_other) > 120 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_unit_naming_example is not null and length(v_unit_naming_example) > 160 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_inactive_units_notes is not null and length(v_inactive_units_notes) > 1000 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_security_staff_count is not null and (v_security_staff_count < 0 or v_security_staff_count > 500) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_security_staff_notes is not null and length(v_security_staff_notes) > 2000 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_contact_name is not null and length(v_contact_name) > 180 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_contact_phone is not null and length(v_contact_phone) > 80 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_contact_email is not null and length(v_contact_email) > 254 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;

  v_completed_sections := public._outrider_complete_sections_v2(
    v_unit_types,
    v_unit_type_other,
    v_unit_naming_example,
    v_has_destinations,
    v_destinations,
    v_has_inactive_units,
    v_inactive_units_notes,
    v_security_staff_count,
    v_contact_name,
    v_contact_phone,
    v_contact_email
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
         has_establishments = v_has_establishments,
         establishments = case when v_has_establishments = true then v_establishments else '{}'::text[] end,
         has_inactive_units = v_has_inactive_units,
         inactive_units_notes = case when v_has_inactive_units = true then v_inactive_units_notes else null end,
         security_staff_count = v_security_staff_count,
         security_staff_names = coalesce(v_security_staff_names, '{}'::text[]),
         security_staff_notes = v_security_staff_notes,
         contact_name = v_contact_name,
         contact_phone = v_contact_phone,
         contact_email = v_contact_email,
         contacts = coalesce(v_contacts, '[]'::jsonb),
         completed_sections = v_completed_sections,
         last_activity_at = now()
   where id = v_outrider.id
   returning * into v_outrider;

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
    'status', v_outrider.status,
    'completed_sections', v_outrider.completed_sections,
    'progress_percent', cardinality(v_outrider.completed_sections) * 20,
    'updated_at', v_outrider.updated_at,
    'last_activity_at', v_outrider.last_activity_at
  );
end;
$function$;

create or replace function public._resolve_community_outrider_without_admins_v1(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_files jsonb;
  v_name text;
  v_city text;
begin
  perform public._outrider_service_role_only_v1();

  if p_token_hash is null or length(btrim(p_token_hash)) < 32 then
    return jsonb_build_object('available', false);
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where token_hash = btrim(p_token_hash);

  if not found then
    return jsonb_build_object('available', false);
  end if;

  v_name := v_outrider.community_name;
  v_city := v_outrider.community_city;

  if v_outrider.community_id is not null then
    select
      coalesce(nullif(btrim(c.name), ''), v_name),
      coalesce(nullif(btrim(c.city), ''), v_city)
    into v_name, v_city
    from public.communities c
    where c.id = v_outrider.community_id;
  end if;

  if nullif(btrim(coalesce(v_name, '')), '') is null then
    return jsonb_build_object('available', false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'category', f.category,
    'original_filename', f.original_filename,
    'mime_type', f.mime_type,
    'byte_size', f.byte_size,
    'uploaded_at', f.uploaded_at
  ) order by f.uploaded_at desc), '[]'::jsonb)
  into v_files
  from public.community_outrider_files f
  where f.outrider_id = v_outrider.id;

  return jsonb_build_object(
    'available', true,
    'community', jsonb_build_object(
      'id', v_outrider.community_id,
      'name', v_name,
      'city', v_city,
      'linked', v_outrider.community_id is not null
    ),
    'outrider', jsonb_build_object(
      'id', v_outrider.id,
      'status', v_outrider.status,
      'unit_types', v_outrider.unit_types,
      'unit_type_other', v_outrider.unit_type_other,
      'unit_naming_example', v_outrider.unit_naming_example,
      'has_destinations', v_outrider.has_destinations,
      'destinations', v_outrider.destinations,
      'has_establishments', v_outrider.has_establishments,
      'establishments', v_outrider.establishments,
      'has_inactive_units', v_outrider.has_inactive_units,
      'inactive_units_notes', v_outrider.inactive_units_notes,
      'security_staff_count', v_outrider.security_staff_count,
      'security_staff_names', v_outrider.security_staff_names,
      'security_staff_notes', v_outrider.security_staff_notes,
      'contact_name', v_outrider.contact_name,
      'contact_phone', v_outrider.contact_phone,
      'contact_email', v_outrider.contact_email,
      'contacts', coalesce(v_outrider.contacts, '[]'::jsonb),
      'completed_sections', v_outrider.completed_sections,
      'review_note', v_outrider.review_note,
      'created_at', v_outrider.created_at,
      'updated_at', v_outrider.updated_at,
      'last_activity_at', v_outrider.last_activity_at,
      'submitted_at', v_outrider.submitted_at,
      'approved_at', v_outrider.approved_at,
      'attachment_count', coalesce(jsonb_array_length(v_files), 0)
    ),
    'files', v_files
  );
end;
$function$;

revoke all on function public._save_community_outrider_without_admins_v1(text, jsonb, text[])
  from public, anon, authenticated;
grant execute on function public._save_community_outrider_without_admins_v1(text, jsonb, text[])
  to service_role;

revoke all on function public._resolve_community_outrider_without_admins_v1(text)
  from public, anon, authenticated;
grant execute on function public._resolve_community_outrider_without_admins_v1(text)
  to service_role;
