-- ENTRY-OBS-003: keep Critical Flow health on canonical operational evidence.
--
-- The first real Paradis smoke test showed two intentional data streams being
-- interpreted as separate health attempts:
--   * QR resolver telemetry + the resulting entry_logs row.
--   * OCR queue completion + the provider usage-ledger row.
--
-- Both streams remain valuable, but they answer different questions. Critical
-- Flow health must use the canonical operational boundary, while provider usage
-- remains in Usage & Cost. This migration overrides only Validate QR and Image
-- OCR in the existing read model, avoiding a risky copy of the full v1 query.

create or replace function public._entry_observability_flow_override_v1(
  p_flow_key text,
  p_starts_at timestamptz,
  p_ends_at timestamptz default now(),
  p_community_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_start timestamptz := coalesce(p_starts_at, now() - interval '24 hours');
  v_end timestamptz := coalesce(p_ends_at, now());
  v_result jsonb;
begin
  if p_flow_key not in ('validate_qr', 'image_ocr') then
    raise exception 'Unsupported ENTRY observability flow override' using errcode = '22023';
  end if;

  if v_end <= v_start or v_end - v_start > interval '31 days' then
    raise exception 'Invalid observability time range' using errcode = '22023';
  end if;

  with selected_communities as (
    select c.id
    from public.communities c
    where coalesce(c.is_active, false) = true
      and (p_community_id is null or c.id = p_community_id)
  ),
  qr_attempts as (
    select
      s.created_at as occurred_at,
      case
        when lower(coalesce(s.details->>'status', '')) in ('success', 'ok', 'completed', 'sent') then 'success'
        when lower(coalesce(s.details->>'status', '')) in ('failed', 'failure', 'error') then 'failed'
        when lower(coalesce(s.details->>'status', '')) in ('skipped', 'cancelled') then 'skipped'
        when public._entry_observability_severity_rank_v1(s.severity) >= 3 then 'failed'
        else 'unknown'
      end as status,
      coalesce(
        public._entry_observability_jsonb_integer_v1(s.details, 'duration_ms'),
        public._entry_observability_jsonb_integer_v1(s.details, 'durationMs')
      ) as duration_ms
    from public.system_event_log s
    where p_flow_key = 'validate_qr'
      and s.created_at >= v_start
      and s.created_at < v_end
      and s.event_type in (
        'QR_VALIDATED',
        'QR_VALIDATION_FAILED',
        'ACCESS_QR_VALIDATED',
        'ACCESS_QR_REJECTED'
      )
      and exists (select 1 from selected_communities sc where sc.id = s.community_id)
  ),
  ocr_attempts as (
    select
      case
        when q.status in ('PENDING', 'PROCESSING') then least(q.created_at, now())
        else coalesce(q.completed_at, q.scheduled_at, q.created_at)
      end as occurred_at,
      case
        when q.status = 'DONE' then 'success'
        when q.status = 'FAILED' then 'failed'
        when q.max_attempts > 0 and q.attempts >= q.max_attempts then 'failed'
        when q.status = 'PROCESSING' and q.scheduled_at < v_end - interval '15 minutes' then 'failed'
        when q.status = 'PENDING' and q.scheduled_at < v_end - interval '30 minutes' then 'failed'
        else 'unknown'
      end as status,
      case
        when q.completed_at is not null then greatest(
          0,
          round(extract(epoch from (q.completed_at - q.created_at)) * 1000)
        )::integer
        else null::integer
      end as duration_ms
    from public.plate_ocr_queue q
    join public.entry_logs el on el.id = q.entry_log_id
    where p_flow_key = 'image_ocr'
      and (
        q.status in ('PENDING', 'PROCESSING')
        or (
          q.status in ('DONE', 'FAILED')
          and coalesce(q.completed_at, q.scheduled_at, q.created_at) >= v_start
          and coalesce(q.completed_at, q.scheduled_at, q.created_at) < v_end
        )
      )
      and exists (select 1 from selected_communities sc where sc.id = el.community_id)
  ),
  attempts as (
    select * from qr_attempts
    union all
    select * from ocr_attempts
  ),
  aggregate as (
    select
      count(*)::integer as evidence_count,
      count(*) filter (where status = 'success')::integer as success_count,
      count(*) filter (where status = 'failed')::integer as failure_count,
      max(occurred_at) filter (where status = 'success') as last_success_at,
      max(occurred_at) as last_seen_at,
      percentile_cont(0.95) within group (order by duration_ms)
        filter (where duration_ms is not null) as p95_latency_ms
    from attempts
  )
  select jsonb_build_object(
    'key', p_flow_key,
    'label', case when p_flow_key = 'validate_qr' then 'Validate QR' else 'Image OCR' end,
    'status', public._entry_observability_flow_status_v1(
      a.success_count,
      a.failure_count,
      a.last_success_at,
      a.evidence_count
    ),
    'success_count', a.success_count,
    'failure_count', a.failure_count,
    'evidence_count', a.evidence_count,
    'last_success_at', a.last_success_at,
    'last_seen_at', a.last_seen_at,
    'p95_latency_ms', round(a.p95_latency_ms::numeric, 0)
  )
  into v_result
  from aggregate a;

  return v_result;
end;
$function$;

revoke all on function public._entry_observability_flow_override_v1(
  text,
  timestamptz,
  timestamptz,
  uuid
) from public, anon, authenticated;
grant execute on function public._entry_observability_flow_override_v1(
  text,
  timestamptz,
  timestamptz,
  uuid
) to service_role;

create or replace function public.sa_get_entry_observability_v1(
  p_starts_at timestamptz,
  p_ends_at timestamptz default now(),
  p_community_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_result jsonb;
  v_flows jsonb;
  v_qr jsonb;
  v_ocr jsonb;
  v_system_status text;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  v_result := public._sa_get_entry_observability_base_v1(
    p_starts_at,
    p_ends_at,
    p_community_id
  );

  v_qr := public._entry_observability_flow_override_v1(
    'validate_qr', p_starts_at, p_ends_at, p_community_id
  );
  v_ocr := public._entry_observability_flow_override_v1(
    'image_ocr', p_starts_at, p_ends_at, p_community_id
  );

  select coalesce(
    jsonb_agg(
      case flow->>'key'
        when 'validate_qr' then v_qr
        when 'image_ocr' then v_ocr
        else flow
      end
      order by ordinal
    ),
    '[]'::jsonb
  )
  into v_flows
  from jsonb_array_elements(coalesce(v_result->'critical_flows', '[]'::jsonb))
    with ordinality as rows(flow, ordinal);

  v_result := jsonb_set(v_result, '{critical_flows}', v_flows, true);

  select case
    when exists (
      select 1 from jsonb_array_elements(v_flows) f
      where f->>'status' = 'down'
    ) then 'down'
    when exists (
      select 1 from jsonb_array_elements(coalesce(v_result->'incidents', '[]'::jsonb)) i
      where i->>'severity' in ('CRITICAL', 'ERROR')
    ) then 'degraded'
    when exists (
      select 1 from jsonb_array_elements(v_flows) f
      where f->>'status' = 'degraded'
    ) then 'degraded'
    when jsonb_array_length(v_flows) = 0 then 'unknown'
    when exists (
      select 1 from jsonb_array_elements(v_flows) f
      where f->>'status' = 'unknown'
    ) then 'unknown'
    else 'healthy'
  end
  into v_system_status;

  v_result := jsonb_set(
    v_result,
    '{summary,system_status}',
    to_jsonb(v_system_status),
    true
  );

  v_result := jsonb_set(
    v_result,
    '{ocr_queue,provider_instrumented}',
    'true'::jsonb,
    true
  );

  v_result := jsonb_set(
    v_result,
    '{ocr_queue,provider_usage_status}',
    to_jsonb('instrumented'::text),
    true
  );

  return v_result;
end;
$function$;

revoke all on function public.sa_get_entry_observability_v1(
  timestamptz,
  timestamptz,
  uuid
) from public, anon;
grant execute on function public.sa_get_entry_observability_v1(
  timestamptz,
  timestamptz,
  uuid
) to authenticated;
grant execute on function public.sa_get_entry_observability_v1(
  timestamptz,
  timestamptz,
  uuid
) to service_role;

comment on function public._entry_observability_flow_override_v1(
  text,
  timestamptz,
  timestamptz,
  uuid
) is
  'Canonical Critical Flow override for QR validation and OCR. QR uses validator telemetry only; OCR uses queue outcomes only. Provider usage remains economic telemetry.';

comment on function public.sa_get_entry_observability_v1(
  timestamptz,
  timestamptz,
  uuid
) is
  'ENTRY Observability read model with canonical QR/OCR flow evidence and repository-controlled Gemini usage instrumentation.';
