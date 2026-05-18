-- Fix complete_resident_activation_pin_v1 to store the profile auth_type
-- value accepted by public.profiles. PIN-based residents authenticate with a
-- generated email behind the scenes, but the profile auth_type remains
-- "username" to match the existing schema constraint and historical data.

create or replace function public.complete_resident_activation_pin_v1(
  p_pin text,
  p_password text,
  p_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_pin_clean text;
  v_identifier text;
  v_attempts int;
  v_pin_id uuid;
  v_pin_row public.resident_activation_pins%rowtype;
  v_queue_row public.resident_activation_queue%rowtype;
  v_community_id uuid;
  v_username text;
  v_auth_type text;
  v_login_email text;
  v_synthetic_email text;
  v_pin_hash_stored text;
  v_instance_id uuid;
  v_new_user_id uuid;
begin
  v_pin_clean := trim(coalesce(p_pin, ''));
  if v_pin_clean !~ '^[0-9]{6}$' then
    return jsonb_build_object('success', false, 'error', 'invalid_pin_format');
  end if;

  if p_password is null or length(p_password) < 6 then
    return jsonb_build_object('success', false, 'error', 'password_too_short');
  end if;

  v_identifier := 'rap_complete:' || v_pin_clean;

  select count(*) into v_attempts
  from public.security_event_log
  where event_type = 'COMPLETE_RESIDENT_ACTIVATION_PIN'
    and identifier = v_identifier
    and created_at >= now() - interval '10 minutes';

  if v_attempts >= 5 then
    insert into public.security_event_log
      (user_id, event_type, identifier, success, metadata)
    values
      (null, 'COMPLETE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
       jsonb_build_object('reason', 'rate_limited'))
    on conflict do nothing;

    return jsonb_build_object('success', false, 'error', 'too_many_attempts');
  end if;

  if not pg_try_advisory_xact_lock(42, hashtext(v_pin_clean)) then
    return jsonb_build_object('success', false, 'error', 'activation_in_progress_retry');
  end if;

  select id into v_pin_id
  from public.resident_activation_pins
  where status = 'pending'
    and expires_at > now()
    and extensions.crypt(v_pin_clean, pin_hash) = pin_hash
  order by created_at desc
  limit 1;

  if v_pin_id is null then
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

  select *
  into v_pin_row
  from public.resident_activation_pins
  where id = v_pin_id
  for update;

  if v_pin_row.status <> 'pending' or v_pin_row.expires_at <= now() then
    insert into public.security_event_log
      (user_id, event_type, identifier, success, metadata)
    values
      (null, 'COMPLETE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
       jsonb_build_object('reason', 'pin_status_changed_after_lock', 'status', v_pin_row.status));

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

  if v_queue_row.status = 'activated' then
    return jsonb_build_object('success', false, 'error', 'already_activated');
  end if;

  if v_queue_row.status = 'skipped' then
    return jsonb_build_object('success', false, 'error', 'queue_not_eligible');
  end if;

  if v_queue_row.house_id is null then
    update public.resident_activation_queue
    set last_error = 'activation_blocked_missing_house', updated_at = now()
    where id = v_queue_row.id;

    return jsonb_build_object('success', false, 'error', 'missing_house_match');
  end if;

  v_community_id := v_pin_row.community_id;

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

  if v_queue_row.activation_method in ('username_pin', 'phone_pin', 'unknown') then
    if v_username is null or v_username = '' then
      v_username := public._raq_suggest_username(
        v_queue_row.resident_name, v_community_id
      );
    end if;

    if v_username is not null and exists (
      select 1 from public.profiles where lower(username) = lower(v_username)
    ) then
      v_username := v_username || (1000 + floor(random() * 9000))::int::text;
    end if;
  end if;

  if v_queue_row.activation_method = 'email'
     and v_queue_row.email is not null
     and v_queue_row.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_auth_type := 'email';
    v_login_email := lower(trim(v_queue_row.email));
    v_synthetic_email := null;
  else
    v_auth_type := 'username';
    v_synthetic_email := 'resident-' || v_username || '@entry.internal';
    v_login_email := v_synthetic_email;
  end if;

  if exists (select 1 from auth.users where lower(email) = lower(v_login_email)) then
    return jsonb_build_object('success', false, 'error', 'email_already_registered');
  end if;

  v_new_user_id := gen_random_uuid();
  v_pin_hash_stored := extensions.crypt(p_password, extensions.gen_salt('bf', 8));

  select instance_id into v_instance_id from auth.users limit 1;
  v_instance_id := coalesce(v_instance_id, '00000000-0000-0000-0000-000000000000'::uuid);

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
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
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object(
      'activation_source', 'resident_queue_pin',
      'queue_id', v_queue_row.id::text,
      'community_id', v_community_id::text
    ),
    false,
    false,
    false
  );

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
    case when v_auth_type = 'username' then v_pin_hash_stored else null end,
    true
  )
  on conflict (user_id) do nothing;

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

  update public.resident_activation_pins
  set status = 'used',
      used_at = now()
  where id = v_pin_row.id;

  update public.resident_activation_queue
  set status = 'activated',
      activated_user_id = v_new_user_id,
      processed_at = now(),
      last_error = null,
      updated_at = now()
  where id = v_queue_row.id;

  insert into public.security_event_log
    (user_id, event_type, identifier, success, metadata)
  values
    (v_new_user_id, 'COMPLETE_RESIDENT_ACTIVATION_PIN', v_identifier, true,
     jsonb_build_object(
       'queue_id', v_queue_row.id,
       'community_id', v_community_id,
       'activation_method', v_queue_row.activation_method,
       'auth_type', v_auth_type
     ));

  return jsonb_build_object(
    'success', true,
    'user_id', v_new_user_id,
    'community_id', v_community_id,
    'activation_method', v_queue_row.activation_method,
    'auth_type', v_auth_type,
    'login_email', v_login_email,
    'username', v_username
  );

exception when others then
  insert into public.security_event_log
    (user_id, event_type, identifier, success, metadata)
  values
    (null, 'COMPLETE_RESIDENT_ACTIVATION_PIN', v_identifier, false,
     jsonb_build_object('reason', 'unexpected_error', 'sqlerrm', sqlerrm))
  on conflict do nothing;

  begin
    update public.resident_activation_queue
    set last_error = left(sqlerrm, 500),
        updated_at = now()
    where id = v_queue_row.id
      and status <> 'activated';
  exception when others then
    null;
  end;

  raise;
end;
$function$;

comment on function public.complete_resident_activation_pin_v1(text, text, text) is
  'Mobile step 2 of 2. Re-validates the 6-digit PIN, then atomically creates '
  'one auth.users row, one profiles row, one community_members row, one '
  'house_residents row, marks the PIN used, and marks the queue row activated. '
  'Idempotent on retries (used PIN -> pin_already_used). No raw PIN or password '
  'is written to logs. Callable by unauthenticated (anon) mobile users.';

revoke all on function public.complete_resident_activation_pin_v1(text, text, text) from public;
grant execute on function public.complete_resident_activation_pin_v1(text, text, text) to anon;
grant execute on function public.complete_resident_activation_pin_v1(text, text, text) to authenticated;
grant execute on function public.complete_resident_activation_pin_v1(text, text, text) to service_role;
