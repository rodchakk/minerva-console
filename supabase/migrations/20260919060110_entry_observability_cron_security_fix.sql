
create or replace function public.reconcile_entry_observability_incidents_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_opened integer := 0;
  v_resolved integer := 0;
begin
  create temporary table if not exists pg_temp.entry_obs_desired_incidents (
    fingerprint text not null,
    scope_key text not null,
    community_id uuid null,
    capability text not null,
    event_type text not null,
    error_code text null,
    severity text not null,
    details jsonb not null
  ) on commit drop;
  truncate pg_temp.entry_obs_desired_incidents;

  insert into pg_temp.entry_obs_desired_incidents
  with resident_population as (
    select p.user_id,p.community_id,p.house_id
    from public.profiles p
    join public.community_members cm
      on cm.user_id=p.user_id and cm.community_id=p.community_id and cm.is_active=true
    join public.communities c on c.id=p.community_id and coalesce(c.is_active,false)=true
    where p.role::text='RESIDENT' and p.is_active=true
  ),
  resident_check as (
    select rp.*,
      (
        rp.house_id is not null
        and (
          select count(*)
          from public.house_residents hr
          join public.houses h on h.id=hr.house_id and h.community_id=hr.community_id
          where hr.user_id=rp.user_id
            and hr.community_id=rp.community_id
            and hr.house_id=rp.house_id
            and hr.is_active=true
            and hr.is_primary=true
            and h.is_active=true
        ) = 1
      ) as valid
    from resident_population rp
  )
  select
    'resident_access:resident_house_context_invalid',
    rc.community_id::text,
    rc.community_id,
    'resident_access',
    'RESIDENT_HOUSE_CONTEXT_INVALID',
    'RESIDENT_HOUSE_CONTEXT_INVALID',
    case when count(*) filter(where not rc.valid)=count(*) then 'CRITICAL' else 'ERROR' end,
    jsonb_build_object(
      'active_residents',count(*),
      'invalid_residents',count(*) filter(where not rc.valid)
    )
  from resident_check rc
  group by rc.community_id
  having count(*) filter(where not rc.valid)>0;

  insert into pg_temp.entry_obs_desired_incidents
  select
    'communications:notification_worker_unhealthy','global',null,'communications',
    'COMMUNICATIONS_WORKER_UNHEALTHY',
    coalesce(h.last_error_code,'COMMUNICATIONS_WORKER_STALE'),
    'ERROR',
    jsonb_strip_nulls(jsonb_build_object(
      'last_cycle_at',h.last_cycle_at,'last_status',h.last_status,'last_failure_at',h.last_failure_at
    ))
  from public.entry_notification_worker_health h
  where h.worker_name='community_message_push'
    and (h.last_cycle_at is null or h.last_cycle_at < now()-interval '6 minutes' or h.last_status='failure');

  insert into pg_temp.entry_obs_desired_incidents
  select
    'communications:no_guard_push_coverage',cm.community_id::text,cm.community_id,'communications',
    'COMMUNICATIONS_GUARD_PUSH_UNAVAILABLE','NO_GUARD_PUSH_COVERAGE','WARNING',
    jsonb_build_object(
      'active_guards',count(distinct cm.user_id),
      'push_ready_guards',count(distinct upt.user_id)
    )
  from public.community_members cm
  join public.communities c on c.id=cm.community_id and coalesce(c.is_active,false)=true
  left join public.user_push_tokens upt
    on upt.user_id=cm.user_id and upt.community_id=cm.community_id and upt.is_active=true
  where cm.is_active=true and cm.role::text='GUARD'
  group by cm.community_id
  having count(distinct cm.user_id)>0 and count(distinct upt.user_id)=0;

  insert into pg_temp.entry_obs_desired_incidents
  select
    'communications:push_queue_stuck',q.community_id::text,q.community_id,'communications',
    'COMMUNICATIONS_QUEUE_STUCK','PUSH_QUEUE_STUCK','ERROR',
    jsonb_build_object('stuck_count',count(*),'oldest_created_at',min(q.created_at))
  from public.community_message_push_queue q
  where q.status in ('pending','processing') and q.created_at < now()-interval '10 minutes'
  group by q.community_id;

  insert into pg_temp.entry_obs_desired_incidents
  select
    'vision_recognition:ocr_queue_stuck',el.community_id::text,el.community_id,'vision_recognition',
    'OCR_QUEUE_STUCK','OCR_QUEUE_STUCK','ERROR',
    jsonb_build_object('stuck_count',count(*),'oldest_created_at',min(q.created_at))
  from public.plate_ocr_queue q
  join public.entry_logs el on el.id=q.entry_log_id
  where q.status in ('PENDING','PROCESSING')
    and q.created_at < now()-interval '15 minutes'
    and coalesce(q.scheduled_at,now()) <= now()
  group by el.community_id;

  insert into pg_temp.entry_obs_desired_incidents
  select
    'infrastructure:cron:' || j.jobname,'global',null,'infrastructure',
    'CRON_JOB_FAILED','CRON_JOB_FAILED','ERROR',
    jsonb_build_object(
      'job_name',j.jobname,'last_status',d.status,'last_started_at',d.start_time,'last_finished_at',d.end_time
    )
  from cron.job j
  join lateral (
    select d.* from cron.job_run_details d
    where d.jobid=j.jobid order by d.start_time desc limit 1
  ) d on true
  where j.active=true and d.status<>'succeeded';

  insert into public.entry_observability_incidents (
    fingerprint,scope_key,community_id,capability,event_type,error_code,severity,status,
    first_seen_at,last_seen_at,resolved_at,occurrence_count,last_details,updated_at
  )
  select d.fingerprint,d.scope_key,d.community_id,d.capability,d.event_type,d.error_code,d.severity,
         'open',now(),now(),null,1,d.details,now()
  from pg_temp.entry_obs_desired_incidents d
  on conflict (fingerprint,scope_key) where status='open'
  do update set
    community_id=excluded.community_id,
    capability=excluded.capability,
    event_type=excluded.event_type,
    error_code=excluded.error_code,
    severity=excluded.severity,
    last_seen_at=now(),
    occurrence_count=public.entry_observability_incidents.occurrence_count+1,
    last_details=excluded.last_details,
    updated_at=now();
  get diagnostics v_opened = row_count;

  update public.entry_observability_incidents i
  set status='resolved',resolved_at=now(),updated_at=now()
  where i.status='open'
    and (
      i.fingerprint in (
        'resident_access:resident_house_context_invalid',
        'communications:notification_worker_unhealthy',
        'communications:no_guard_push_coverage',
        'communications:push_queue_stuck',
        'vision_recognition:ocr_queue_stuck'
      )
      or i.fingerprint like 'infrastructure:cron:%'
    )
    and not exists (
      select 1 from pg_temp.entry_obs_desired_incidents d
      where d.fingerprint=i.fingerprint and d.scope_key=i.scope_key
    );
  get diagnostics v_resolved = row_count;

  return jsonb_build_object(
    'desired',(select count(*) from pg_temp.entry_obs_desired_incidents),
    'upserted',v_opened,'resolved',v_resolved,'checked_at',now()
  );
end;
$$;

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
begin
  delete from public.entry_performance_events where created_at < now()-interval '45 days';
  get diagnostics v_perf = row_count;

  delete from public.system_event_log
  where event_type='ENTRY_WEB_PUSH_DISPATCH_COMPLETED'
    and severity='INFO'
    and created_at < now()-interval '7 days';
  get diagnostics v_heartbeat = row_count;

  delete from public.entry_observability_incidents
  where status='resolved' and resolved_at < now()-interval '180 days';
  get diagnostics v_incidents = row_count;

  return jsonb_build_object(
    'performance_deleted',v_perf,'heartbeat_deleted',v_heartbeat,
    'incidents_deleted',v_incidents,'maintained_at',now()
  );
end;
$$;

revoke all on function public.reconcile_entry_observability_incidents_v1() from public, anon, authenticated;
grant execute on function public.reconcile_entry_observability_incidents_v1() to service_role;
revoke all on function public.maintain_entry_observability_retention_v1() from public, anon, authenticated;
grant execute on function public.maintain_entry_observability_retention_v1() to service_role;
