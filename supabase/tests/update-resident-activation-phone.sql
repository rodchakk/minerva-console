set test.superadmin = 'true';

do $test$
declare
  c uuid := '11111111-1111-1111-1111-111111111111';
  h uuid := '33333333-3333-3333-3333-333333333333';
  q uuid;
  result jsonb;
begin
  insert into public.resident_activation_queue
    (community_id, house_id, unit_label, resident_name, phone, email, activation_method, status)
  values
    (c, h, '10', 'Phone Edit Email Resident', '99990000', 'phone-edit@example.com', 'email', 'invited')
  returning id into q;

  insert into public.resident_activation_pins
    (queue_id, community_id, pin_hash, visible_code, status, expires_at)
  values
    (q, c, 'email-method-hash', '112233', 'pending', now() + interval '7 days');

  result := public.update_resident_activation_phone_v1(c, q, '+504 9999-1111');

  assert (result->>'success')::boolean, 'email resident phone edit succeeds';
  assert not (result->>'activation_reset')::boolean,
    'email activation is preserved when only phone changes';
  assert exists (
    select 1 from public.resident_activation_queue
     where id = q
       and phone = '+504 9999-1111'
       and status = 'invited'
       and activation_method = 'email'
  ), 'email queue state preserved';
  assert exists (
    select 1 from public.resident_activation_pins
     where queue_id = q and status = 'pending'
  ), 'email activation PIN remains valid';

  delete from public.resident_activation_pins where queue_id = q;
  delete from public.resident_activation_queue where id = q;

  insert into public.resident_activation_queue
    (community_id, house_id, unit_label, resident_name, phone, email, activation_method, status, invite_sent_at)
  values
    (c, h, '10', 'Phone PIN Resident', '99992222', null, 'phone_pin', 'invited', now())
  returning id into q;

  insert into public.resident_activation_pins
    (queue_id, community_id, pin_hash, visible_code, status, expires_at)
  values
    (q, c, 'phone-method-hash', '445566', 'pending', now() + interval '7 days');

  result := public.update_resident_activation_phone_v1(c, q, '99993333');

  assert (result->>'success')::boolean, 'phone PIN resident phone edit succeeds';
  assert (result->>'activation_reset')::boolean,
    'phone PIN activation resets after recipient change';
  assert (result->>'status') = 'pending', 'phone PIN queue returns to pending';
  assert exists (
    select 1 from public.resident_activation_queue
     where id = q
       and phone = '99993333'
       and status = 'pending'
       and invite_sent_at is null
  ), 'phone queue updated and invite reset';
  assert exists (
    select 1 from public.resident_activation_pins
     where queue_id = q and status = 'expired'
  ), 'old phone PIN invalidated';

  result := public.update_resident_activation_phone_v1(c, q, 'not-a-phone');
  assert result->>'error' = 'invalid_phone', 'invalid phone rejected';

  update public.resident_activation_queue set status = 'activated' where id = q;
  result := public.update_resident_activation_phone_v1(c, q, '99994444');
  assert result->>'error' = 'queue_row_terminal', 'activated resident cannot be edited';

  assert not has_function_privilege(
    'anon',
    'public.update_resident_activation_phone_v1(uuid,uuid,text)',
    'EXECUTE'
  );
  assert has_function_privilege(
    'authenticated',
    'public.update_resident_activation_phone_v1(uuid,uuid,text)',
    'EXECUTE'
  );
end;
$test$;
