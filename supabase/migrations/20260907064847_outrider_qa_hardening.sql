-- QA hardening after the first full production Outrider walkthrough.
-- Drafts must be able to persist incomplete answers; no live ENTRY records are imported.

alter table public.community_outrider_sessions
  add column if not exists security_staff_count integer,
  add column if not exists security_staff_notes text;

-- `Otro` is a draft choice. Requiring its text value at the table layer prevents
-- autosave from persisting the intermediate state between checking "Otro" and typing it.
alter table public.community_outrider_sessions
  drop constraint if exists community_outrider_sessions_other_requires_value;

alter table public.community_outrider_sessions
  drop constraint if exists community_outrider_sessions_security_staff_count_check;
alter table public.community_outrider_sessions
  add constraint community_outrider_sessions_security_staff_count_check
  check (security_staff_count is null or security_staff_count between 0 and 500);

alter table public.community_outrider_sessions
  drop constraint if exists community_outrider_sessions_security_staff_notes_check;
alter table public.community_outrider_sessions
  add constraint community_outrider_sessions_security_staff_notes_check
  check (security_staff_notes is null or length(security_staff_notes) <= 2000);

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
set search_path = ''
as $function$
declare
  v_sections text[] := '{}'::text[];
  v_email_valid boolean := false;
begin
  if cardinality(coalesce(p_unit_types, '{}'::text[])) > 0
     and nullif(btrim(coalesce(p_unit_naming_example, '')), '') is not null
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

  -- Files are optional. Section four is complete once the patronato states the
  -- current security staffing count (0 is a valid answer).
  if p_security_staff_count is not null then
    v_sections := array_append(v_sections, 'available_information');
  end if;

  v_email_valid :=
    p_contact_email is not null
    and p_contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';

  if nullif(btrim(coalesce(p_contact_name, '')), '') is not null
     and (
       nullif(btrim(coalesce(p_contact_phone, '')), '') is not null
       or v_email_valid
     ) then
    v_sections := array_append(v_sections, 'contact');
  end if;

  return v_sections;
end;
$function$;

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
  v_security_staff_count integer;
  v_security_staff_notes text;
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

  if not (p_payload ? 'security_staff_count')
     or p_payload -> 'security_staff_count' = 'null'::jsonb then
    v_security_staff_count := null;
  elsif jsonb_typeof(p_payload -> 'security_staff_count') <> 'number'
     or (p_payload ->> 'security_staff_count') !~ '^\d+$' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  else
    v_security_staff_count := (p_payload ->> 'security_staff_count')::integer;
  end if;

  v_security_staff_notes := public._outrider_normalize_text_v1(p_payload ->> 'security_staff_notes');
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
  -- Draft autosave must tolerate a partially typed email. Strict email shape is
  -- enforced when submitting for review.
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
         has_inactive_units = v_has_inactive_units,
         inactive_units_notes = case when v_has_inactive_units = true then v_inactive_units_notes else null end,
         security_staff_count = v_security_staff_count,
         security_staff_notes = v_security_staff_notes,
         contact_name = v_contact_name,
         contact_phone = v_contact_phone,
         contact_email = v_contact_email,
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

  if v_outrider.contact_email is not null
     and v_outrider.contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD', 'P0409');
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

create or replace function public.complete_community_outrider_available_information_v1(
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

  if v_outrider.security_staff_count is null then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INCOMPLETE', 'P0409');
  end if;

  return public.save_community_outrider_v1(
    p_token_hash,
    jsonb_build_object(
      'unit_types', to_jsonb(v_outrider.unit_types),
      'unit_type_other', v_outrider.unit_type_other,
      'unit_naming_example', v_outrider.unit_naming_example,
      'has_destinations', v_outrider.has_destinations,
      'destinations', to_jsonb(v_outrider.destinations),
      'has_inactive_units', v_outrider.has_inactive_units,
      'inactive_units_notes', v_outrider.inactive_units_notes,
      'security_staff_count', v_outrider.security_staff_count,
      'security_staff_notes', v_outrider.security_staff_notes,
      'contact_name', v_outrider.contact_name,
      'contact_phone', v_outrider.contact_phone,
      'contact_email', v_outrider.contact_email
    ),
    v_outrider.completed_sections
  );
end;
$function$;

create or replace function public.resolve_community_outrider_v1(
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
      'has_inactive_units', v_outrider.has_inactive_units,
      'inactive_units_notes', v_outrider.inactive_units_notes,
      'security_staff_count', v_outrider.security_staff_count,
      'security_staff_notes', v_outrider.security_staff_notes,
      'contact_name', v_outrider.contact_name,
      'contact_phone', v_outrider.contact_phone,
      'contact_email', v_outrider.contact_email,
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

comment on column public.community_outrider_sessions.security_staff_count is
  'Structured count of security staff reported during Outrider intake. Zero is valid.';
comment on column public.community_outrider_sessions.security_staff_notes is
  'Optional names, shifts, or other security staffing information reported during Outrider intake.';
