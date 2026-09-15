-- Allow ENTRY Outrider setup report generation after the customer-facing
-- report schema advanced from v1 to v2.
--
-- The report renderer/model now sends entry-outrider-setup-report-v2, while
-- the database reservation RPC still accepted only v1. That mismatch was
-- incorrectly surfaced as ENTRY_OUTRIDER_BLOCKING_FINDINGS even when workbook
-- analysis had zero errors. Keep the RPC contract service-role-only and all
-- existing workbook/fingerprint/findings guards intact; only advance the
-- accepted report schema version.

create or replace function public.prepare_community_outrider_setup_report_v1(
  p_outrider_id uuid,
  p_source_file_id uuid,
  p_report_schema_version text,
  p_workbook_schema_version text,
  p_source_sha256 text,
  p_input_sha256 text,
  p_parsed_snapshot jsonb,
  p_findings jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_outrider public.community_outrider_sessions%rowtype;
  v_source public.community_outrider_files%rowtype;
  v_latest_source_id uuid;
  v_report public.community_outrider_setup_reports%rowtype;
  v_next_version integer;
  v_pdf_storage_path text;
begin
  perform public._outrider_service_role_only_v1();
  perform public._outrider_validate_actor_v1(p_actor_user_id);

  select * into v_outrider
    from public.community_outrider_sessions
   where id = p_outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE', '42501');
  end if;

  if v_outrider.status = 'approved' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_APPROVED_LOCKED', 'P0409');
  end if;

  select * into v_source
    from public.community_outrider_files
   where id = p_source_file_id
     and outrider_id = v_outrider.id
     and category = 'setup_workbook';

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_INVALID_SETUP_WORKBOOK');
  end if;

  select f.id into v_latest_source_id
    from public.community_outrider_files f
   where f.outrider_id = v_outrider.id
     and f.category = 'setup_workbook'
   order by coalesce(f.uploaded_at, f.created_at) desc, f.created_at desc, f.id desc
   limit 1;

  if v_latest_source_id is distinct from v_source.id then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_WORKBOOK_STALE', 'P0409');
  end if;

  if p_report_schema_version <> 'entry-outrider-setup-report-v2'
     or p_workbook_schema_version <> 'entry-onboarding-workbook-v1'
     or p_source_sha256 !~ '^[a-f0-9]{64}$'
     or p_input_sha256 !~ '^[a-f0-9]{64}$'
     or p_source_sha256 is distinct from v_source.file_sha256
     or jsonb_typeof(p_parsed_snapshot) <> 'object'
     or jsonb_typeof(p_findings) <> 'array'
     or exists (
       select 1
       from jsonb_array_elements(p_findings) f
       where f->>'severity' = 'error'
     ) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_BLOCKING_FINDINGS', 'P0409');
  end if;

  update public.community_outrider_setup_reports
     set status = 'abandoned',
         abandoned_at = now()
   where outrider_id = v_outrider.id
     and status = 'generating'
     and generated_at < now() - interval '15 minutes';

  if exists (
    select 1
      from public.community_outrider_setup_reports r
     where r.outrider_id = v_outrider.id
       and r.status = 'generating'
  ) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_REPORT_GENERATION_IN_PROGRESS', 'P0409');
  end if;

  select coalesce(max(version), 0) + 1
    into v_next_version
    from public.community_outrider_setup_reports
   where outrider_id = v_outrider.id;

  v_pdf_storage_path := v_outrider.id::text
    || '/setup-reports/v'
    || v_next_version::text
    || '/report.pdf';

  insert into public.community_outrider_setup_reports (
    outrider_id,
    source_file_id,
    version,
    status,
    report_schema_version,
    workbook_schema_version,
    source_sha256,
    input_sha256,
    source_filename_snapshot,
    parsed_snapshot,
    findings,
    report_snapshot,
    pdf_storage_path,
    generated_by,
    generated_at
  )
  values (
    v_outrider.id,
    v_source.id,
    v_next_version,
    'generating',
    p_report_schema_version,
    p_workbook_schema_version,
    p_source_sha256,
    p_input_sha256,
    btrim(v_source.original_filename),
    p_parsed_snapshot,
    p_findings,
    '{}'::jsonb,
    v_pdf_storage_path,
    p_actor_user_id,
    now()
  )
  returning * into v_report;

  return jsonb_build_object(
    'accepted', true,
    'report_id', v_report.id,
    'version', v_report.version,
    'pdf_storage_path', v_report.pdf_storage_path
  );
exception
  when unique_violation then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_REPORT_GENERATION_IN_PROGRESS', 'P0409');
end;
$function$;

revoke all on function public.prepare_community_outrider_setup_report_v1(uuid, uuid, text, text, text, text, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_community_outrider_setup_report_v1(uuid, uuid, text, text, text, text, jsonb, jsonb, uuid)
  to service_role;

comment on function public.prepare_community_outrider_setup_report_v1(uuid, uuid, text, text, text, text, jsonb, jsonb, uuid) is
  'ENTRY internal RPC. Reserves the next immutable setup report version using report schema v2 and the current setup workbook only; service_role only.';
