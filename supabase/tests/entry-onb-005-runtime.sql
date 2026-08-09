begin;

select set_config('request.jwt.claim.role', 'service_role', true);

create table pg_temp.runtime_assertions (
  step text primary key,
  detail text,
  checked_at timestamptz not null default now()
);

create table pg_temp.runtime_state (
  key text primary key,
  value text not null
);

create table pg_temp.runtime_baseline (
  table_name text primary key,
  row_count bigint not null
);

create table pg_temp.runtime_baseline_raq_ids (
  id uuid primary key
);

create or replace function pg_temp.note(p_step text, p_detail text default null)
returns void
language plpgsql
as $function$
begin
  insert into pg_temp.runtime_assertions(step, detail)
  values (p_step, p_detail)
  on conflict (step) do update
    set detail = excluded.detail,
        checked_at = now();
end;
$function$;

create or replace function pg_temp.assert_true(
  p_step text,
  p_condition boolean,
  p_detail text default null
)
returns void
language plpgsql
as $function$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ENTRY_ONB_005_ASSERTION_FAILED: % %', p_step, coalesce(p_detail, '');
  end if;

  perform pg_temp.note(p_step, p_detail);
end;
$function$;

create or replace function pg_temp.assert_equals(
  p_step text,
  p_actual text,
  p_expected text
)
returns void
language plpgsql
as $function$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ENTRY_ONB_005_ASSERTION_FAILED: % expected %, got %',
      p_step,
      p_expected,
      coalesce(p_actual, '<null>');
  end if;

  perform pg_temp.note(p_step, 'expected=' || p_expected);
end;
$function$;

create or replace function pg_temp.expect_error(
  p_step text,
  p_sql text,
  p_expected_message text default null
)
returns void
language plpgsql
as $function$
declare
  v_message text;
begin
  begin
    execute p_sql;
  exception
    when others then
      v_message := sqlerrm;

      if p_expected_message is null or position(p_expected_message in v_message) > 0 then
        perform pg_temp.note(p_step, v_message);
        return;
      end if;

      raise exception 'ENTRY_ONB_005_ASSERTION_FAILED: % expected error %, got %',
        p_step,
        p_expected_message,
        v_message;
  end;

  raise exception 'ENTRY_ONB_005_ASSERTION_FAILED: % expected an error', p_step;
end;
$function$;

insert into pg_temp.runtime_baseline(table_name, row_count)
values
  ('auth.users', (select count(*) from auth.users)),
  ('profiles', (select count(*) from public.profiles)),
  ('community_members', (select count(*) from public.community_members)),
  ('house_residents', (select count(*) from public.house_residents)),
  ('resident_activation_pins', (select count(*) from public.resident_activation_pins)),
  ('resident_activation_queue', (select count(*) from public.resident_activation_queue));

insert into pg_temp.runtime_baseline_raq_ids(id)
select id
from public.resident_activation_queue;

select pg_temp.assert_equals('baseline auth.users', (select row_count::text from pg_temp.runtime_baseline where table_name = 'auth.users'), '313');
select pg_temp.assert_equals('baseline profiles', (select row_count::text from pg_temp.runtime_baseline where table_name = 'profiles'), '304');
select pg_temp.assert_equals('baseline community_members', (select row_count::text from pg_temp.runtime_baseline where table_name = 'community_members'), '303');
select pg_temp.assert_equals('baseline house_residents', (select row_count::text from pg_temp.runtime_baseline where table_name = 'house_residents'), '332');
select pg_temp.assert_equals('baseline resident_activation_pins', (select row_count::text from pg_temp.runtime_baseline where table_name = 'resident_activation_pins'), '63');
select pg_temp.assert_equals('baseline resident_activation_queue', (select row_count::text from pg_temp.runtime_baseline where table_name = 'resident_activation_queue'), '194');

select pg_temp.assert_equals(
  'baseline RAQ legacy source ids null',
  (select count(*)::text from public.resident_activation_queue where community_registration_resident_id is null),
  '194'
);

select pg_temp.assert_equals(
  'baseline RAQ activated',
  (select count(*)::text from public.resident_activation_queue where status = 'activated'),
  '15'
);
select pg_temp.assert_equals(
  'baseline RAQ invited',
  (select count(*)::text from public.resident_activation_queue where status = 'invited'),
  '29'
);
select pg_temp.assert_equals(
  'baseline RAQ pending',
  (select count(*)::text from public.resident_activation_queue where status = 'pending'),
  '132'
);
select pg_temp.assert_equals(
  'baseline RAQ pin_generated',
  (select count(*)::text from public.resident_activation_queue where status = 'pin_generated'),
  '18'
);
select pg_temp.assert_equals(
  'baseline RAQ excel_import',
  (select count(*)::text from public.resident_activation_queue where source = 'excel_import'),
  '20'
);
select pg_temp.assert_equals(
  'baseline RAQ excel_import_v2',
  (select count(*)::text from public.resident_activation_queue where source = 'excel_import_v2'),
  '174'
);

do $runtime$
declare
  v_run_id uuid := gen_random_uuid();
  v_marker text := 'ENTRY-ONB-005-RUNTIME';
  v_actor_id uuid;
  v_community_id uuid;
  v_foreign_community_id uuid;
  v_house_1_id uuid;
  v_house_2_id uuid;
  v_foreign_house_id uuid;
  v_campaign_id uuid;
  v_foreign_campaign_id uuid;
  v_unit_1_id uuid;
  v_unit_2_id uuid;
  v_foreign_unit_id uuid;
  v_slug text;
  v_foreign_slug text;
  v_campaign_hash text;
  v_foreign_campaign_hash text;
  v_patronato_hash text;
  v_edit_hash text;
  v_expired_edit_hash text;
  v_json jsonb;
  v_resident_id uuid;
  v_before_raq bigint;
  v_after_raq bigint;
begin
  select id into v_actor_id
  from auth.users
  where deleted_at is null
  order by created_at nulls last, id
  limit 1;

  perform pg_temp.assert_true('actor UUID selected dynamically', v_actor_id is not null, 'auth.users.id only');

  v_slug := 'entry-onb-005-runtime-' || replace(v_run_id::text, '-', '');
  v_foreign_slug := 'entry-onb-005-runtime-foreign-' || replace(v_run_id::text, '-', '');
  v_campaign_hash := md5(v_marker || ':campaign:' || v_run_id::text) || md5(v_run_id::text || ':campaign');
  v_foreign_campaign_hash := md5(v_marker || ':foreign-campaign:' || v_run_id::text) || md5(v_run_id::text || ':foreign-campaign');
  v_patronato_hash := md5(v_marker || ':patronato:' || v_run_id::text) || md5(v_run_id::text || ':patronato');
  v_edit_hash := md5(v_marker || ':edit:' || v_run_id::text) || md5(v_run_id::text || ':edit');
  v_expired_edit_hash := md5(v_marker || ':expired-edit:' || v_run_id::text) || md5(v_run_id::text || ':expired-edit');

  insert into pg_temp.runtime_state(key, value)
  values
    ('run_id', v_run_id::text),
    ('actor_id', v_actor_id::text),
    ('campaign_hash', v_campaign_hash),
    ('patronato_hash', v_patronato_hash),
    ('edit_hash', v_edit_hash);

  insert into public.communities(name, community_code, city, created_by, unit_label)
  values (
    'Runtime Test Community ' || v_marker || ' ' || left(v_run_id::text, 8),
    'RT' || upper(left(replace(v_run_id::text, '-', ''), 10)),
    'Runtime Test City',
    v_actor_id,
    'Casa'
  )
  returning id into v_community_id;

  insert into public.communities(name, community_code, city, created_by, unit_label)
  values (
    'Runtime Test Community Foreign ' || v_marker || ' ' || left(v_run_id::text, 8),
    'RF' || upper(left(replace(v_run_id::text, '-', ''), 10)),
    'Runtime Test City',
    v_actor_id,
    'Casa'
  )
  returning id into v_foreign_community_id;

  insert into public.houses(community_id, house_label, owner_name)
  values
    (v_community_id, 'Casa RT-001 ' || left(v_run_id::text, 8), 'Ana Runtime Owner')
  returning id into v_house_1_id;

  insert into public.houses(community_id, house_label, owner_name)
  values
    (v_community_id, 'Casa RT-002 ' || left(v_run_id::text, 8), 'Carlos Runtime Owner')
  returning id into v_house_2_id;

  insert into public.houses(community_id, house_label, owner_name)
  values
    (v_foreign_community_id, 'Casa RT-999 ' || left(v_run_id::text, 8), 'Foreign Runtime Owner')
  returning id into v_foreign_house_id;

  v_json := public.create_community_registration_campaign_v1(
    v_community_id,
    'Runtime Test Campaign ' || v_marker,
    'Runtime Test Campaign',
    'Synthetic runtime harness only',
    v_slug,
    3,
    now() - interval '5 minutes',
    now() + interval '2 hours',
    v_campaign_hash,
    v_actor_id
  );
  v_campaign_id := (v_json->>'campaign_id')::uuid;
  perform pg_temp.assert_equals('create campaign status', v_json->>'status', 'open');

  v_json := public.create_community_registration_campaign_v1(
    v_foreign_community_id,
    'Runtime Test Foreign Campaign ' || v_marker,
    'Runtime Test Foreign Campaign',
    'Synthetic runtime harness only',
    v_foreign_slug,
    2,
    now() - interval '5 minutes',
    now() + interval '2 hours',
    v_foreign_campaign_hash,
    v_actor_id
  );
  v_foreign_campaign_id := (v_json->>'campaign_id')::uuid;

  v_json := public.add_community_registration_units_v1(
    v_campaign_id,
    array[v_house_1_id, v_house_2_id],
    '{}'::jsonb,
    v_actor_id
  );
  perform pg_temp.assert_equals('add two units inserted', v_json->>'inserted_count', '2');

  select id into v_unit_1_id
  from public.community_registration_units
  where campaign_id = v_campaign_id
    and house_id = v_house_1_id;

  select id into v_unit_2_id
  from public.community_registration_units
  where campaign_id = v_campaign_id
    and house_id = v_house_2_id;

  v_json := public.add_community_registration_units_v1(
    v_foreign_campaign_id,
    array[v_foreign_house_id],
    '{}'::jsonb,
    v_actor_id
  );
  perform pg_temp.assert_equals('add foreign unit inserted', v_json->>'inserted_count', '1');

  select id into v_foreign_unit_id
  from public.community_registration_units
  where campaign_id = v_foreign_campaign_id
    and house_id = v_foreign_house_id;

  perform pg_temp.assert_true('unit ids captured', v_unit_1_id is not null and v_unit_2_id is not null, null);

  v_json := public.resolve_community_registration_campaign_v1(v_slug, v_campaign_hash);
  perform pg_temp.assert_equals('resolve campaign available', v_json->>'available', 'true');

  v_json := public.resolve_community_registration_campaign_v1('missing-' || v_slug, v_campaign_hash);
  perform pg_temp.assert_equals('negative missing slug unavailable', v_json->>'available', 'false');

  v_json := public.resolve_community_registration_campaign_v1(v_slug, 'wrong-' || v_campaign_hash);
  perform pg_temp.assert_equals('negative wrong campaign token unavailable', v_json->>'available', 'false');

  v_json := public.lookup_community_registration_unit_v1(v_slug, v_campaign_hash, 'Casa RT-001 ' || left(v_run_id::text, 8));
  perform pg_temp.assert_equals('lookup unit can start', v_json->>'can_start', 'true');

  v_json := public.lookup_community_registration_unit_v1(v_slug, v_campaign_hash, 'Casa Missing ' || left(v_run_id::text, 8));
  perform pg_temp.assert_equals('negative missing unit cannot start', v_json->>'can_start', 'false');

  perform pg_temp.expect_error(
    'negative resident limit exceeded',
    format(
      $sql$select public.submit_community_registration_household_v1(%L, %L, %L, %L::jsonb, '{"marker":"ENTRY-ONB-005-RUNTIME"}'::jsonb)$sql$,
      v_slug,
      v_campaign_hash,
      'Casa RT-001 ' || left(v_run_id::text, 8),
      jsonb_build_array(
        jsonb_build_object('position', 1, 'full_name', 'Ana Runtime', 'email', 'ana.runtime@example.invalid', 'phone', '+50400000001', 'relationship_to_house', 'owner', 'is_owner_reference', true),
        jsonb_build_object('position', 2, 'full_name', 'Carlos Runtime', 'email', 'carlos.runtime@example.invalid', 'phone', '+50400000002', 'relationship_to_house', 'family'),
        jsonb_build_object('position', 3, 'full_name', 'Dina Runtime', 'email', 'dina.runtime@example.invalid', 'phone', '+50400000003', 'relationship_to_house', 'family'),
        jsonb_build_object('position', 4, 'full_name', 'Elena Runtime', 'email', 'elena.runtime@example.invalid', 'phone', '+50400000004', 'relationship_to_house', 'family')
      )::text
    ),
    'ENTRY_CR_LIMIT_EXCEEDED'
  );

  perform pg_temp.expect_error(
    'negative invalid resident payload',
    format(
      $sql$select public.submit_community_registration_household_v1(%L, %L, %L, %L::jsonb, '{"marker":"ENTRY-ONB-005-RUNTIME"}'::jsonb)$sql$,
      v_slug,
      v_campaign_hash,
      'Casa RT-001 ' || left(v_run_id::text, 8),
      jsonb_build_array(jsonb_build_object('position', 1, 'email', 'invalid.runtime@example.invalid'))::text
    ),
    'ENTRY_CR_INVALID_RESIDENT'
  );

  v_json := public.submit_community_registration_household_v1(
    v_slug,
    v_campaign_hash,
    'Casa RT-001 ' || left(v_run_id::text, 8),
    jsonb_build_array(
      jsonb_build_object('position', 1, 'full_name', 'Ana Runtime', 'email', 'ana.runtime@example.invalid', 'phone', '+50400000001', 'relationship_to_house', 'owner', 'is_owner_reference', true),
      jsonb_build_object('position', 2, 'full_name', 'Carlos Runtime', 'email', null, 'phone', '+50400000002', 'relationship_to_house', 'family')
    ),
    jsonb_build_object('marker', v_marker, 'case', 'initial-main')
  );
  perform pg_temp.assert_equals('submit unit 1 accepted', v_json->>'accepted', 'true');

  v_json := public.submit_community_registration_household_v1(
    v_slug,
    v_campaign_hash,
    'Casa RT-002 ' || left(v_run_id::text, 8),
    jsonb_build_array(
      jsonb_build_object('position', 1, 'full_name', 'Reset Runtime', 'email', 'reset.runtime@example.invalid', 'phone', '+50400000003', 'relationship_to_house', 'tenant')
    ),
    jsonb_build_object('marker', v_marker, 'case', 'secondary-reset')
  );
  perform pg_temp.assert_equals('submit unit 2 accepted', v_json->>'accepted', 'true');

  v_json := public.get_community_registration_unit_state_v1(v_unit_1_id);
  perform pg_temp.assert_equals('unit state submitted', v_json->>'status', 'submitted');
  perform pg_temp.assert_equals('unit state resident count', jsonb_array_length(v_json->'current_residents')::text, '2');

  v_json := public.start_community_registration_review_v1(v_campaign_id, v_actor_id);
  perform pg_temp.assert_equals('start review status', v_json->>'campaign_status', 'review');

  v_json := public.create_community_registration_patronato_access_v1(
    v_campaign_id,
    v_patronato_hash,
    now() + interval '2 hours',
    v_actor_id
  );
  perform pg_temp.assert_true('patronato access created', (v_json->>'patronato_access_id')::uuid is not null, null);

  v_json := public.resolve_community_registration_patronato_access_v1(v_patronato_hash);
  perform pg_temp.assert_equals('resolve patronato valid', v_json->>'valid', 'true');

  perform pg_temp.expect_error(
    'negative wrong patronato token',
    format($sql$select public.resolve_community_registration_patronato_access_v1(%L)$sql$, 'wrong-' || v_patronato_hash),
    'ENTRY_CR_PATRONATO_ACCESS_INVALID'
  );

  v_json := public.list_community_registration_review_units_v1(v_campaign_id, null, null, null, 50, 0);
  perform pg_temp.assert_equals('review list has two units', jsonb_array_length(v_json->'units')::text, '2');

  v_json := public.get_community_registration_review_summary_v1(v_campaign_id, null);
  perform pg_temp.assert_equals('review summary total units', v_json->>'total_units', '2');

  v_json := public.get_community_registration_review_unit_v1(v_campaign_id, v_unit_1_id, null);
  perform pg_temp.assert_equals('review detail unit status', v_json->>'status', 'submitted');

  perform pg_temp.expect_error(
    'negative cross campaign unit rejected',
    format(
      $sql$select public.request_community_registration_correction_v1(%L::uuid, %L::uuid, %L, %L::uuid, null)$sql$,
      v_campaign_id,
      v_foreign_unit_id,
      'Cross campaign should fail ' || v_marker,
      v_actor_id
    ),
    'ENTRY_CR_INVALID_UNIT'
  );

  v_json := public.request_community_registration_correction_v1(
    v_campaign_id,
    v_unit_1_id,
    'Correct synthetic phone formatting ' || v_marker,
    null,
    v_patronato_hash
  );
  perform pg_temp.assert_equals('correction requested status', v_json->>'status', 'needs_correction');

  perform pg_temp.expect_error(
    'negative resubmit without valid edit token',
    format(
      $sql$select public.resubmit_community_registration_household_v1(%L, %L::jsonb)$sql$,
      'wrong-' || v_edit_hash,
      jsonb_build_array(jsonb_build_object('position', 1, 'full_name', 'Ana Runtime', 'email', 'ana.runtime@example.invalid', 'phone', '+50400000001', 'relationship_to_house', 'owner', 'is_owner_reference', true))::text
    ),
    'ENTRY_CR_INVALID_TOKEN'
  );

  insert into public.community_registration_access_tokens(
    campaign_id,
    campaign_unit_id,
    submission_id,
    token_type,
    token_hash,
    status,
    expires_at,
    created_at,
    created_by
  )
  select
    v_campaign_id,
    v_unit_1_id,
    s.id,
    'resident_edit',
    v_expired_edit_hash,
    'active',
    now() - interval '1 minute',
    now() - interval '2 minutes',
    v_actor_id
  from public.community_registration_submissions s
  where s.campaign_unit_id = v_unit_1_id
    and s.status = 'submitted'
  order by s.version_number desc
  limit 1;

  perform pg_temp.expect_error(
    'negative expired edit token',
    format($sql$select public.resolve_community_registration_edit_v1(%L)$sql$, v_expired_edit_hash),
    'ENTRY_CR_INVALID_TOKEN'
  );

  v_json := public.enable_community_registration_edit_v1(
    v_unit_1_id,
    v_edit_hash,
    now() + interval '1 hour',
    v_actor_id,
    'Synthetic correction edit ' || v_marker
  );
  perform pg_temp.assert_true('edit enabled token id present', (v_json->>'edit_token_id')::uuid is not null, null);

  v_json := public.resolve_community_registration_edit_v1(v_edit_hash);
  perform pg_temp.assert_equals('resolve edit residents', jsonb_array_length(v_json->'residents')::text, '2');

  v_json := public.resubmit_community_registration_household_v1(
    v_edit_hash,
    jsonb_build_array(
      jsonb_build_object('position', 1, 'full_name', 'Ana Runtime', 'email', 'ana.runtime@example.invalid', 'phone', '+50400000001', 'relationship_to_house', 'owner', 'is_owner_reference', true),
      jsonb_build_object('position', 2, 'full_name', 'Carlos Runtime', 'email', null, 'phone', '+50400000022', 'relationship_to_house', 'family')
    )
  );
  perform pg_temp.assert_equals('resubmit accepted', v_json->>'accepted', 'true');

  v_json := public.mark_community_registration_unit_reviewed_v1(v_unit_1_id, v_actor_id);
  perform pg_temp.assert_equals('unit reviewed status', v_json->>'status', 'reviewed');

  v_json := public.confirm_community_registration_unit_v1(v_campaign_id, v_unit_1_id, v_patronato_hash);
  perform pg_temp.assert_equals('unit confirmed status', v_json->>'status', 'confirmed');

  perform pg_temp.expect_error(
    'negative campaign confirmation with pending unit',
    format($sql$select public.confirm_community_registration_campaign_v1(%L::uuid, %L)$sql$, v_campaign_id, v_patronato_hash),
    'ENTRY_CR_CAMPAIGN_INCOMPLETE'
  );

  perform pg_temp.expect_error(
    'negative conversion before campaign confirmation',
    format($sql$select public.convert_community_registration_unit_to_activation_v1(%L::uuid, %L::uuid, %L)$sql$, v_unit_1_id, v_actor_id, 'too early ' || v_marker),
    'ENTRY_CR_CONVERSION_NOT_READY'
  );

  v_json := public.reset_community_registration_unit_v1(v_unit_2_id, v_actor_id, 'Synthetic reset ' || v_marker);
  perform pg_temp.assert_equals('secondary unit reset', v_json->>'status', 'unregistered');

  v_json := public.authorize_incomplete_campaign_confirmation_v1(
    v_campaign_id,
    v_actor_id,
    'Authorize one synthetic unregistered unit ' || v_marker
  );
  perform pg_temp.assert_equals('incomplete authorization count', v_json->>'unregistered_count', '1');

  v_json := public.confirm_community_registration_campaign_v1(v_campaign_id, v_patronato_hash);
  perform pg_temp.assert_equals('campaign confirmed status', v_json->>'campaign_status', 'confirmed');
  perform pg_temp.assert_equals('campaign approved residents', v_json->>'approved_resident_count', '2');

  v_json := public.list_community_registration_units_pending_conversion_v1(v_campaign_id, 50, 0, v_actor_id);
  perform pg_temp.assert_equals('pending conversion units', jsonb_array_length(v_json->'units')::text, '1');

  v_json := public.preview_community_registration_unit_conversion_v1(v_unit_1_id, v_actor_id);
  perform pg_temp.assert_equals('preview eligible', v_json->>'eligible', 'true');
  perform pg_temp.assert_equals('preview resident count', jsonb_array_length(v_json->'residents')::text, '2');

  select row_count into v_before_raq
  from pg_temp.runtime_baseline
  where table_name = 'resident_activation_queue';

  v_json := public.convert_community_registration_unit_to_activation_v1(
    v_unit_1_id,
    v_actor_id,
    'Synthetic conversion ' || v_marker
  );
  perform pg_temp.assert_equals('conversion processed status', v_json->>'status', 'processed');
  perform pg_temp.assert_equals('conversion converted count', v_json->>'converted_count', '2');

  select count(*) into v_after_raq
  from public.resident_activation_queue;
  perform pg_temp.assert_equals('RAQ delta after conversion', (v_after_raq - v_before_raq)::text, '2');

  v_json := public.convert_community_registration_unit_to_activation_v1(
    v_unit_1_id,
    v_actor_id,
    'Synthetic conversion replay ' || v_marker
  );
  perform pg_temp.assert_equals('conversion replay already complete', v_json->>'already_complete', 'true');
  perform pg_temp.assert_equals('RAQ stable after replay', (select (count(*) - v_before_raq)::text from public.resident_activation_queue), '2');

  v_json := public.get_community_registration_conversion_result_v1(v_unit_1_id, v_actor_id);
  perform pg_temp.assert_equals('conversion result unit status', v_json->>'unit_status', 'processed');
  perform pg_temp.assert_equals('conversion result residents', jsonb_array_length(v_json->'residents')::text, '2');

  select (v_json->'residents'->0->>'resident_id')::uuid into v_resident_id;

  perform pg_temp.expect_error(
    'negative duplicate RAQ source row',
    format(
      $sql$
        insert into public.resident_activation_queue (
          community_id,
          house_id,
          unit_label,
          resident_name,
          phone,
          email,
          activation_method,
          status,
          source,
          raw_data,
          created_by,
          community_registration_resident_id
        )
        values (%L::uuid, %L::uuid, %L, 'Duplicate Runtime', '+50400000999', 'duplicate.runtime@example.invalid', 'email', 'pending', 'community_registration_v1', '{"marker":"ENTRY-ONB-005-RUNTIME"}'::jsonb, %L::uuid, %L::uuid)
      $sql$,
      v_community_id,
      v_house_1_id,
      'Casa RT-001 ' || left(v_run_id::text, 8),
      v_actor_id,
      v_resident_id
    ),
    'duplicate key'
  );

  perform pg_temp.assert_equals(
    'unit 2 residents not converted',
    (
      select count(*)::text
      from public.community_registration_residents r
      where r.campaign_unit_id = v_unit_2_id
        and r.conversion_status = 'not_ready'
        and r.activation_queue_id is null
    ),
    '1'
  );

  v_json := public.mark_community_registration_campaign_processed_v1(v_campaign_id, v_actor_id);
  perform pg_temp.assert_equals('campaign processed status', v_json->>'status', 'processed');

  perform pg_temp.assert_true(
    'event traceability campaign processed',
    not exists (
      select 1
      from (
        values
          ('campaign_created'),
          ('units_added'),
          ('household_submitted'),
          ('campaign_review_started'),
          ('patronato_access_created'),
          ('correction_requested'),
          ('resident_edit_enabled'),
          ('household_resubmitted'),
          ('unit_reviewed'),
          ('unit_confirmed'),
          ('registration_reset'),
          ('incomplete_confirmation_authorized'),
          ('campaign_confirmed'),
          ('resident_conversion_created'),
          ('unit_conversion_completed'),
          ('campaign_processing_completed')
      ) as required(event_type)
      where not exists (
        select 1
        from public.community_registration_events e
        where e.campaign_id = v_campaign_id
          and e.event_type = required.event_type
      )
    ),
    'all required event types exist'
  );
end;
$runtime$;

select set_config('request.jwt.claim.role', 'anon', true);

select pg_temp.expect_error(
  'negative unauthorized role execution',
  $$select public.get_community_registration_unit_state_v1((select id from public.community_registration_units limit 1))$$,
  'ENTRY_CR_UNAUTHORIZED'
);

select set_config('request.jwt.claim.role', 'service_role', true);

select pg_temp.assert_equals(
  'no auth.users delta',
  ((select count(*) from auth.users) - (select row_count from pg_temp.runtime_baseline where table_name = 'auth.users'))::text,
  '0'
);
select pg_temp.assert_equals(
  'no profiles delta',
  ((select count(*) from public.profiles) - (select row_count from pg_temp.runtime_baseline where table_name = 'profiles'))::text,
  '0'
);
select pg_temp.assert_equals(
  'no community_members delta',
  ((select count(*) from public.community_members) - (select row_count from pg_temp.runtime_baseline where table_name = 'community_members'))::text,
  '0'
);
select pg_temp.assert_equals(
  'no house_residents delta',
  ((select count(*) from public.house_residents) - (select row_count from pg_temp.runtime_baseline where table_name = 'house_residents'))::text,
  '0'
);
select pg_temp.assert_equals(
  'no resident_activation_pins delta',
  ((select count(*) from public.resident_activation_pins) - (select row_count from pg_temp.runtime_baseline where table_name = 'resident_activation_pins'))::text,
  '0'
);
select pg_temp.assert_equals(
  'synthetic RAQ delta only',
  ((select count(*) from public.resident_activation_queue) - (select row_count from pg_temp.runtime_baseline where table_name = 'resident_activation_queue'))::text,
  '2'
);
select pg_temp.assert_equals(
  'baseline RAQ ids still source null',
  (
    select count(*)::text
    from public.resident_activation_queue q
    join pg_temp.runtime_baseline_raq_ids b on b.id = q.id
    where q.community_registration_resident_id is null
  ),
  '194'
);
select pg_temp.assert_equals(
  'synthetic RAQ rows linked',
  (
    select count(*)::text
    from public.resident_activation_queue q
    left join pg_temp.runtime_baseline_raq_ids b on b.id = q.id
    where b.id is null
      and q.source = 'community_registration_v1'
      and q.community_registration_resident_id is not null
  ),
  '2'
);
select pg_temp.assert_equals(
  'synthetic RAQ rows pending',
  (
    select count(*)::text
    from public.resident_activation_queue q
    left join pg_temp.runtime_baseline_raq_ids b on b.id = q.id
    where b.id is null
      and q.status = 'pending'
  ),
  '2'
);

select jsonb_pretty(jsonb_build_object(
  'marker', 'ENTRY-ONB-005-RUNTIME',
  'run_id', (select value from pg_temp.runtime_state where key = 'run_id'),
  'assertions_passed', (select count(*) from pg_temp.runtime_assertions),
  'deltas_before_rollback', jsonb_build_object(
    'auth.users', ((select count(*) from auth.users) - (select row_count from pg_temp.runtime_baseline where table_name = 'auth.users')),
    'profiles', ((select count(*) from public.profiles) - (select row_count from pg_temp.runtime_baseline where table_name = 'profiles')),
    'community_members', ((select count(*) from public.community_members) - (select row_count from pg_temp.runtime_baseline where table_name = 'community_members')),
    'house_residents', ((select count(*) from public.house_residents) - (select row_count from pg_temp.runtime_baseline where table_name = 'house_residents')),
    'resident_activation_pins', ((select count(*) from public.resident_activation_pins) - (select row_count from pg_temp.runtime_baseline where table_name = 'resident_activation_pins')),
    'resident_activation_queue', ((select count(*) from public.resident_activation_queue) - (select row_count from pg_temp.runtime_baseline where table_name = 'resident_activation_queue'))
  ),
  'assertion_steps', (
    select jsonb_agg(step order by checked_at, step)
    from pg_temp.runtime_assertions
  )
)) as entry_onb_005_runtime_summary;

rollback;
