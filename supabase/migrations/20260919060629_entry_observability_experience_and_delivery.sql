
alter table public.entry_performance_events
  alter column duration_ms drop not null;

alter table public.entry_performance_events
  add column if not exists metric_value numeric,
  add column if not exists metric_unit text not null default 'ms';

update public.entry_performance_events
set metric_value = duration_ms,
    metric_unit = 'ms'
where metric_value is null
  and duration_ms is not null;

alter table public.entry_performance_events
  drop constraint if exists entry_performance_events_value_ck;
alter table public.entry_performance_events
  add constraint entry_performance_events_value_ck
  check (duration_ms is not null or metric_value is not null);

alter table public.entry_performance_events
  drop constraint if exists entry_performance_events_unit_ck;
alter table public.entry_performance_events
  add constraint entry_performance_events_unit_ck
  check (metric_unit in ('ms','score','count','percent'));

create or replace function public.record_entry_metric_v1(
  p_metric_name text,
  p_metric_value numeric,
  p_metric_unit text default 'ms',
  p_source_surface text default 'entry_web',
  p_status text default 'success',
  p_error_code text default null,
  p_platform text default null,
  p_app_version text default null,
  p_route text default null,
  p_community_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_community uuid;
  v_id bigint;
  v_metric text := left(regexp_replace(coalesce(p_metric_name,''), '[^a-zA-Z0-9_.:-]+', '_', 'g'), 96);
  v_surface text := left(regexp_replace(coalesce(p_source_surface,'entry_web'), '[^a-zA-Z0-9_.:-]+', '_', 'g'), 64);
  v_unit text := lower(coalesce(p_metric_unit,'ms'));
  v_route text := nullif(left(regexp_replace(coalesce(p_route,''), '[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}', ':id', 'g'), 160), '');
  v_error text := nullif(left(regexp_replace(coalesce(p_error_code,''), '[^a-zA-Z0-9_.:-]+', '_', 'g'), 96), '');
  v_duration integer;
begin
  if v_actor is null and v_role <> 'service_role' then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if nullif(v_metric,'') is null or p_metric_value is null or p_metric_value < 0 then
    raise exception 'Invalid metric' using errcode='22023';
  end if;

  if v_unit not in ('ms','score','count','percent') then
    raise exception 'Invalid metric unit' using errcode='22023';
  end if;

  if coalesce(p_status,'success') not in ('success','failed') then
    raise exception 'Invalid performance status' using errcode='22023';
  end if;

  if v_unit='ms' then
    if p_metric_value > 600000 then
      raise exception 'Invalid duration' using errcode='22023';
    end if;
    v_duration := round(p_metric_value)::integer;
  end if;

  if v_role='service_role' then
    v_community := p_community_id;
  else
    v_community := public._entry_observability_actor_community_v1();
    if p_community_id is not null and p_community_id=v_community then
      v_community := p_community_id;
    end if;
  end if;

  insert into public.entry_performance_events (
    community_id,actor_id,source_surface,metric_name,duration_ms,metric_value,metric_unit,status,
    error_code,platform,app_version,route,metadata
  )
  values (
    v_community,v_actor,v_surface,v_metric,v_duration,p_metric_value,v_unit,coalesce(p_status,'success'),
    v_error,nullif(left(coalesce(p_platform,''),32),''),
    nullif(left(coalesce(p_app_version,''),48),''),
    v_route,'{}'::jsonb
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_entry_metric_v1(text,numeric,text,text,text,text,text,text,text,uuid)
  from public,anon;
grant execute on function public.record_entry_metric_v1(text,numeric,text,text,text,text,text,text,text,uuid)
  to authenticated,service_role;

create or replace function public.reconcile_entry_observability_data_integrity_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_upserted integer := 0;
  v_resolved integer := 0;
begin
  create temporary table if not exists pg_temp.entry_obs_integrity_desired (
    fingerprint text not null,
    scope_key text not null,
    community_id uuid null,
    capability text not null,
    event_type text not null,
    error_code text null,
    severity text not null,
    details jsonb not null
  ) on commit drop;
  truncate pg_temp.entry_obs_integrity_desired;

  insert into pg_temp.entry_obs_integrity_desired
  with active_communities as (
    select id from public.communities where coalesce(is_active,false)=true
  ),
  problems as (
    select
      p.community_id,
      count(*) filter (
        where p.is_active=true
          and p.role::text in ('RESIDENT','ADMIN','GUARD')
          and not exists (
            select 1 from public.community_members cm
            where cm.user_id=p.user_id
              and cm.community_id=p.community_id
              and cm.is_active=true
          )
      )::integer as active_profile_without_membership,
      (
        select count(*)::integer
        from public.community_members cm
        where cm.community_id=p.community_id
          and cm.is_active=true
          and not exists (
            select 1 from public.profiles px
            where px.user_id=cm.user_id
              and px.community_id=cm.community_id
              and px.is_active=true
          )
      ) as active_membership_without_profile
    from public.profiles p
    join active_communities ac on ac.id=p.community_id
    group by p.community_id
  )
  select
    'authentication:identity_context_invalid',
    pr.community_id::text,
    pr.community_id,
    'authentication',
    'AUTH_IDENTITY_CONTEXT_INVALID',
    'AUTH_IDENTITY_CONTEXT_INVALID',
    'ERROR',
    jsonb_build_object(
      'active_profile_without_membership',pr.active_profile_without_membership,
      'active_membership_without_profile',pr.active_membership_without_profile
    )
  from problems pr
  where pr.active_profile_without_membership>0
     or pr.active_membership_without_profile>0;

  insert into pg_temp.entry_obs_integrity_desired
  select
    'resident_access:expired_pass_active',
    vp.community_id::text,
    vp.community_id,
    'resident_access',
    'EXPIRED_PASS_STILL_ACTIVE',
    'EXPIRED_PASS_STILL_ACTIVE',
    'ERROR',
    jsonb_build_object(
      'count',count(*),
      'oldest_expired_at',min(vp.expires_at)
    )
  from public.visit_passes vp
  join public.communities c on c.id=vp.community_id and coalesce(c.is_active,false)=true
  where vp.status::text in ('ACTIVE','CHECKED_IN','SCHEDULED')
    and vp.expires_at is not null
    and vp.expires_at < now()-interval '5 minutes'
  group by vp.community_id;

  insert into pg_temp.entry_obs_integrity_desired
  select
    'resident_access:expired_frequent_access_active',
    fv.community_id::text,
    fv.community_id,
    'resident_access',
    'EXPIRED_FREQUENT_ACCESS_STILL_ACTIVE',
    'EXPIRED_FREQUENT_ACCESS_STILL_ACTIVE',
    'WARNING',
    jsonb_build_object(
      'count',count(*),
      'oldest_expired_at',min(fv.expires_at)
    )
  from public.authorized_frequent_visitors fv
  join public.communities c on c.id=fv.community_id and coalesce(c.is_active,false)=true
  where fv.is_active=true
    and fv.revoked_at is null
    and fv.expires_at is not null
    and fv.expires_at < now()-interval '5 minutes'
  group by fv.community_id;

  insert into public.entry_observability_incidents (
    fingerprint,scope_key,community_id,capability,event_type,error_code,severity,status,
    first_seen_at,last_seen_at,resolved_at,occurrence_count,last_details,updated_at
  )
  select
    d.fingerprint,d.scope_key,d.community_id,d.capability,d.event_type,d.error_code,d.severity,
    'open',now(),now(),null,1,d.details,now()
  from pg_temp.entry_obs_integrity_desired d
  on conflict (fingerprint,scope_key) where status='open'
  do update set
    severity=excluded.severity,
    last_seen_at=now(),
    occurrence_count=public.entry_observability_incidents.occurrence_count+1,
    last_details=excluded.last_details,
    updated_at=now();
  get diagnostics v_upserted=row_count;

  update public.entry_observability_incidents i
  set status='resolved',resolved_at=now(),updated_at=now()
  where i.status='open'
    and i.fingerprint in (
      'authentication:identity_context_invalid',
      'resident_access:expired_pass_active',
      'resident_access:expired_frequent_access_active'
    )
    and not exists (
      select 1 from pg_temp.entry_obs_integrity_desired d
      where d.fingerprint=i.fingerprint and d.scope_key=i.scope_key
    );
  get diagnostics v_resolved=row_count;

  return jsonb_build_object(
    'desired',(select count(*) from pg_temp.entry_obs_integrity_desired),
    'upserted',v_upserted,
    'resolved',v_resolved,
    'checked_at',now()
  );
end;
$$;

revoke all on function public.reconcile_entry_observability_data_integrity_v1()
  from public,anon,authenticated;
grant execute on function public.reconcile_entry_observability_data_integrity_v1()
  to service_role;

create or replace function public.sa_get_entry_observability_v4(
  p_starts_at timestamptz,
  p_ends_at timestamptz default now(),
  p_community_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start timestamptz := coalesce(p_starts_at,now()-interval '24 hours');
  v_end timestamptz := coalesce(p_ends_at,now());
  v_result jsonb;
  v_flows jsonb;
  v_perf jsonb;
  v_receipts jsonb;
  v_auth_failures integer := 0;
  v_auth_last_failure timestamptz;
  v_receipt_delivered integer := 0;
  v_receipt_failed integer := 0;
  v_receipt_pending integer := 0;
  v_status text;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode='42501';
  end if;
  if v_end<=v_start or v_end-v_start>interval '31 days' then
    raise exception 'Invalid observability time range' using errcode='22023';
  end if;

  v_result := public.sa_get_entry_observability_v3(v_start,v_end,p_community_id);

  select
    count(*)::integer,
    max(s.created_at)
  into v_auth_failures,v_auth_last_failure
  from public.system_event_log s
  where s.created_at>=v_start and s.created_at<v_end
    and s.event_type='AUTH_LOGIN_FAILED'
    and (p_community_id is null or s.community_id=p_community_id);

  select coalesce(jsonb_agg(
    case
      when f->>'key'='authentication' and v_auth_failures>0 then
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                f,
                '{failure_count}',
                to_jsonb(coalesce((f->>'failure_count')::integer,0)+v_auth_failures),
                true
              ),
              '{evidence_count}',
              to_jsonb(coalesce((f->>'evidence_count')::integer,0)+v_auth_failures),
              true
            ),
            '{last_seen_at}',
            to_jsonb(greatest(
              nullif(f->>'last_seen_at','')::timestamptz,
              v_auth_last_failure
            )),
            true
          ),
          '{status}',
          to_jsonb(public._entry_observability_flow_status_v1(
            coalesce((f->>'success_count')::integer,0),
            coalesce((f->>'failure_count')::integer,0)+v_auth_failures,
            nullif(f->>'last_success_at','')::timestamptz,
            coalesce((f->>'evidence_count')::integer,0)+v_auth_failures
          )),
          true
        )
      else f
    end
  ),'[]'::jsonb)
  into v_flows
  from jsonb_array_elements(coalesce(v_result->'critical_flows','[]'::jsonb)) f;

  select
    count(*) filter(where r.status='delivered')::integer,
    count(*) filter(where r.status='failed')::integer,
    count(*) filter(where r.status in ('accepted','unknown'))::integer
  into v_receipt_delivered,v_receipt_failed,v_receipt_pending
  from public.entry_mobile_push_receipts r
  where r.created_at>=v_start and r.created_at<v_end
    and (p_community_id is null or r.community_id=p_community_id);

  if v_receipt_failed>0 then
    select coalesce(jsonb_agg(
      case
        when f->>'key'='communications' then
          jsonb_set(
            f,
            '{status}',
            to_jsonb(
              case
                when v_receipt_failed>=5 and v_receipt_delivered=0 then 'down'
                when v_receipt_failed>=3
                  and v_receipt_failed::numeric / greatest(v_receipt_failed+v_receipt_delivered,1) >= 0.20
                  then 'degraded'
                else f->>'status'
              end
            ),
            true
          )
        else f
      end
    ),'[]'::jsonb)
    into v_flows
    from jsonb_array_elements(v_flows) f;
  end if;

  with perf as (
    select *
    from public.entry_performance_events p
    where p.created_at>=v_start and p.created_at<v_end
      and (p_community_id is null or p.community_id=p_community_id)
  ),
  ms_total as (
    select
      count(*)::integer as event_count,
      count(*) filter(where status='failed')::integer as failed_count,
      percentile_cont(0.50) within group(order by metric_value) filter(where metric_unit='ms') as p50,
      percentile_cont(0.95) within group(order by metric_value) filter(where metric_unit='ms') as p95,
      percentile_cont(0.99) within group(order by metric_value) filter(where metric_unit='ms') as p99,
      max(created_at) as last_seen_at
    from perf
  ),
  metric_rows as (
    select
      source_surface,metric_name,metric_unit,platform,app_version,
      count(*)::integer as event_count,
      count(*) filter(where status='failed')::integer as failed_count,
      percentile_cont(0.50) within group(order by metric_value) as p50,
      percentile_cont(0.95) within group(order by metric_value) as p95,
      percentile_cont(0.99) within group(order by metric_value) as p99,
      max(created_at) as last_seen_at
    from perf
    group by source_surface,metric_name,metric_unit,platform,app_version
  )
  select jsonb_build_object(
    'summary',jsonb_build_object(
      'event_count',t.event_count,
      'failed_count',t.failed_count,
      'p50_ms',round(t.p50::numeric,0),
      'p95_ms',round(t.p95::numeric,0),
      'p99_ms',round(t.p99::numeric,0),
      'last_seen_at',t.last_seen_at
    ),
    'metrics',coalesce((
      select jsonb_agg(jsonb_build_object(
        'surface',m.source_surface,
        'metric',m.metric_name,
        'unit',m.metric_unit,
        'platform',m.platform,
        'app_version',m.app_version,
        'event_count',m.event_count,
        'failed_count',m.failed_count,
        'p50',round(m.p50::numeric,case when m.metric_unit='score' then 4 else 0 end),
        'p95',round(m.p95::numeric,case when m.metric_unit='score' then 4 else 0 end),
        'p99',round(m.p99::numeric,case when m.metric_unit='score' then 4 else 0 end),
        'last_seen_at',m.last_seen_at
      ) order by m.event_count desc,m.source_surface,m.metric_name)
      from (select * from metric_rows order by event_count desc limit 32) m
    ),'[]'::jsonb)
  )
  into v_perf
  from ms_total t;

  select jsonb_build_object(
    'accepted_count',v_receipt_pending,
    'delivered_count',v_receipt_delivered,
    'failed_count',v_receipt_failed,
    'delivery_rate',case
      when v_receipt_delivered+v_receipt_failed=0 then null
      else round(v_receipt_delivered::numeric/(v_receipt_delivered+v_receipt_failed),4)
    end,
    'last_delivered_at',max(r.completed_at) filter(where r.status='delivered'),
    'last_failed_at',max(r.completed_at) filter(where r.status='failed')
  )
  into v_receipts
  from public.entry_mobile_push_receipts r
  where r.created_at>=v_start and r.created_at<v_end
    and (p_community_id is null or r.community_id=p_community_id);

  v_result := jsonb_set(v_result,'{critical_flows}',v_flows,true);
  v_result := jsonb_set(v_result,'{performance}',coalesce(v_perf,'{}'::jsonb),true);
  v_result := jsonb_set(v_result,'{mobile_push_delivery}',coalesce(v_receipts,'{}'::jsonb),true);

  select case
    when exists(select 1 from jsonb_array_elements(v_flows) f where f->>'status'='down') then 'down'
    when exists(select 1 from jsonb_array_elements(coalesce(v_result->'incidents','[]'::jsonb)) i where i->>'severity' in ('CRITICAL','ERROR')) then 'degraded'
    when exists(select 1 from jsonb_array_elements(v_flows) f where f->>'status'='degraded') then 'degraded'
    when exists(select 1 from jsonb_array_elements(v_flows) f where f->>'status'='unknown') then 'unknown'
    else 'healthy'
  end into v_status;

  v_result := jsonb_set(v_result,'{summary,system_status}',to_jsonb(v_status),true);
  return v_result;
end;
$$;

revoke all on function public.sa_get_entry_observability_v4(timestamptz,timestamptz,uuid)
  from public,anon;
grant execute on function public.sa_get_entry_observability_v4(timestamptz,timestamptz,uuid)
  to authenticated,service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='entry-observability-incident-reconcile';
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule(
    'entry-observability-incident-reconcile',
    '*/5 * * * *',
    'select public.reconcile_entry_observability_incidents_v1(); select public.reconcile_entry_observability_data_integrity_v1();'
  );
end $$;
