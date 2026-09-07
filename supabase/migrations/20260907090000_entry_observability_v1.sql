-- ENTRY-OBS-001: Production Observability v1.
--
-- Observability v1 reuses the existing operational/audit/security streams and
-- adds only the missing provider usage ledger. The dashboard read model is a
-- bounded, superadmin-only RPC so the browser does not download raw logs.
-- Provider prices must not be invented; unknown cost remains NULL.

create table if not exists public.entry_usage_ledger (
  id                    uuid        not null default gen_random_uuid() primary key,
  occurred_at           timestamptz not null default now(),
  community_id          uuid        references public.communities(id) on delete set null,
  actor_id              uuid        references auth.users(id) on delete set null,
  operation             text        not null
                                      constraint entry_usage_ledger_operation_not_blank
                                      check (btrim(operation) <> ''),
  provider              text        not null
                                      constraint entry_usage_ledger_provider_not_blank
                                      check (btrim(provider) <> ''),
  service_model         text,
  status                text        not null default 'unknown'
                                      constraint entry_usage_ledger_status_check
                                      check (status in ('success', 'failed', 'skipped', 'unknown')),
  quantity              numeric(18, 6)
                                      constraint entry_usage_ledger_quantity_nonnegative
                                      check (quantity is null or quantity >= 0),
  image_count           integer
                                      constraint entry_usage_ledger_image_count_nonnegative
                                      check (image_count is null or image_count >= 0),
  input_tokens          integer
                                      constraint entry_usage_ledger_input_tokens_nonnegative
                                      check (input_tokens is null or input_tokens >= 0),
  output_tokens         integer
                                      constraint entry_usage_ledger_output_tokens_nonnegative
                                      check (output_tokens is null or output_tokens >= 0),
  duration_ms           integer
                                      constraint entry_usage_ledger_duration_nonnegative
                                      check (duration_ms is null or duration_ms >= 0),
  provider_request_id   text,
  pricing_version       text,
  estimated_cost        numeric(18, 8)
                                      constraint entry_usage_ledger_estimated_cost_nonnegative
                                      check (estimated_cost is null or estimated_cost >= 0),
  currency              text        not null default 'USD'
                                      constraint entry_usage_ledger_currency_check
                                      check (currency ~ '^[A-Z]{3}$'),
  request_id            text,
  correlation_id        text,
  error_code            text,
  error_fingerprint     text,
  metadata              jsonb       not null default '{}'::jsonb
                                      constraint entry_usage_ledger_metadata_object
                                      check (jsonb_typeof(metadata) = 'object'),
  created_at            timestamptz not null default now()
);

alter table public.entry_usage_ledger enable row level security;

revoke all on table public.entry_usage_ledger from public, anon, authenticated;
grant select, insert on table public.entry_usage_ledger to service_role;

create index if not exists idx_entry_usage_ledger_occurred_at
  on public.entry_usage_ledger (occurred_at desc);

create index if not exists idx_entry_usage_ledger_community_occurred
  on public.entry_usage_ledger (community_id, occurred_at desc)
  where community_id is not null;

create index if not exists idx_entry_usage_ledger_provider_operation
  on public.entry_usage_ledger (provider, operation, occurred_at desc);

create index if not exists idx_entry_usage_ledger_correlation
  on public.entry_usage_ledger (correlation_id, occurred_at desc)
  where correlation_id is not null;

create index if not exists idx_entry_usage_ledger_failures
  on public.entry_usage_ledger (operation, error_fingerprint, occurred_at desc)
  where status = 'failed';

create or replace function public._entry_observability_service_role_only_v1()
returns void
language plpgsql
set search_path = ''
as $function$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'ENTRY_USAGE_UNAUTHORIZED' using errcode = '42501';
  end if;
end;
$function$;

revoke all on function public._entry_observability_service_role_only_v1() from public, anon, authenticated;

create or replace function public._entry_observability_normalize_fingerprint_v1(
  p_source text,
  p_event_type text,
  p_error_code text,
  p_message text
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select md5(concat_ws(
    '|',
    lower(coalesce(nullif(btrim(p_source), ''), 'unknown')),
    lower(coalesce(nullif(btrim(p_event_type), ''), 'unknown')),
    lower(coalesce(nullif(btrim(p_error_code), ''), 'none')),
    regexp_replace(
      regexp_replace(lower(coalesce(p_message, '')), '[0-9a-f]{8}-[0-9a-f-]{27,}', '{uuid}', 'gi'),
      '\m[0-9]{3,}\M',
      '{number}',
      'g'
    )
  ));
$function$;

revoke all on function public._entry_observability_normalize_fingerprint_v1(text, text, text, text) from public, anon, authenticated;

create or replace function public._entry_observability_flow_status_v1(
  p_success_count integer,
  p_failure_count integer,
  p_last_success_at timestamptz,
  p_evidence_count integer
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when coalesce(p_evidence_count, 0) = 0 then 'unknown'
    when coalesce(p_success_count, 0) = 0 and coalesce(p_failure_count, 0) >= 5 then 'down'
    when coalesce(p_success_count, 0) = 0 and coalesce(p_failure_count, 0) > 0 then 'degraded'
    when coalesce(p_failure_count, 0) >= 3
      and coalesce(p_failure_count, 0)::numeric
        / greatest(coalesce(p_success_count, 0) + coalesce(p_failure_count, 0), 1)::numeric >= 0.20
      then 'degraded'
    when p_last_success_at is not null then 'healthy'
    else 'unknown'
  end;
$function$;

revoke all on function public._entry_observability_flow_status_v1(integer, integer, timestamptz, integer) from public, anon, authenticated;

create or replace function public._entry_observability_severity_rank_v1(
  p_severity text
)
returns integer
language sql
immutable
set search_path = ''
as $function$
  select case upper(coalesce(nullif(btrim(p_severity), ''), 'INFO'))
    when 'CRITICAL' then 4
    when 'ERROR' then 3
    when 'WARNING' then 2
    when 'WARN' then 2
    else 1
  end;
$function$;

revoke all on function public._entry_observability_severity_rank_v1(text) from public, anon, authenticated;

create or replace function public._entry_observability_normalize_severity_v1(
  p_severity text
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case public._entry_observability_severity_rank_v1(p_severity)
    when 4 then 'CRITICAL'
    when 3 then 'ERROR'
    when 2 then 'WARNING'
    else 'INFO'
  end;
$function$;

revoke all on function public._entry_observability_normalize_severity_v1(text) from public, anon, authenticated;

create or replace function public._entry_observability_jsonb_integer_v1(
  p_details jsonb,
  p_key text
)
returns integer
language sql
immutable
set search_path = ''
as $function$
  select case
    when coalesce(p_details, '{}'::jsonb) ? p_key
      and coalesce(p_details->>p_key, '') ~ '^[0-9]+$'
      then (p_details->>p_key)::integer
    else null::integer
  end;
$function$;

revoke all on function public._entry_observability_jsonb_integer_v1(jsonb, text) from public, anon, authenticated;

create or replace function public.record_entry_usage_v1(
  p_community_id uuid,
  p_operation text,
  p_provider text,
  p_service_model text default null,
  p_status text default 'unknown',
  p_quantity numeric default null,
  p_image_count integer default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_duration_ms integer default null,
  p_provider_request_id text default null,
  p_pricing_version text default null,
  p_estimated_cost numeric default null,
  p_currency text default 'USD',
  p_request_id text default null,
  p_correlation_id text default null,
  p_actor_id uuid default null,
  p_error_code text default null,
  p_error_fingerprint text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_status text := lower(coalesce(nullif(btrim(p_status), ''), 'unknown'));
  v_currency text := upper(coalesce(nullif(btrim(p_currency), ''), 'USD'));
begin
  perform public._entry_observability_service_role_only_v1();

  if p_operation is null or btrim(p_operation) = '' then
    raise exception 'ENTRY_USAGE_INVALID_OPERATION' using errcode = '22023';
  end if;

  if p_provider is null or btrim(p_provider) = '' then
    raise exception 'ENTRY_USAGE_INVALID_PROVIDER' using errcode = '22023';
  end if;

  if v_status not in ('success', 'failed', 'skipped', 'unknown') then
    raise exception 'ENTRY_USAGE_INVALID_STATUS' using errcode = '22023';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'ENTRY_USAGE_INVALID_CURRENCY' using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'ENTRY_USAGE_INVALID_METADATA' using errcode = '22023';
  end if;

  insert into public.entry_usage_ledger (
    occurred_at,
    community_id,
    actor_id,
    operation,
    provider,
    service_model,
    status,
    quantity,
    image_count,
    input_tokens,
    output_tokens,
    duration_ms,
    provider_request_id,
    pricing_version,
    estimated_cost,
    currency,
    request_id,
    correlation_id,
    error_code,
    error_fingerprint,
    metadata
  )
  values (
    now(),
    p_community_id,
    p_actor_id,
    btrim(p_operation),
    btrim(p_provider),
    nullif(btrim(coalesce(p_service_model, '')), ''),
    v_status,
    p_quantity,
    p_image_count,
    p_input_tokens,
    p_output_tokens,
    p_duration_ms,
    nullif(btrim(coalesce(p_provider_request_id, '')), ''),
    nullif(btrim(coalesce(p_pricing_version, '')), ''),
    p_estimated_cost,
    v_currency,
    nullif(btrim(coalesce(p_request_id, '')), ''),
    nullif(btrim(coalesce(p_correlation_id, '')), ''),
    nullif(btrim(coalesce(p_error_code, '')), ''),
    nullif(btrim(coalesce(p_error_fingerprint, '')), ''),
    p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.record_entry_usage_v1(
  uuid, text, text, text, text, numeric, integer, integer, integer, integer,
  text, text, numeric, text, text, text, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_entry_usage_v1(
  uuid, text, text, text, text, numeric, integer, integer, integer, integer,
  text, text, numeric, text, text, text, uuid, text, text, jsonb
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
  v_start timestamptz := coalesce(p_starts_at, now() - interval '24 hours');
  v_end timestamptz := coalesce(p_ends_at, now());
  v_selected_community uuid := p_community_id;
  v_result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  if v_end <= v_start then
    raise exception 'Invalid observability time range' using errcode = '22023';
  end if;

  if v_end - v_start > interval '31 days' then
    raise exception 'Observability time range is too large' using errcode = '22023';
  end if;

  with active_communities as (
    select c.id, c.name
    from public.communities c
    where coalesce(c.is_active, false) = true
  ),
  selected_communities as (
    select ac.id, ac.name
    from active_communities ac
    where v_selected_community is null or ac.id = v_selected_community
  ),
  system_attempts as (
    select
      s.created_at as occurred_at,
      s.community_id,
      coalesce(nullif(s.source, ''), nullif(s.module, ''), 'system') as source,
      s.event_type,
      null::text as access_method,
      case
        when lower(coalesce(s.details->>'status', '')) in ('success', 'ok', 'completed', 'sent') then 'success'
        when lower(coalesce(s.details->>'status', '')) in ('failed', 'failure', 'error') then 'failed'
        when lower(coalesce(s.details->>'status', '')) in ('skipped', 'cancelled') then 'skipped'
        when public._entry_observability_severity_rank_v1(s.severity) >= 3 then 'failed'
        else 'unknown'
      end as status,
      public._entry_observability_normalize_severity_v1(s.severity) as severity,
      coalesce(
        public._entry_observability_jsonb_integer_v1(s.details, 'duration_ms'),
        public._entry_observability_jsonb_integer_v1(s.details, 'durationMs')
      ) as duration_ms,
      nullif(coalesce(s.details->>'error_code', s.details->>'code'), '') as error_code,
      coalesce(
        nullif(coalesce(s.details->>'error_fingerprint', s.details->>'fingerprint'), ''),
        public._entry_observability_normalize_fingerprint_v1(
          coalesce(nullif(s.source, ''), nullif(s.module, ''), 'system'),
          s.event_type,
          nullif(coalesce(s.details->>'error_code', s.details->>'code'), ''),
          s.message
        )
      ) as fingerprint,
      left(coalesce(nullif(s.message, ''), s.event_type, 'Operational event'), 180) as explanation
    from public.system_event_log s
    where s.created_at >= v_start
      and s.created_at < v_end
      and (
        (v_selected_community is null and s.community_id is null)
        or exists (
          select 1 from selected_communities sc where sc.id = s.community_id
        )
      )
  ),
  registration_attempts as (
    select
      e.created_at as occurred_at,
      camp.community_id,
      'community_registration'::text as source,
      e.event_type,
      null::text as access_method,
      case
        when e.event_type in (
          'household_submitted',
          'household_resubmitted',
          'unit_reviewed',
          'unit_confirmed',
          'unit_conversion_completed'
        ) then 'success'
        when e.event_type in ('resident_conversion_blocked', 'conversion_failed') then 'failed'
        else 'unknown'
      end as status,
      case
        when e.event_type = 'conversion_failed' then 'ERROR'
        when e.event_type = 'resident_conversion_blocked' then 'WARNING'
        else 'INFO'
      end as severity,
      null::integer as duration_ms,
      case when e.event_type in ('resident_conversion_blocked', 'conversion_failed') then e.event_type else null end as error_code,
      public._entry_observability_normalize_fingerprint_v1(
        'community_registration',
        e.event_type,
        case when e.event_type in ('resident_conversion_blocked', 'conversion_failed') then e.event_type else null end,
        e.event_type
      ) as fingerprint,
      case e.event_type
        when 'household_submitted' then 'Household registration submitted'
        when 'household_resubmitted' then 'Household registration resubmitted'
        when 'unit_reviewed' then 'Registration reviewed'
        when 'unit_confirmed' then 'Registration confirmed'
        when 'unit_conversion_completed' then 'Residents prepared for activation'
        when 'resident_conversion_blocked' then 'Registration conversion blocked'
        when 'conversion_failed' then 'Registration conversion failed'
        else 'Registration activity recorded'
      end as explanation
    from public.community_registration_events e
    join public.community_registration_campaigns camp on camp.id = e.campaign_id
    where e.created_at >= v_start
      and e.created_at < v_end
      and exists (
        select 1 from selected_communities sc where sc.id = camp.community_id
      )
  ),
  access_attempts as (
    select
      el.action_at as occurred_at,
      el.community_id,
      'entry_access'::text as source,
      coalesce(el.action::text, 'ENTRY_ACCESS') as event_type,
      el.method::text as access_method,
      'success'::text as status,
      'INFO'::text as severity,
      null::integer as duration_ms,
      null::text as error_code,
      null::text as fingerprint,
      'Gate access event recorded'::text as explanation
    from public.entry_logs el
    where el.action_at >= v_start
      and el.action_at < v_end
      and exists (
        select 1 from selected_communities sc where sc.id = el.community_id
      )
  ),
  ocr_queue_attempts as (
    select
      case
        when q.status in ('PENDING', 'PROCESSING') then least(q.created_at, now())
        else coalesce(q.completed_at, q.scheduled_at, q.created_at)
      end as occurred_at,
      el.community_id,
      'plate_ocr_queue'::text as source,
      concat('PLATE_OCR_QUEUE_', q.status)::text as event_type,
      null::text as access_method,
      case
        when q.status = 'DONE' then 'success'
        when q.status = 'FAILED' then 'failed'
        when q.max_attempts > 0 and q.attempts >= q.max_attempts then 'failed'
        when q.status = 'PROCESSING' and q.scheduled_at < v_end - interval '15 minutes' then 'failed'
        when q.status = 'PENDING' and q.scheduled_at < v_end - interval '30 minutes' then 'failed'
        else 'unknown'
      end as status,
      case
        when q.status = 'FAILED' or (q.max_attempts > 0 and q.attempts >= q.max_attempts) then 'ERROR'
        when q.status = 'PROCESSING' and q.scheduled_at < v_end - interval '15 minutes' then 'WARNING'
        when q.status = 'PENDING' and q.scheduled_at < v_end - interval '30 minutes' then 'WARNING'
        else 'INFO'
      end as severity,
      case
        when q.completed_at is not null then greatest(
          0,
          round(extract(epoch from (q.completed_at - q.created_at)) * 1000)
        )::integer
        else null::integer
      end as duration_ms,
      case
        when q.status = 'FAILED' then 'PLATE_OCR_QUEUE_FAILED'
        when q.max_attempts > 0 and q.attempts >= q.max_attempts then 'PLATE_OCR_QUEUE_EXHAUSTED'
        when q.status = 'PROCESSING' and q.scheduled_at < v_end - interval '15 minutes' then 'PLATE_OCR_QUEUE_STUCK_PROCESSING'
        when q.status = 'PENDING' and q.scheduled_at < v_end - interval '30 minutes' then 'PLATE_OCR_QUEUE_STUCK_PENDING'
        else null
      end as error_code,
      case
        when q.status = 'FAILED'
          or (q.max_attempts > 0 and q.attempts >= q.max_attempts)
          or (q.status = 'PROCESSING' and q.scheduled_at < v_end - interval '15 minutes')
          or (q.status = 'PENDING' and q.scheduled_at < v_end - interval '30 minutes')
          then public._entry_observability_normalize_fingerprint_v1(
            'plate_ocr_queue',
            concat('PLATE_OCR_QUEUE_', q.status),
            case
              when q.status = 'FAILED' then 'PLATE_OCR_QUEUE_FAILED'
              when q.max_attempts > 0 and q.attempts >= q.max_attempts then 'PLATE_OCR_QUEUE_EXHAUSTED'
              when q.status = 'PROCESSING' and q.scheduled_at < v_end - interval '15 minutes' then 'PLATE_OCR_QUEUE_STUCK_PROCESSING'
              when q.status = 'PENDING' and q.scheduled_at < v_end - interval '30 minutes' then 'PLATE_OCR_QUEUE_STUCK_PENDING'
              else null
            end,
            coalesce(q.last_error, q.status)
          )
        else null
      end as fingerprint,
      case
        when q.status = 'DONE' then 'Plate OCR queue job completed'
        when q.status = 'FAILED' then 'Plate OCR queue job failed'
        when q.max_attempts > 0 and q.attempts >= q.max_attempts then 'Plate OCR queue exhausted retry attempts'
        when q.status = 'PROCESSING' and q.scheduled_at < v_end - interval '15 minutes' then 'Plate OCR queue job appears stuck processing'
        when q.status = 'PENDING' and q.scheduled_at < v_end - interval '30 minutes' then 'Plate OCR queue job is pending beyond the freshness threshold'
        else 'Plate OCR queue job recorded'
      end as explanation
    from public.plate_ocr_queue q
    join public.entry_logs el on el.id = q.entry_log_id
    where (
        q.status in ('PENDING', 'PROCESSING')
        or (
          q.status in ('DONE', 'FAILED')
          and coalesce(q.completed_at, q.scheduled_at, q.created_at) >= v_start
          and coalesce(q.completed_at, q.scheduled_at, q.created_at) < v_end
        )
      )
      and exists (
        select 1 from selected_communities sc where sc.id = el.community_id
      )
  ),
  notification_attempts as (
    select
      coalesce(m.sent_at, m.failed_at, m.last_attempt_at, m.updated_at, m.created_at) as occurred_at,
      m.community_id,
      'onboarding_notifications'::text as source,
      'onboarding_email'::text as event_type,
      null::text as access_method,
      case
        when m.status = 'sent' then 'success'
        when m.status = 'failed' then 'failed'
        when m.status in ('skipped', 'cancelled') then 'skipped'
        else 'unknown'
      end as status,
      case when m.status = 'failed' then 'ERROR' else 'INFO' end as severity,
      null::integer as duration_ms,
      case when m.status = 'failed' then 'ONBOARDING_EMAIL_FAILED' else null end as error_code,
      case
        when m.status = 'failed' then public._entry_observability_normalize_fingerprint_v1(
          'onboarding_notifications',
          'onboarding_email',
          'ONBOARDING_EMAIL_FAILED',
          m.last_error
        )
        else null
      end as fingerprint,
      case
        when m.status = 'failed' then left(coalesce(nullif(m.last_error, ''), 'Onboarding email failed'), 180)
        when m.status = 'sent' then 'Onboarding email sent'
        when m.status = 'skipped' then 'Onboarding email skipped'
        else 'Onboarding email attempt recorded'
      end as explanation
    from public.onboarding_campaign_messages m
    where coalesce(m.sent_at, m.failed_at, m.last_attempt_at, m.updated_at, m.created_at) >= v_start
      and coalesce(m.sent_at, m.failed_at, m.last_attempt_at, m.updated_at, m.created_at) < v_end
      and exists (
        select 1 from selected_communities sc where sc.id = m.community_id
      )
  ),
  usage_attempts as (
    select
      u.occurred_at,
      u.community_id,
      u.provider as source,
      u.operation as event_type,
      null::text as access_method,
      u.status,
      case when u.status = 'failed' then 'ERROR' else 'INFO' end as severity,
      u.duration_ms,
      u.error_code,
      coalesce(
        nullif(u.error_fingerprint, ''),
        case when u.status = 'failed' then public._entry_observability_normalize_fingerprint_v1(
          u.provider,
          u.operation,
          u.error_code,
          u.operation
        ) end
      ) as fingerprint,
      case
        when u.status = 'failed' then concat('Provider usage failed for ', u.operation)
        else concat('Provider usage recorded for ', u.operation)
      end as explanation
    from public.entry_usage_ledger u
    where u.occurred_at >= v_start
      and u.occurred_at < v_end
      and (
        (v_selected_community is null and u.community_id is null)
        or exists (
          select 1 from selected_communities sc where sc.id = u.community_id
        )
      )
  ),
  attempts as (
    select * from system_attempts
    union all select * from registration_attempts
    union all select * from access_attempts
    union all select * from ocr_queue_attempts
    union all select * from notification_attempts
    union all select * from usage_attempts
  ),
  attempts_classified as (
    select
      a.*,
      case
        when lower(coalesce(a.status, '')) in ('success', 'ok', 'completed', 'sent') then true
        else false
      end as is_success,
      case
        when lower(coalesce(a.status, '')) in ('failed', 'failure', 'error')
          or a.severity in ('ERROR', 'CRITICAL')
          then true
        else false
      end as is_failure
    from attempts a
  ),
  flow_catalog(flow_key, flow_label) as (
    values
      ('create_pass', 'Create pass'),
      ('validate_qr', 'Validate QR'),
      ('resident_login', 'Resident login'),
      ('registration', 'Registration'),
      ('image_ocr', 'Image OCR'),
      ('notifications', 'Notifications')
  ),
  flow_attempts as (
    select
      case
        when a.event_type in ('PASS_CREATE', 'PASS_CREATED', 'PASS_CREATE_FAILED', 'CREATE_PASS', 'CREATE_PASS_FAILED', 'ACCESS_PASS_CREATED', 'ACCESS_PASS_CREATE_FAILED') then 'create_pass'
        when (a.source = 'entry_access' and a.access_method = 'QR')
          or a.event_type in ('QR_VALIDATED', 'QR_VALIDATION_FAILED', 'ACCESS_QR_VALIDATED', 'ACCESS_QR_REJECTED') then 'validate_qr'
        when a.event_type in ('RESIDENT_LOGIN', 'RESIDENT_LOGIN_FAILED', 'AUTH_LOGIN', 'AUTH_LOGIN_FAILED') then 'resident_login'
        when a.source = 'community_registration' then 'registration'
        when a.source = 'plate_ocr_queue'
          or a.event_type in ('IMAGE_OCR', 'IMAGE_OCR_FAILED', 'PLATE_OCR', 'PLATE_OCR_FAILED')
          or a.event_type = 'image_ocr' then 'image_ocr'
        when a.source = 'onboarding_notifications'
          or a.event_type in ('NOTIFICATION_SENT', 'NOTIFICATION_FAILED', 'PUSH_CLAIM_RPC_ERROR', 'SOS_PUSH_NO_GUARD_TOKENS') then 'notifications'
        else null
      end as flow_key,
      a.*
    from attempts_classified a
  ),
  flows as (
    select
      fc.flow_key,
      fc.flow_label,
      count(fa.*)::integer as evidence_count,
      count(*) filter (where fa.is_success)::integer as success_count,
      count(*) filter (where fa.is_failure)::integer as failure_count,
      max(fa.occurred_at) filter (where fa.is_success) as last_success_at,
      max(fa.occurred_at) as last_seen_at,
      percentile_cont(0.95) within group (order by fa.duration_ms)
        filter (where fa.duration_ms is not null) as p95_latency_ms
    from flow_catalog fc
    left join flow_attempts fa on fa.flow_key = fc.flow_key
    group by fc.flow_key, fc.flow_label
  ),
  flow_json as (
    select jsonb_agg(
      jsonb_build_object(
        'key', f.flow_key,
        'label', f.flow_label,
        'status', public._entry_observability_flow_status_v1(
          f.success_count,
          f.failure_count,
          f.last_success_at,
          f.evidence_count
        ),
        'success_count', f.success_count,
        'failure_count', f.failure_count,
        'evidence_count', f.evidence_count,
        'last_success_at', f.last_success_at,
        'last_seen_at', f.last_seen_at,
        'p95_latency_ms', round(f.p95_latency_ms::numeric, 0)
      )
      order by
        case f.flow_key
          when 'create_pass' then 1
          when 'validate_qr' then 2
          when 'resident_login' then 3
          when 'registration' then 4
          when 'image_ocr' then 5
          when 'notifications' then 6
          else 99
        end
    ) as payload
    from flows f
  ),
  incidents as (
    select
      coalesce(
        nullif(a.fingerprint, ''),
        public._entry_observability_normalize_fingerprint_v1(a.source, a.event_type, a.error_code, a.explanation)
      ) as fingerprint,
      (array_agg(a.severity order by public._entry_observability_severity_rank_v1(a.severity) desc))[1] as severity,
      max(a.source) as source,
      max(a.event_type) as event_type,
      max(a.error_code) as error_code,
      min(a.occurred_at) as first_seen_at,
      max(a.occurred_at) as last_seen_at,
      count(*)::integer as occurrence_count,
      count(distinct a.community_id) filter (where a.community_id is not null)::integer as affected_community_count,
      left(max(a.explanation), 180) as explanation
    from attempts_classified a
    where a.is_failure
    group by 1
    having count(*) >= 2
      or max(public._entry_observability_severity_rank_v1(a.severity)) = 4
  ),
  incident_communities as (
    select
      i.fingerprint,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'community_id', ranked.community_id,
          'community_name', ranked.community_name,
          'occurrence_count', ranked.occurrence_count
        )
        order by ranked.occurrence_count desc, ranked.community_name asc
      ) filter (where ranked.community_id is not null), '[]'::jsonb) as communities
    from incidents i
    left join lateral (
      select
        a.community_id,
        coalesce(sc.name, 'ENTRY system') as community_name,
        count(*)::integer as occurrence_count
      from attempts_classified a
      left join selected_communities sc on sc.id = a.community_id
      where a.is_failure
        and coalesce(
          nullif(a.fingerprint, ''),
          public._entry_observability_normalize_fingerprint_v1(a.source, a.event_type, a.error_code, a.explanation)
        ) = i.fingerprint
      group by a.community_id, coalesce(sc.name, 'ENTRY system')
      order by count(*) desc, coalesce(sc.name, 'ENTRY system') asc
      limit 5
    ) ranked on true
    group by i.fingerprint
  ),
  incident_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'fingerprint', i.fingerprint,
        'severity', i.severity,
        'source', i.source,
        'event_type', i.event_type,
        'error_code', i.error_code,
        'occurrence_count', i.occurrence_count,
        'affected_community_count', i.affected_community_count,
        'first_seen_at', i.first_seen_at,
        'last_seen_at', i.last_seen_at,
        'explanation', i.explanation,
        'communities', coalesce(ic.communities, '[]'::jsonb)
      )
      order by
        case i.severity when 'CRITICAL' then 1 when 'ERROR' then 2 when 'WARNING' then 3 else 4 end,
        i.last_seen_at desc
    ), '[]'::jsonb) as payload
    from (
      select * from incidents
      order by
        case severity when 'CRITICAL' then 1 when 'ERROR' then 2 when 'WARNING' then 3 else 4 end,
        last_seen_at desc
      limit 10
    ) i
    left join incident_communities ic on ic.fingerprint = i.fingerprint
  ),
  usage_summary as (
    select
      coalesce(sum(u.quantity), 0)::numeric as quantity,
      coalesce(sum(u.image_count), 0)::integer as image_count,
      coalesce(sum(u.input_tokens), 0)::integer as input_tokens,
      coalesce(sum(u.output_tokens), 0)::integer as output_tokens,
      sum(u.estimated_cost) as estimated_cost,
      count(*)::integer as record_count,
      count(*) filter (where u.estimated_cost is null)::integer as unknown_cost_count,
      count(*) filter (where u.status = 'failed')::integer as failed_count,
      count(*) filter (where u.status = 'success')::integer as success_count
    from public.entry_usage_ledger u
    where u.occurred_at >= v_start
      and u.occurred_at < v_end
      and (
        (v_selected_community is null and u.community_id is null)
        or exists (select 1 from selected_communities sc where sc.id = u.community_id)
      )
  ),
  ocr_queue_summary as (
    select
      count(*)::integer as total_jobs,
      count(*) filter (where q.status = 'PENDING')::integer as pending_count,
      count(*) filter (where q.status = 'PROCESSING')::integer as processing_count,
      count(*) filter (where q.status = 'FAILED')::integer as failed_count,
      count(*) filter (where q.status = 'DONE')::integer as completed_count,
      coalesce(sum(q.attempts), 0)::integer as attempt_count,
      count(*) filter (where q.max_attempts > 0 and q.attempts >= q.max_attempts)::integer as exhausted_count,
      min(q.scheduled_at) filter (where q.status in ('PENDING', 'PROCESSING')) as oldest_open_scheduled_at,
      max(q.completed_at) filter (where q.status = 'DONE') as last_completed_at
    from public.plate_ocr_queue q
    join public.entry_logs el on el.id = q.entry_log_id
    where (
        q.status in ('PENDING', 'PROCESSING')
        or (
          q.status in ('DONE', 'FAILED')
          and coalesce(q.completed_at, q.scheduled_at, q.created_at) >= v_start
          and coalesce(q.completed_at, q.scheduled_at, q.created_at) < v_end
        )
      )
      and exists (select 1 from selected_communities sc where sc.id = el.community_id)
  ),
  usage_by_provider as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'provider', provider,
        'service_model', service_model,
        'operation', operation,
        'record_count', record_count,
        'quantity', quantity,
        'image_count', image_count,
        'input_tokens', input_tokens,
        'output_tokens', output_tokens,
        'estimated_cost', estimated_cost,
        'unknown_cost_count', unknown_cost_count
      )
      order by record_count desc, provider asc, operation asc
    ), '[]'::jsonb) as payload
    from (
      select
        u.provider,
        coalesce(u.service_model, 'not specified') as service_model,
        u.operation,
        count(*)::integer as record_count,
        coalesce(sum(u.quantity), 0)::numeric as quantity,
        coalesce(sum(u.image_count), 0)::integer as image_count,
        coalesce(sum(u.input_tokens), 0)::integer as input_tokens,
        coalesce(sum(u.output_tokens), 0)::integer as output_tokens,
        sum(u.estimated_cost) as estimated_cost,
        count(*) filter (where u.estimated_cost is null)::integer as unknown_cost_count
      from public.entry_usage_ledger u
      where u.occurred_at >= v_start
        and u.occurred_at < v_end
        and (
          (v_selected_community is null and u.community_id is null)
          or exists (select 1 from selected_communities sc where sc.id = u.community_id)
        )
      group by u.provider, coalesce(u.service_model, 'not specified'), u.operation
      order by count(*) desc
      limit 10
    ) provider_rows
  ),
  usage_by_community as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'community_id', community_id,
        'community_name', community_name,
        'record_count', record_count,
        'estimated_cost', estimated_cost,
        'unknown_cost_count', unknown_cost_count,
        'image_count', image_count,
        'input_tokens', input_tokens,
        'output_tokens', output_tokens
      )
      order by record_count desc, community_name asc
    ), '[]'::jsonb) as payload
    from (
      select
        u.community_id,
        coalesce(sc.name, 'ENTRY system') as community_name,
        count(*)::integer as record_count,
        sum(u.estimated_cost) as estimated_cost,
        count(*) filter (where u.estimated_cost is null)::integer as unknown_cost_count,
        coalesce(sum(u.image_count), 0)::integer as image_count,
        coalesce(sum(u.input_tokens), 0)::integer as input_tokens,
        coalesce(sum(u.output_tokens), 0)::integer as output_tokens
      from public.entry_usage_ledger u
      left join selected_communities sc on sc.id = u.community_id
      where u.occurred_at >= v_start
        and u.occurred_at < v_end
        and (
          (v_selected_community is null and u.community_id is null)
          or exists (select 1 from selected_communities sc2 where sc2.id = u.community_id)
        )
      group by u.community_id, coalesce(sc.name, 'ENTRY system')
      order by count(*) desc
      limit 10
    ) community_rows
  ),
  usage_daily as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'date', day::date,
        'record_count', record_count,
        'image_count', image_count,
        'estimated_cost', estimated_cost
      )
      order by day asc
    ), '[]'::jsonb) as payload
    from (
      select
        date_trunc('day', u.occurred_at) as day,
        count(*)::integer as record_count,
        coalesce(sum(u.image_count), 0)::integer as image_count,
        sum(u.estimated_cost) as estimated_cost
      from public.entry_usage_ledger u
      where u.occurred_at >= v_start
        and u.occurred_at < v_end
        and (
          (v_selected_community is null and u.community_id is null)
          or exists (select 1 from selected_communities sc where sc.id = u.community_id)
        )
      group by date_trunc('day', u.occurred_at)
      order by day asc
    ) daily_rows
  ),
  audit_rows as (
    select
      'superadmin_audit'::text as source,
      a.id::text as event_id,
      a.created_at as occurred_at,
      c.id as community_id,
      coalesce(c.name, 'ENTRY system') as community_name,
      a.action as action,
      coalesce(
        actor_profile.full_name,
        case
          when a.actor_user_id is not null then 'actor:' || left(a.actor_user_id::text, 8)
          else 'System'
        end
      ) as actor,
      coalesce(a.target_type, 'console') as target
    from public.superadmin_audit_log a
    left join public.communities c
      on c.id::text = coalesce(
        nullif(a.metadata->>'community_id', ''),
        case when a.target_type = 'community' then a.target_id::text end
      )
    left join lateral (
      select nullif(btrim(p.full_name), '') as full_name
      from public.profiles p
      where p.user_id = a.actor_user_id
      order by p.created_at desc
      limit 1
    ) actor_profile on true
    where a.created_at >= v_start
      and a.created_at < v_end
      and (
        (v_selected_community is null and c.id is null)
        or exists (select 1 from selected_communities sc where sc.id = c.id)
      )

    union all

    select
      'community_admin_activity'::text,
      l.id::text,
      l.created_at,
      l.community_id,
      sc.name,
      l.action_type,
      coalesce(
        actor_profile.full_name,
        case
          when l.actor_user_id is not null then 'actor:' || left(l.actor_user_id::text, 8)
          when nullif(l.actor_role, '') is not null then l.actor_role
          else 'System'
        end
      ),
      'community'
    from public.community_admin_activity_log l
    join selected_communities sc on sc.id = l.community_id
    left join lateral (
      select nullif(btrim(p.full_name), '') as full_name
      from public.profiles p
      where p.user_id = l.actor_user_id
      order by p.created_at desc
      limit 1
    ) actor_profile on true
    where l.created_at >= v_start
      and l.created_at < v_end
  ),
  audit_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'source', source,
        'event_id', event_id,
        'occurred_at', occurred_at,
        'community_id', community_id,
        'community_name', community_name,
        'action', action,
        'actor', actor,
        'target', target
      )
      order by occurred_at desc, event_id desc
    ), '[]'::jsonb) as payload
    from (
      select * from audit_rows
      order by occurred_at desc, event_id desc
      limit 12
    ) latest_audit
  ),
  summary as (
    select
      count(*)::integer as tracked_operations,
      count(*) filter (where is_failure)::integer as failed_operations,
      count(*) filter (where is_success)::integer as successful_operations,
      count(*) filter (where is_success or is_failure)::integer as known_outcome_operations,
      count(*) filter (where not is_success and not is_failure)::integer as unclassified_operations,
      percentile_cont(0.95) within group (order by duration_ms)
        filter (where duration_ms is not null)::numeric as p95_latency_ms,
      max(occurred_at) as last_observed_at
    from attempts_classified
  ),
  global_status as (
    select case
      when exists (
        select 1 from flows f
        where public._entry_observability_flow_status_v1(f.success_count, f.failure_count, f.last_success_at, f.evidence_count) = 'down'
      ) then 'down'
      when exists (select 1 from incidents where severity in ('CRITICAL', 'ERROR')) then 'degraded'
      when exists (
        select 1 from flows f
        where public._entry_observability_flow_status_v1(f.success_count, f.failure_count, f.last_success_at, f.evidence_count) = 'degraded'
      ) then 'degraded'
      when (select tracked_operations from summary) = 0 then 'unknown'
      when exists (
        select 1 from flows f
        where public._entry_observability_flow_status_v1(f.success_count, f.failure_count, f.last_success_at, f.evidence_count) = 'unknown'
      ) then 'unknown'
      else 'healthy'
    end as value
  )
  select jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object(
      'starts_at', v_start,
      'ends_at', v_end,
      'community_id', v_selected_community
    ),
    'communities', coalesce((
      select jsonb_agg(jsonb_build_object('id', ac.id, 'name', ac.name) order by ac.name asc)
      from active_communities ac
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'system_status', (select value from global_status),
      'tracked_operations', coalesce((select tracked_operations from summary), 0),
      'successful_operations', coalesce((select successful_operations from summary), 0),
      'failed_operations', coalesce((select failed_operations from summary), 0),
      'known_outcome_operations', coalesce((select known_outcome_operations from summary), 0),
      'unclassified_operations', coalesce((select unclassified_operations from summary), 0),
      'error_rate', case
        when coalesce((select known_outcome_operations from summary), 0) = 0 then null
        else round(
          coalesce((select failed_operations from summary), 0)::numeric
          / greatest((select known_outcome_operations from summary), 1)::numeric,
          4
        )
      end,
      'p95_latency_ms', round((select p95_latency_ms from summary), 0),
      'last_observed_at', (select last_observed_at from summary),
      'images_processed', (select image_count from usage_summary),
      'usage_records', (select record_count from usage_summary),
      'estimated_cost', (select estimated_cost from usage_summary),
      'unknown_cost_count', (select unknown_cost_count from usage_summary)
    ),
    'critical_flows', coalesce((select payload from flow_json), '[]'::jsonb),
    'incidents', coalesce((select payload from incident_json), '[]'::jsonb),
    'usage', jsonb_build_object(
      'summary', jsonb_build_object(
        'record_count', (select record_count from usage_summary),
        'success_count', (select success_count from usage_summary),
        'failed_count', (select failed_count from usage_summary),
        'quantity', (select quantity from usage_summary),
        'image_count', (select image_count from usage_summary),
        'input_tokens', (select input_tokens from usage_summary),
        'output_tokens', (select output_tokens from usage_summary),
        'estimated_cost', (select estimated_cost from usage_summary),
        'unknown_cost_count', (select unknown_cost_count from usage_summary)
      ),
      'by_provider', coalesce((select payload from usage_by_provider), '[]'::jsonb),
      'by_community', coalesce((select payload from usage_by_community), '[]'::jsonb),
      'daily', coalesce((select payload from usage_daily), '[]'::jsonb)
    ),
    'ocr_queue', jsonb_build_object(
      'total_jobs', coalesce((select total_jobs from ocr_queue_summary), 0),
      'pending_count', coalesce((select pending_count from ocr_queue_summary), 0),
      'processing_count', coalesce((select processing_count from ocr_queue_summary), 0),
      'failed_count', coalesce((select failed_count from ocr_queue_summary), 0),
      'completed_count', coalesce((select completed_count from ocr_queue_summary), 0),
      'attempt_count', coalesce((select attempt_count from ocr_queue_summary), 0),
      'exhausted_count', coalesce((select exhausted_count from ocr_queue_summary), 0),
      'oldest_open_scheduled_at', (select oldest_open_scheduled_at from ocr_queue_summary),
      'last_completed_at', (select last_completed_at from ocr_queue_summary),
      'provider_instrumented', false,
      'provider_usage_status', 'not_instrumented'
    ),
    'audit_activity', coalesce((select payload from audit_json), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.sa_get_entry_observability_v1(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.sa_get_entry_observability_v1(timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.sa_get_entry_observability_v1(timestamptz, timestamptz, uuid) to service_role;

comment on table public.entry_usage_ledger is
  'ENTRY provider usage ledger. Records billable or potentially billable external/provider operations with community attribution and historical pricing assumptions when known.';
comment on column public.entry_usage_ledger.estimated_cost is
  'Estimated cost at the time the usage was recorded. NULL means pricing was not safely known; old rows must not be recomputed with newer pricing.';
comment on column public.entry_usage_ledger.metadata is
  'Allowlisted operational metadata only. Do not store secrets, PINs, full OCR text, raw payloads, or unnecessary PII.';
comment on function public.record_entry_usage_v1(
  uuid, text, text, text, text, numeric, integer, integer, integer, integer,
  text, text, numeric, text, text, text, uuid, text, text, jsonb
) is
  'Service-role only ENTRY usage accounting helper. Stores measured provider usage and cost only when pricing is explicitly known.';
comment on function public.sa_get_entry_observability_v1(timestamptz, timestamptz, uuid) is
  'Superadmin-only ENTRY Observability v1 read model. Returns bounded summary, health, incidents, usage/cost, communities, and audit activity.';
