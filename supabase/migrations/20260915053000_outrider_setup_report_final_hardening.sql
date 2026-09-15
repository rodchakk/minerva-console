-- Final hardening for ENTRY Outrider preliminary setup reports.
--
-- 1) Setup-workflow state errors use a dedicated SQLSTATE so the server action
--    error mapper does not misclassify them as generic Outrider conflicts.
-- 2) Setup-report approval is idempotent for the same current, fresh report.

create or replace function public._outrider_raise_v1(
  p_code text,
  p_sqlstate text default 'P0001'
)
returns void
language plpgsql
set search_path = ''
as $function$
declare
  v_sqlstate text := p_sqlstate;
begin
  if p_code in (
    'ENTRY_OUTRIDER_SETUP_REPORT_REQUIRED',
    'ENTRY_OUTRIDER_SETUP_REPORT_STALE',
    'ENTRY_OUTRIDER_SETUP_WORKBOOK_STALE',
    'ENTRY_OUTRIDER_BLOCKING_FINDINGS',
    'ENTRY_OUTRIDER_REPORT_UNAVAILABLE',
    'ENTRY_OUTRIDER_APPROVED_LOCKED',
    'ENTRY_OUTRIDER_SETUP_REPORT_GENERATION_IN_PROGRESS'
  ) then
    v_sqlstate := 'P0412';
  end if;

  raise exception '%', p_code using errcode = v_sqlstate;
end;
$function$;

comment on function public._outrider_raise_v1(text, text) is
  'Outrider error helper. Setup-workflow state errors use P0412 so application error mapping can distinguish them from generic P0409 conflicts.';

create or replace function public.approve_community_outrider_setup_report_v1(
  p_report_id uuid,
  p_current_input_sha256 text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_report public.community_outrider_setup_reports%rowtype;
  v_outrider public.community_outrider_sessions%rowtype;
  v_latest_source_id uuid;
begin
  perform public._outrider_service_role_only_v1();
  perform public._outrider_validate_actor_v1(p_actor_user_id);

  select * into v_report
    from public.community_outrider_setup_reports
   where id = p_report_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_REPORT_UNAVAILABLE', '42501');
  end if;

  select * into v_outrider
    from public.community_outrider_sessions
   where id = v_report.outrider_id
   for update;

  if not found then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_UNAVAILABLE', '42501');
  end if;

  if v_outrider.status = 'approved' then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_APPROVED_LOCKED', 'P0409');
  end if;

  select f.id into v_latest_source_id
    from public.community_outrider_files f
   where f.outrider_id = v_outrider.id
     and f.category = 'setup_workbook'
   order by coalesce(f.uploaded_at, f.created_at) desc, f.created_at desc, f.id desc
   limit 1;

  if v_report.status not in ('draft', 'approved')
     or v_latest_source_id is distinct from v_report.source_file_id
     or v_report.input_sha256 is distinct from p_current_input_sha256
     or exists (
       select 1
       from jsonb_array_elements(v_report.findings) f
       where f->>'severity' = 'error'
     ) then
    perform public._outrider_raise_v1('ENTRY_OUTRIDER_SETUP_REPORT_STALE', 'P0409');
  end if;

  -- Idempotent retry: the exact same current, fresh report may be approved again
  -- without mutating the immutable approved snapshot or duplicating audit events.
  if v_report.status = 'approved' then
    return jsonb_build_object(
      'accepted', true,
      'status', v_report.status,
      'approved_at', v_report.approved_at,
      'idempotent', true
    );
  end if;

  update public.community_outrider_setup_reports
     set status = 'approved',
         approved_by = p_actor_user_id,
         approved_at = now()
   where id = v_report.id
     and status = 'draft'
   returning * into v_report;

  insert into public.community_outrider_events (
    outrider_id,
    community_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  )
  values (
    v_outrider.id,
    v_outrider.community_id,
    'setup_report_approved',
    'entry_admin',
    p_actor_user_id,
    jsonb_build_object(
      'report_id', v_report.id,
      'version', v_report.version,
      'source_file_id', v_report.source_file_id
    )
  );

  return jsonb_build_object(
    'accepted', true,
    'status', v_report.status,
    'approved_at', v_report.approved_at,
    'idempotent', false
  );
end;
$function$;

revoke all on function public.approve_community_outrider_setup_report_v1(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.approve_community_outrider_setup_report_v1(uuid, text, uuid) to service_role;

comment on function public.approve_community_outrider_setup_report_v1(uuid, text, uuid) is
  'ENTRY internal RPC. Idempotently approves only the current non-stale setup report without blocking findings before final Outrider approval locks the workflow. service_role only.';
