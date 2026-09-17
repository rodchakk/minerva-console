set test.superadmin = 'true';
do $test$
declare
  c uuid := '11111111-1111-1111-1111-111111111111';
  h uuid := '33333333-3333-3333-3333-333333333333';
  first_result jsonb;
  result jsonb;
  state text;
begin
  first_result := public.prepare_resident_activation_invite_v1(c,h,'  Test Resident  ','  NORMALIZE@EXAMPLE.COM  ');
  assert (first_result->>'created')::boolean, 'active house accepted';
  assert first_result->>'email' = 'normalize@example.com', 'email normalized';
  assert first_result->>'status' = 'pending', 'canonical pending lifecycle';
  assert (select count(*) = 0 from auth.users), 'no premature Auth identity';
  foreach state in array array['pending','invited','pin_generated','failed'] loop
    update public.resident_activation_queue set status = state where id = (first_result->>'queue_id')::uuid;
    result := public.prepare_resident_activation_invite_v1(c,h,'Test Resident','normalize@example.com');
    assert result->>'queue_id' = first_result->>'queue_id', 'compatible state reused';
    assert not (result->>'created')::boolean, 'reuse is idempotent';
    assert result->>'status' = state, 'preparation does not change PIN/email lifecycle';
  end loop;
  update public.resident_activation_queue set status = 'activated' where id = (first_result->>'queue_id')::uuid;
  result := public.prepare_resident_activation_invite_v1(c,h,'Test Resident','normalize@example.com');
  assert result->>'error' = 'resident_activation_conflict', 'activated state reserved';
  update public.resident_activation_queue set status = 'skipped' where id = (first_result->>'queue_id')::uuid;
  result := public.prepare_resident_activation_invite_v1(c,h,'Test Resident','normalize@example.com');
  assert (result->>'created')::boolean, 'skipped history may be superseded';
  assert result->>'queue_id' <> first_result->>'queue_id', 'skipped history preserved';

  result := public.prepare_resident_activation_invite_v1(c,h,'Other Person','normalize@example.com');
  assert result->>'error' = 'resident_activation_conflict', 'different resident cannot claim email';
  result := public.prepare_resident_activation_invite_v1(c,h,'Test Resident','different@example.com');
  assert result->>'error' = 'resident_activation_conflict', 'same resident/unit with different email conflicts';
  result := public.prepare_resident_activation_invite_v1('22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555','Test Resident','normalize@example.com');
  assert result->>'error' = 'resident_activation_conflict', 'email reservation is global';

  insert into auth.users(email) values ('active@example.com');
  result := public.prepare_resident_activation_invite_v1(c,h,'Active Resident','active@example.com');
  assert result->>'error' = 'email_already_registered', 'existing account conflicts';
  assert not exists (select 1 from public.resident_activation_queue where email = 'active@example.com');

  begin
    perform public.prepare_resident_activation_invite_v1(c,'44444444-4444-4444-4444-444444444444','Inactive','inactive@example.com');
    raise exception 'test failed: inactive house accepted';
  exception when raise_exception then assert sqlerrm = 'house_inactive'; end;
  begin
    perform public.prepare_resident_activation_invite_v1(c,'55555555-5555-5555-5555-555555555555','Wrong community','wrong@example.com');
    raise exception 'test failed: foreign house accepted';
  exception when raise_exception then assert sqlerrm = 'house_not_in_community'; end;
  begin
    perform public.prepare_resident_activation_invite_v1(c,h,'Blank email','   ');
    raise exception 'test failed: whitespace email accepted';
  exception when raise_exception then assert sqlerrm = 'invalid_resident_invite'; end;
  begin
    perform public.prepare_resident_activation_invite_v1(c,h,'Invalid email','invalid');
    raise exception 'test failed: invalid email accepted';
  exception when raise_exception then assert sqlerrm = 'invalid_resident_invite'; end;

  perform set_config('test.superadmin','false',true);
  begin
    perform public.prepare_resident_activation_invite_v1(c,h,'Unauthorized','unauthorized@example.com');
    raise exception 'test failed: unauthorized accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('test.superadmin','true',true);

  assert not has_function_privilege('anon','public.prepare_resident_activation_invite_v1(uuid,uuid,text,text,text)','EXECUTE');
  assert has_function_privilege('authenticated','public.prepare_resident_activation_invite_v1(uuid,uuid,text,text,text)','EXECUTE');
  result := public.confirm_resident_bulk_import_v1(c,'[{"unit_label":"10","resident_name":"Bulk One","email":"bulk-one@example.com"}]',false);
  assert (result->>'inserted_count')::integer = 1, 'canonical bulk works';
  result := public.create_resident_activation_queue_bulk_v1(c,'[{"unit_label":"10","resident_name":"Bulk Two","email":"bulk-two@example.com"}]');
  assert (result->>'inserted_count')::integer = 1, 'legacy bulk works';
  assert exists (select 1 from public.test_audit where action = 'prepare_resident_activation_invite_v1'), 'audit reused';
  assert exists (select 1 from pg_indexes where indexname = 'ux_raq_community_registration_resident'), 'registration structural index preserved';
end;
$test$;
