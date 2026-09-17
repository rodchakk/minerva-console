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

-- Every lifecycle state must preserve a valid second row in the same transaction.
do $batch$
<<batch>>
declare
  c uuid := '11111111-1111-1111-1111-111111111111';
  h uuid := '33333333-3333-3333-3333-333333333333';
  state text;
  importer text;
  email text;
  fresh text;
  result jsonb;
  rows jsonb;
  original_id uuid;
begin
  perform set_config('test.superadmin','true',true);
  foreach importer in array array['canonical','legacy'] loop
    foreach state in array array['pending','invited','pin_generated','failed','activated','skipped'] loop
      email := importer || '-' || state || '@batch.example.com';
      fresh := 'new-' || email;
      insert into public.resident_activation_queue
        (community_id,house_id,unit_label,resident_name,email,activation_method,status)
        values(c,h,'10','Reserved Resident',email,'email',state) returning id into original_id;
      rows := jsonb_build_array(
        jsonb_build_object('unit_label','10','resident_name','Reserved Resident','email','  ' || upper(email) || '  '),
        jsonb_build_object('unit_label','10','resident_name','New Resident ' || state,'email',fresh));
      if importer = 'canonical' then
        result := public.confirm_resident_bulk_import_v1(c,rows,false);
      else
        result := public.create_resident_activation_queue_bulk_v1(c,rows);
      end if;
      assert (result->>'inserted_count')::int = case when state = 'skipped' then 2 else 1 end,
        importer || ': second batch row must insert for ' || state;
      assert (result->>'skipped_duplicates_count')::int = case when state = 'skipped' then 0 else 1 end;
      assert (result->>'failed_count')::int = 0;
      assert exists(select 1 from public.resident_activation_queue q where q.email = fresh);
      assert exists(select 1 from public.resident_activation_queue where id = original_id and status = state),
        'existing retry/delivery state is unchanged';
      assert (select count(*) from public.resident_activation_queue
        where lower(btrim(resident_activation_queue.email)) = batch.email and status <> 'skipped') = 1;
    end loop;
    rows := jsonb_build_array(
      jsonb_build_object('unit_label','Other House','resident_name','Someone Else','email','canonical-failed@batch.example.com'),
      jsonb_build_object('unit_label','10','resident_name','After conflict','email',importer || '-after-conflict@batch.example.com'));
    if importer = 'canonical' then
      result := public.confirm_resident_bulk_import_v1(c,rows,false);
    else
      result := public.create_resident_activation_queue_bulk_v1(c,rows);
    end if;
    assert (result->>'failed_count')::int = 1;
    assert (result->>'inserted_count')::int = 1, 'house identity conflict does not abort next row';
    rows := jsonb_build_array(
      jsonb_build_object('unit_label','20','resident_name','Reserved Resident','email','  CANONICAL-FAILED@BATCH.EXAMPLE.COM  '),
      jsonb_build_object('unit_label','20','resident_name','Foreign community new row','email',importer || '-foreign-new@batch.example.com'));
    if importer = 'canonical' then
      result := public.confirm_resident_bulk_import_v1('22222222-2222-2222-2222-222222222222',rows,false);
    else
      result := public.create_resident_activation_queue_bulk_v1('22222222-2222-2222-2222-222222222222',rows);
    end if;
    assert (result->>'failed_count')::int = 1;
    assert (result->>'inserted_count')::int = 1, 'global email conflict does not abort next row';
  end loop;
end;
$batch$;

-- Other unique constraints must still fail rather than silently skipping rows.
create unique index test_unrelated_unique on public.resident_activation_queue(resident_name)
  where resident_name = 'Unrelated Unique';
do $unrelated$
declare
  c uuid := '11111111-1111-1111-1111-111111111111';
  importer text;
  constraint_found text;
begin
  perform set_config('test.superadmin','true',true);
  insert into public.resident_activation_queue(community_id,unit_label,resident_name,email,status,activation_method)
    values(c,'10','Unrelated Unique','unrelated-first@example.com','pending','email');
  foreach importer in array array['canonical','legacy'] loop
    begin
      if importer = 'canonical' then
        perform public.confirm_resident_bulk_import_v1(c,
          '[{"unit_label":"10","resident_name":"Unrelated Unique","email":"unrelated-next@example.com"}]',false);
      else
        perform public.create_resident_activation_queue_bulk_v1(c,
          '[{"unit_label":"10","resident_name":"Unrelated Unique","email":"unrelated-next@example.com"}]');
      end if;
      raise exception 'unrelated violation was swallowed';
    exception when unique_violation then
      get stacked diagnostics constraint_found = constraint_name;
      assert constraint_found = 'test_unrelated_unique';
    end;
  end loop;
end;
$unrelated$;
drop index public.test_unrelated_unique;
