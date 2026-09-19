-- ENTRY-OBS-005: generalized capability taxonomy and durable capability signals.
--
-- The dashboard should describe product capabilities, not implementation details.
-- This read model keeps v1 as the compatibility base, then promotes six stable
-- capabilities: Authentication, Onboarding, Resident access, Gate access,
-- Communications, and Vision & recognition.
--
-- Workload-driven capabilities may be Idle. Idle is healthy-neutral and must not
-- force global system health to Unknown.

create or replace function public.sa_get_entry_observability_v2(
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
  v_flows jsonb := '[]'::jsonb;
  v_incidents jsonb := '[]'::jsonb;
  v_system_status text := 'unknown';
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

  v_result := public.sa_get_entry_observability_v1(
    v_start,
    v_end,
    p_community_id
  );

  with
  selected_communities as (
    select c.id, c.name
    from public.communities c
    where coalesce(c.is_active, false) = true
      and (p_community_id is null or c.id = p_community_id)
  ),
  base_flows as (
    select flow
    from jsonb_array_elements(coalesce(v_result->'critical_flows', '[]'::jsonb)) flow
  ),
  resident_population as (
    select
      p.user_id,
      p.community_id,
      p.house_id
    from public.profiles p
    join public.community_members cm
      on cm.user_id = p.user_id
     and cm.community_id = p.community_id
     and cm.is_active = true
    join selected_communities sc on sc.id = p.community_id
    where p.role = 'RESIDENT'
      and p.is_active = true
  ),
  resident_context as (
    select
      rp.user_id,
      rp.community_id,
      rp.house_id,
      (
        rp.house_id is not null
        and (
          select count(*)
          from public.house_residents hr
          join public.houses h
            on h.id = hr.house_id
           and h.community_id = hr.community_id
          where hr.user_id = rp.user_id
            and hr.community_id = rp.community_id
            and hr.house_id = rp.house_id
            and hr.is_active = true
            and hr.is_primary = true
            and h.is_active = true
        ) = 1
      ) as is_valid
    from resident_population rp
  ),
  resident_integrity as (
    select
      count(*)::integer as active_residents,
      count(*) filter (where not is_valid)::integer as invalid_residents
    from resident_context
  ),
  resident_integrity_by_community as (
    select
      rc.community_id,
      sc.name as community_name,
      count(*) filter (where not rc.is_valid)::integer as invalid_residents
    from resident_context rc
    join selected_communities sc on sc.id = rc.community_id
    group by rc.community_id, sc.name
  ),
  resident_access_extra as (
    select
      count(*)::integer as evidence_count,
      count(*) filter (
        where lower(coalesce(s.details->>'status', 'success')) in ('success', 'ok', 'completed')
          and public._entry_observability_severity_rank_v1(s.severity) < 3
      )::integer as success_count,
      count(*) filter (
        where lower(coalesce(s.details->>'status', '')) in ('failed', 'failure', 'error')
           or public._entry_observability_severity_rank_v1(s.severity) >= 3
      )::integer as failure_count,
      max(s.created_at) filter (
        where lower(coalesce(s.details->>'status', 'success')) in ('success', 'ok', 'completed')
          and public._entry_observability_severity_rank_v1(s.severity) < 3
      ) as last_success_at,
      max(s.created_at) as last_seen_at,
      percentile_cont(0.95) within group (
        order by public._entry_observability_jsonb_integer_v1(s.details, 'duration_ms')
      ) filter (
        where public._entry_observability_jsonb_integer_v1(s.details, 'duration_ms') is not null
      ) as p95_latency_ms
    from public.system_event_log s
    where s.created_at >= v_start
      and s.created_at < v_end
      and s.event_type in (
        'VISIT_GROUP_CREATED',
        'VISIT_GROUP_CREATE_FAILED',
        'FREQUENT_ACCESS_CREATED',
        'FREQUENT_ACCESS_CREATE_FAILED',
        'SELF_ACCESS_CREATE_FAILED',
        'RESIDENT_ACCESS_FAILED'
      )
      and exists (
        select 1 from selected_communities sc where sc.id = s.community_id
      )
  ),
  gate_attempts as (
    select
      el.action_at as occurred_at,
      'success'::text as status,
      null::integer as duration_ms
    from public.entry_logs el
    where el.action_at >= v_start
      and el.action_at < v_end
      and exists (
        select 1 from selected_communities sc where sc.id = el.community_id
      )

    union all

    select
      s.created_at,
      'failed',
      coalesce(
        public._entry_observability_jsonb_integer_v1(s.details, 'duration_ms'),
        public._entry_observability_jsonb_integer_v1(s.details, 'durationMs')
      )
    from public.system_event_log s
    where s.created_at >= v_start
      and s.created_at < v_end
      and s.event_type in (
        'QR_VALIDATION_FAILED',
        'ACCESS_QR_REJECTED',
        'PIN_VALIDATION_FAILED',
        'ACCESS_PIN_REJECTED',
        'SELF_ACCESS_VALIDATION_FAILED',
        'FREQUENT_ACCESS_VALIDATION_FAILED',
        'GATE_ACCESS_REJECTED',
        'GATE_ACCESS_FAILED'
      )
      and exists (
        select 1 from selected_communities sc where sc.id = s.community_id
      )
  ),
  gate_summary as (
    select
      count(*)::integer as evidence_count,
      count(*) filter (where status = 'success')::integer as success_count,
      count(*) filter (where status = 'failed')::integer as failure_count,
      max(occurred_at) filter (where status = 'success') as last_success_at,
      max(occurred_at) as last_seen_at,
      percentile_cont(0.95) within group (order by duration_ms)
        filter (where duration_ms is not null) as p95_latency_ms
    from gate_attempts
  ),
  onboarding_extra as (
    select
      count(*)::integer as evidence_count,
      count(*) filter (where s.event_type = 'ONBOARDING_ACTIVATED')::integer as success_count,
      count(*) filter (where s.event_type = 'ONBOARDING_ACTIVATION_FAILED')::integer as failure_count,
      max(s.created_at) filter (where s.event_type = 'ONBOARDING_ACTIVATED') as last_success_at,
      max(s.created_at) as last_seen_at
    from public.system_event_log s
    where s.created_at >= v_start
      and s.created_at < v_end
      and s.event_type in ('ONBOARDING_ACTIVATED', 'ONBOARDING_ACTIVATION_FAILED')
      and exists (
        select 1 from selected_communities sc where sc.id = s.community_id
      )
  ),
  onboarding_work as (
    select count(*)::integer as open_work
    from public.onboarding_campaign_messages m
    join public.onboarding_campaigns c on c.id = m.campaign_id
    where c.status = 'running'
      and m.status in ('pending', 'processing')
      and exists (
        select 1 from selected_communities sc where sc.id = m.community_id
      )
  ),
  communications_extra as (
    select
      count(*)::integer as evidence_count,
      count(*) filter (where s.event_type = 'ACTIVATION_EMAIL_SENT')::integer as success_count,
      count(*) filter (where s.event_type = 'ACTIVATION_EMAIL_FAILED')::integer as failure_count,
      max(s.created_at) filter (where s.event_type = 'ACTIVATION_EMAIL_SENT') as last_success_at,
      max(s.created_at) as last_seen_at,
      percentile_cont(0.95) within group (
        order by coalesce(
          public._entry_observability_jsonb_integer_v1(s.details, 'duration_ms'),
          public._entry_observability_jsonb_integer_v1(s.details, 'durationMs')
        )
      ) filter (
        where coalesce(
          public._entry_observability_jsonb_integer_v1(s.details, 'duration_ms'),
          public._entry_observability_jsonb_integer_v1(s.details, 'durationMs')
        ) is not null
      ) as p95_latency_ms
    from public.system_event_log s
    where s.created_at >= v_start
      and s.created_at < v_end
      and s.event_type in ('ACTIVATION_EMAIL_SENT', 'ACTIVATION_EMAIL_FAILED')
      and exists (
        select 1 from selected_communities sc where sc.id = s.community_id
      )
  ),
  worker_health as (
    select
      h.last_cycle_at,
      h.last_status,
      h.last_failure_at,
      h.last_error_code,
      h.last_error_summary,
      (
        h.last_cycle_at is null
        or h.last_cycle_at < now() - interval '6 minutes'
        or h.last_status = 'failure'
      ) as degraded
    from public.entry_notification_worker_health h
    where h.worker_name = 'community_message_push'
    limit 1
  ),
  vision_open_work as (
    select count(*)::integer as open_work
    from public.plate_ocr_queue q
    join public.entry_logs el on el.id = q.entry_log_id
    where q.status in ('PENDING', 'PROCESSING')
      and exists (
        select 1 from selected_communities sc where sc.id = el.community_id
      )
  ),
  values_base as (
    select
      coalesce((select (flow->>'success_count')::integer from base_flows where flow->>'key' = 'resident_login' limit 1), 0) as auth_success,
      coalesce((select (flow->>'failure_count')::integer from base_flows where flow->>'key' = 'resident_login' limit 1), 0) as auth_failure,
      coalesce((select (flow->>'evidence_count')::integer from base_flows where flow->>'key' = 'resident_login' limit 1), 0) as auth_evidence,
      (select (flow->>'last_success_at')::timestamptz from base_flows where flow->>'key' = 'resident_login' limit 1) as auth_last_success,
      (select (flow->>'last_seen_at')::timestamptz from base_flows where flow->>'key' = 'resident_login' limit 1) as auth_last_seen,
      (select (flow->>'p95_latency_ms')::numeric from base_flows where flow->>'key' = 'resident_login' limit 1) as auth_p95,

      coalesce((select (flow->>'success_count')::integer from base_flows where flow->>'key' = 'registration' limit 1), 0) as onboarding_success,
      coalesce((select (flow->>'failure_count')::integer from base_flows where flow->>'key' = 'registration' limit 1), 0) as onboarding_failure,
      coalesce((select (flow->>'evidence_count')::integer from base_flows where flow->>'key' = 'registration' limit 1), 0) as onboarding_evidence,
      (select (flow->>'last_success_at')::timestamptz from base_flows where flow->>'key' = 'registration' limit 1) as onboarding_last_success,
      (select (flow->>'last_seen_at')::timestamptz from base_flows where flow->>'key' = 'registration' limit 1) as onboarding_last_seen,

      coalesce((select (flow->>'success_count')::integer from base_flows where flow->>'key' = 'create_pass' limit 1), 0) as resident_success,
      coalesce((select (flow->>'failure_count')::integer from base_flows where flow->>'key' = 'create_pass' limit 1), 0) as resident_failure,
      coalesce((select (flow->>'evidence_count')::integer from base_flows where flow->>'key' = 'create_pass' limit 1), 0) as resident_evidence,
      (select (flow->>'last_success_at')::timestamptz from base_flows where flow->>'key' = 'create_pass' limit 1) as resident_last_success,
      (select (flow->>'last_seen_at')::timestamptz from base_flows where flow->>'key' = 'create_pass' limit 1) as resident_last_seen,
      (select (flow->>'p95_latency_ms')::numeric from base_flows where flow->>'key' = 'create_pass' limit 1) as resident_p95,

      coalesce((select (flow->>'success_count')::integer from base_flows where flow->>'key' = 'notifications' limit 1), 0) as communications_success,
      coalesce((select (flow->>'failure_count')::integer from base_flows where flow->>'key' = 'notifications' limit 1), 0) as communications_failure,
      coalesce((select (flow->>'evidence_count')::integer from base_flows where flow->>'key' = 'notifications' limit 1), 0) as communications_evidence,
      (select (flow->>'last_success_at')::timestamptz from base_flows where flow->>'key' = 'notifications' limit 1) as communications_last_success,
      (select (flow->>'last_seen_at')::timestamptz from base_flows where flow->>'key' = 'notifications' limit 1) as communications_last_seen,
      (select (flow->>'p95_latency_ms')::numeric from base_flows where flow->>'key' = 'notifications' limit 1) as communications_p95,

      coalesce((select (flow->>'success_count')::integer from base_flows where flow->>'key' = 'image_ocr' limit 1), 0) as vision_success,
      coalesce((select (flow->>'failure_count')::integer from base_flows where flow->>'key' = 'image_ocr' limit 1), 0) as vision_failure,
      coalesce((select (flow->>'evidence_count')::integer from base_flows where flow->>'key' = 'image_ocr' limit 1), 0) as vision_evidence,
      (select (flow->>'last_success_at')::timestamptz from base_flows where flow->>'key' = 'image_ocr' limit 1) as vision_last_success,
      (select (flow->>'last_seen_at')::timestamptz from base_flows where flow->>'key' = 'image_ocr' limit 1) as vision_last_seen,
      (select (flow->>'p95_latency_ms')::numeric from base_flows where flow->>'key' = 'image_ocr' limit 1) as vision_p95
  ),
  flow_rows as (
    select
      1 as ordinal,
      'authentication'::text as flow_key,
      'Authentication'::text as flow_label,
      public._entry_observability_flow_status_v1(
        vb.auth_success,
        vb.auth_failure,
        vb.auth_last_success,
        vb.auth_evidence
      ) as status,
      vb.auth_success as success_count,
      vb.auth_failure as failure_count,
      vb.auth_evidence as evidence_count,
      vb.auth_last_success as last_success_at,
      vb.auth_last_seen as last_seen_at,
      vb.auth_p95 as p95_latency_ms,
      'continuous'::text as health_mode
    from values_base vb

    union all

    select
      2,
      'onboarding',
      'Onboarding',
      case
        when vb.onboarding_evidence + oe.evidence_count = 0
         and ow.open_work = 0 then 'idle'
        else public._entry_observability_flow_status_v1(
          vb.onboarding_success + oe.success_count,
          vb.onboarding_failure + oe.failure_count,
          greatest(vb.onboarding_last_success, oe.last_success_at),
          vb.onboarding_evidence + oe.evidence_count
        )
      end,
      vb.onboarding_success + oe.success_count,
      vb.onboarding_failure + oe.failure_count,
      vb.onboarding_evidence + oe.evidence_count,
      greatest(vb.onboarding_last_success, oe.last_success_at),
      greatest(vb.onboarding_last_seen, oe.last_seen_at),
      null::numeric,
      'workload'
    from values_base vb
    cross join onboarding_extra oe
    cross join onboarding_work ow

    union all

    select
      3,
      'resident_access',
      'Resident access',
      case
        when ri.invalid_residents > 0
         and ri.active_residents > 0
         and ri.invalid_residents >= ri.active_residents then 'down'
        when ri.invalid_residents > 0 then 'degraded'
        else public._entry_observability_flow_status_v1(
          vb.resident_success + rae.success_count,
          vb.resident_failure + rae.failure_count,
          greatest(vb.resident_last_success, rae.last_success_at),
          vb.resident_evidence + rae.evidence_count
        )
      end,
      vb.resident_success + rae.success_count,
      vb.resident_failure + rae.failure_count + ri.invalid_residents,
      vb.resident_evidence + rae.evidence_count + ri.invalid_residents,
      greatest(vb.resident_last_success, rae.last_success_at),
      case
        when ri.invalid_residents > 0 then v_end
        else greatest(vb.resident_last_seen, rae.last_seen_at)
      end,
      coalesce(rae.p95_latency_ms, vb.resident_p95),
      'continuous'
    from values_base vb
    cross join resident_access_extra rae
    cross join resident_integrity ri

    union all

    select
      4,
      'gate_access',
      'Gate access',
      public._entry_observability_flow_status_v1(
        gs.success_count,
        gs.failure_count,
        gs.last_success_at,
        gs.evidence_count
      ),
      gs.success_count,
      gs.failure_count,
      gs.evidence_count,
      gs.last_success_at,
      gs.last_seen_at,
      gs.p95_latency_ms,
      'continuous'
    from gate_summary gs

    union all

    select
      5,
      'communications',
      'Communications',
      case
        when public._entry_observability_flow_status_v1(
          vb.communications_success + ce.success_count,
          vb.communications_failure + ce.failure_count,
          greatest(vb.communications_last_success, ce.last_success_at),
          vb.communications_evidence + ce.evidence_count
        ) = 'down' then 'down'
        when coalesce((select degraded from worker_health), false) then 'degraded'
        else public._entry_observability_flow_status_v1(
          vb.communications_success + ce.success_count,
          vb.communications_failure + ce.failure_count,
          greatest(vb.communications_last_success, ce.last_success_at),
          vb.communications_evidence + ce.evidence_count
        )
      end,
      vb.communications_success + ce.success_count,
      vb.communications_failure + ce.failure_count,
      vb.communications_evidence + ce.evidence_count,
      greatest(vb.communications_last_success, ce.last_success_at),
      greatest(vb.communications_last_seen, ce.last_seen_at),
      coalesce(ce.p95_latency_ms, vb.communications_p95),
      'continuous'
    from values_base vb
    cross join communications_extra ce

    union all

    select
      6,
      'vision_recognition',
      'Vision & recognition',
      case
        when vb.vision_evidence = 0 and vow.open_work = 0 then 'idle'
        else public._entry_observability_flow_status_v1(
          vb.vision_success,
          vb.vision_failure,
          vb.vision_last_success,
          vb.vision_evidence
        )
      end,
      vb.vision_success,
      vb.vision_failure,
      vb.vision_evidence,
      vb.vision_last_success,
      vb.vision_last_seen,
      vb.vision_p95,
      'workload'
    from values_base vb
    cross join vision_open_work vow
  ),
  flow_json as (
    select jsonb_agg(
      jsonb_build_object(
        'key', fr.flow_key,
        'label', fr.flow_label,
        'status', fr.status,
        'success_count', fr.success_count,
        'failure_count', fr.failure_count,
        'evidence_count', fr.evidence_count,
        'last_success_at', fr.last_success_at,
        'last_seen_at', fr.last_seen_at,
        'p95_latency_ms', round(fr.p95_latency_ms, 0),
        'health_mode', fr.health_mode
      )
      order by fr.ordinal
    ) as payload
    from flow_rows fr
  ),
  integrity_incident as (
    select
      case
        when ri.invalid_residents = 0 then null::jsonb
        else jsonb_build_object(
          'fingerprint', 'resident_access:resident_house_context_invalid',
          'severity', case
            when ri.active_residents > 0 and ri.invalid_residents >= ri.active_residents
              then 'CRITICAL'
            else 'ERROR'
          end,
          'source', 'resident_house_integrity',
          'event_type', 'RESIDENT_HOUSE_CONTEXT_INVALID',
          'error_code', 'RESIDENT_HOUSE_CONTEXT_INVALID',
          'occurrence_count', ri.invalid_residents,
          'affected_community_count', (
            select count(*)::integer
            from resident_integrity_by_community c
            where c.invalid_residents > 0
          ),
          'first_seen_at', v_end,
          'last_seen_at', v_end,
          'explanation', 'Active residents have an invalid or ambiguous primary-house context.',
          'communities', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'community_id', c.community_id,
                'community_name', c.community_name,
                'occurrence_count', c.invalid_residents
              )
              order by c.invalid_residents desc, c.community_name
            )
            from resident_integrity_by_community c
            where c.invalid_residents > 0
          ), '[]'::jsonb)
        )
      end as payload
    from resident_integrity ri
  ),
  worker_incident as (
    select
      case
        when not coalesce(wh.degraded, false) then null::jsonb
        else jsonb_build_object(
          'fingerprint', 'communications:notification_worker_unhealthy',
          'severity', 'ERROR',
          'source', 'entry_worker_health',
          'event_type', 'COMMUNICATIONS_WORKER_UNHEALTHY',
          'error_code', coalesce(wh.last_error_code, 'COMMUNICATIONS_WORKER_STALE'),
          'occurrence_count', 1,
          'affected_community_count', 0,
          'first_seen_at', coalesce(wh.last_failure_at, wh.last_cycle_at, v_end),
          'last_seen_at', v_end,
          'explanation', case
            when wh.last_cycle_at is null or wh.last_cycle_at < now() - interval '6 minutes'
              then 'The communications worker heartbeat is stale.'
            else 'The communications worker latest cycle is failing.'
          end,
          'communities', '[]'::jsonb
        )
      end as payload
    from worker_health wh
  )
  select
    coalesce((select payload from flow_json), '[]'::jsonb),
    (
      coalesce((
        select jsonb_agg(x.event)
        from (
          select ii.payload as event, 1 as ordinal from integrity_incident ii where ii.payload is not null
          union all
          select wi.payload, 2 from worker_incident wi where wi.payload is not null
          union all
          select e.value, 10 + e.ordinality::integer
          from jsonb_array_elements(coalesce(v_result->'incidents', '[]'::jsonb))
            with ordinality e(value, ordinality)
        ) x
        order by x.ordinal
      ), '[]'::jsonb)
    )
  into v_flows, v_incidents;

  v_result := jsonb_set(v_result, '{critical_flows}', v_flows, true);
  v_result := jsonb_set(v_result, '{incidents}', v_incidents, true);

  select case
    when exists (
      select 1
      from jsonb_array_elements(v_flows) f
      where f->>'status' = 'down'
    ) then 'down'
    when exists (
      select 1
      from jsonb_array_elements(v_incidents) i
      where i->>'severity' in ('CRITICAL', 'ERROR')
    ) then 'degraded'
    when exists (
      select 1
      from jsonb_array_elements(v_flows) f
      where f->>'status' = 'degraded'
    ) then 'degraded'
    when jsonb_array_length(v_flows) = 0 then 'unknown'
    when exists (
      select 1
      from jsonb_array_elements(v_flows) f
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

  return v_result;
end;
$function$;

revoke all on function public.sa_get_entry_observability_v2(
  timestamptz, timestamptz, uuid
) from public, anon;
grant execute on function public.sa_get_entry_observability_v2(
  timestamptz, timestamptz, uuid
) to authenticated;
grant execute on function public.sa_get_entry_observability_v2(
  timestamptz, timestamptz, uuid
) to service_role;

comment on function public.sa_get_entry_observability_v2(
  timestamptz, timestamptz, uuid
) is
  'Superadmin-only ENTRY capability observability read model. Uses stable product capability categories, current resident-house integrity, workload-aware Idle states, and communications worker health.';
