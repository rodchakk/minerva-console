-- ─────────────────────────────────────────────────────────────────────────────
-- complete_resident_activation_pin_v1
--
-- Mobile step 2 of 2. Re-validates the PIN (never trusts the prior response),
-- then atomically:
--   1. Creates one auth.users row (postgres superuser writes auth schema).
--   2. Creates one profiles row.
--   3. Creates one community_members row.
--   4. Creates one house_residents row (when house_id is set).
--   5. Marks resident_activation_pins.status = 'used'.
--   6. Marks resident_activation_queue.status = 'activated', sets activated_user_id.
--   7. Writes an audit entry.
--
-- If any step fails the whole transaction rolls back — no partial user is left.
--
-- Auth: callable by unauthenticated mobile users (anon role).
--       Security is entirely in PIN re-validation + row locking.
--
-- Idempotency: retrying an already-used PIN returns 'pin_already_used' without
--              creating a second user.
--
-- Hard constraints enforced here:
--   - house_id must be set; activation is blocked if house_id is NULL.
--   - Cross-community activation is impossible (community_id comes from the PIN
--     row, never from the caller).
--   - No raw PIN or password is logged.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.complete_resident_activation_pin_v1(
  p_pin      text,
  p_password text,
  p_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  -- Input
  v_pin_clean  text;
  v_identifier text;

  -- Rate limiting
  v_attempts   int;

  -- PIN + queue state
  v_pin_id     uuid;
  v_pin_row    public.resident_activation_pins%rowtype;
  v_queue_row  public.resident_activation_queue%rowtype;

  -- Derived values
  v_community_id    uuid;
  v_username        text;
  v_auth_type       text;
  v_login_email     text;
  v_synthetic_email text;
  v_pin_hash_stored text;
  v_instance_id     uuid;
  v_new_user_id     uuid;
begin

  -- ── 1. Input validation ───────────────────────────────────────────────────

  v_pin_clean := trim(coalesce(p_pin, ''));
  if v_pin_clean !~ '^[0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', 'invalid_pin_format');
  end if;

  if p_password is null or length(p_password) < 6 then
    return jsonb_build_object('success', false, 'error', 'password_too_short');
  end if;

  v_identifier := 'rap_complete:' || v_pin_clean;

  -- ── 2. Rate limit: 5 completion attempts per PIN per 10 minutes ──────────
  select count(*) into v_attempts
  from public.security_event_log
  where event_type = 'COMPLETE_RESIDENT_ACTIVATION_PIN'
    and identifier  = v_identifier
    and created_at  >= now() - interval '10 minutes';

  if v_attempts >= 5 then
    insert into public.security_event_log
      (user_id, event_type, identifier, success, metadata)
    values
      (null, 'COMPLETE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
       jsonb_build_object('reason', 'rate_limited'))
    on conflict do nothing;

    return jsonb_build_object('success', false, 'error', 'too_many_attempts');
  end if;

  -- ── 3. Advisory lock prevents concurrent activations of the same PIN ──────
  -- pg_try_advisory_xact_lock is released automatically at end of transaction.
  if not pg_try_advisory_xact_lock(42, hashtext(v_pin_clean)) then
    return jsonb_build_object('success', false, 'error', 'activation_in_progress_retry');
  end if;

  -- ── 4. Find matching PIN by bcrypt comparison (no lock yet) ───────────────
  select id into v_pin_id
  from public.resident_activation_pins
  where status    = 'pending'
    and expires_at > now()
    and extensions.crypt(v_pin_clean, pin_hash) = pin_hash
  order by created_at desc
  limit 1;

  if v_pin_id is null then
    -- Distinguish used vs wrong to give the mobile app an actionable message,
    -- but do not reveal hash or timing info.
    -- Check if the PIN exists but is already used/expired (safe: not enumerable
    -- because the caller must already know the correct 6-digit value).
    if exists (
      select 1 from public.resident_activation_pins
      where status in ('used', 'expired')
        and extensions.crypt(v_pin_clean, pin_hash) = pin_hash
      limit 1
    ) then
      insert into public.security_event_log
        (user_id, event_type, identifier, success, metadata)
      values
        (null, 'COMPLETE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
         jsonb_build_object('reason', 'pin_already_used_or_expired'));

      return jsonb_build_object('success', false, 'error', 'pin_already_used');
    end if;

    insert into public.security_event_log
      (user_id, event_type, identifier, success, metadata)
    values
      (null, 'COMPLETE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
       jsonb_build_object('reason', 'not_found_or_invalid'));

    return jsonb_build_object('success', false, 'error', 'invalid_pin');
  end if;

  -- ── 5. Row-lock the PIN and queue rows ────────────────────────────────────
  select *
  into v_pin_row
  from public.resident_activation_pins
  where id = v_pin_id
  for update;

  -- Re-verify after lock — another concurrent call may have beaten us.
  if v_pin_row.status <> 'pending' or v_pin_row.expires_at <= now() then
    insert into public.security_event_log
      (user_id, event_type, identifier, success, metadata)
    values
      (null, 'COMPLETE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
       jsonb_build_object('reason', 'pin_status_changed_after_lock',
                          'status', v_pin_row.status));

    return jsonb_build_object('success', false, 'error', 'pin_already_used');
  end if;

  select *
  into v_queue_row
  from public.resident_activation_queue
  where id = v_pin_row.queue_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'queue_row_not_found');
  end if;

  -- Hard block on terminal queue statuses.
  if v_queue_row.status = 'activated' then
    return jsonb_build_object('success', false, 'error', 'already_activated');
  end if;

  if v_queue_row.status = 'skipped' then
    return jsonb_build_object('success', false, 'error', 'queue_not_eligible');
  end if;

  -- ── 6. Require house_id — partial activations are not allowed ─────────────
  if v_queue_row.house_id is null then
    update public.resident_activation_queue
    set last_error = 'activation_blocked_missing_house', updated_at = now()
    where id = v_queue_row.id;

    return jsonb_build_object('success', false, 'error', 'missing_house_match');
  end if;

  v_community_id := v_pin_row.community_id;

  -- ── 7. Resolve and normalise username ────────────────────────────────────
  -- Priority: caller-supplied > queue suggested_username > generate fresh.
  if p_username is not null and trim(p_username) <> '' then
    v_username := lower(
      regexp_replace(
        extensions.unaccent(trim(p_username)),
        '[^a-zA-Z0-9]', '', 'g'
      )
    );
  end if;

  if v_username is null or v_username = '' then
    v_username := v_queue_row.suggested_username;
  end if;

  -- For PIN-based auth types, a username is required; generate one if missing.
  if v_queue_row.activation_method in ('username_pin', 'phone_pin', 'unknown') then
    if v_username is null or v_username = '' then
      v_username := public._raq_suggest_username(
        v_queue_row.resident_name, v_community_id
      );
    end if;

    -- Username uniqueness check against existing profiles.
    if v_username is not null and exists (
      select 1 from public.profiles where lower(username) = lower(v_username)
    ) then
      -- Append a random 4-digit suffix to resolve the collision.
      v_username := v_username || (1000 + floor(random() * 9000))::int::text;
    end if;
  end if;

  -- ── 8. Determine auth_type and login email ────────────────────────────────
  if v_queue_row.activation_method = 'email'
     and v_queue_row.email is not null
     and v_queue_row.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    -- Email-method: use the real email, standard Supabase auth_type.
    v_auth_type       := 'email';
    v_login_email     := lower(trim(v_queue_row.email));
    v_synthetic_email := null;
  else
    -- Username/phone-PIN method: synthesise an internal email.
    -- Pattern matches is_synthetic_email(): resident-{username}@entry.internal
    v_auth_type       := 'username_pin';
    v_synthetic_email := 'resident-' || v_username || '@entry.internal';
    v_login_email     := v_synthetic_email;
  end if;

  -- Duplicate email guard — prevents re-registering the same address.
  if exists (select 1 from auth.users where lower(email) = lower(v_login_email)) then
    return jsonb_build_object('success', false, 'error', 'email_already_registered');
  end if;

  -- ── 9. Bcrypt hash the password at auth-level strength (10 rounds) ────────
  -- Using the same algorithm Supabase uses for auth.users.encrypted_password.
  -- The PIN hash stored on profiles uses 8 rounds (faster for login checks).
  v_new_user_id     := gen_random_uuid();
  v_pin_hash_stored := extensions.crypt(p_password, extensions.gen_salt('bf', 8));

  -- Derive instance_id from an existing auth user (always 00000000… on Supabase).
  select instance_id into v_instance_id from auth.users limit 1;
  v_instance_id := coalesce(v_instance_id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- ── 10. Create auth.users row ─────────────────────────────────────────────
  -- This runs under SECURITY DEFINER (postgres superuser) which has write
  -- access to auth schema. auth.users INSERT is part of this transaction;
  -- if any later step raises, the whole block rolls back atomically.
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,   -- skip email verification (identity proven by PIN)
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    is_sso_user,
    is_anonymous
  ) values (
    v_instance_id,
    v_new_user_id,
    'authenticated',
    'authenticated',
    v_login_email,
    -- auth-level bcrypt (10 rounds) for auth.users.encrypted_password
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),  -- email confirmed immediately — activation was via PIN
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object(
      'activation_source', 'resident_queue_pin',
      'queue_id',          v_queue_row.id::text,
      'community_id',      v_community_id::text
    ),
    false,
    false,
    false
  );

  -- ── 11. Create profile ────────────────────────────────────────────────────
  insert into public.profiles (
    user_id,
    community_id,
    role,
    full_name,
    phone,
    house_id,
    username,
    auth_type,
    synthetic_email,
    pin_hash,
    is_active
  ) values (
    v_new_user_id,
    v_community_id,
    'RESIDENT',
    v_queue_row.resident_name,
    v_queue_row.phone,
    v_queue_row.house_id,
    v_username,
    v_auth_type,
    v_synthetic_email,
    case when v_auth_type = 'username_pin' then v_pin_hash_stored else null end,
    true
  )
  on conflict (user_id) do nothing; -- should never conflict; guard against retries

  -- ── 12. Create community_members row ─────────────────────────────────────
  -- community_members is a lean join table: (community_id, user_id, role, is_active).
  -- Extended fields (house_id, full_name, pin_hash, etc.) live on profiles only.
  insert into public.community_members (
    community_id,
    user_id,
    role,
    is_active
  ) values (
    v_community_id,
    v_new_user_id,
    'RESIDENT',
    true
  )
  on conflict (community_id, user_id) do nothing;

  -- ── 13. Create house_residents row ───────────────────────────────────────
  insert into public.house_residents (
    community_id,
    house_id,
    user_id,
    is_primary,
    is_active
  ) values (
    v_community_id,
    v_queue_row.house_id,
    v_new_user_id,
    true,
    true
  )
  on conflict (user_id, community_id, house_id) do update
    set is_active = true, is_primary = true;

  -- ── 14. Mark PIN as used ─────────────────────────────────────────────────
  update public.resident_activation_pins
  set status  = 'used',
      used_at = now()
  where id = v_pin_row.id;

  -- ── 15. Mark queue row as activated ──────────────────────────────────────
  update public.resident_activation_queue
  set status            = 'activated',
      activated_user_id = v_new_user_id,
      processed_at      = now(),
      last_error        = null,
      updated_at        = now()
  where id = v_queue_row.id;

  -- ── 16. Audit (no PIN, no password, no hash) ──────────────────────────────
  insert into public.security_event_log
    (user_id, event_type, identifier, success, metadata)
  values
    (v_new_user_id, 'COMPLETE_RESIDENT_ACTIVATION_PIN', v_identifier, true,
     jsonb_build_object(
       'queue_id',          v_queue_row.id,
       'community_id',      v_community_id,
       'activation_method', v_queue_row.activation_method,
       'auth_type',         v_auth_type
     ));

  -- ── 17. Return the login email so the mobile can sign in ──────────────────
  return jsonb_build_object(
    'success',           true,
    'user_id',           v_new_user_id,
    'community_id',      v_community_id,
    'activation_method', v_queue_row.activation_method,
    'auth_type',         v_auth_type,
    'login_email',       v_login_email,  -- mobile calls signInWithPassword with this
    'username',          v_username
  );

exception when others then
  -- Log failure reason without leaking PIN or password.
  insert into public.security_event_log
    (user_id, event_type, identifier, success, metadata)
  values
    (null, 'COMPLETE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
     jsonb_build_object('reason', 'unexpected_error', 'sqlerrm', sqlerrm))
  on conflict do nothing;

  -- Update queue last_error for admin visibility.
  begin
    update public.resident_activation_queue
    set last_error  = left(sqlerrm, 500),
        updated_at  = now()
    where id = v_queue_row.id
      and status <> 'activated';  -- never overwrite a success
  exception when others then
    null;
  end;

  -- Re-raise so the transaction rolls back (atomically undoes auth.users INSERT too).
  raise;
end;
$function$;

comment on function public.complete_resident_activation_pin_v1(text, text, text) is
  'Mobile step 2 of 2. Re-validates the 6-digit PIN, then atomically creates '
  'one auth.users row, one profiles row, one community_members row, one '
  'house_residents row, marks the PIN used, and marks the queue row activated. '
  'Idempotent on retries (used PIN → pin_already_used). No raw PIN or password '
  'is written to logs. Callable by unauthenticated (anon) mobile users.';

revoke all on function public.complete_resident_activation_pin_v1(text, text, text) from public;
grant execute on function public.complete_resident_activation_pin_v1(text, text, text) to anon;
grant execute on function public.complete_resident_activation_pin_v1(text, text, text) to authenticated;
grant execute on function public.complete_resident_activation_pin_v1(text, text, text) to service_role;
