-- ENTRY-OBS-004: durable notification worker cycle health and recovery evidence.
--
-- This is observability-only. It does not change queue claim, delivery, retry,
-- or provider behavior.

create table if not exists public.entry_notification_worker_health (
  worker_name text primary key,
  last_cycle_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_status text not null default 'unknown'
    check (last_status in ('success', 'failure', 'unknown')),
  consecutive_failures integer not null default 0
    check (consecutive_failures >= 0),
  last_claimed integer,
  last_processed integer,
  last_error_code text,
  last_error_summary text,
  last_invocation_id text,
  updated_at timestamptz not null default now()
);

alter table public.entry_notification_worker_health enable row level security;
revoke all on table public.entry_notification_worker_health from public, anon, authenticated;
revoke all on table public.entry_notification_worker_health from service_role;

comment on table public.entry_notification_worker_health is
  'Single-row-per-worker durable heartbeat state for ENTRY notification worker observability. No push content, recipient identifiers, provider payloads, tokens, or credentials.';

-- Preserve the incident that motivated this instrumentation. If a claim-level
-- worker failure already exists before heartbeat tracking is deployed, seed it
-- as the unresolved baseline. The first later successful cycle will then prove
-- recovery instead of erasing the historical failure.
with latest_claim_failure as (
  select
    s.created_at,
    public._entry_notification_observability_sanitize_text_v1(
      coalesce(s.details->>'error', s.details->>'error_message', s.message),
      'Worker claim failed without a sanitized reason'
    ) as error_summary
  from public.system_event_log s
  where s.event_type = 'PUSH_CLAIM_RPC_ERROR'
    and coalesce(s.source, '') = 'smart-service'
  order by s.created_at desc
  limit 1
)
insert into public.entry_notification_worker_health (
  worker_name,
  last_cycle_at,
  last_success_at,
  last_failure_at,
  last_status,
  consecutive_failures,
  last_claimed,
  last_processed,
  last_error_code,
  last_error_summary,
  updated_at
)
select
  'community_message_push',
  f.created_at,
  null,
  f.created_at,
  'failure',
  1,
  0,
  0,
  'PUSH_CLAIM_RPC_ERROR',
  f.error_summary,
  now()
from latest_claim_failure f
on conflict (worker_name) do nothing;

create or replace function public.record_entry_notification_worker_cycle_v1(
  p_success boolean,
  p_claimed integer default 0,
  p_processed integer default 0,
  p_error_code text default null,
  p_error_summary text default null,
  p_invocation_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_now timestamptz := now();
  v_worker_name constant text := 'community_message_push';
  v_previous_failure timestamptz;
  v_previous_success timestamptz;
  v_recovered boolean := false;
  v_error_summary text;
begin
  select h.last_failure_at, h.last_success_at
  into v_previous_failure, v_previous_success
  from public.entry_notification_worker_health h
  where h.worker_name = v_worker_name
  for update;

  if p_success then
    v_recovered := v_previous_failure is not null
      and v_previous_failure > coalesce(v_previous_success, '-infinity'::timestamptz);
    v_error_summary := null;
  else
    v_error_summary := public._entry_notification_observability_sanitize_text_v1(
      p_error_summary,
      'Worker cycle failed without a sanitized reason'
    );
  end if;

  insert into public.entry_notification_worker_health (
    worker_name,
    last_cycle_at,
    last_success_at,
    last_failure_at,
    last_status,
    consecutive_failures,
    last_claimed,
    last_processed,
    last_error_code,
    last_error_summary,
    last_invocation_id,
    updated_at
  )
  values (
    v_worker_name,
    v_now,
    case when p_success then v_now else null end,
    case when p_success then null else v_now end,
    case when p_success then 'success' else 'failure' end,
    case when p_success then 0 else 1 end,
    greatest(coalesce(p_claimed, 0), 0),
    greatest(coalesce(p_processed, 0), 0),
    case when p_success then null else nullif(left(btrim(coalesce(p_error_code, '')), 80), '') end,
    v_error_summary,
    nullif(left(btrim(coalesce(p_invocation_id, '')), 80), ''),
    v_now
  )
  on conflict (worker_name) do update set
    last_cycle_at = excluded.last_cycle_at,
    last_success_at = case
      when p_success then excluded.last_cycle_at
      else public.entry_notification_worker_health.last_success_at
    end,
    last_failure_at = case
      when p_success then public.entry_notification_worker_health.last_failure_at
      else excluded.last_cycle_at
    end,
    last_status = excluded.last_status,
    consecutive_failures = case
      when p_success then 0
      else public.entry_notification_worker_health.consecutive_failures + 1
    end,
    last_claimed = excluded.last_claimed,
    last_processed = excluded.last_processed,
    last_error_code = excluded.last_error_code,
    last_error_summary = excluded.last_error_summary,
    last_invocation_id = excluded.last_invocation_id,
    updated_at = excluded.updated_at;

  if v_recovered then
    insert into public.system_event_log (
      severity,
      module,
      event_type,
      message,
      details,
      source
    )
    values (
      'INFO',
      'community_message_push',
      'PUSH_WORKER_RECOVERED',
      'Notification worker completed a successful cycle after a prior worker failure',
      jsonb_strip_nulls(jsonb_build_object(
        'status', 'success',
        'previous_failure_at', v_previous_failure,
        'claimed', greatest(coalesce(p_claimed, 0), 0),
        'processed', greatest(coalesce(p_processed, 0), 0),
        'invocation_id', nullif(left(btrim(coalesce(p_invocation_id, '')), 80), '')
      )),
      'entry_worker_health'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'recovered', v_recovered,
    'recorded_at', v_now
  );
end;
$function$;

revoke all on function public.record_entry_notification_worker_cycle_v1(
  boolean, integer, integer, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_entry_notification_worker_cycle_v1(
  boolean, integer, integer, text, text, text
) to service_role;

comment on function public.record_entry_notification_worker_cycle_v1(
  boolean, integer, integer, text, text, text
) is
  'Service-role-only best-effort recorder for notification worker cycle health. Stores bounded operational metadata only.';

create or replace function public.sa_get_entry_notification_worker_health_v1()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_row public.entry_notification_worker_health%rowtype;
  v_recovered boolean := false;
  v_is_stale boolean := false;
  v_status text := 'unknown';
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  select *
  into v_row
  from public.entry_notification_worker_health h
  where h.worker_name = 'community_message_push';

  if not found then
    return jsonb_build_object(
      'status', 'unknown',
      'is_stale', false,
      'recovered', false,
      'worker_name', 'community_message_push'
    );
  end if;

  v_recovered := v_row.last_failure_at is not null
    and v_row.last_success_at is not null
    and v_row.last_success_at > v_row.last_failure_at;

  -- The scheduler runs every two minutes. Six minutes allows two missed cycles
  -- before the worker is considered stale.
  v_is_stale := v_row.last_cycle_at is null or v_row.last_cycle_at < now() - interval '6 minutes';

  v_status := case
    when v_is_stale then 'degraded'
    when v_row.last_status = 'failure' then 'degraded'
    when v_row.last_status = 'success' then 'healthy'
    else 'unknown'
  end;

  return jsonb_strip_nulls(jsonb_build_object(
    'worker_name', v_row.worker_name,
    'status', v_status,
    'is_stale', v_is_stale,
    'last_cycle_at', v_row.last_cycle_at,
    'last_success_at', v_row.last_success_at,
    'last_failure_at', v_row.last_failure_at,
    'consecutive_failures', v_row.consecutive_failures,
    'last_claimed', v_row.last_claimed,
    'last_processed', v_row.last_processed,
    'last_error_code', v_row.last_error_code,
    'last_error_summary', v_row.last_error_summary,
    'recovered', v_recovered,
    'recovered_at', case when v_recovered then v_row.last_success_at else null end,
    'recovery_summary', case
      when v_recovered then 'A later worker cycle completed successfully after the latest recorded worker failure.'
      when v_row.last_status = 'failure' then 'No successful worker cycle has been recorded after the latest worker failure.'
      when v_is_stale then 'The worker has not recorded a cycle within the expected heartbeat window.'
      else 'No unresolved worker failure is currently recorded.'
    end
  ));
end;
$function$;

revoke all on function public.sa_get_entry_notification_worker_health_v1()
  from public, anon;
grant execute on function public.sa_get_entry_notification_worker_health_v1()
  to authenticated;
grant execute on function public.sa_get_entry_notification_worker_health_v1()
  to service_role;

comment on function public.sa_get_entry_notification_worker_health_v1() is
  'Superadmin-only ENTRY notification worker health read model. Separates worker-cycle recovery from notification delivery outcomes.';
