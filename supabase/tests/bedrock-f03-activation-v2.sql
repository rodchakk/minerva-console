\set ON_ERROR_STOP on
set test.superadmin = 'true';
set test.role = 'service_role';

do $test$
declare
  c constant uuid := '10000000-0000-4000-8000-000000000001';
  q1 constant uuid := '10000000-0000-4000-8000-000000000100';
  q2 constant uuid := '10000000-0000-4000-8000-000000000101';
  result jsonb;
  item jsonb;
  handle uuid;
  pin text;
  wrong_pin text;
  event_count integer;
begin
  result := public.generate_resident_activation_pins_locked_v2(c, array[q1, q2]);
  assert (result->>'generated_count')::integer = 2, 'two v2 credentials generated';

  select value into item
    from jsonb_array_elements(result->'items')
   where value->>'queue_id' = q1::text;
  handle := (item->>'activation_id')::uuid;
  pin := item->>'pin';

  assert pin ~ '^[0-9]{6}$', 'generator returns six digits';
  assert handle is not null, 'generator returns opaque handle';
  assert exists (
    select 1 from public.resident_activation_pins p
     where p.queue_id = q1
       and p.activation_handle = handle
       and p.credential_version = 2
       and p.visible_code is null
       and extensions.crypt(pin, p.pin_hash) = p.pin_hash
  ), 'v2 stores bcrypt plus handle without plaintext';

  for event_count in 1..5 loop
    wrong_pin := lpad(event_count::text, 6, '0');
    if wrong_pin = pin then
      wrong_pin := lpad((event_count + 10)::text, 6, '0');
    end if;
    result := public.validate_resident_activation_pin_v2(handle, wrong_pin);
    assert result = '{"valid": false, "reason": "invalid_or_expired"}'::jsonb,
      'wrong candidate has uniform response';
  end loop;

  assert exists (
    select 1 from public.resident_activation_pins p
     where p.activation_handle = handle
       and p.failed_attempts = 5
       and p.locked_at is not null
  ), 'rotating candidates consume one credential budget';
  result := public.validate_resident_activation_pin_v2(handle, pin);
  assert not (result->>'valid')::boolean, 'locked credential rejects correct PIN';

  -- A legacy generator invoked after v2 must not leave a hybrid credential.
  result := public.generate_resident_activation_pins_locked_v1(c, array[q1]);
  assert exists (
    select 1 from public.resident_activation_pins p
     where p.queue_id = q1
       and p.credential_version = 1
       and p.activation_handle is null
       and p.visible_code is not null
       and p.failed_attempts = 0
       and p.locked_at is null
  ), 'legacy regeneration resets the row to an explicit v1 credential';

  select count(*) into event_count from public.security_event_log;
  result := public.validate_resident_activation_pin_v2(
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '123456'
  );
  assert result = '{"valid": false, "reason": "invalid_or_expired"}'::jsonb,
    'unknown handles use the same response';
  assert (select count(*) from public.security_event_log) = event_count,
    'unknown handles cannot create unbounded audit rows';

  select value into item
    from jsonb_array_elements(
      public.generate_resident_activation_pins_locked_v2(c, array[q2])->'items'
    ) limit 1;
  handle := (item->>'activation_id')::uuid;
  pin := item->>'pin';

  result := public.validate_resident_activation_pin_v2(handle, pin);
  assert (result->>'valid')::boolean, 'valid v2 credential validates';
  assert result->>'resident_name' = 'Synthetic Two', 'expected resident context returned';

  result := public.complete_resident_activation_pin_v2(
    handle, pin, 'Synthetic-Password-42!', null
  );
  assert (result->>'success')::boolean, 'valid credential completes';
  assert (select status from public.resident_activation_pins where activation_handle = handle) = 'used',
    'credential consumed';
  assert (select status from public.resident_activation_queue where id = q2) = 'activated',
    'queue activated';
  assert (select count(*) from auth.users) = 1, 'one auth identity created';
  assert (select count(*) from public.profiles) = 1, 'one profile created';
  assert (select count(*) from public.community_members) = 1, 'one membership created';
  assert (select count(*) from public.house_residents) = 1, 'one house link created';

  result := public.complete_resident_activation_pin_v2(
    handle, pin, 'Synthetic-Password-42!', null
  );
  assert result->>'error' = 'invalid_or_expired', 'replay is non-enumerating';
  assert (select count(*) from auth.users) = 1, 'replay creates no identity';

  assert not exists (
    select 1 from public.security_event_log e
     where coalesce(e.identifier, '') like '%' || pin || '%'
        or coalesce(e.identifier, '') like '%' || handle::text || '%'
        or coalesce(e.metadata::text, '') like '%' || pin || '%'
        or coalesce(e.metadata::text, '') like '%' || handle::text || '%'
  ), 'audit events contain neither credential component';

  -- Directly exercise expiry and revocation without exposing a credential.
  insert into public.resident_activation_queue(
    id, community_id, house_id, unit_label, resident_name,
    activation_method, status
  ) values
    ('10000000-0000-4000-8000-000000000110', c,
     '10000000-0000-4000-8000-000000000010', 'A-1', 'Expired', 'email', 'pending'),
    ('10000000-0000-4000-8000-000000000111', c,
     '10000000-0000-4000-8000-000000000010', 'A-1', 'Revoked', 'email', 'pending');
  insert into public.resident_activation_pins(
    queue_id, community_id, pin_hash, visible_code, status, expires_at,
    activation_handle, credential_version, revoked_at
  ) values
    ('10000000-0000-4000-8000-000000000110', c,
     extensions.crypt('333333', extensions.gen_salt('bf', 8)), null, 'pending',
     now() - interval '1 minute', '10000000-0000-4000-8000-000000000210', 2, null),
    ('10000000-0000-4000-8000-000000000111', c,
     extensions.crypt('444444', extensions.gen_salt('bf', 8)), null, 'pending',
     now() + interval '1 day', '10000000-0000-4000-8000-000000000211', 2, now());
  assert not (public.validate_resident_activation_pin_v2(
    '10000000-0000-4000-8000-000000000210', '333333'
  )->>'valid')::boolean, 'expired credential rejected';
  assert not (public.validate_resident_activation_pin_v2(
    '10000000-0000-4000-8000-000000000211', '444444'
  )->>'valid')::boolean, 'revoked credential rejected';

  assert has_function_privilege(
    'authenticated',
    'public.generate_resident_activation_pins_locked_v1(uuid,uuid[])',
    'EXECUTE'
  ), 'v1 generation compatibility retained';
  assert not has_function_privilege(
    'anon',
    'public.generate_resident_activation_pins_locked_v2(uuid,uuid[])',
    'EXECUTE'
  ), 'anonymous callers cannot generate credentials';
  assert has_function_privilege(
    'anon',
    'public.validate_resident_activation_pin_v2(uuid,text)',
    'EXECUTE'
  ), 'anonymous activation can validate v2';
end;
$test$;

select 'BEDROCK F03 activation v2 tests passed' as result;
