-- ENTRY staged cron recovery after the October 1 provider degradation.
-- This migration adds a recovery tier between DEGRADED and NORMAL so database-only
-- maintenance can return without permitting OCR or web-push fan-out.
--
-- IMPORTANT: this migration does not activate any cron job.

alter table public.entry_background_runtime_control
  drop constraint if exists entry_background_runtime_control_mode;

alter table public.entry_background_runtime_control
  add constraint entry_background_runtime_control_mode
  check (mode in ('NORMAL', 'RECOVERY', 'DEGRADED', 'SEVERE'));

create or replace function public.run_entry_background_job_v1(
  p_job_name text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_job_name text := btrim(coalesce(p_job_name, ''));
  v_mode text;
  v_allowed boolean := false;
  v_lock_key bigint;
begin
  if v_job_name not in (
    'cleanup-edge-rate-limits',
    'community-message-push-stale-sweeper',
    'community-message-push-worker',
    'entry-mobile-push-receipts',
    'entry-observability-incident-reconcile',
    'entry-plate-ocr-queue',
    'entry-web-push-dispatch',
    'expire-stale-records'
  ) then
    raise exception 'Unsupported ENTRY background job: %', v_job_name
      using errcode = '22023';
  end if;

  select c.mode
    into v_mode
  from public.entry_background_runtime_control c
  where c.control_key = 'global';

  v_mode := coalesce(v_mode, 'SEVERE');

  if v_mode = 'NORMAL' then
    v_allowed := true;
  elsif v_mode = 'RECOVERY' then
    -- Recovery permits the already-bounded communications workers plus
    -- database-only reconciliation/cleanup. Provider fan-out stays blocked.
    v_allowed := v_job_name in (
      'cleanup-edge-rate-limits',
      'community-message-push-stale-sweeper',
      'community-message-push-worker',
      'entry-mobile-push-receipts',
      'entry-observability-incident-reconcile',
      'expire-stale-records'
    );
  elsif v_mode = 'DEGRADED' then
    v_allowed := v_job_name in (
      'community-message-push-worker',
      'entry-mobile-push-receipts'
    );
  else
    v_allowed := false;
  end if;

  if not v_allowed then
    return jsonb_build_object(
      'ok', true,
      'ran', false,
      'job', v_job_name,
      'mode', v_mode,
      'reason', 'runtime_gate'
    );
  end if;

  -- One transaction-scoped advisory lock per job prevents a slow invocation
  -- from overlapping the next cron tick and multiplying connection pressure.
  v_lock_key := hashtextextended('entry-background:' || v_job_name, 0);
  if not pg_try_advisory_xact_lock(v_lock_key) then
    return jsonb_build_object(
      'ok', true,
      'ran', false,
      'job', v_job_name,
      'mode', v_mode,
      'reason', 'overlap_guard'
    );
  end if;

  case v_job_name
    when 'cleanup-edge-rate-limits' then
      perform public.cleanup_edge_rate_limit_buckets();

    when 'community-message-push-stale-sweeper' then
      perform public.sweep_stale_community_message_pushes();

    when 'community-message-push-worker' then
      perform public.trigger_community_message_push_worker();

    when 'entry-mobile-push-receipts' then
      perform public.trigger_entry_mobile_push_receipt_worker();

    when 'entry-observability-incident-reconcile' then
      perform public.reconcile_entry_observability_incidents_v1();
      perform public.reconcile_entry_observability_data_integrity_v1();

    when 'entry-plate-ocr-queue' then
      perform public.process_plate_ocr_queue();

    when 'entry-web-push-dispatch' then
      perform public.invoke_entry_web_push_dispatch_v1();

    when 'expire-stale-records' then
      perform public.expire_stale_records();
  end case;

  return jsonb_build_object(
    'ok', true,
    'ran', true,
    'job', v_job_name,
    'mode', v_mode
  );
end;
$function$;

revoke all on function public.run_entry_background_job_v1(text) from public;
revoke all on function public.run_entry_background_job_v1(text) from anon;
revoke all on function public.run_entry_background_job_v1(text) from authenticated;
grant execute on function public.run_entry_background_job_v1(text) to service_role;
