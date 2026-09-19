-- ENTRY diagnostics: consolidated troubleshooting bundles and automatic incident snapshots.
--
-- Manual bundles are superadmin-generated and can be copied/downloaded or saved.
-- ERROR/CRITICAL incident open/recovery transitions create fail-open automatic snapshots.
-- Payloads intentionally exclude credentials, PINs, QR values, raw push tokens,
-- visitor names, email addresses, and raw provider payloads.

create table if not exists public.entry_diagnostic_snapshots (
  id uuid primary key default gen_random_uuid(),
  diagnostic_ref text not null unique,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  community_id uuid null references public.communities(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  system_status text null,
  trigger_type text not null,
  trigger_incident_id uuid null references public.entry_observability_incidents(id) on delete set null,
  notes text null,
  payload jsonb not null,
  expires_at timestamptz not null,
  constraint entry_diagnostic_snapshots_range_ck check (ends_at > starts_at),
  constraint entry_diagnostic_snapshots_trigger_ck check (
    trigger_type in ('manual','incident_open','incident_recovery')
  ),
  constraint entry_diagnostic_snapshots_status_ck check (
    system_status is null or system_status in ('healthy','degraded','down','idle','unknown')
  ),
  constraint entry_diagnostic_snapshots_notes_ck check (
    notes is null or char_length(notes) <= 1000
  )
);

create index if not exists idx_entry_diagnostic_snapshots_created
  on public.entry_diagnostic_snapshots (created_at desc);
create index if not exists idx_entry_diagnostic_snapshots_community_created
  on public.entry_diagnostic_snapshots (community_id, created_at desc);
create index if not exists idx_entry_diagnostic_snapshots_incident
  on public.entry_diagnostic_snapshots (trigger_incident_id, created_at desc)
  where trigger_incident_id is not null;

alter table public.entry_diagnostic_snapshots enable row level security;
revoke all on table public.entry_diagnostic_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.entry_diagnostic_snapshots to service_role;

create or replace function public._entry_diagnostic_ref_v1()
returns text
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select 'ENTRY-DIAG-' ||
         to_char(clock_timestamp(), 'YYYYMMDD-HH24MI') || '-' ||
         upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
$$;

revoke all on function public._entry_diagnostic_ref_v1()
  from public, anon, authenticated;
grant execute on function public._entry_diagnostic_ref_v1() to service_role;

create or replace function public._entry_diagnostic_recent_events_v1(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_community_id uuid default null,
  p_limit integer default 300
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(event order by event_time desc), '[]'::jsonb)
  from (
    select
      s.created_at as event_time,
      jsonb_strip_nulls(jsonb_build_object(
        'id', s.id,
        'occurred_at', s.created_at,
        'severity', s.severity,
        'module', s.module,
        'event_type', s.event_type,
        'source', s.source,
        'community_id', s.community_id,
        'entity_type', s.entity_type,
        'status', nullif(s.details->>'status',''),
        'error_code', coalesce(nullif(s.details->>'error_code',''), nullif(s.details->>'code','')),
        'fingerprint', coalesce(
          nullif(s.details->>'error_fingerprint',''),
          nullif(s.details->>'fingerprint','')
        ),
        'duration_ms', case
          when (s.details->>'duration_ms') ~ '^\d+$' then (s.details->>'duration_ms')::integer
          when (s.details->>'durationMs') ~ '^\d+$' then (s.details->>'durationMs')::integer
          else null
        end,
        'operation', nullif(s.details->>'operation',''),
        'provider', nullif(s.details->>'provider',''),
        'attempts', case
          when (s.details->>'attempts') ~ '^\d+$' then (s.details->>'attempts')::integer
          else null
        end
      )) as event
    from public.system_event_log s
    where s.created_at >= p_starts_at
      and s.created_at < p_ends_at
      and (p_community_id is null or s.community_id = p_community_id)
    order by s.created_at desc
    limit least(greatest(coalesce(p_limit,300),1),500)
  ) x
$$;

revoke all on function public._entry_diagnostic_recent_events_v1(timestamptz,timestamptz,uuid,integer)
  from public, anon, authenticated;
grant execute on function public._entry_diagnostic_recent_events_v1(timestamptz,timestamptz,uuid,integer)
  to service_role;

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
    'schema_version', 1,
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

create or replace function public._entry_capture_incident_diagnostic_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trigger_type text;
  v_starts_at timestamptz := now() - interval '60 minutes';
  v_ends_at timestamptz := now();
  v_payload jsonb;
begin
  if tg_op = 'INSERT' then
    if NEW.status <> 'open' or NEW.severity not in ('ERROR','CRITICAL') then
      return NEW;
    end if;
    v_trigger_type := 'incident_open';
  elsif tg_op = 'UPDATE' then
    if OLD.status <> 'open' or NEW.status <> 'resolved'
       or NEW.severity not in ('ERROR','CRITICAL') then
      return NEW;
    end if;
    v_trigger_type := 'incident_recovery';
  else
    return NEW;
  end if;

  v_payload := public._entry_build_auto_diagnostic_payload_v1(
    NEW.id,
    v_trigger_type,
    v_starts_at,
    v_ends_at
  );

  insert into public.entry_diagnostic_snapshots (
    diagnostic_ref,
    created_by,
    community_id,
    starts_at,
    ends_at,
    system_status,
    trigger_type,
    trigger_incident_id,
    payload,
    expires_at
  )
  values (
    public._entry_diagnostic_ref_v1(),
    null,
    NEW.community_id,
    v_starts_at,
    v_ends_at,
    case
      when NEW.severity = 'CRITICAL' then 'down'
      else 'degraded'
    end,
    v_trigger_type,
    NEW.id,
    v_payload,
    now() + interval '90 days'
  );

  return NEW;
exception when others then
  -- Diagnostics are fail-open and must never interfere with incident reconciliation.
  return NEW;
end;
$$;

revoke all on function public._entry_capture_incident_diagnostic_v1()
  from public, anon, authenticated;

drop trigger if exists trg_entry_capture_incident_diagnostic_open_v1
  on public.entry_observability_incidents;
create trigger trg_entry_capture_incident_diagnostic_open_v1
after insert on public.entry_observability_incidents
for each row
execute function public._entry_capture_incident_diagnostic_v1();

drop trigger if exists trg_entry_capture_incident_diagnostic_recovery_v1
  on public.entry_observability_incidents;
create trigger trg_entry_capture_incident_diagnostic_recovery_v1
after update of status on public.entry_observability_incidents
for each row
when (OLD.status is distinct from NEW.status)
execute function public._entry_capture_incident_diagnostic_v1();

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
  v_observability jsonb;
  v_events jsonb;
  v_bundle jsonb;
  v_snapshot_id uuid;
  v_snapshot_ref text;
  v_community_name text;
  v_suspected_areas jsonb;
  v_down_flows jsonb;
  v_degraded_flows jsonb;
  v_status text;
  v_active_incident_count integer;
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

  v_events := public._entry_diagnostic_recent_events_v1(
    v_start,
    v_end,
    p_community_id,
    300
  );

  v_status := coalesce(v_observability->'summary'->>'system_status','unknown');
  v_active_incident_count := jsonb_array_length(coalesce(v_observability->'incidents','[]'::jsonb));

  select count(*) filter (where i->>'severity' in ('ERROR','CRITICAL')),
         count(*) filter (where i->>'severity' = 'WARNING')
  into v_error_count, v_warning_count
  from jsonb_array_elements(coalesce(v_observability->'incidents','[]'::jsonb)) i;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', f->>'key',
    'label', f->>'label',
    'status', f->>'status'
  ) order by f->>'label'), '[]'::jsonb)
  into v_down_flows
  from jsonb_array_elements(coalesce(v_observability->'critical_flows','[]'::jsonb)) f
  where f->>'status' = 'down';

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', f->>'key',
    'label', f->>'label',
    'status', f->>'status'
  ) order by f->>'label'), '[]'::jsonb)
  into v_degraded_flows
  from jsonb_array_elements(coalesce(v_observability->'critical_flows','[]'::jsonb)) f
  where f->>'status' = 'degraded';

  with incident_codes as (
    select upper(coalesce(i->>'error_code', i->>'event_type','')) as code,
           lower(coalesce(i->>'source','')) as source
    from jsonb_array_elements(coalesce(v_observability->'incidents','[]'::jsonb)) i
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

  v_bundle := jsonb_build_object(
    'schema_version', 1,
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
      'active_incident_count', v_active_incident_count,
      'error_or_critical_count', coalesce(v_error_count,0),
      'warning_count', coalesce(v_warning_count,0),
      'down_flows', v_down_flows,
      'degraded_flows', v_degraded_flows
    ),
    'suspected_areas', v_suspected_areas,
    'observability', v_observability,
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

create or replace function public.sa_list_entry_diagnostic_snapshots_v1(
  p_community_id uuid default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode='42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', s.id,
      'diagnostic_ref', s.diagnostic_ref,
      'created_at', s.created_at,
      'community_id', s.community_id,
      'community_name', c.name,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'system_status', s.system_status,
      'trigger_type', s.trigger_type,
      'trigger_incident_id', s.trigger_incident_id,
      'notes', s.notes,
      'expires_at', s.expires_at
    )) order by s.created_at desc)
    from (
      select *
      from public.entry_diagnostic_snapshots ds
      where p_community_id is null or ds.community_id = p_community_id
      order by ds.created_at desc
      limit least(greatest(coalesce(p_limit,20),1),100)
    ) s
    left join public.communities c on c.id = s.community_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.sa_list_entry_diagnostic_snapshots_v1(uuid,integer)
  from public, anon;
grant execute on function public.sa_list_entry_diagnostic_snapshots_v1(uuid,integer)
  to authenticated, service_role;

create or replace function public.sa_get_entry_diagnostic_snapshot_v1(
  p_snapshot_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'snapshot', jsonb_strip_nulls(jsonb_build_object(
      'id', s.id,
      'diagnostic_ref', s.diagnostic_ref,
      'created_at', s.created_at,
      'community_id', s.community_id,
      'community_name', c.name,
      'starts_at', s.starts_at,
      'ends_at', s.ends_at,
      'system_status', s.system_status,
      'trigger_type', s.trigger_type,
      'trigger_incident_id', s.trigger_incident_id,
      'notes', s.notes,
      'expires_at', s.expires_at
    )),
    'bundle', s.payload
  )
  into v_result
  from public.entry_diagnostic_snapshots s
  left join public.communities c on c.id = s.community_id
  where s.id = p_snapshot_id;

  if v_result is null then
    raise exception 'Diagnostic snapshot not found' using errcode='P0002';
  end if;

  return v_result;
end;
$$;

revoke all on function public.sa_get_entry_diagnostic_snapshot_v1(uuid)
  from public, anon;
grant execute on function public.sa_get_entry_diagnostic_snapshot_v1(uuid)
  to authenticated, service_role;

create or replace function public.maintain_entry_observability_retention_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_perf integer;
  v_heartbeat integer;
  v_incidents integer;
  v_diagnostics integer;
begin
  delete from public.entry_performance_events
  where created_at < now()-interval '45 days';
  get diagnostics v_perf = row_count;

  delete from public.system_event_log
  where event_type='ENTRY_WEB_PUSH_DISPATCH_COMPLETED'
    and severity='INFO'
    and created_at < now()-interval '7 days';
  get diagnostics v_heartbeat = row_count;

  delete from public.entry_observability_incidents
  where status='resolved'
    and resolved_at < now()-interval '180 days';
  get diagnostics v_incidents = row_count;

  delete from public.entry_diagnostic_snapshots
  where expires_at < now();
  get diagnostics v_diagnostics = row_count;

  return jsonb_build_object(
    'performance_deleted',v_perf,
    'heartbeat_deleted',v_heartbeat,
    'incidents_deleted',v_incidents,
    'diagnostics_deleted',v_diagnostics,
    'maintained_at',now()
  );
end;
$$;

revoke all on function public.maintain_entry_observability_retention_v1()
  from public, anon, authenticated;
grant execute on function public.maintain_entry_observability_retention_v1()
  to service_role;

comment on table public.entry_diagnostic_snapshots is
  'Privacy-minimized ENTRY diagnostic snapshots. Manual snapshots retain 180 days; automatic incident snapshots retain 90 days.';
