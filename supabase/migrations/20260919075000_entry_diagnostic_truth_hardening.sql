-- ENTRY diagnostic truth hardening.
--
-- Separates current operational state from historical failures inside a selected
-- troubleshooting window, and distinguishes delivery-unavailable push outcomes
-- (no registered device) from actual queue/system failures.

create or replace function public._entry_build_auto_diagnostic_payload_v1(
  p_incident_id uuid,
  p_trigger_type text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_incident public.entry_observability_incidents%rowtype;
  v_community_name text;
  v_active_incidents jsonb;
  v_workers jsonb;
  v_queues jsonb;
  v_database jsonb;
  v_recent_events jsonb;
begin
  select * into v_incident
  from public.entry_observability_incidents
  where id = p_incident_id;

  if not found then
    return '{}'::jsonb;
  end if;

  select c.name into v_community_name
  from public.communities c
  where c.id = v_incident.community_id;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', i.id,
    'capability', i.capability,
    'event_type', i.event_type,
    'error_code', i.error_code,
    'severity', i.severity,
    'status', i.status,
    'first_seen_at', i.first_seen_at,
    'last_seen_at', i.last_seen_at,
    'occurrence_count', i.occurrence_count,
    'details', i.last_details
  )) order by i.last_seen_at desc), '[]'::jsonb)
  into v_active_incidents
  from public.entry_observability_incidents i
  where i.status = 'open'
    and (
      v_incident.community_id is null
      or i.community_id = v_incident.community_id
      or i.community_id is null
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'name', j.jobname,
    'schedule', j.schedule,
    'status', coalesce(d.status,'unknown'),
    'last_started_at', d.start_time,
    'last_finished_at', d.end_time
  ) order by j.jobname), '[]'::jsonb)
  into v_workers
  from cron.job j
  left join lateral (
    select r.status, r.start_time, r.end_time
    from cron.job_run_details r
    where r.jobid = j.jobid
    order by r.start_time desc
    limit 1
  ) d on true
  where j.active = true;

  select jsonb_build_array(
    jsonb_build_object(
      'name','Mobile push queue',
      'open_count',(
        select count(*) from public.community_message_push_queue q
        where q.status in ('pending','processing')
          and (v_incident.community_id is null or q.community_id = v_incident.community_id)
      ),
      'failed_count',(
        select count(*) from public.community_message_push_queue q
        where q.status = 'failed'
          and coalesce(q.last_error,'') not ilike 'No active push tokens found for audience%'
          and (v_incident.community_id is null or q.community_id = v_incident.community_id)
      ),
      'delivery_unavailable_count',(
        select count(*) from public.community_message_push_queue q
        where q.status = 'failed'
          and coalesce(q.last_error,'') ilike 'No active push tokens found for audience%'
          and (v_incident.community_id is null or q.community_id = v_incident.community_id)
      ),
      'oldest_open_at',(
        select min(q.created_at) from public.community_message_push_queue q
        where q.status in ('pending','processing')
          and (v_incident.community_id is null or q.community_id = v_incident.community_id)
      )
    ),
    jsonb_build_object(
      'name','OCR queue',
      'open_count',(
        select count(*)
        from public.plate_ocr_queue q
        join public.entry_logs el on el.id = q.entry_log_id
        where q.status in ('PENDING','PROCESSING')
          and (v_incident.community_id is null or el.community_id = v_incident.community_id)
      ),
      'failed_count',(
        select count(*)
        from public.plate_ocr_queue q
        join public.entry_logs el on el.id = q.entry_log_id
        where q.status = 'FAILED'
          and (v_incident.community_id is null or el.community_id = v_incident.community_id)
      ),
      'delivery_unavailable_count',0,
      'oldest_open_at',(
        select min(q.created_at)
        from public.plate_ocr_queue q
        join public.entry_logs el on el.id = q.entry_log_id
        where q.status in ('PENDING','PROCESSING')
          and (v_incident.community_id is null or el.community_id = v_incident.community_id)
      )
    )
  )
  into v_queues;

  select jsonb_build_object(
    'connections', d.numbackends,
    'deadlocks', d.deadlocks,
    'conflicts', d.conflicts,
    'cache_hit_percent', case
      when d.blks_hit + d.blks_read = 0 then null
      else round((d.blks_hit::numeric / (d.blks_hit + d.blks_read)) * 100, 2)
    end,
    'stats_reset', d.stats_reset
  )
  into v_database
  from pg_stat_database d
  where d.datname = current_database();

  v_recent_events := public._entry_diagnostic_recent_events_v1(
    p_starts_at,
    p_ends_at,
    v_incident.community_id,
    200
  );

  return jsonb_build_object(
    'schema_version', 2,
    'generated_at', now(),
    'trigger', p_trigger_type,
    'range', jsonb_build_object(
      'starts_at', p_starts_at,
      'ends_at', p_ends_at
    ),
    'community', jsonb_strip_nulls(jsonb_build_object(
      'id', v_incident.community_id,
      'name', v_community_name
    )),
    'trigger_incident', jsonb_strip_nulls(jsonb_build_object(
      'id', v_incident.id,
      'capability', v_incident.capability,
      'event_type', v_incident.event_type,
      'error_code', v_incident.error_code,
      'severity', v_incident.severity,
      'status', v_incident.status,
      'first_seen_at', v_incident.first_seen_at,
      'last_seen_at', v_incident.last_seen_at,
      'resolved_at', v_incident.resolved_at,
      'occurrence_count', v_incident.occurrence_count,
      'details', v_incident.last_details
    )),
    'active_incidents', v_active_incidents,
    'infrastructure', jsonb_build_object(
      'workers', v_workers,
      'queues', v_queues,
      'database', v_database
    ),
    'recent_events', v_recent_events,
    'privacy', jsonb_build_object(
      'pii_minimized', true,
      'excluded', jsonb_build_array(
        'passwords','pins','qr_tokens','push_tokens','visitor_names','email_addresses','message_bodies'
      )
    )
  );
end;
$$;

revoke all on function public._entry_build_auto_diagnostic_payload_v1(uuid,text,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public._entry_build_auto_diagnostic_payload_v1(uuid,text,timestamptz,timestamptz)
  to service_role;

create or replace function public.sa_generate_entry_diagnostic_bundle_v1(
  p_starts_at timestamptz,
  p_ends_at timestamptz default now(),
  p_community_id uuid default null,
  p_save boolean default false,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz := p_starts_at;
  v_end timestamptz := coalesce(p_ends_at, now());
  v_current_start timestamptz;
  v_observability jsonb;
  v_current_observability jsonb;
  v_events jsonb;
  v_bundle jsonb;
  v_snapshot_id uuid;
  v_snapshot_ref text;
  v_community_name text;
  v_current_incidents jsonb;
  v_historical_signals jsonb;
  v_suspected_areas jsonb;
  v_down_flows jsonb;
  v_degraded_flows jsonb;
  v_queue_health jsonb;
  v_status text;
  v_window_status text;
  v_current_incident_count integer;
  v_error_count integer;
  v_warning_count integer;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode='42501';
  end if;

  if v_start is null or v_end <= v_start or v_end - v_start > interval '31 days' then
    raise exception 'Invalid diagnostic time range' using errcode='22023';
  end if;

  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Diagnostic notes are too long' using errcode='22023';
  end if;

  if p_community_id is not null then
    select c.name into v_community_name
    from public.communities c
    where c.id = p_community_id;

    if v_community_name is null then
      raise exception 'Unknown community' using errcode='22023';
    end if;
  end if;

  v_observability := public.sa_get_entry_observability_v4(
    v_start,
    v_end,
    p_community_id
  );

  v_current_start := greatest(v_start, v_end - interval '6 hours');
  v_current_observability := public.sa_get_entry_observability_v4(
    v_current_start,
    v_end,
    p_community_id
  );

  v_events := public._entry_diagnostic_recent_events_v1(
    v_start,
    v_end,
    p_community_id,
    300
  );

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id', i.id,
    'fingerprint', i.fingerprint,
    'capability', i.capability,
    'event_type', i.event_type,
    'error_code', i.error_code,
    'severity', i.severity,
    'status', i.status,
    'community_id', i.community_id,
    'community_name', c.name,
    'first_seen_at', i.first_seen_at,
    'last_seen_at', i.last_seen_at,
    'occurrence_count', i.occurrence_count,
    'details', i.last_details
  )) order by
    case i.severity when 'CRITICAL' then 4 when 'ERROR' then 3 when 'WARNING' then 2 else 1 end desc,
    i.last_seen_at desc), '[]'::jsonb)
  into v_current_incidents
  from public.entry_observability_incidents i
  left join public.communities c on c.id = i.community_id
  where i.status = 'open'
    and (
      p_community_id is null
      or i.community_id = p_community_id
      or i.community_id is null
    );

  select coalesce(jsonb_agg(w.value order by
    case w.value->>'severity' when 'CRITICAL' then 4 when 'ERROR' then 3 when 'WARNING' then 2 else 1 end desc,
    nullif(w.value->>'last_seen_at','')::timestamptz desc nulls last
  ), '[]'::jsonb)
  into v_historical_signals
  from jsonb_array_elements(coalesce(v_observability->'incidents','[]'::jsonb)) w(value)
  where not exists (
    select 1
    from jsonb_array_elements(v_current_incidents) c(value)
    where coalesce(c.value->>'fingerprint','') <> ''
      and c.value->>'fingerprint' = w.value->>'fingerprint'
  );

  v_status := coalesce(v_current_observability->'summary'->>'system_status','unknown');
  v_window_status := coalesce(v_observability->'summary'->>'system_status','unknown');
  v_current_incident_count := jsonb_array_length(v_current_incidents);

  select count(*) filter (where i->>'severity' in ('ERROR','CRITICAL')),
         count(*) filter (where i->>'severity' = 'WARNING')
  into v_error_count, v_warning_count
  from jsonb_array_elements(v_current_incidents) i;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', f->>'key',
    'label', f->>'label',
    'status', f->>'status'
  ) order by f->>'label'), '[]'::jsonb)
  into v_down_flows
  from jsonb_array_elements(coalesce(v_current_observability->'critical_flows','[]'::jsonb)) f
  where f->>'status' = 'down';

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', f->>'key',
    'label', f->>'label',
    'status', f->>'status'
  ) order by f->>'label'), '[]'::jsonb)
  into v_degraded_flows
  from jsonb_array_elements(coalesce(v_current_observability->'critical_flows','[]'::jsonb)) f
  where f->>'status' = 'degraded';

  with incident_codes as (
    select upper(coalesce(i->>'error_code', i->>'event_type','')) as code,
           lower(coalesce(i->>'source','')) as source
    from jsonb_array_elements(v_current_incidents) i
  ),
  areas as (
    select distinct area
    from incident_codes,
    lateral (
      values
        (case when code like '%HOUSE_CONTEXT%' then 'profiles.house_id / house_residents / community_members' end),
        (case when code like '%GUARD_PUSH%' or code like '%PUSH_COVERAGE%' then 'user_push_tokens / guard mobile registration' end),
        (case when code like '%WORKER%' then 'background worker heartbeat / cron execution' end),
        (case when code like '%QUEUE%' then 'queue backlog / retry state' end),
        (case when code like '%AUTH%' then 'authentication / profiles / community_members' end),
        (case when code like '%OCR%' then 'plate_ocr_queue / image processing provider' end),
        (case when code like '%PASS%' or code like '%ACCESS%' then 'resident access authorization / gate resolution' end),
        (case when source like '%client%' then 'ENTRY client runtime' end)
    ) x(area)
    where area is not null
  )
  select coalesce(jsonb_agg(area order by area), '[]'::jsonb)
  into v_suspected_areas
  from areas;

  select jsonb_build_object(
    'mobile_push', jsonb_build_object(
      'open_count', (
        select count(*)
        from public.community_message_push_queue q
        where q.status in ('pending','processing')
          and (p_community_id is null or q.community_id = p_community_id)
      ),
      'system_failed_count', (
        select count(*)
        from public.community_message_push_queue q
        where q.status = 'failed'
          and coalesce(q.last_error,'') not ilike 'No active push tokens found for audience%'
          and coalesce(q.completed_at,q.updated_at,q.created_at) >= v_start
          and coalesce(q.completed_at,q.updated_at,q.created_at) < v_end
          and (p_community_id is null or q.community_id = p_community_id)
      ),
      'delivery_unavailable_count', (
        select count(*)
        from public.community_message_push_queue q
        where q.status = 'failed'
          and coalesce(q.last_error,'') ilike 'No active push tokens found for audience%'
          and coalesce(q.completed_at,q.updated_at,q.created_at) >= v_start
          and coalesce(q.completed_at,q.updated_at,q.created_at) < v_end
          and (p_community_id is null or q.community_id = p_community_id)
      ),
      'sent_count', (
        select count(*)
        from public.community_message_push_queue q
        where q.status = 'sent'
          and coalesce(q.completed_at,q.updated_at,q.created_at) >= v_start
          and coalesce(q.completed_at,q.updated_at,q.created_at) < v_end
          and (p_community_id is null or q.community_id = p_community_id)
      ),
      'oldest_open_at', (
        select min(q.created_at)
        from public.community_message_push_queue q
        where q.status in ('pending','processing')
          and (p_community_id is null or q.community_id = p_community_id)
      )
    ),
    'activation', jsonb_build_object(
      'open_count', (
        select count(*)
        from public.resident_activation_queue q
        where q.status in ('pending','invited')
          and (p_community_id is null or q.community_id = p_community_id)
      ),
      'system_failed_count', 0,
      'delivery_unavailable_count', 0,
      'oldest_open_at', (
        select min(q.created_at)
        from public.resident_activation_queue q
        where q.status in ('pending','invited')
          and (p_community_id is null or q.community_id = p_community_id)
      )
    ),
    'ocr', jsonb_build_object(
      'open_count', (
        select count(*)
        from public.plate_ocr_queue q
        join public.entry_logs el on el.id = q.entry_log_id
        where q.status in ('PENDING','PROCESSING')
          and (p_community_id is null or el.community_id = p_community_id)
      ),
      'system_failed_count', (
        select count(*)
        from public.plate_ocr_queue q
        join public.entry_logs el on el.id = q.entry_log_id
        where q.status = 'FAILED'
          and coalesce(q.completed_at,q.updated_at,q.created_at) >= v_start
          and coalesce(q.completed_at,q.updated_at,q.created_at) < v_end
          and (p_community_id is null or el.community_id = p_community_id)
      ),
      'delivery_unavailable_count', 0,
      'oldest_open_at', (
        select min(q.created_at)
        from public.plate_ocr_queue q
        join public.entry_logs el on el.id = q.entry_log_id
        where q.status in ('PENDING','PROCESSING')
          and (p_community_id is null or el.community_id = p_community_id)
      )
    )
  )
  into v_queue_health;

  v_bundle := jsonb_build_object(
    'schema_version', 2,
    'generated_at', now(),
    'community', jsonb_strip_nulls(jsonb_build_object(
      'id', p_community_id,
      'name', v_community_name
    )),
    'range', jsonb_build_object(
      'starts_at', v_start,
      'ends_at', v_end
    ),
    'triage_summary', jsonb_build_object(
      'system_status', v_status,
      'window_status', v_window_status,
      'active_incident_count', v_current_incident_count,
      'error_or_critical_count', coalesce(v_error_count,0),
      'warning_count', coalesce(v_warning_count,0),
      'historical_failure_signal_count', jsonb_array_length(v_historical_signals),
      'down_flows', v_down_flows,
      'degraded_flows', v_degraded_flows
    ),
    'current_incidents', v_current_incidents,
    'historical_failure_signals', v_historical_signals,
    'queue_health', v_queue_health,
    'suspected_areas', v_suspected_areas,
    'observability', v_observability,
    'current_observability', v_current_observability,
    'recent_events', v_events,
    'privacy', jsonb_build_object(
      'pii_minimized', true,
      'excluded', jsonb_build_array(
        'passwords','pins','qr_tokens','push_tokens','visitor_names','email_addresses','message_bodies'
      )
    )
  );

  if p_save then
    v_snapshot_ref := public._entry_diagnostic_ref_v1();

    insert into public.entry_diagnostic_snapshots (
      diagnostic_ref,
      created_by,
      community_id,
      starts_at,
      ends_at,
      system_status,
      trigger_type,
      notes,
      payload,
      expires_at
    )
    values (
      v_snapshot_ref,
      auth.uid(),
      p_community_id,
      v_start,
      v_end,
      v_status,
      'manual',
      nullif(left(btrim(coalesce(p_notes,'')),1000),''),
      v_bundle,
      now() + interval '180 days'
    )
    returning id into v_snapshot_id;
  end if;

  return jsonb_build_object(
    'bundle', v_bundle,
    'snapshot', case
      when v_snapshot_id is null then null
      else jsonb_build_object(
        'id', v_snapshot_id,
        'diagnostic_ref', v_snapshot_ref,
        'created_at', now()
      )
    end
  );
end;
$$;

revoke all on function public.sa_generate_entry_diagnostic_bundle_v1(timestamptz,timestamptz,uuid,boolean,text)
  from public, anon;
grant execute on function public.sa_generate_entry_diagnostic_bundle_v1(timestamptz,timestamptz,uuid,boolean,text)
  to authenticated, service_role;

comment on function public.sa_generate_entry_diagnostic_bundle_v1(timestamptz,timestamptz,uuid,boolean,text) is
  'Superadmin ENTRY diagnostic bundle. Separates current open incidents from historical selected-window signals and classifies no-device push outcomes separately from system failures.';
