
create or replace function public.sa_get_entry_notification_observability_v2(
  p_starts_at timestamptz,
  p_ends_at timestamptz default now(),
  p_community_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base jsonb;
  v_events jsonb;
  v_summary jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode='42501';
  end if;

  if p_ends_at <= p_starts_at or p_ends_at - p_starts_at > interval '31 days' then
    raise exception 'Invalid observability time range' using errcode='22023';
  end if;

  v_base := public.sa_get_entry_notification_observability_v1(
    p_starts_at,p_ends_at,p_community_id,p_limit
  );

  with receipt_summary as (
    select
      r.queue_id,
      count(*) filter(where r.status='delivered')::integer as delivered_count,
      count(*) filter(where r.status='failed')::integer as failed_count,
      count(*) filter(where r.status in ('accepted','unknown'))::integer as pending_count,
      max(r.completed_at) filter(where r.status='delivered') as last_delivered_at,
      max(r.completed_at) filter(where r.status='failed') as last_failed_at
    from public.entry_mobile_push_receipts r
    where r.created_at>=p_starts_at
      and r.created_at<p_ends_at
      and (p_community_id is null or r.community_id=p_community_id)
    group by r.queue_id
  ),
  transformed as (
    select
      case
        when rs.queue_id is null then e.value
        when e.value->>'channel' <> 'push' then e.value
        when rs.failed_count>0 then
          e.value
          || jsonb_build_object(
            'status','failed',
            'severity','ERROR',
            'operation','Push delivery failed',
            'completed_at',coalesce(rs.last_failed_at,nullif(e.value->>'completed_at','')::timestamptz),
            'error_code','PUSH_RECEIPT_FAILED',
            'error_summary','Expo receipt reported one or more device delivery failures.',
            'impact_summary','Provider acceptance was followed by a verified device-delivery failure.',
            'provider_reached',true,
            'retry_mode','provider_receipt',
            'retry_summary','A failed receipt is terminal for that device token unless a new notification is sent.'
          )
        when rs.pending_count>0 then
          e.value
          || jsonb_build_object(
            'status','unknown',
            'severity','INFO',
            'operation','Push accepted; delivery pending',
            'error_summary','Expo accepted the push; final device receipt is still pending.',
            'impact_summary','Provider acceptance is confirmed, but device delivery has not yet been verified.',
            'provider_reached',true,
            'retry_mode','receipt_check',
            'retry_summary','ENTRY will re-check the provider receipt asynchronously.'
          )
        when rs.delivered_count>0 then
          e.value
          || jsonb_build_object(
            'status','success',
            'severity','INFO',
            'operation','Push delivered',
            'completed_at',coalesce(rs.last_delivered_at,nullif(e.value->>'completed_at','')::timestamptz),
            'error_summary','Expo receipt verified device delivery.',
            'impact_summary','Device delivery was verified by the Expo push receipt.',
            'provider_reached',true,
            'retry_mode','none',
            'retry_summary','No retry is required for verified delivery.'
          )
        else e.value
      end as value,
      e.ordinality
    from jsonb_array_elements(coalesce(v_base->'events','[]'::jsonb))
      with ordinality e(value,ordinality)
    left join receipt_summary rs
      on rs.queue_id = nullif(e.value->>'queue_id','')::uuid
  )
  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb)
  into v_events
  from transformed;

  with events as (
    select value
    from jsonb_array_elements(v_events)
  ),
  counts as (
    select
      count(*)::integer as event_count,
      count(*) filter(where value->>'status'='success')::integer as success_count,
      count(*) filter(where value->>'status'='failed')::integer as failed_count,
      count(*) filter(where value->>'status'='skipped')::integer as skipped_count,
      max(nullif(value->>'occurred_at','')::timestamptz) as last_observed_at,
      max(nullif(value->>'occurred_at','')::timestamptz)
        filter(where value->>'status'='success') as last_success_at,
      max(nullif(value->>'occurred_at','')::timestamptz)
        filter(where value->>'status'='failed') as last_failure_at
    from events
  )
  select jsonb_build_object(
    'event_count',c.event_count,
    'success_count',c.success_count,
    'failed_count',c.failed_count,
    'skipped_count',c.skipped_count,
    'last_observed_at',c.last_observed_at,
    'last_failure_at',c.last_failure_at,
    'status',public._entry_observability_flow_status_v1(
      c.success_count,
      c.failed_count,
      c.last_success_at,
      c.success_count+c.failed_count
    )
  )
  into v_summary
  from counts c;

  v_base := jsonb_set(v_base,'{events}',v_events,true);
  v_base := jsonb_set(v_base,'{summary}',v_summary,true);
  return v_base;
end;
$$;

revoke all on function public.sa_get_entry_notification_observability_v2(timestamptz,timestamptz,uuid,integer)
  from public,anon;
grant execute on function public.sa_get_entry_notification_observability_v2(timestamptz,timestamptz,uuid,integer)
  to authenticated,service_role;
