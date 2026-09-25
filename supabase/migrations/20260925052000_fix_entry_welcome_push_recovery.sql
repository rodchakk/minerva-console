-- Fix welcome push recovery after a resident enables notifications more than 24h
-- after the original welcome message was published.
--
-- Root cause:
--   ensure_welcome_push_after_token() correctly re-opened a failed welcome queue row,
--   but claim_pending_community_message_pushes() only claimed rows whose original
--   queue/message timestamps were less than 24h old. The row therefore remained
--   pending forever and observability raised PUSH_QUEUE_STUCK.
--
-- Safety:
--   Old-message replay is allowed only for rows explicitly marked by the welcome
--   recovery path, only for targeted messages, only for 24h after the recovery,
--   and only while the target user has an active push token.

create or replace function public.claim_pending_community_message_pushes(
  p_limit integer default 20
)
returns table(
  queue_id uuid,
  message_id uuid,
  community_id uuid,
  push_title text,
  push_body text,
  attempts integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  with picked as (
    select q.id
    from public.community_message_push_queue q
    join public.community_messages m on m.id = q.message_id
    where q.status = 'pending'
      and q.attempts < 5
      and m.published_at <= now()
      and m.is_active = true
      and m.deleted_at is null
      and (
        (
          q.created_at >= now() - interval '24 hours'
          and m.published_at >= now() - interval '24 hours'
        )
        or (
          q.enqueue_source = 'welcome_token_recovery'
          and q.updated_at >= now() - interval '24 hours'
          and m.target_user_id is not null
          and exists (
            select 1
            from public.user_push_tokens upt
            where upt.user_id = m.target_user_id
              and upt.community_id = m.community_id
              and upt.is_active = true
          )
        )
      )
    order by q.created_at asc
    limit greatest(coalesce(p_limit, 20), 1)
    for update of q skip locked
  ),
  updated as (
    update public.community_message_push_queue q
       set status     = 'processing',
           attempts   = q.attempts + 1,
           updated_at = now(),
           claimed_at = coalesce(q.claimed_at, now())
      from picked
     where q.id = picked.id
    returning q.id, q.message_id, q.community_id, q.push_title, q.push_body, q.attempts
  )
  select
    updated.id as queue_id,
    updated.message_id,
    updated.community_id,
    updated.push_title,
    updated.push_body,
    updated.attempts
  from updated;
end;
$function$;

create or replace function public.ensure_welcome_push_after_token(
  p_community_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id          uuid := auth.uid();
  v_full_name        text;
  v_house_label      text;
  v_message_id       uuid;
  v_queue_status     text;
  v_queue_updated_at timestamptz;
  v_action           text := 'noop';
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_community_id is null then
    raise exception 'Community is required';
  end if;

  if not exists (
    select 1
    from public.community_members cm
    where cm.user_id = v_user_id
      and cm.community_id = p_community_id
      and cm.is_active = true
  ) then
    raise exception 'User is not an active member of this community';
  end if;

  if not exists (
    select 1
    from public.user_push_tokens upt
    where upt.user_id = v_user_id
      and upt.community_id = p_community_id
      and upt.is_active = true
  ) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'no_active_push_token'
    );
  end if;

  select p.full_name, h.house_label
    into v_full_name, v_house_label
  from public.profiles p
  left join public.houses h
    on h.id = p.house_id
   and h.community_id = p.community_id
  where p.user_id = v_user_id
    and p.community_id = p_community_id
    and p.is_active = true
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'active_profile_not_found'
    );
  end if;

  select m.id
    into v_message_id
  from public.community_messages m
  where m.community_id = p_community_id
    and m.target_user_id = v_user_id
    and m.title = 'Bienvenido(a) a ENTRY'
    and m.is_active = true
    and m.deleted_at is null
  order by m.published_at desc nulls last, m.created_at desc
  limit 1;

  if v_message_id is null then
    perform public.send_welcome_notification(
      v_user_id,
      p_community_id,
      v_full_name,
      v_house_label
    );

    select m.id
      into v_message_id
    from public.community_messages m
    where m.community_id = p_community_id
      and m.target_user_id = v_user_id
      and m.title = 'Bienvenido(a) a ENTRY'
      and m.is_active = true
      and m.deleted_at is null
    order by m.published_at desc nulls last, m.created_at desc
    limit 1;

    if v_message_id is null then
      return jsonb_build_object(
        'ok', false,
        'reason', 'welcome_message_not_created'
      );
    end if;

    v_action := 'created';
  end if;

  select q.status, q.updated_at
    into v_queue_status, v_queue_updated_at
  from public.community_message_push_queue q
  where q.message_id = v_message_id;

  if not found then
    perform set_config('app.push_enqueue_source', 'welcome_token_recovery', true);
    perform public.enqueue_community_message_push(v_message_id);
    v_action := case when v_action = 'created' then 'created' else 'enqueued' end;
    v_queue_status := 'pending';
  elsif v_queue_status = 'failed'
     or (
       v_queue_status = 'pending'
       and coalesce(v_queue_updated_at, '-infinity'::timestamptz) < now() - interval '24 hours'
     ) then
    update public.community_message_push_queue
       set status = 'pending',
           attempts = 0,
           last_error = null,
           processed_at = null,
           claimed_at = null,
           completed_at = null,
           provider_response = null,
           enqueue_source = 'welcome_token_recovery',
           updated_at = now()
     where message_id = v_message_id;

    v_action := 'retried';
    v_queue_status := 'pending';
  end if;

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'message_id', v_message_id,
    'queue_status', v_queue_status
  );
end;
$function$;

create or replace function public.sweep_stale_community_message_pushes()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recent_count integer := 0;
  v_old_count integer := 0;
  v_old_pending_count integer := 0;
begin
  -- Recent processing rows that were claimed but never completed.
  with recent_stuck as (
    select q.id
    from public.community_message_push_queue q
    join public.community_messages m on m.id = q.message_id
    where q.status = 'processing'
      and q.updated_at < now() - interval '15 minutes'
      and m.published_at >= now() - interval '24 hours'
  )
  update public.community_message_push_queue q
     set status       = 'failed',
         last_error   = 'Stale processing row swept by sweep_stale_community_message_pushes (recent message)',
         completed_at = now(),
         updated_at   = now()
  from recent_stuck
  where q.id = recent_stuck.id;
  get diagnostics v_recent_count = row_count;

  -- Old claimed rows are terminal until a later token-driven welcome recovery
  -- explicitly re-opens them.
  with old_stuck as (
    select q.id
    from public.community_message_push_queue q
    join public.community_messages m on m.id = q.message_id
    where q.status = 'processing'
      and q.updated_at < now() - interval '15 minutes'
      and m.published_at < now() - interval '24 hours'
  )
  update public.community_message_push_queue q
     set status       = 'failed',
         last_error   = 'failed_stale_old_message: message older than 24h, will not be retried',
         completed_at = now(),
         updated_at   = now()
  from old_stuck
  where q.id = old_stuck.id;
  get diagnostics v_old_count = row_count;

  -- Old pending rows previously had no terminal path. Close them so the queue
  -- cannot remain permanently degraded. A later welcome-token recovery may
  -- intentionally re-open the targeted welcome row.
  with old_pending as (
    select q.id
    from public.community_message_push_queue q
    join public.community_messages m on m.id = q.message_id
    where q.status = 'pending'
      and q.created_at < now() - interval '24 hours'
      and m.published_at < now() - interval '24 hours'
      and q.updated_at < now() - interval '24 hours'
  )
  update public.community_message_push_queue q
     set status       = 'failed',
         last_error   = 'failed_stale_old_pending: pending message exceeded the 24h claim window without a fresh recovery',
         completed_at = now(),
         updated_at   = now()
  from old_pending
  where q.id = old_pending.id;
  get diagnostics v_old_pending_count = row_count;

  if v_recent_count > 0 or v_old_count > 0 or v_old_pending_count > 0 then
    insert into public.system_event_log (
      severity, module, event_type, message, source, details
    ) values (
      case when v_recent_count > 0 then 'WARN' else 'INFO' end,
      'community_message_push',
      'PUSH_QUEUE_SWEEP_STALE',
      'Swept stuck rows in community_message_push_queue',
      'sweep_stale_community_message_pushes',
      jsonb_build_object(
        'recent_processing_swept', v_recent_count,
        'old_processing_swept', v_old_count,
        'old_pending_swept', v_old_pending_count
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'recent_processing_swept', v_recent_count,
    'old_processing_swept', v_old_count,
    'old_pending_swept', v_old_pending_count
  );
end;
$function$;

-- Recover any currently stranded targeted welcome rows whose resident already
-- has an active token. This is deliberately narrow and idempotent.
update public.community_message_push_queue q
   set status = 'pending',
       attempts = 0,
       last_error = null,
       processed_at = null,
       claimed_at = null,
       completed_at = null,
       provider_response = null,
       enqueue_source = 'welcome_token_recovery',
       updated_at = now()
from public.community_messages m
where m.id = q.message_id
  and q.status = 'pending'
  and q.created_at < now() - interval '24 hours'
  and m.published_at < now() - interval '24 hours'
  and m.target_user_id is not null
  and m.title = 'Bienvenido(a) a ENTRY'
  and m.is_active = true
  and m.deleted_at is null
  and exists (
    select 1
    from public.user_push_tokens upt
    where upt.user_id = m.target_user_id
      and upt.community_id = m.community_id
      and upt.is_active = true
  );

comment on function public.claim_pending_community_message_pushes(integer) is
  'Claims normal <=24h pushes plus explicitly token-recovered targeted welcome pushes for up to 24h after recovery.';

comment on function public.ensure_welcome_push_after_token(uuid) is
  'Ensures a targeted welcome push can be created or safely re-opened after the resident registers an active push token, including welcomes older than 24h.';

comment on function public.sweep_stale_community_message_pushes() is
  'Closes stale processing rows and terminally closes old pending rows so the mobile push queue cannot remain stuck indefinitely.';
