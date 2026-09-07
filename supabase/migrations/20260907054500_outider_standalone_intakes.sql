-- Allow Outrider to begin before a live ENTRY community exists.
-- No live ENTRY operational records are automatically imported by Outrider.

alter table public.community_outrider_sessions
  add column if not exists community_name text,
  add column if not exists community_city text;

update public.community_outrider_sessions s
set
  community_name = coalesce(nullif(btrim(s.community_name), ''), c.name),
  community_city = coalesce(nullif(btrim(s.community_city), ''), c.city)
from public.communities c
where c.id = s.community_id
  and (
    nullif(btrim(s.community_name), '') is null
    or nullif(btrim(s.community_city), '') is null
  );

alter table public.community_outrider_sessions
  alter column community_id drop not null;

alter table public.community_outrider_sessions
  alter column community_name set not null;

alter table public.community_outrider_sessions
  drop constraint if exists community_outrider_sessions_identity_check;

alter table public.community_outrider_sessions
  add constraint community_outrider_sessions_identity_check
  check (
    nullif(btrim(community_name), '') is not null
    and length(btrim(community_name)) <= 180
    and (community_city is null or length(btrim(community_city)) <= 180)
  );

alter table public.community_outrider_events
  alter column community_id drop not null;

create or replace function public._outrider_fill_community_snapshot_v2()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_name text;
  v_city text;
begin
  if new.community_id is not null then
    select c.name, c.city
      into v_name, v_city
      from public.communities c
     where c.id = new.community_id;

    if found then
      new.community_name := coalesce(
        public._outrider_normalize_text_v1(new.community_name),
        public._outrider_normalize_text_v1(v_name)
      );
      new.community_city := coalesce(
        public._outrider_normalize_text_v1(new.community_city),
        public._outrider_normalize_text_v1(v_city)
      );
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public._outrider_fill_community_snapshot_v2()
  from public, anon, authenticated;

drop trigger if exists trg_community_outrider_sessions_snapshot_v2
  on public.community_outrider_sessions;
create trigger trg_community_outrider_sessions_snapshot_v2
  before insert or update of community_id, community_name, community_city
  on public.community_outrider_sessions
  for each row execute function public._outrider_fill_community_snapshot_v2();

create or replace function public.create_community_outrider_session_v2(
  p_community_name text,
  p_community_city text,
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
  v_community public.communities%rowtype;
  v_name text;
  v_city text;
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

  if p_community_id is not null then
    select * into v_community
      from public.communities
     where id = p_community_id;

    if not found then
      perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_COMMUNITY', '42501');
    end if;

    v_name := public._outrider_normalize_text_v1(v_community.name);
    v_city := public._outrider_normalize_text_v1(v_community.city);
  else
    v_name := public._outrider_normalize_text_v1(p_community_name);
    v_city := public._outrider_normalize_text_v1(p_community_city);
  end if;

  if v_name is null or length(v_name) > 180 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_COMMUNITY');
  end if;

  if v_city is not null and length(v_city) > 180 then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_COMMUNITY');
  end if;

  insert into public.community_outrider_sessions (
    community_id,
    community_name,
    community_city,
    token_hash,
    encrypted_token_payload,
    created_by,
    last_activity_at
  )
  values (
    p_community_id,
    v_name,
    v_city,
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
    jsonb_build_object(
      'community_name', v_outrider.community_name,
      'standalone', v_outrider.community_id is null
    )
  );

  return jsonb_build_object(
    'outrider_id', v_outrider.id,
    'community_id', v_outrider.community_id,
    'community_name', v_outrider.community_name,
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

revoke all on function public.create_community_outrider_session_v2(text, text, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_community_outrider_session_v2(text, text, uuid, text, text, uuid)
  to service_role;

comment on function public.create_community_outrider_session_v2(text, text, uuid, text, text, uuid) is
  'ENTRY internal RPC. Creates an Outrider before a live community exists, or links it to an existing ENTRY community. service_role only.';
