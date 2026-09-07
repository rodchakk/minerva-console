-- ENTRY-OUTRIDER-001: Community Intelligence Intake v1.
--
-- Outrider stores a structured, resumable community setup handoff. It does not
-- create live ENTRY units, residents, guards, facilities, or destinations.
-- No live ENTRY operational records are automatically imported by Outrider.

create or replace function public._touch_community_outrider_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public._touch_community_outrider_updated_at() from public;
revoke all on function public._touch_community_outrider_updated_at() from anon;
revoke all on function public._touch_community_outrider_updated_at() from authenticated;

create table if not exists public.community_outrider_sessions (
  id                        uuid        not null default gen_random_uuid() primary key,
  community_id              uuid        not null references public.communities(id) on delete restrict,
  status                    text        not null default 'not_started'
                                        constraint community_outrider_sessions_status_check
                                        check (status in (
                                          'not_started',
                                          'in_progress',
                                          'ready_for_review',
                                          'needs_information',
                                          'approved'
                                        )),
  token_hash                text        not null
                                        constraint community_outrider_sessions_token_hash_not_blank
                                        check (length(btrim(token_hash)) >= 32),
  encrypted_token_payload   text,
  unit_types                text[]      not null default '{}'::text[],
  unit_type_other           text,
  unit_naming_example       text,
  has_destinations          boolean,
  destinations              text[]      not null default '{}'::text[],
  has_inactive_units        boolean,
  inactive_units_notes      text,
  contact_name              text,
  contact_phone             text,
  contact_email             text,
  completed_sections        text[]      not null default '{}'::text[],
  review_note               text,
  created_by                uuid references auth.users(id) on delete set null,
  approved_by               uuid references auth.users(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  last_activity_at          timestamptz,
  submitted_at              timestamptz,
  approved_at               timestamptz,

  constraint community_outrider_sessions_one_per_community unique (community_id),
  constraint community_outrider_sessions_token_hash_unique unique (token_hash),
  constraint community_outrider_sessions_completed_sections_check
    check (completed_sections <@ array[
      'units',
      'destinations',
      'inactive_units',
      'available_information',
      'contact'
    ]::text[]),
  constraint community_outrider_sessions_unit_types_check
    check (unit_types <@ array[
      'casas',
      'apartamentos',
      'condominios',
      'oficinas',
      'otro'
    ]::text[]),
  constraint community_outrider_sessions_other_requires_value
    check ('otro' <> all(unit_types) or nullif(btrim(coalesce(unit_type_other, '')), '') is not null),
  constraint community_outrider_sessions_submitted_requires_timestamp
    check (status <> 'ready_for_review' or submitted_at is not null),
  constraint community_outrider_sessions_approved_requires_metadata
    check (status <> 'approved' or (approved_at is not null and approved_by is not null)),
  constraint community_outrider_sessions_encrypted_payload_shape
    check (
      encrypted_token_payload is null
      or (
        encrypted_token_payload = btrim(encrypted_token_payload)
        and encrypted_token_payload like 'v1:%:%:%'
        and length(encrypted_token_payload) >= 48
      )
    )
);

create index if not exists idx_community_outrider_sessions_status_attention
  on public.community_outrider_sessions (status, last_activity_at desc, updated_at desc);

create index if not exists idx_community_outrider_sessions_community_status
  on public.community_outrider_sessions (community_id, status);

create table if not exists public.community_outrider_files (
  id                  uuid        not null default gen_random_uuid() primary key,
  outrider_id         uuid        not null references public.community_outrider_sessions(id) on delete restrict,
  category            text        not null
                                  constraint community_outrider_files_category_check
                                  check (category in (
                                    'units',
                                    'residents',
                                    'security_staff',
                                    'common_areas'
                                  )),
  storage_path        text        not null
                                  constraint community_outrider_files_storage_path_not_blank
                                  check (btrim(storage_path) <> ''),
  original_filename   text        not null
                                  constraint community_outrider_files_original_filename_not_blank
                                  check (btrim(original_filename) <> ''),
  mime_type           text,
  byte_size           bigint
                                  constraint community_outrider_files_byte_size_check
                                  check (byte_size is null or byte_size between 0 and 20971520),
  created_at          timestamptz not null default now(),
  uploaded_at         timestamptz not null default now(),

  constraint community_outrider_files_storage_path_unique unique (storage_path)
);

create index if not exists idx_community_outrider_files_outrider_category
  on public.community_outrider_files (outrider_id, category, uploaded_at desc);

create table if not exists public.community_outrider_events (
  id              uuid        not null default gen_random_uuid() primary key,
  outrider_id     uuid        not null references public.community_outrider_sessions(id) on delete restrict,
  community_id    uuid        not null references public.communities(id) on delete restrict,
  event_type      text        not null
                              constraint community_outrider_events_type_check
                              check (event_type in (
                                'outrider_started',
                                'outrider_saved',
                                'file_uploaded',
                                'outrider_submitted',
                                'information_requested',
                                'outrider_approved',
                                'link_rotated'
                              )),
  actor_type      text        not null
                              constraint community_outrider_events_actor_type_check
                              check (actor_type in (
                                'public_token',
                                'entry_admin',
                                'service_role',
                                'system'
                              )),
  actor_user_id   uuid references auth.users(id) on delete set null,
  metadata        jsonb       not null default '{}'::jsonb
                              constraint community_outrider_events_metadata_object
                              check (jsonb_typeof(metadata) = 'object'),
  created_at      timestamptz not null default now()
);

create index if not exists idx_community_outrider_events_outrider_created
  on public.community_outrider_events (outrider_id, created_at desc);

create index if not exists idx_community_outrider_events_community_created
  on public.community_outrider_events (community_id, created_at desc);

drop trigger if exists trg_community_outrider_sessions_updated_at
  on public.community_outrider_sessions;
create trigger trg_community_outrider_sessions_updated_at
  before update on public.community_outrider_sessions
  for each row execute function public._touch_community_outrider_updated_at();

alter table public.community_outrider_sessions enable row level security;
alter table public.community_outrider_files enable row level security;
alter table public.community_outrider_events enable row level security;

revoke all on table public.community_outrider_sessions from public, anon, authenticated;
revoke all on table public.community_outrider_files from public, anon, authenticated;
revoke all on table public.community_outrider_events from public, anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'entry-outrider',
  'entry-outrider',
  false,
  20971520,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public._outrider_service_role_only_v1()
returns void
language plpgsql
set search_path = ''
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'ENTRY_OUTRIDER_UNAUTHORIZED' using errcode = '42501';
  end if;
end;
$function$;

create or replace function public._outrider_raise_v1(
  p_code text,
  p_sqlstate text default 'P0001'
)
returns void
language plpgsql
set search_path = ''
as $function$
begin
  raise exception '%', p_code using errcode = p_sqlstate;
end;
$function$;

create or replace function public._outrider_normalize_text_v1(p_value text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select nullif(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'), '');
$function$;

create or replace function public._outrider_normalize_text_array_v1(
  p_values text[],
  p_max_items integer,
  p_max_length integer
)
returns text[]
language plpgsql
set search_path = ''
as $function$
declare
  v_value text;
  v_normalized text;
  v_values text[] := '{}'::text[];
begin
  if p_values is null then
    return '{}'::text[];
  end if;

  foreach v_value in array p_values loop
    v_normalized := public._outrider_normalize_text_v1(v_value);
    if v_normalized is not null then
      if length(v_normalized) > p_max_length then
        perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
      end if;
      if not v_normalized = any(v_values) then
        v_values := array_append(v_values, v_normalized);
      end if;
    end if;
  end loop;

  if array_length(v_values, 1) > p_max_items then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;

  return coalesce(v_values, '{}'::text[]);
end;
$function$;

create or replace function public._outrider_text_array_from_json_v1(
  p_payload jsonb,
  p_key text,
  p_max_items integer,
  p_max_length integer
)
returns text[]
language plpgsql
set search_path = ''
as $function$
declare
  v_values text[] := '{}'::text[];
  v_item jsonb;
begin
  if not (p_payload ? p_key) or p_payload -> p_key is null then
    return '{}'::text[];
  end if;

  if jsonb_typeof(p_payload -> p_key) <> 'array' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;

  for v_item in select value from jsonb_array_elements(p_payload -> p_key) loop
    if jsonb_typeof(v_item) <> 'string' then
      perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
    end if;
    v_values := array_append(v_values, v_item #>> '{}');
  end loop;

  return public._outrider_normalize_text_array_v1(v_values, p_max_items, p_max_length);
end;
$function$;

create or replace function public._outrider_boolean_from_json_v1(
  p_payload jsonb,
  p_key text
)
returns boolean
language plpgsql
set search_path = ''
as $function$
begin
  if not (p_payload ? p_key) or p_payload -> p_key = 'null'::jsonb then
    return null;
  end if;

  if jsonb_typeof(p_payload -> p_key) <> 'boolean' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;

  return (p_payload ->> p_key)::boolean;
end;
$function$;

create or replace function public._outrider_complete_sections_v1(
  p_unit_types text[],
  p_unit_type_other text,
  p_unit_naming_example text,
  p_has_destinations boolean,
  p_destinations text[],
  p_has_inactive_units boolean,
  p_inactive_units_notes text,
  p_contact_name text,
  p_contact_phone text,
  p_contact_email text,
  p_requested_completed_sections text[] default '{}'::text[]
)
returns text[]
language plpgsql
set search_path = ''
as $function$
declare
  v_sections text[] := '{}'::text[];
  v_requested text[] := coalesce(p_requested_completed_sections, '{}'::text[]);
begin
  if cardinality(coalesce(p_unit_types, '{}'::text[])) > 0
     and nullif(btrim(coalesce(p_unit_naming_example, '')), '') is not null
     and ('otro' <> all(coalesce(p_unit_types, '{}'::text[])) or nullif(btrim(coalesce(p_unit_type_other, '')), '') is not null) then
    v_sections := array_append(v_sections, 'units');
  end if;

  if p_has_destinations = false
     or (p_has_destinations = true and cardinality(coalesce(p_destinations, '{}'::text[])) > 0) then
    v_sections := array_append(v_sections, 'destinations');
  end if;

  if p_has_inactive_units = false
     or (p_has_inactive_units = true and nullif(btrim(coalesce(p_inactive_units_notes, '')), '') is not null) then
    v_sections := array_append(v_sections, 'inactive_units');
  end if;

  if 'available_information' = any(v_requested) then
    v_sections := array_append(v_sections, 'available_information');
  end if;

  if nullif(btrim(coalesce(p_contact_name, '')), '') is not null
     and (
       nullif(btrim(coalesce(p_contact_phone, '')), '') is not null
       or nullif(btrim(coalesce(p_contact_email, '')), '') is not null
     ) then
    v_sections := array_append(v_sections, 'contact');
  end if;

  return v_sections;
end;
$function$;

create or replace function public.create_community_outrider_session_v1(
  p_community_id uuid,
  p_token_hash text,
  p_encrypted_token_payload text,
  p_actor_user_id uuid default null
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

  if p_actor_user_id is null
     or not exists (select 1 from auth.users where id = p_actor_user_id) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_ACTOR', '42501');
  end if;

  if p_community_id is null
     or not exists (select 1 from public.communities where id = p_community_id) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_COMMUNITY', '42501');
  end if;

  if p_token_hash is null or length(btrim(p_token_hash)) < 32 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_TOKEN');
  end if;

  if p_encrypted_token_payload is null
     or btrim(p_encrypted_token_payload) <> p_encrypted_token_payload
     or p_encrypted_token_payload not like 'v1:%:%:%'
     or length(p_encrypted_token_payload) < 48 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_TOKEN');
  end if;

  insert into public.community_outrider_sessions (
    community_id,
    token_hash,
    encrypted_token_payload,
    created_by,
    last_activity_at
  )
  values (
    p_community_id,
    btrim(p_token_hash),
    p_encrypted_token_payload,
    p_actor_user_id,
    now()
  )
  returning * into v_outrider;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'outrider_started',
    'entry_admin',
    p_actor_user_id,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'outrider_id', v_outrider.id,
    'community_id', v_outrider.community_id,
    'status', v_outrider.status
  );
exception
  when unique_violation then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_CONFLICT', 'P0409');
end;
$function$;

create or replace function public.rotate_community_outrider_access_v1(
  p_outrider_id uuid,
  p_token_hash text,
  p_encrypted_token_payload text,
  p_actor_user_id uuid default null
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

  if p_actor_user_id is null
     or not exists (select 1 from auth.users where id = p_actor_user_id) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_ACTOR', '42501');
  end if;

  if p_token_hash is null or length(btrim(p_token_hash)) < 32 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_TOKEN');
  end if;

  if p_encrypted_token_payload is null
     or btrim(p_encrypted_token_payload) <> p_encrypted_token_payload
     or p_encrypted_token_payload not like 'v1:%:%:%'
     or length(p_encrypted_token_payload) < 48 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_TOKEN');
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where id = p_outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE');
  end if;

  if v_outrider.status = 'approved' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_STATE', 'P0409');
  end if;

  update public.community_outrider_sessions
     set token_hash = btrim(p_token_hash),
         encrypted_token_payload = p_encrypted_token_payload
   where id = v_outrider.id
   returning * into v_outrider;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'link_rotated',
    'entry_admin',
    p_actor_user_id,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'outrider_id', v_outrider.id,
    'community_id', v_outrider.community_id,
    'status', v_outrider.status
  );
exception
  when unique_violation then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_CONFLICT', 'P0409');
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
  v_community public.communities%rowtype;
  v_files jsonb;
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

  select * into v_community
    from public.communities
   where id = v_outrider.community_id;

  if not found then
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
      'id', v_community.id,
      'name', v_community.name
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

  v_unit_types := public._outrider_text_array_from_json_v1(p_payload, 'unit_types', 5, 40);
  if not v_unit_types <@ array['casas','apartamentos','condominios','oficinas','otro']::text[] then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;

  v_unit_type_other := public._outrider_normalize_text_v1(p_payload ->> 'unit_type_other');
  v_unit_naming_example := public._outrider_normalize_text_v1(p_payload ->> 'unit_naming_example');
  v_has_destinations := public._outrider_boolean_from_json_v1(p_payload, 'has_destinations');
  v_destinations := public._outrider_text_array_from_json_v1(p_payload, 'destinations', 50, 120);
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
  if v_inactive_units_notes is not null and length(v_inactive_units_notes) > 2000 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_contact_name is not null and length(v_contact_name) > 160 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_PAYLOAD');
  end if;
  if v_contact_phone is not null and length(v_contact_phone) > 60 then
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
    jsonb_build_object('completed_sections', cardinality(v_completed_sections))
  );

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
     or p_storage_path not like v_outrider.id::text || '/%'
     or p_original_filename is null
     or btrim(p_original_filename) = ''
     or length(btrim(p_original_filename)) > 180
     or coalesce(p_byte_size, 0) < 0
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

create or replace function public.request_community_outrider_information_v1(
  p_outrider_id uuid,
  p_review_note text,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_note text;
begin
  perform public._outrider_service_role_only_v1();

  if p_actor_user_id is null
     or not exists (select 1 from auth.users where id = p_actor_user_id) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_ACTOR', '42501');
  end if;

  v_note := nullif(btrim(coalesce(p_review_note, '')), '');
  if v_note is null or length(v_note) > 1000 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_REVIEW_NOTE');
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where id = p_outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE');
  end if;

  if v_outrider.status = 'approved' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_STATE', 'P0409');
  end if;

  update public.community_outrider_sessions
     set status = 'needs_information',
         review_note = v_note
   where id = v_outrider.id
   returning * into v_outrider;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'information_requested',
    'entry_admin',
    p_actor_user_id,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'accepted', true,
    'status', v_outrider.status,
    'review_note', v_outrider.review_note
  );
end;
$function$;

create or replace function public.approve_community_outrider_v1(
  p_outrider_id uuid,
  p_actor_user_id uuid
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

  if p_actor_user_id is null
     or not exists (select 1 from auth.users where id = p_actor_user_id) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_ACTOR', '42501');
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where id = p_outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE');
  end if;

  if v_outrider.status <> 'ready_for_review' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_STATE', 'P0409');
  end if;

  update public.community_outrider_sessions
     set status = 'approved',
         approved_at = now(),
         approved_by = p_actor_user_id
   where id = v_outrider.id
   returning * into v_outrider;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'outrider_approved',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object('submitted_at', v_outrider.submitted_at)
  );

  return jsonb_build_object(
    'accepted', true,
    'status', v_outrider.status,
    'approved_at', v_outrider.approved_at
  );
end;
$function$;

create or replace function public.list_entry_operational_activity_v1(
  p_limit integer default 15
)
returns table (
  event_id text,
  occurred_at timestamptz,
  community_id uuid,
  community_name text,
  event_key text,
  event_label text,
  detail text,
  actor text,
  severity text,
  category text,
  source text
)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  return query
  with operational_events as (
    select
      'sa:' || a.id::text as event_id,
      a.created_at as occurred_at,
      c.id as community_id,
      c.name as community_name,
      case a.action
        when 'create_community' then 'community_created'
        when 'bulk_create_houses_v2_normalized' then 'units_imported'
        when 'bulk_create_houses' then 'units_imported'
        when 'bulk_create_community_facilities' then 'facilities_configured'
        when 'generate_resident_activation_pins' then 'residents_prepared'
        when 'community.deactivate' then 'community_deactivated'
        when 'community.reactivate' then 'community_reactivated'
        when 'community_user.deactivate' then 'user_deactivated'
        when 'community_user.reactivate' then 'user_reactivated'
        else a.action
      end as event_key,
      case a.action
        when 'create_community' then 'Community created'
        when 'bulk_create_houses_v2_normalized' then 'Units imported'
        when 'bulk_create_houses' then 'Units imported'
        when 'bulk_create_community_facilities' then 'Facilities configured'
        when 'generate_resident_activation_pins' then 'Residents prepared'
        when 'community.deactivate' then 'Community deactivated'
        when 'community.reactivate' then 'Community reactivated'
        when 'community_user.deactivate' then 'User deactivated'
        when 'community_user.reactivate' then 'User reactivated'
        else 'Operational update'
      end as event_label,
      case a.action
        when 'create_community' then 'Community initialized for onboarding'
        when 'bulk_create_houses_v2_normalized' then
          case
            when a.metadata->>'inserted_count' = '1' then '1 unit imported'
            when a.metadata ? 'inserted_count' then (a.metadata->>'inserted_count') || ' units imported'
            else 'Community units imported'
          end
        when 'bulk_create_houses' then
          case
            when a.metadata->>'inserted_count' = '1' then '1 unit imported'
            when a.metadata ? 'inserted_count' then (a.metadata->>'inserted_count') || ' units imported'
            else 'Community units imported'
          end
        when 'bulk_create_community_facilities' then
          case
            when a.metadata->>'inserted_count' = '1' then '1 reservable area configured'
            when a.metadata ? 'inserted_count' then (a.metadata->>'inserted_count') || ' reservable areas configured'
            else 'Reservable areas configured'
          end
        when 'generate_resident_activation_pins' then
          case
            when a.metadata->>'generated_count' = '1' then '1 activation PIN generated'
            when a.metadata ? 'generated_count' then (a.metadata->>'generated_count') || ' activation PINs generated'
            else 'Residents prepared for activation'
          end
        when 'community.deactivate' then 'Community operations were deactivated'
        when 'community.reactivate' then 'Community operations were reactivated'
        when 'community_user.deactivate' then 'A community user was deactivated'
        when 'community_user.reactivate' then 'A community user was reactivated'
        else 'Operational update recorded'
      end as detail,
      'Minerva'::text as actor,
      case
        when a.action in ('community.deactivate', 'community_user.deactivate') then 'warning'
        else 'info'
      end as severity,
      case
        when a.action = 'generate_resident_activation_pins' then 'activation'
        when a.action like 'community_user.%' then 'admin'
        else 'setup'
      end as category,
      'superadmin_audit'::text as source
    from public.superadmin_audit_log a
    left join public.communities c
      on c.id::text = coalesce(
        nullif(a.metadata->>'community_id', ''),
        case when a.target_type = 'community' then a.target_id::text end
      )
    where a.action in (
      'create_community',
      'bulk_create_houses_v2_normalized',
      'bulk_create_houses',
      'bulk_create_community_facilities',
      'generate_resident_activation_pins',
      'community.deactivate',
      'community.reactivate',
      'community_user.deactivate',
      'community_user.reactivate'
    )

    union all

    select
      'ca:' || l.id::text,
      l.created_at,
      c.id,
      c.name,
      case l.action_type
        when 'community_message_sent' then 'message_published'
        when 'onboarding_activation_queue_reviewed' then 'activation_queue_reviewed'
        when 'onboarding_completed' then 'onboarding_completed'
        else l.action_type
      end,
      case l.action_type
        when 'community_message_sent' then 'Message published'
        when 'onboarding_activation_queue_reviewed' then 'Activation queue reviewed'
        when 'onboarding_completed' then 'Onboarding completed'
        else 'Admin activity'
      end,
      case l.action_type
        when 'community_message_sent' then 'Community update published'
        when 'onboarding_activation_queue_reviewed' then 'Prepared residents were reviewed for activation'
        when 'onboarding_completed' then 'Community setup completed and is ready for operations'
        else l.summary
      end,
      case upper(coalesce(l.actor_role, ''))
        when 'SUPERADMIN' then 'Minerva'
        when 'ADMIN' then 'Admin'
        else 'System'
      end,
      'info'::text,
      case l.action_type
        when 'community_message_sent' then 'messages'
        when 'onboarding_activation_queue_reviewed' then 'activation'
        else 'setup'
      end,
      'community_admin_activity'::text
    from public.community_admin_activity_log l
    join public.communities c on c.id = l.community_id
    where
      l.action_type in ('onboarding_activation_queue_reviewed', 'onboarding_completed')
      or (
        l.action_type = 'community_message_sent'
        and upper(coalesce(l.actor_role, '')) in ('ADMIN', 'SUPERADMIN')
      )

    union all

    select
      'msg:' || m.id::text,
      m.published_at,
      c.id,
      c.name,
      'message_published'::text,
      'Message published'::text,
      'Minerva community update published'::text,
      'Minerva'::text,
      'info'::text,
      'messages'::text,
      'community_messages'::text
    from public.community_messages m
    join public.communities c on c.id = m.community_id
    where
      m.source_type = 'system'
      and m.author_label = 'ENTRY'
      and m.target_user_id is null
      and m.deleted_at is null

    union all

    select
      'cr:' || e.id::text,
      e.created_at,
      c.id,
      c.name,
      e.event_type,
      case e.event_type
        when 'household_submitted' then 'Registration submitted'
        when 'household_resubmitted' then 'Registration resubmitted'
        when 'correction_requested' then 'Correction requested'
        when 'unit_reviewed' then 'Registration reviewed'
        when 'unit_confirmed' then 'Registration confirmed'
        when 'unit_conversion_completed' then 'Residents prepared'
        when 'resident_conversion_blocked' then 'Activation blocked'
        else 'Registration update'
      end,
      case e.event_type
        when 'household_submitted' then coalesce(u.unit_label_snapshot, 'Unit') || ' submitted for review'
        when 'household_resubmitted' then coalesce(u.unit_label_snapshot, 'Unit') || ' resubmitted after correction'
        when 'correction_requested' then coalesce(u.unit_label_snapshot, 'Unit') || ' returned for correction'
        when 'unit_reviewed' then coalesce(u.unit_label_snapshot, 'Unit') || ' reviewed by Minerva'
        when 'unit_confirmed' then coalesce(u.unit_label_snapshot, 'Unit') || ' confirmed for activation'
        when 'unit_conversion_completed' then coalesce(u.unit_label_snapshot, 'Unit') || ' moved to the activation queue'
        when 'resident_conversion_blocked' then coalesce(u.unit_label_snapshot, 'Unit') || ' could not be prepared for activation'
        else 'Registration activity recorded'
      end,
      case e.actor_type
        when 'resident_token' then 'Resident'
        when 'entry_admin' then 'Minerva'
        when 'service_role' then 'System'
        else 'System'
      end,
      case when e.event_type = 'resident_conversion_blocked' then 'warning' else 'info' end,
      case
        when e.event_type in ('unit_conversion_completed', 'resident_conversion_blocked') then 'activation'
        else 'registration'
      end,
      'community_registration'::text
    from public.community_registration_events e
    join public.community_registration_campaigns camp on camp.id = e.campaign_id
    join public.communities c on c.id = camp.community_id
    left join public.community_registration_units u on u.id = e.campaign_unit_id
    where e.event_type in (
      'household_submitted',
      'household_resubmitted',
      'correction_requested',
      'unit_reviewed',
      'unit_confirmed',
      'unit_conversion_completed',
      'resident_conversion_blocked'
    )

    union all

    select
      'out:' || e.id::text,
      e.created_at,
      c.id,
      c.name,
      e.event_type,
      case e.event_type
        when 'outrider_started' then 'Outrider started'
        when 'outrider_saved' then 'Outrider information updated'
        when 'outrider_submitted' then 'Outrider submitted'
        when 'file_uploaded' then 'Outrider file uploaded'
        when 'information_requested' then 'Outrider needs information'
        when 'outrider_approved' then 'Outrider approved'
        when 'link_rotated' then 'Outrider link rotated'
        else 'Outrider update'
      end,
      case e.event_type
        when 'outrider_started' then 'Community setup intake was started'
        when 'outrider_saved' then 'Community setup intake information was updated'
        when 'outrider_submitted' then 'Community setup intake is ready for review'
        when 'file_uploaded' then 'A source document was uploaded'
        when 'information_requested' then 'Minerva requested clarification'
        when 'outrider_approved' then 'Community setup intake was approved for export'
        when 'link_rotated' then 'Secure Outrider link was replaced'
        else 'Outrider activity recorded'
      end,
      'Outrider'::text,
      case when e.event_type = 'information_requested' then 'warning' else 'info' end,
      'outrider'::text,
      'community_outrider'::text
    from public.community_outrider_events e
    join public.communities c on c.id = e.community_id
    where e.event_type in (
      'outrider_started',
      'outrider_saved',
      'outrider_submitted',
      'file_uploaded',
      'information_requested',
      'outrider_approved',
      'link_rotated'
    )

    union all

    select
      'sys:' || s.id::text,
      s.created_at,
      c.id,
      c.name,
      s.event_type,
      case s.event_type
        when 'SOS_PUSH_NO_GUARD_TOKENS' then 'Emergency delivery warning'
        when 'PUSH_CLAIM_RPC_ERROR' then 'Message delivery error'
        else 'Operational issue'
      end,
      case s.event_type
        when 'SOS_PUSH_NO_GUARD_TOKENS' then 'No active guard devices were available for an SOS alert'
        when 'PUSH_CLAIM_RPC_ERROR' then 'Push delivery worker could not claim pending messages'
        else 'An operational issue requires attention'
      end,
      'System'::text,
      case when upper(coalesce(s.severity, '')) = 'ERROR' then 'error' else 'warning' end,
      'system'::text,
      'system_event_log'::text
    from public.system_event_log s
    left join public.communities c on c.id = s.community_id
    where s.event_type in ('SOS_PUSH_NO_GUARD_TOKENS', 'PUSH_CLAIM_RPC_ERROR')
  )
  select
    oe.event_id,
    oe.occurred_at,
    oe.community_id,
    oe.community_name,
    oe.event_key,
    oe.event_label,
    oe.detail,
    oe.actor,
    oe.severity,
    oe.category,
    oe.source
  from operational_events oe
  order by oe.occurred_at desc, oe.event_id desc
  limit greatest(1, least(coalesce(p_limit, 15), 50));
end;
$function$;

comment on table public.community_outrider_sessions is
  'Outrider community setup handoff sessions. Stores typed intake answers and link recovery material; does not import live ENTRY operational records.';
comment on table public.community_outrider_files is
  'Original customer source documents uploaded for Outrider. Files remain in private storage and are not parsed into live ENTRY tables.';
comment on table public.community_outrider_events is
  'Minimal Outrider operational event stream with sanitized metadata.';
comment on column public.community_outrider_sessions.encrypted_token_payload is
  'Application-layer encrypted public access token payload. Plaintext token is never stored in Supabase.';
comment on function public.create_community_outrider_session_v1(uuid, text, text, uuid) is
  'ENTRY internal RPC. Creates one Outrider session for an existing community with hash-only public access. service_role only.';
comment on function public.rotate_community_outrider_access_v1(uuid, text, text, uuid) is
  'ENTRY internal RPC. Replaces the hash-only public Outrider access token and encrypted recovery payload. service_role only.';
comment on function public.resolve_community_outrider_v1(text) is
  'Public route backend RPC. Resolves one Outrider by token hash and returns only safe, token-scoped data. service_role only.';
comment on function public.save_community_outrider_v1(text, jsonb, text[]) is
  'Public route backend RPC. Whitelist-saves typed Outrider fields, recomputes persisted progress, and rejects read-only states. service_role only.';
comment on function public.submit_community_outrider_v1(text) is
  'Public route backend RPC. Moves completed Outrider information to ready_for_review without importing ENTRY records. service_role only.';
comment on function public.record_community_outrider_file_v1(text, text, text, text, text, bigint) is
  'Public route backend RPC. Persists metadata for an uploaded private Storage object after token validation. service_role only.';
comment on function public.request_community_outrider_information_v1(uuid, text, uuid) is
  'ENTRY internal RPC. Requests clarification and reopens the public Outrider for editing. service_role only.';
comment on function public.approve_community_outrider_v1(uuid, uuid) is
  'ENTRY internal RPC. Approves a ready_for_review Outrider without importing live ENTRY records. service_role only.';

revoke all on function public._outrider_service_role_only_v1() from public, anon, authenticated;
revoke all on function public._outrider_raise_v1(text, text) from public, anon, authenticated;
revoke all on function public._outrider_normalize_text_v1(text) from public, anon, authenticated;
revoke all on function public._outrider_normalize_text_array_v1(text[], integer, integer) from public, anon, authenticated;
revoke all on function public._outrider_text_array_from_json_v1(jsonb, text, integer, integer) from public, anon, authenticated;
revoke all on function public._outrider_boolean_from_json_v1(jsonb, text) from public, anon, authenticated;
revoke all on function public._outrider_complete_sections_v1(text[], text, text, boolean, text[], boolean, text, text, text, text, text[]) from public, anon, authenticated;
revoke all on function public.create_community_outrider_session_v1(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.rotate_community_outrider_access_v1(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.resolve_community_outrider_v1(text) from public, anon, authenticated;
revoke all on function public.save_community_outrider_v1(text, jsonb, text[]) from public, anon, authenticated;
revoke all on function public.submit_community_outrider_v1(text) from public, anon, authenticated;
revoke all on function public.record_community_outrider_file_v1(text, text, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.request_community_outrider_information_v1(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.approve_community_outrider_v1(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_community_outrider_session_v1(uuid, text, text, uuid) to service_role;
grant execute on function public.rotate_community_outrider_access_v1(uuid, text, text, uuid) to service_role;
grant execute on function public.resolve_community_outrider_v1(text) to service_role;
grant execute on function public.save_community_outrider_v1(text, jsonb, text[]) to service_role;
grant execute on function public.submit_community_outrider_v1(text) to service_role;
grant execute on function public.record_community_outrider_file_v1(text, text, text, text, text, bigint) to service_role;
grant execute on function public.request_community_outrider_information_v1(uuid, text, uuid) to service_role;
grant execute on function public.approve_community_outrider_v1(uuid, uuid) to service_role;

revoke execute on function public.list_entry_operational_activity_v1(integer) from public;
revoke execute on function public.list_entry_operational_activity_v1(integer) from anon;
grant execute on function public.list_entry_operational_activity_v1(integer) to authenticated;
grant execute on function public.list_entry_operational_activity_v1(integer) to service_role;
