-- ENTRY observability queue outcome truth.
--
-- Keep current queue backlog visible, but count terminal failures inside the
-- selected window and distinguish "no active device" delivery-unavailable
-- outcomes from actual system/provider failures.

create or replace function public.sa_get_entry_observability_v5(
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
  v_start timestamptz := coalesce(p_starts_at, now()-interval '24 hours');
  v_end timestamptz := coalesce(p_ends_at, now());
  v_result jsonb;
  v_queues jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode='42501';
  end if;

  if v_end <= v_start or v_end-v_start > interval '31 days' then
    raise exception 'Invalid observability time range' using errcode='22023';
  end if;

  v_result := public.sa_get_entry_observability_v4(v_start,v_end,p_community_id);

  select jsonb_build_array(
    jsonb_build_object(
      'capability','onboarding',
      'name','Activation queue',
      'open_count',(
        select count(*)
        from public.resident_activation_queue q
        where q.status in ('pending','invited')
          and (p_community_id is null or q.community_id=p_community_id)
      ),
      'failed_count',0,
      'delivery_unavailable_count',0,
      'oldest_open_at',(
        select min(q.created_at)
        from public.resident_activation_queue q
        where q.status in ('pending','invited')
          and (p_community_id is null or q.community_id=p_community_id)
      )
    ),
    jsonb_build_object(
      'capability','communications',
      'name','Mobile push queue',
      'open_count',(
        select count(*)
        from public.community_message_push_queue q
        where q.status in ('pending','processing')
          and (p_community_id is null or q.community_id=p_community_id)
      ),
      'failed_count',(
        select count(*)
        from public.community_message_push_queue q
        where q.status='failed'
          and coalesce(q.last_error,'') not ilike 'No active push tokens found for audience%'
          and coalesce(q.completed_at,q.updated_at,q.created_at)>=v_start
          and coalesce(q.completed_at,q.updated_at,q.created_at)<v_end
          and (p_community_id is null or q.community_id=p_community_id)
      ),
      'delivery_unavailable_count',(
        select count(*)
        from public.community_message_push_queue q
        where q.status='failed'
          and coalesce(q.last_error,'') ilike 'No active push tokens found for audience%'
          and coalesce(q.completed_at,q.updated_at,q.created_at)>=v_start
          and coalesce(q.completed_at,q.updated_at,q.created_at)<v_end
          and (p_community_id is null or q.community_id=p_community_id)
      ),
      'oldest_open_at',(
        select min(q.created_at)
        from public.community_message_push_queue q
        where q.status in ('pending','processing')
          and (p_community_id is null or q.community_id=p_community_id)
      )
    ),
    jsonb_build_object(
      'capability','vision_recognition',
      'name','OCR queue',
      'open_count',(
        select count(*)
        from public.plate_ocr_queue q
        join public.entry_logs el on el.id=q.entry_log_id
        where q.status in ('PENDING','PROCESSING')
          and (p_community_id is null or el.community_id=p_community_id)
      ),
      'failed_count',(
        select count(*)
        from public.plate_ocr_queue q
        join public.entry_logs el on el.id=q.entry_log_id
        where q.status='FAILED'
          and coalesce(q.completed_at,q.created_at)>=v_start
          and coalesce(q.completed_at,q.created_at)<v_end
          and (p_community_id is null or el.community_id=p_community_id)
      ),
      'delivery_unavailable_count',0,
      'oldest_open_at',(
        select min(q.created_at)
        from public.plate_ocr_queue q
        join public.entry_logs el on el.id=q.entry_log_id
        where q.status in ('PENDING','PROCESSING')
          and (p_community_id is null or el.community_id=p_community_id)
      )
    )
  )
  into v_queues;

  v_result := jsonb_set(v_result,'{infrastructure,queues}',v_queues,true);
  return v_result;
end;
$$;

revoke all on function public.sa_get_entry_observability_v5(timestamptz,timestamptz,uuid)
  from public,anon;
grant execute on function public.sa_get_entry_observability_v5(timestamptz,timestamptz,uuid)
  to authenticated,service_role;

comment on function public.sa_get_entry_observability_v5(timestamptz,timestamptz,uuid) is
  'ENTRY observability v5. Queue terminal failures are range-scoped and mobile no-device outcomes are classified as delivery_unavailable instead of system failures.';
