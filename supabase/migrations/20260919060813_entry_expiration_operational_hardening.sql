
do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='expire-stale-records';

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  perform cron.schedule(
    'expire-stale-records',
    '*/5 * * * *',
    'select public.expire_stale_records();'
  );
end $$;

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
  where vp.status::text in ('ACTIVE','SCHEDULED')
    and vp.expires_at is not null
    and vp.expires_at < now()-interval '10 minutes'
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
    and fv.expires_at < now()-interval '10 minutes'
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
