set test.superadmin = 'true';

do $test$
declare
  c uuid := '11111111-1111-1111-1111-111111111111';
  h uuid := '33333333-3333-3333-3333-333333333333';
  q uuid;
  other_q uuid;
  campaign uuid;
  result jsonb;
begin
  insert into public.resident_activation_queue
    (community_id, house_id, unit_label, resident_name, email, activation_method, status, invite_sent_at)
  values
    (c, h, '10', 'Email Edit Resident', 'old-edit@example.com', 'email', 'invited', now())
  returning id into q;

  insert into public.resident_activation_pins
    (queue_id, community_id, pin_hash, visible_code, status, expires_at)
  values
    (q, c, 'test-hash', '123456', 'pending', now() + interval '7 days');

  result := public.update_resident_activation_email_v1(
    c, q, '  NEW-EDIT@EXAMPLE.COM  '
  );

  assert (result->>'success')::boolean, 'email edit succeeds';
  assert (result->>'changed')::boolean, 'email edit reports changed';
  assert result->>'email' = 'new-edit@example.com', 'email normalized';
  assert result->>'status' = 'pending', 'queue reset to pending';
  assert (result->>'pins_invalidated')::integer = 1, 'pending PIN invalidated';
  assert exists (
    select 1
      from public.resident_activation_queue
     where id = q
       and email = 'new-edit@example.com'
       and activation_method = 'email'
       and status = 'pending'
       and invite_sent_at is null
       and last_error is null
  ), 'queue identity updated';
  assert exists (
    select 1
      from public.resident_activation_pins
     where queue_id = q
       and status = 'expired'
  ), 'old PIN cannot be used';

  result := public.update_resident_activation_email_v1(
    c, q, 'new-edit@example.com'
  );
  assert (result->>'success')::boolean and not (result->>'changed')::boolean,
    'same normalized email is idempotent';

  insert into public.resident_activation_queue
    (community_id, house_id, unit_label, resident_name, email, activation_method, status)
  values
    (c, h, '10', 'Reserved Email Resident', 'reserved-edit@example.com', 'email', 'pending')
  returning id into other_q;

  result := public.update_resident_activation_email_v1(
    c, q, 'reserved-edit@example.com'
  );
  assert result->>'error' = 'email_already_reserved', 'queue reservation protected';
  assert exists (
    select 1 from public.resident_activation_queue
     where id = q and email = 'new-edit@example.com'
  ), 'conflict does not mutate queue';

  insert into auth.users(email) values ('registered-edit@example.com');
  result := public.update_resident_activation_email_v1(
    c, q, 'registered-edit@example.com'
  );
  assert result->>'error' = 'email_already_registered', 'Auth identity protected';

  update public.resident_activation_queue set status = 'activated' where id = q;
  result := public.update_resident_activation_email_v1(
    c, q, 'after-activation@example.com'
  );
  assert result->>'error' = 'queue_row_terminal', 'activated queue cannot be edited';
  update public.resident_activation_queue set status = 'pending' where id = q;

  insert into public.onboarding_campaigns
    (community_id, name, channel, status, send_rate_per_minute, dry_run, started_at)
  values
    (c, 'Email edit safety test', 'email', 'running', 10, true, now())
  returning id into campaign;

  insert into public.onboarding_campaign_messages
    (campaign_id, community_id, activation_queue_id, channel, recipient_email, resident_name, unit_label, status, dry_run)
  values
    (campaign, c, q, 'email', 'new-edit@example.com', 'Email Edit Resident', '10', 'pending', true);

  result := public.update_resident_activation_email_v1(
    c, q, 'campaign-edit@example.com'
  );
  assert (result->>'success')::boolean, 'pending campaign email can be corrected';
  assert (result->>'campaign_messages_updated')::integer = 1,
    'pending campaign snapshot updated';
  assert exists (
    select 1 from public.onboarding_campaign_messages
     where campaign_id = campaign
       and activation_queue_id = q
       and recipient_email = 'campaign-edit@example.com'
       and status = 'pending'
  ), 'pending campaign uses corrected email';

  update public.onboarding_campaign_messages
     set status = 'processing'
   where campaign_id = campaign and activation_queue_id = q;

  result := public.update_resident_activation_email_v1(
    c, q, 'blocked-during-send@example.com'
  );
  assert result->>'error' = 'campaign_send_in_progress',
    'in-flight campaign prevents identity mutation';
  assert exists (
    select 1 from public.resident_activation_queue
     where id = q and email = 'campaign-edit@example.com'
  ), 'in-flight rejection leaves queue unchanged';

  perform set_config('test.superadmin', 'false', true);
  begin
    perform public.update_resident_activation_email_v1(
      c, q, 'unauthorized-edit@example.com'
    );
    raise exception 'test failed: unauthorized email edit accepted';
  exception when insufficient_privilege then
    null;
  end;

  assert not has_function_privilege(
    'anon',
    'public.update_resident_activation_email_v1(uuid,uuid,text)',
    'EXECUTE'
  );
  assert has_function_privilege(
    'authenticated',
    'public.update_resident_activation_email_v1(uuid,uuid,text)',
    'EXECUTE'
  );
end;
$test$;
