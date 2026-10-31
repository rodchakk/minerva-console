-- PROJECT BEDROCK F02 R2: make the legacy and v2 terminal protocols disjoint.
--
-- `claim_protocol` is durable protocol provenance, not merely a convenience
-- flag. A NULL claim token alone is insufficient because legacy and v2 rows
-- coexist during the worker transition. Only the legacy claim RPC can mint a
-- LEGACY_V25 processing row; v2 transitions require both V2 provenance and
-- the current lease token.

alter table public.community_message_push_queue
  add column if not exists claim_protocol text;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'community_message_push_queue_claim_protocol_ck'
      and conrelid = 'public.community_message_push_queue'::regclass
  ) then
    alter table public.community_message_push_queue
      add constraint community_message_push_queue_claim_protocol_ck
      check (
        claim_protocol is null
        or claim_protocol = 'V2'
        or (
          claim_protocol = 'LEGACY_V25'
          and audience_type = 'PUBLIC'
          and audience_target_user_id is null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'community_message_push_queue_v2_processing_lease_ck'
      and conrelid = 'public.community_message_push_queue'::regclass
  ) then
    alter table public.community_message_push_queue
      add constraint community_message_push_queue_v2_processing_lease_ck
      check (
        status <> 'processing'
        or claim_protocol <> 'V2'
        or claim_token is not null
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'community_message_push_queue_legacy_processing_token_ck'
      and conrelid = 'public.community_message_push_queue'::regclass
  ) then
    alter table public.community_message_push_queue
      add constraint community_message_push_queue_legacy_processing_token_ck
      check (
        status <> 'processing'
        or claim_protocol <> 'LEGACY_V25'
        or claim_token is null
      );
  end if;
end;
$migration$;

-- Claims created before this R2 migration can be classified without guessing:
-- v2 claims have a lease, while a public, lease-less processing row is the
-- only safe legacy compatibility case. Old private lease-less rows remain
-- unclassified and are quarantined by the existing stale sweeper.
update public.community_message_push_queue q
set claim_protocol = case
      when q.claim_token is not null then 'V2'
      when q.status = 'processing'
       and q.audience_type = 'PUBLIC'
       and q.audience_target_user_id is null then 'LEGACY_V25'
      else null
    end
where q.claim_protocol is distinct from case
      when q.claim_token is not null then 'V2'
      when q.status = 'processing'
       and q.audience_type = 'PUBLIC'
       and q.audience_target_user_id is null then 'LEGACY_V25'
      else null
    end;

-- v25 may claim only never-v2, public rows. In particular, a safely retried
-- v2 public row remains V2 and pauses during a rollback to v25.
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
set search_path = ''
as $function$
begin
  return query
  with picked as (
    select q.id
    from public.community_message_push_queue q
    join public.community_messages m
      on m.id = q.message_id
     and m.community_id = q.community_id
    where q.status = 'pending'
      and q.claim_protocol is null
      and q.attempts < 5
      and coalesce(q.next_attempt_at, '-infinity'::timestamptz) <= now()
      and m.target_user_id is null
      and m.published_at <= now()
      and m.is_active = true
      and m.deleted_at is null
      and q.created_at >= now() - interval '24 hours'
      and m.published_at >= now() - interval '24 hours'
    order by q.created_at asc, q.id asc
    limit least(greatest(coalesce(p_limit, 5), 1), 5)
    for update of q skip locked
  ),
  updated as (
    update public.community_message_push_queue q
       set status = 'processing',
           attempts = q.attempts + 1,
           claimed_at = now(),
           audience_type = 'PUBLIC',
           audience_target_user_id = null,
           delivery_stage = 'PRE_PROVIDER',
           claim_protocol = 'LEGACY_V25',
           claim_token = null,
           provider_attempted_at = null,
           failure_code = null,
           next_attempt_at = null,
           completed_at = null,
           last_error = null,
           updated_at = now()
      from picked
     where q.id = picked.id
    returning q.id, q.message_id, q.community_id, q.push_title, q.push_body, q.attempts
  )
  select updated.id, updated.message_id, updated.community_id,
         updated.push_title, updated.push_body, updated.attempts
  from updated;
end;
$function$;

create or replace function public.claim_pending_community_message_pushes_v2(
  p_limit integer default 5
)
returns table(
  queue_id uuid,
  message_id uuid,
  community_id uuid,
  push_title text,
  push_body text,
  attempts integer,
  audience_type text,
  target_user_id uuid,
  claim_token uuid,
  delivery_stage text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 5);
begin
  with invalid_private as (
    select q.id
    from public.community_message_push_queue q
    join public.community_messages m on m.id = q.message_id and m.community_id = q.community_id
    where q.status = 'pending'
      and (q.claim_protocol is null or q.claim_protocol = 'V2')
      and q.attempts < 5
      and coalesce(q.next_attempt_at, '-infinity'::timestamptz) <= now()
      and m.target_user_id is not null
      and not exists (
        select 1 from public.community_members cm
        where cm.community_id = m.community_id
          and cm.user_id = m.target_user_id
          and cm.is_active = true
      )
    order by q.created_at asc, q.id asc
    limit v_limit
    for update of q skip locked
  )
  update public.community_message_push_queue q
     set status = 'failed',
         audience_type = 'PRIVATE',
         audience_target_user_id = m.target_user_id,
         delivery_stage = 'FAILED',
         -- This is a v2-only validation path. Preserve/mint V2 provenance so
         -- a rollback worker can never reinterpret it as legacy work.
         claim_protocol = 'V2',
         failure_code = 'INVALID_PRIVATE_AUDIENCE',
         last_error = 'Private notification target is not an active member of the message community',
         completed_at = now(),
         claim_token = null,
         next_attempt_at = null,
         updated_at = now()
    from invalid_private i, public.community_messages m
   where q.id = i.id and m.id = q.message_id and m.community_id = q.community_id;

  return query
  with picked as (
    select q.id,
           case when m.target_user_id is null then 'PUBLIC'::text else 'PRIVATE'::text end as resolved_audience_type,
           m.target_user_id as resolved_target_user_id,
           gen_random_uuid() as resolved_claim_token
    from public.community_message_push_queue q
    join public.community_messages m on m.id = q.message_id and m.community_id = q.community_id
    where q.status = 'pending'
      -- A v2 retry retains V2 provenance; v25 may only claim NULL work.
      and (q.claim_protocol is null or q.claim_protocol = 'V2')
      and q.attempts < 5
      and coalesce(q.next_attempt_at, '-infinity'::timestamptz) <= now()
      and m.published_at <= now()
      and m.is_active = true
      and m.deleted_at is null
      and (
        (q.created_at >= now() - interval '24 hours' and m.published_at >= now() - interval '24 hours')
        or (
          q.enqueue_source = 'welcome_token_recovery'
          and q.updated_at >= now() - interval '24 hours'
          and m.target_user_id is not null
          and exists (
            select 1 from public.user_push_tokens upt
            where upt.user_id = m.target_user_id and upt.community_id = m.community_id and upt.is_active = true
          )
        )
      )
      and (
        m.target_user_id is null or exists (
          select 1 from public.community_members cm
          where cm.community_id = m.community_id and cm.user_id = m.target_user_id and cm.is_active = true
        )
      )
    order by q.created_at asc, q.id asc
    limit v_limit
    for update of q skip locked
  ),
  updated as (
    update public.community_message_push_queue q
       set status = 'processing',
           attempts = q.attempts + 1,
           claimed_at = now(),
           audience_type = picked.resolved_audience_type,
           audience_target_user_id = picked.resolved_target_user_id,
           delivery_stage = 'PRE_PROVIDER',
           claim_protocol = 'V2',
           claim_token = picked.resolved_claim_token,
           provider_attempted_at = null,
           failure_code = null,
           next_attempt_at = null,
           completed_at = null,
           last_error = null,
           updated_at = now()
      from picked
     where q.id = picked.id
    returning q.id, q.message_id, q.community_id, q.push_title, q.push_body, q.attempts,
              q.audience_type, q.audience_target_user_id, q.claim_token, q.delivery_stage
  )
  select * from updated;
end;
$function$;

create or replace function public.mark_community_message_push_provider_contacted_v2(
  p_queue_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.community_message_push_queue
     set delivery_stage = 'PROVIDER_CONTACTED', provider_attempted_at = now(), updated_at = now()
   where id = p_queue_id and claim_protocol = 'V2' and claim_token = p_claim_token
     and status = 'processing' and delivery_stage = 'PRE_PROVIDER';
  if not found then
    raise exception 'Queue claim is not eligible for provider contact (queue_id=%)', p_queue_id using errcode = 'P0001';
  end if;
  return jsonb_build_object('ok', true, 'stage', 'PROVIDER_CONTACTED');
end;
$function$;

create or replace function public.retry_community_message_push_pre_provider_v2(
  p_queue_id uuid, p_claim_token uuid, p_failure_code text, p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_attempts integer; v_created_at timestamptz; v_updated_at timestamptz;
  v_published_at timestamptz; v_enqueue_source text; v_target_user_id uuid;
  v_retryable boolean; v_delay interval;
begin
  select q.attempts, q.created_at, q.updated_at, q.enqueue_source, m.published_at, m.target_user_id
    into v_attempts, v_created_at, v_updated_at, v_enqueue_source, v_published_at, v_target_user_id
  from public.community_message_push_queue q
  join public.community_messages m on m.id = q.message_id and m.community_id = q.community_id
  where q.id = p_queue_id and q.claim_protocol = 'V2' and q.claim_token = p_claim_token
    and q.status = 'processing' and q.delivery_stage = 'PRE_PROVIDER'
  for update of q;
  if not found then
    raise exception 'Queue claim is not retryable before provider contact (queue_id=%)', p_queue_id using errcode = 'P0001';
  end if;
  v_retryable := v_attempts < 5 and (
    (v_created_at >= now() - interval '24 hours' and v_published_at >= now() - interval '24 hours')
    or (v_enqueue_source = 'welcome_token_recovery' and v_updated_at >= now() - interval '24 hours' and v_target_user_id is not null)
  );
  v_delay := power(2, least(greatest(v_attempts, 1), 4)) * interval '1 minute';
  if v_retryable then
    update public.community_message_push_queue
       set status = 'pending', delivery_stage = 'PRE_PROVIDER', claim_protocol = 'V2', claim_token = null,
           provider_attempted_at = null,
           failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), 'PRE_PROVIDER_FAILURE'), 80),
           last_error = left(coalesce(nullif(btrim(p_error), ''), 'Pre-provider processing failed'), 1000),
           next_attempt_at = now() + v_delay, completed_at = null, processed_at = null, updated_at = now()
     where id = p_queue_id;
    return jsonb_build_object('ok', true, 'outcome', 'retry_scheduled', 'next_attempt_at', now() + v_delay);
  end if;
  update public.community_message_push_queue
     set status = 'failed', delivery_stage = 'FAILED', claim_protocol = 'V2', claim_token = null,
         failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), 'PRE_PROVIDER_RETRY_EXHAUSTED'), 80),
         last_error = left(coalesce(nullif(btrim(p_error), ''), 'Pre-provider retry exhausted'), 1000),
         next_attempt_at = null, completed_at = now(), updated_at = now()
   where id = p_queue_id;
  return jsonb_build_object('ok', true, 'outcome', 'failed');
end;
$function$;

create or replace function public.complete_community_message_push_v2(
  p_queue_id uuid, p_claim_token uuid, p_provider_response jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.community_message_push_queue
     set status = 'sent', delivery_stage = 'CONFIRMED', claim_protocol = 'V2',
         provider_response = coalesce(p_provider_response, '{}'::jsonb), processed_at = now(), completed_at = now(),
         claim_token = null, failure_code = null, last_error = null, updated_at = now()
   where id = p_queue_id and claim_protocol = 'V2' and claim_token = p_claim_token
     and status = 'processing' and delivery_stage = 'PROVIDER_CONTACTED';
  if not found then
    raise exception 'Queue claim is not confirmable (queue_id=%)', p_queue_id using errcode = 'P0001';
  end if;
  return jsonb_build_object('ok', true, 'stage', 'CONFIRMED');
end;
$function$;

create or replace function public.fail_community_message_push_v2(
  p_queue_id uuid, p_claim_token uuid, p_failure_code text, p_error text,
  p_provider_response jsonb default null, p_unknown_outcome boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.community_message_push_queue
     set status = 'failed', delivery_stage = case when p_unknown_outcome then 'UNKNOWN_OUTCOME' else 'FAILED' end,
         claim_protocol = 'V2', provider_response = coalesce(p_provider_response, provider_response),
         failure_code = left(coalesce(nullif(btrim(p_failure_code), ''), 'PUSH_FAILED'), 80),
         last_error = left(coalesce(nullif(btrim(p_error), ''), 'Push processing failed'), 1000),
         completed_at = now(), claim_token = null, next_attempt_at = null, updated_at = now()
   where id = p_queue_id and claim_protocol = 'V2' and claim_token = p_claim_token
     and status = 'processing' and delivery_stage in ('PRE_PROVIDER', 'PROVIDER_CONTACTED')
     and (not p_unknown_outcome or delivery_stage = 'PROVIDER_CONTACTED');
  if not found then
    raise exception 'Queue claim is not fail-able in the requested state (queue_id=%)', p_queue_id using errcode = 'P0001';
  end if;
  return jsonb_build_object('ok', true, 'stage', case when p_unknown_outcome then 'UNKNOWN_OUTCOME' else 'FAILED' end);
end;
$function$;

-- Legacy terminal RPCs deliberately require durable legacy provenance. They
-- cannot touch a v2 public claim, a v2 private claim, or an unclassified row.
create or replace function public.complete_community_message_push(p_queue_id uuid)
returns table(success boolean)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.community_message_push_queue
     set status = 'sent', delivery_stage = 'CONFIRMED', claim_protocol = 'LEGACY_V25',
         processed_at = now(), completed_at = now(), claim_token = null,
         failure_code = null, last_error = null, updated_at = now()
   where id = p_queue_id and status = 'processing' and claim_protocol = 'LEGACY_V25'
     and audience_type = 'PUBLIC' and audience_target_user_id is null and claim_token is null;
  if not found then
    raise exception 'Queue item is not an authorized legacy public claim (queue_id=%)', p_queue_id using errcode = 'P0001';
  end if;
  return query select true;
end;
$function$;

create or replace function public.fail_community_message_push(p_queue_id uuid, p_error text)
returns table(success boolean)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.community_message_push_queue
     set status = 'failed', delivery_stage = 'FAILED', claim_protocol = 'LEGACY_V25',
         last_error = left(coalesce(p_error, 'Unknown error'), 1000),
         failure_code = coalesce(failure_code, 'LEGACY_WORKER_FAILURE'),
         completed_at = now(), claim_token = null, next_attempt_at = null, updated_at = now()
   where id = p_queue_id and status = 'processing' and claim_protocol = 'LEGACY_V25'
     and audience_type = 'PUBLIC' and audience_target_user_id is null and claim_token is null;
  if not found then
    raise exception 'Queue item is not an authorized legacy public claim (queue_id=%)', p_queue_id using errcode = 'P0001';
  end if;
  return query select true;
end;
$function$;

-- The sweeper is the only non-worker actor allowed to resolve an abandoned
-- claim. It can requeue only a leased V2 PRE_PROVIDER claim; every legacy,
-- unclassified, or provider-contacted claim remains non-replayable.
create or replace function public.sweep_stale_community_message_pushes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pre_provider_requeued integer := 0; v_ambiguous_count integer := 0;
  v_old_count integer := 0; v_old_pending_count integer := 0;
begin
  with safe_stuck as (
    select q.id
    from public.community_message_push_queue q
    join public.community_messages m on m.id = q.message_id and m.community_id = q.community_id
    where q.status = 'processing' and q.claim_protocol = 'V2' and q.delivery_stage = 'PRE_PROVIDER'
      and q.claim_token is not null and q.updated_at < now() - interval '15 minutes' and q.attempts < 5
      and ((q.created_at >= now() - interval '24 hours' and m.published_at >= now() - interval '24 hours')
        or (q.enqueue_source = 'welcome_token_recovery' and m.target_user_id is not null and exists (
          select 1 from public.user_push_tokens upt
          where upt.user_id = m.target_user_id and upt.community_id = m.community_id and upt.is_active = true
        )))
    order by q.id for update of q skip locked
  )
  update public.community_message_push_queue q
     set status = 'pending', delivery_stage = 'PRE_PROVIDER', claim_protocol = 'V2', claim_token = null,
         provider_attempted_at = null, failure_code = 'PRE_PROVIDER_LEASE_EXPIRED',
         last_error = 'V2 pre-provider claim expired and was safely requeued', next_attempt_at = now() + interval '2 minutes',
         completed_at = null, processed_at = null, updated_at = now()
    from safe_stuck s where q.id = s.id;
  get diagnostics v_pre_provider_requeued = row_count;

  with ambiguous_stuck as (
    select q.id
    from public.community_message_push_queue q join public.community_messages m on m.id = q.message_id and m.community_id = q.community_id
    where q.status = 'processing' and q.updated_at < now() - interval '15 minutes'
      and m.published_at >= now() - interval '24 hours'
    order by q.id for update of q skip locked
  )
  update public.community_message_push_queue q
     set status = 'failed', delivery_stage = case when q.claim_protocol = 'V2' and q.delivery_stage = 'PRE_PROVIDER' and q.claim_token is not null then 'FAILED' else 'UNKNOWN_OUTCOME' end,
         failure_code = case when q.claim_protocol = 'V2' and q.delivery_stage = 'PRE_PROVIDER' and q.claim_token is not null then 'PRE_PROVIDER_RETRY_EXHAUSTED' else 'STALE_PROVIDER_OUTCOME_UNKNOWN' end,
         last_error = case when q.claim_protocol = 'V2' and q.delivery_stage = 'PRE_PROVIDER' and q.claim_token is not null then 'V2 pre-provider claim exhausted retries' else 'Stale claim may have contacted provider; automatic replay is forbidden' end,
         completed_at = now(), claim_token = null, next_attempt_at = null, updated_at = now()
    from ambiguous_stuck s where q.id = s.id;
  get diagnostics v_ambiguous_count = row_count;

  with old_stuck as (
    select q.id
    from public.community_message_push_queue q join public.community_messages m on m.id = q.message_id and m.community_id = q.community_id
    where q.status = 'processing' and q.updated_at < now() - interval '15 minutes'
      and m.published_at < now() - interval '24 hours'
    order by q.id for update of q skip locked
  )
  update public.community_message_push_queue q
     set status = 'failed', delivery_stage = case when q.claim_protocol = 'V2' and q.delivery_stage = 'PRE_PROVIDER' and q.claim_token is not null then 'FAILED' else 'UNKNOWN_OUTCOME' end,
         failure_code = 'STALE_OLD_MESSAGE', last_error = 'Stale processing message is older than 24h and will not be retried',
         completed_at = now(), claim_token = null, next_attempt_at = null, updated_at = now()
    from old_stuck s where q.id = s.id;
  get diagnostics v_old_count = row_count;

  with old_pending as (
    select q.id
    from public.community_message_push_queue q join public.community_messages m on m.id = q.message_id
    where q.status = 'pending' and q.created_at < now() - interval '24 hours'
      and m.published_at < now() - interval '24 hours' and q.updated_at < now() - interval '24 hours'
    order by q.id for update of q skip locked
  )
  update public.community_message_push_queue q
     set status = 'failed', delivery_stage = 'FAILED', failure_code = 'STALE_OLD_PENDING',
         last_error = 'Pending message exceeded the 24h claim window', completed_at = now(),
         next_attempt_at = null, updated_at = now()
    from old_pending s where q.id = s.id;
  get diagnostics v_old_pending_count = row_count;

  if v_pre_provider_requeued > 0 or v_ambiguous_count > 0
     or v_old_count > 0 or v_old_pending_count > 0 then
    insert into public.system_event_log (
      severity, module, event_type, message, source, details
    ) values (
      case when v_ambiguous_count > 0 or v_old_count > 0 then 'WARN' else 'INFO' end,
      'community_message_push',
      'PUSH_QUEUE_SWEEP_STALE',
      'Recovered or quarantined stale notification claims',
      'sweep_stale_community_message_pushes',
      jsonb_build_object(
        'pre_provider_requeued', v_pre_provider_requeued,
        'ambiguous_failed', v_ambiguous_count,
        'old_processing_failed', v_old_count,
        'old_pending_failed', v_old_pending_count
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'pre_provider_requeued', v_pre_provider_requeued,
    'ambiguous_failed', v_ambiguous_count, 'old_processing_failed', v_old_count,
    'old_pending_failed', v_old_pending_count);
end;
$function$;

-- Welcome recovery creates a new v2-eligible pending row; it must not retain
-- terminal V2 provenance across that safe, no-provider-evidence recovery.
create or replace function public.ensure_welcome_push_after_token(p_community_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid(); v_full_name text; v_house_label text; v_message_id uuid;
  v_queue_status text; v_queue_updated_at timestamptz; v_failure_code text;
  v_delivery_stage text; v_provider_attempted_at timestamptz; v_provider_response jsonb;
  v_action text := 'noop';
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_community_id is null then raise exception 'Community is required'; end if;
  if not exists (select 1 from public.community_members cm where cm.user_id=v_user_id and cm.community_id=p_community_id and cm.is_active=true) then raise exception 'User is not an active member of this community'; end if;
  if not exists (select 1 from public.user_push_tokens upt where upt.user_id=v_user_id and upt.community_id=p_community_id and upt.is_active=true) then return jsonb_build_object('ok', false, 'reason', 'no_active_push_token'); end if;
  select p.full_name, h.house_label into v_full_name, v_house_label from public.profiles p left join public.houses h on h.id=p.house_id and h.community_id=p.community_id where p.user_id=v_user_id and p.community_id=p_community_id and p.is_active=true limit 1;
  if not found then return jsonb_build_object('ok', false, 'reason', 'active_profile_not_found'); end if;
  select m.id into v_message_id from public.community_messages m where m.community_id=p_community_id and m.target_user_id=v_user_id and m.title='Bienvenido(a) a ENTRY' and m.is_active=true and m.deleted_at is null order by m.published_at desc nulls last, m.created_at desc limit 1;
  if v_message_id is null then
    perform public.send_welcome_notification(v_user_id, p_community_id, v_full_name, v_house_label);
    select m.id into v_message_id from public.community_messages m where m.community_id=p_community_id and m.target_user_id=v_user_id and m.title='Bienvenido(a) a ENTRY' and m.is_active=true and m.deleted_at is null order by m.published_at desc nulls last, m.created_at desc limit 1;
    if v_message_id is null then return jsonb_build_object('ok', false, 'reason', 'welcome_message_not_created'); end if;
    v_action := 'created';
  end if;
  select q.status,q.updated_at,q.failure_code,q.delivery_stage,q.provider_attempted_at,q.provider_response into v_queue_status,v_queue_updated_at,v_failure_code,v_delivery_stage,v_provider_attempted_at,v_provider_response from public.community_message_push_queue q where q.message_id=v_message_id;
  if not found then
    perform set_config('app.push_enqueue_source', 'welcome_token_recovery', true); perform public.enqueue_community_message_push(v_message_id); v_action := case when v_action='created' then 'created' else 'enqueued' end; v_queue_status := 'pending';
  elsif (v_queue_status='failed' and v_failure_code='NO_ACTIVE_TOKENS' and v_delivery_stage='FAILED' and v_provider_attempted_at is null and v_provider_response is null)
     or (v_queue_status='pending' and coalesce(v_queue_updated_at, '-infinity'::timestamptz)<now()-interval '24 hours' and v_provider_attempted_at is null and v_provider_response is null) then
    update public.community_message_push_queue
       set status='pending',attempts=0,audience_type='PRIVATE',audience_target_user_id=v_user_id,delivery_stage='PRE_PROVIDER',claim_protocol=null,claim_token=null,provider_attempted_at=null,failure_code=null,last_error=null,next_attempt_at=now(),processed_at=null,claimed_at=null,completed_at=null,provider_response=null,enqueue_source='welcome_token_recovery',updated_at=now()
     where message_id=v_message_id;
    v_action := 'retried'; v_queue_status := 'pending';
  elsif v_queue_status='failed' then v_action := 'blocked_unsafe_retry'; end if;
  return jsonb_build_object('ok',true,'action',v_action,'message_id',v_message_id,'queue_status',v_queue_status);
end;
$function$;

-- SECURITY DEFINER functions in public must explicitly revoke default PUBLIC
-- execute rights. The legacy surface remains service-role-only for v25.
revoke all on function public.claim_pending_community_message_pushes(integer) from public, anon, authenticated;
revoke all on function public.complete_community_message_push(uuid) from public, anon, authenticated;
revoke all on function public.fail_community_message_push(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_pending_community_message_pushes(integer) to service_role;
grant execute on function public.complete_community_message_push(uuid) to service_role;
grant execute on function public.fail_community_message_push(uuid, text) to service_role;

comment on column public.community_message_push_queue.claim_protocol is
  'F02 durable ownership provenance: LEGACY_V25 is public-only; V2 requires a lease for every processing transition.';
comment on function public.complete_community_message_push(uuid) is
  'Legacy v25 terminal transition for a durable LEGACY_V25 public claim only; cannot finalize V2 claims.';
comment on function public.fail_community_message_push(uuid, text) is
  'Legacy v25 terminal transition for a durable LEGACY_V25 public claim only; cannot fail V2 claims.';
