-- BEDROCK F03: activation credential v2.
--
-- This is an additive compatibility migration. Existing v1 RPCs remain in
-- place for installed clients, while new clients use a high-entropy opaque
-- activation handle plus a six-digit PIN. The handle is the lookup key and
-- the failed-attempt budget is stored on the credential row, so rotating the
-- candidate PIN cannot rotate the budget.

alter table public.resident_activation_pins
  alter column visible_code drop not null,
  add column if not exists activation_handle uuid,
  add column if not exists credential_version smallint not null default 1,
  add column if not exists failed_attempts smallint not null default 0,
  add column if not exists max_attempts smallint not null default 5,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists revoked_at timestamptz;

alter table public.resident_activation_pins
  drop constraint if exists resident_activation_pins_credential_version_check,
  add constraint resident_activation_pins_credential_version_check
    check (credential_version in (1, 2)),
  drop constraint if exists resident_activation_pins_attempts_check,
  add constraint resident_activation_pins_attempts_check
    check (failed_attempts >= 0 and max_attempts between 1 and 20);

create unique index if not exists ux_rap_activation_handle
  on public.resident_activation_pins (activation_handle)
  where activation_handle is not null;

create index if not exists idx_rap_v2_pending_handle
  on public.resident_activation_pins (activation_handle, status, expires_at)
  where credential_version = 2 and activation_handle is not null;

-- Legacy generators may still be called by installed/older consumers during
-- the compatibility window. When they write a plaintext visible_code, make the
-- row explicitly v1 and clear all v2 state. The v2 wrappers overwrite this
-- transient state in the same transaction before commit.
create or replace function public._normalize_resident_activation_credential_write_v2()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.visible_code is not null then
    new.activation_handle := null;
    new.credential_version := 1;
    new.failed_attempts := 0;
    new.max_attempts := 5;
    new.last_attempt_at := null;
    new.locked_at := null;
    new.revoked_at := null;
  end if;
  return new;
end;
$function$;

revoke all on function public._normalize_resident_activation_credential_write_v2() from public;
revoke all on function public._normalize_resident_activation_credential_write_v2() from anon;
revoke all on function public._normalize_resident_activation_credential_write_v2() from authenticated;
revoke all on function public._normalize_resident_activation_credential_write_v2() from service_role;

drop trigger if exists normalize_resident_activation_credential_write_v2
  on public.resident_activation_pins;
create trigger normalize_resident_activation_credential_write_v2
before insert or update of pin_hash, visible_code
on public.resident_activation_pins
for each row execute function public._normalize_resident_activation_credential_write_v2();

-- Generate a six-digit value with pgcrypto rather than PostgreSQL random().
-- Rejection sampling removes modulo bias. This helper is never executable by
-- an API role; only SECURITY DEFINER generators below may call it.
create or replace function public._generate_resident_activation_pin_v2()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_bytes bytea;
  v_value bigint;
begin
  loop
    v_bytes := extensions.gen_random_bytes(4);
    v_value :=
      (get_byte(v_bytes, 0)::bigint << 24) +
      (get_byte(v_bytes, 1)::bigint << 16) +
      (get_byte(v_bytes, 2)::bigint << 8) +
      get_byte(v_bytes, 3)::bigint;

    -- 4,294,000,000 is the largest multiple of 1,000,000 below 2^32.
    if v_value < 4294000000 then
      return lpad((v_value % 1000000)::text, 6, '0');
    end if;
  end loop;
end;
$function$;

revoke all on function public._generate_resident_activation_pin_v2() from public;
revoke all on function public._generate_resident_activation_pin_v2() from anon;
revoke all on function public._generate_resident_activation_pin_v2() from authenticated;
revoke all on function public._generate_resident_activation_pin_v2() from service_role;

-- Convert the console's canonical, lock-safe v1 generation result to v2 in the
-- same transaction. The transient v1 value is overwritten before commit and
-- never becomes visible to another transaction.
create or replace function public.generate_resident_activation_pins_locked_v2(
  p_community_id uuid,
  p_queue_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_pin text;
  v_handle uuid;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin_required' using errcode = '42501';
  end if;

  v_result := public.generate_resident_activation_pins_locked_v1(
    p_community_id,
    p_queue_ids
  );

  for v_item in
    select value from jsonb_array_elements(coalesce(v_result->'items', '[]'::jsonb))
  loop
    if v_item->>'status' = 'pin_generated' then
      v_pin := public._generate_resident_activation_pin_v2();
      v_handle := extensions.gen_random_uuid();

      update public.resident_activation_pins
         set pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf', 10)),
             visible_code = null,
             activation_handle = v_handle,
             credential_version = 2,
             failed_attempts = 0,
             max_attempts = 5,
             last_attempt_at = null,
             locked_at = null,
             revoked_at = null
       where queue_id = (v_item->>'queue_id')::uuid
         and community_id = p_community_id
         and status = 'pending';

      if not found then
        raise exception 'v2_credential_upgrade_failed' using errcode = 'P0001';
      end if;

      v_item := jsonb_set(v_item, '{pin}', to_jsonb(v_pin), true);
      v_item := jsonb_set(v_item, '{activation_id}', to_jsonb(v_handle::text), true);
    end if;

    v_items := v_items || jsonb_build_array(v_item);
  end loop;

  return jsonb_set(v_result, '{items}', v_items, true);
end;
$function$;

comment on function public.generate_resident_activation_pins_locked_v2(uuid, uuid[]) is
  'Superadmin-only v2 generator. Returns a one-time plaintext PIN plus an opaque '
  'activation_id, stores only bcrypt and the handle, and resets the per-credential budget.';

revoke all on function public.generate_resident_activation_pins_locked_v2(uuid, uuid[]) from public;
revoke all on function public.generate_resident_activation_pins_locked_v2(uuid, uuid[]) from anon;
revoke all on function public.generate_resident_activation_pins_locked_v2(uuid, uuid[]) from service_role;
grant execute on function public.generate_resident_activation_pins_locked_v2(uuid, uuid[]) to authenticated;

create or replace function public.worker_generate_resident_activation_pin_v2(
  p_community_id uuid,
  p_queue_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_pin text;
  v_handle uuid := extensions.gen_random_uuid();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'worker_only' using errcode = '42501';
  end if;

  v_result := public.worker_generate_resident_activation_pin_v1(
    p_community_id,
    p_queue_id
  );
  v_pin := public._generate_resident_activation_pin_v2();

  update public.resident_activation_pins
     set pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf', 10)),
         visible_code = null,
         activation_handle = v_handle,
         credential_version = 2,
         failed_attempts = 0,
         max_attempts = 5,
         last_attempt_at = null,
         locked_at = null,
         revoked_at = null
   where queue_id = p_queue_id
     and community_id = p_community_id
     and status = 'pending';

  if not found then
    raise exception 'v2_credential_upgrade_failed' using errcode = 'P0001';
  end if;

  v_result := jsonb_set(v_result, '{pin}', to_jsonb(v_pin), true);
  return jsonb_set(v_result, '{activation_id}', to_jsonb(v_handle::text), true);
end;
$function$;

comment on function public.worker_generate_resident_activation_pin_v2(uuid, uuid) is
  'Service-role-only v2 generator for onboarding email workers.';

revoke all on function public.worker_generate_resident_activation_pin_v2(uuid, uuid) from public;
revoke all on function public.worker_generate_resident_activation_pin_v2(uuid, uuid) from anon;
revoke all on function public.worker_generate_resident_activation_pin_v2(uuid, uuid) from authenticated;
grant execute on function public.worker_generate_resident_activation_pin_v2(uuid, uuid) to service_role;

create or replace function public.validate_resident_activation_pin_v2(
  p_activation_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pin text := btrim(coalesce(p_pin, ''));
  v_credential public.resident_activation_pins%rowtype;
  v_queue public.resident_activation_queue%rowtype;
  v_house_label text;
  v_community_name text;
begin
  if p_activation_id is null or v_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('valid', false, 'reason', 'invalid_or_expired');
  end if;

  select * into v_credential
    from public.resident_activation_pins
   where activation_handle = p_activation_id
     and credential_version = 2
   for update;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'invalid_or_expired');
  end if;

  if v_credential.status <> 'pending'
     or v_credential.expires_at <= now()
     or v_credential.revoked_at is not null
     or v_credential.locked_at is not null
     or v_credential.failed_attempts >= v_credential.max_attempts then
    return jsonb_build_object('valid', false, 'reason', 'invalid_or_expired');
  end if;

  if extensions.crypt(v_pin, v_credential.pin_hash) <> v_credential.pin_hash then
    update public.resident_activation_pins
       set failed_attempts = failed_attempts + 1,
           last_attempt_at = now(),
           locked_at = case
             when failed_attempts + 1 >= max_attempts then now()
             else locked_at
           end
     where id = v_credential.id;

    insert into public.security_event_log
      (user_id, event_type, identifier, success, metadata)
    values (
      null,
      'VALIDATE_RESIDENT_ACTIVATION_PIN_V2',
      'credential:' || v_credential.id::text,
      false,
      jsonb_build_object('reason', 'invalid_or_expired')
    );

    return jsonb_build_object('valid', false, 'reason', 'invalid_or_expired');
  end if;

  select * into v_queue
    from public.resident_activation_queue
   where id = v_credential.queue_id;

  if not found
     or v_queue.status not in ('pending', 'invited', 'pin_generated')
     or v_queue.activated_user_id is not null then
    return jsonb_build_object('valid', false, 'reason', 'invalid_or_expired');
  end if;

  select h.house_label into v_house_label
    from public.houses h
   where h.id = v_queue.house_id;

  select c.name into v_community_name
    from public.communities c
   where c.id = v_credential.community_id;

  insert into public.security_event_log
    (user_id, event_type, identifier, success, metadata)
  values (
    null,
    'VALIDATE_RESIDENT_ACTIVATION_PIN_V2',
    'credential:' || v_credential.id::text,
    true,
    jsonb_build_object('queue_id', v_queue.id, 'community_id', v_credential.community_id)
  );

  return jsonb_build_object(
    'valid', true,
    'resident_name', v_queue.resident_name,
    'unit_label', coalesce(v_queue.unit_label, v_house_label),
    'community_name', v_community_name,
    'activation_method', v_queue.activation_method
  );
end;
$function$;

comment on function public.validate_resident_activation_pin_v2(uuid, text) is
  'Validates an opaque activation handle plus PIN. Wrong PINs consume an atomic '
  'credential budget; logs contain only the internal credential row id.';

revoke all on function public.validate_resident_activation_pin_v2(uuid, text) from public;
grant execute on function public.validate_resident_activation_pin_v2(uuid, text) to anon;
grant execute on function public.validate_resident_activation_pin_v2(uuid, text) to authenticated;
grant execute on function public.validate_resident_activation_pin_v2(uuid, text) to service_role;

create or replace function public.complete_resident_activation_pin_v2(
  p_activation_id uuid,
  p_pin text,
  p_password text,
  p_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pin text := btrim(coalesce(p_pin, ''));
  v_credential public.resident_activation_pins%rowtype;
  v_queue public.resident_activation_queue%rowtype;
  v_community_id uuid;
  v_username text;
  v_auth_type text;
  v_login_email text;
  v_synthetic_email text;
  v_pin_hash_stored text;
  v_instance_id uuid;
  v_new_user_id uuid;
begin
  if p_activation_id is null
     or v_pin !~ '^[0-9]{6}$'
     or p_password is null
     or length(p_password) < 8 then
    return jsonb_build_object('success', false, 'error', 'invalid_request');
  end if;

  select * into v_credential
    from public.resident_activation_pins
   where activation_handle = p_activation_id
     and credential_version = 2
   for update;

  if not found
     or v_credential.status <> 'pending'
     or v_credential.expires_at <= now()
     or v_credential.revoked_at is not null
     or v_credential.locked_at is not null
     or v_credential.failed_attempts >= v_credential.max_attempts then
    return jsonb_build_object('success', false, 'error', 'invalid_or_expired');
  end if;

  if extensions.crypt(v_pin, v_credential.pin_hash) <> v_credential.pin_hash then
    update public.resident_activation_pins
       set failed_attempts = failed_attempts + 1,
           last_attempt_at = now(),
           locked_at = case
             when failed_attempts + 1 >= max_attempts then now()
             else locked_at
           end
     where id = v_credential.id;

    insert into public.security_event_log
      (user_id, event_type, identifier, success, metadata)
    values (
      null,
      'COMPLETE_RESIDENT_ACTIVATION_PIN_V2',
      'credential:' || v_credential.id::text,
      false,
      jsonb_build_object('reason', 'invalid_or_expired')
    );

    return jsonb_build_object('success', false, 'error', 'invalid_or_expired');
  end if;

  select * into v_queue
    from public.resident_activation_queue
   where id = v_credential.queue_id
   for update;

  if not found
     or v_queue.status not in ('pending', 'invited', 'pin_generated')
     or v_queue.activated_user_id is not null
     or v_queue.house_id is null then
    return jsonb_build_object('success', false, 'error', 'activation_unavailable');
  end if;

  v_community_id := v_credential.community_id;

  if p_username is not null and btrim(p_username) <> '' then
    v_username := lower(
      regexp_replace(
        extensions.unaccent(btrim(p_username)),
        '[^a-zA-Z0-9]', '', 'g'
      )
    );
  end if;

  if v_username is null or v_username = '' then
    v_username := v_queue.suggested_username;
  end if;

  if v_queue.activation_method in ('username_pin', 'phone_pin', 'unknown') then
    if v_username is null or v_username = '' then
      v_username := public._raq_suggest_username(v_queue.resident_name, v_community_id);
    end if;

    if v_username is not null and exists (
      select 1 from public.profiles where lower(username) = lower(v_username)
    ) then
      v_username := v_username ||
        (1000 + floor(random() * 9000))::int::text;
    end if;
  end if;

  if v_queue.activation_method = 'email'
     and v_queue.email is not null
     and v_queue.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_auth_type := 'email';
    v_login_email := lower(btrim(v_queue.email));
    v_synthetic_email := null;
  else
    v_auth_type := 'username';
    v_synthetic_email := 'resident-' || v_username || '@entry.internal';
    v_login_email := v_synthetic_email;
  end if;

  if exists (select 1 from auth.users where lower(email) = lower(v_login_email)) then
    return jsonb_build_object('success', false, 'error', 'activation_unavailable');
  end if;

  v_new_user_id := extensions.gen_random_uuid();
  v_pin_hash_stored := extensions.crypt(p_password, extensions.gen_salt('bf', 8));

  select instance_id into v_instance_id from auth.users limit 1;
  v_instance_id := coalesce(
    v_instance_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  );

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data,
    raw_user_meta_data, is_super_admin, is_sso_user, is_anonymous
  ) values (
    v_instance_id, v_new_user_id, 'authenticated', 'authenticated',
    v_login_email, extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(), now(), now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object(
      'activation_source', 'resident_queue_pin_v2',
      'queue_id', v_queue.id::text,
      'community_id', v_community_id::text
    ),
    false, false, false
  );

  insert into public.profiles (
    user_id, community_id, role, full_name, phone, house_id, username,
    auth_type, synthetic_email, pin_hash, is_active
  ) values (
    v_new_user_id, v_community_id, 'RESIDENT', v_queue.resident_name,
    v_queue.phone, v_queue.house_id, v_username, v_auth_type,
    v_synthetic_email,
    case when v_auth_type = 'username' then v_pin_hash_stored else null end,
    true
  ) on conflict (user_id) do nothing;

  insert into public.community_members (community_id, user_id, role, is_active)
  values (v_community_id, v_new_user_id, 'RESIDENT', true)
  on conflict (community_id, user_id) do nothing;

  insert into public.house_residents (
    community_id, house_id, user_id, is_primary, is_active
  ) values (
    v_community_id, v_queue.house_id, v_new_user_id, true, true
  ) on conflict (user_id, community_id, house_id) do update
    set is_active = true, is_primary = true;

  update public.resident_activation_pins
     set status = 'used', used_at = now(), visible_code = null
   where id = v_credential.id
     and status = 'pending';

  if not found then
    raise exception 'activation_credential_state_changed' using errcode = '40001';
  end if;

  update public.resident_activation_queue
     set status = 'activated',
         activated_user_id = v_new_user_id,
         processed_at = now(),
         last_error = null,
         updated_at = now()
   where id = v_queue.id;

  insert into public.security_event_log
    (user_id, event_type, identifier, success, metadata)
  values (
    v_new_user_id,
    'COMPLETE_RESIDENT_ACTIVATION_PIN_V2',
    'credential:' || v_credential.id::text,
    true,
    jsonb_build_object(
      'queue_id', v_queue.id,
      'community_id', v_community_id,
      'activation_method', v_queue.activation_method,
      'auth_type', v_auth_type
    )
  );

  return jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'community_id', v_community_id,
    'activation_method', v_queue.activation_method,
    'auth_type', v_auth_type,
    'login_email', v_login_email,
    'username', v_username
  );
exception when others then
  -- The statement transaction rolls back all identity and credential changes.
  -- Do not persist SQLERRM or either credential component in observability.
  raise;
end;
$function$;

comment on function public.complete_resident_activation_pin_v2(uuid, text, text, text) is
  'Atomically consumes a v2 activation credential and creates the resident '
  'identity. All invalid credential states share a non-enumerating response.';

revoke all on function public.complete_resident_activation_pin_v2(uuid, text, text, text) from public;
grant execute on function public.complete_resident_activation_pin_v2(uuid, text, text, text) to anon;
grant execute on function public.complete_resident_activation_pin_v2(uuid, text, text, text) to authenticated;
grant execute on function public.complete_resident_activation_pin_v2(uuid, text, text, text) to service_role;

notify pgrst, 'reload schema';
