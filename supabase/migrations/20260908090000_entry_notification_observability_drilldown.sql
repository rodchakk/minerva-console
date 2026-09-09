-- ENTRY-OBS-003: Notifications drill-down read model.
--
-- Observability only. This RPC normalizes existing durable notification
-- evidence without changing queue, worker, retry, or provider behavior.

create or replace function public._entry_notification_observability_sanitize_text_v1(
  p_value text,
  p_fallback text default 'No sanitized reason recorded'
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select left(
    coalesce(
      nullif(
        btrim(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    coalesce(p_value, ''),
                    '(?i)(authorization|bearer|service[_ -]?role|apikey|api[_ -]?key|jwt|token)[[:space:]:=]+[^[:space:],;}]+',
                    '\1=[redacted]',
                    'g'
                  ),
                  'ExponentPushToken\[[^]]+\]',
                  'ExponentPushToken[redacted]',
                  'g'
                ),
                '[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}',
                '[redacted-email]',
                'g'
              ),
              '\meyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\M',
              '[redacted-jwt]',
              'g'
            ),
            '\m[A-Za-z0-9_-]{32,}\M',
            '[redacted-token]',
            'g'
          )
        ),
        ''
      ),
      p_fallback,
      'No sanitized reason recorded'
    ),
    220
  );
$function$;

revoke all on function public._entry_notification_observability_sanitize_text_v1(text, text)
  from public, anon, authenticated;

create or replace function public._entry_notification_observability_status_v1(
  p_status text,
  p_severity text,
  p_error text
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when lower(coalesce(p_status, '')) in ('success', 'sent', 'completed', 'ok') then 'success'
    when lower(coalesce(p_status, '')) in ('skipped', 'cancelled', 'canceled') then 'skipped'
    when lower(coalesce(p_status, '')) in ('failed', 'failure', 'error') then
      case
        when lower(coalesce(p_error, '')) like 'no active push tokens%' then 'skipped'
        else 'failed'
      end
    when public._entry_observability_severity_rank_v1(p_severity) >= 3 then 'failed'
    else 'unknown'
  end;
$function$;

revoke all on function public._entry_notification_observability_status_v1(text, text, text)
  from public, anon, authenticated;

create or replace function public._entry_notification_observability_severity_v1(
  p_status text,
  p_severity text,
  p_error text
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when public._entry_notification_observability_status_v1(p_status, p_severity, p_error) = 'failed'
      then 'ERROR'
    when public._entry_notification_observability_status_v1(p_status, p_severity, p_error) = 'skipped'
      then 'WARNING'
    else public._entry_observability_normalize_severity_v1(p_severity)
  end;
$function$;

revoke all on function public._entry_notification_observability_severity_v1(text, text, text)
  from public, anon, authenticated;

create or replace function public._entry_notification_observability_error_code_v1(
  p_status text,
  p_error text,
  p_fallback text default null
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when lower(coalesce(p_error, '')) like 'no active push tokens%' then 'PUSH_NO_ACTIVE_TOKENS'
    when nullif(btrim(coalesce(p_fallback, '')), '') is not null then btrim(p_fallback)
    when lower(coalesce(p_status, '')) in ('failed', 'failure', 'error') then 'NOTIFICATION_DELIVERY_FAILED'
    else null::text
  end;
$function$;

revoke all on function public._entry_notification_observability_error_code_v1(text, text, text)
  from public, anon, authenticated;

create or replace function public._entry_notification_observability_retry_summary_v1(
  p_channel text,
  p_layer text,
  p_status text,
  p_error_code text
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when p_error_code = 'PUSH_CLAIM_RPC_ERROR'
      then 'Scheduled worker invocation will run again because no queue row was claimed or terminally failed.'
    when p_channel = 'push' and p_layer = 'queue' and p_status = 'failed'
      then 'Terminal failed queue rows are not automatically reclaimed by the current claim RPC.'
    when p_channel = 'push' and p_error_code = 'PUSH_NO_ACTIVE_TOKENS'
      then 'No provider retry is expected until the audience has an active push token and a new notification is queued.'
    when p_channel = 'onboarding_email' and p_status = 'failed'
      then 'Onboarding email retry depends on campaign worker behavior; this read model only reports the recorded attempt state.'
    when p_status = 'skipped'
      then 'Skipped evidence is not a provider retry condition.'
    else 'No retry conclusion available from this evidence.'
  end;
$function$;

revoke all on function public._entry_notification_observability_retry_summary_v1(text, text, text, text)
  from public, anon, authenticated;

create or replace function public.sa_get_entry_notification_observability_v1(
  p_starts_at timestamptz,
  p_ends_at timestamptz default now(),
  p_community_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_start timestamptz := coalesce(p_starts_at, now() - interval '24 hours');
  v_end timestamptz := coalesce(p_ends_at, now());
  v_selected_community uuid := p_community_id;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  if v_end <= v_start then
    raise exception 'Invalid notification observability time range' using errcode = '22023';
  end if;

  if v_end - v_start > interval '31 days' then
    raise exception 'Notification observability time range is too large' using errcode = '22023';
  end if;

  with active_communities as (
    select c.id, c.name
    from public.communities c
    where coalesce(c.is_active, false) = true
  ),
  selected_communities as (
    select ac.id, ac.name
    from active_communities ac
    where v_selected_community is null or ac.id = v_selected_community
  ),
  push_queue_events as (
    select
      ('queue:' || q.id::text) as id,
      coalesce(q.completed_at, q.processed_at, q.claimed_at, q.created_at) as occurred_at,
      'push'::text as channel,
      case
        when lower(q.status) in ('sent', 'failed') and q.provider_response is not null then 'provider'
        when lower(coalesce(q.last_error, '')) like 'no active push tokens%' then 'delivery'
        else 'queue'
      end as layer,
      case
        when lower(q.status) = 'sent' then 'Push delivery completed'
        when lower(q.status) = 'failed' then 'Push delivery failed'
        when lower(q.status) = 'processing' then 'Push delivery claimed'
        else 'Push delivery queued'
      end as operation,
      public._entry_notification_observability_status_v1(q.status, 'INFO', q.last_error) as status,
      public._entry_notification_observability_severity_v1(q.status, 'INFO', q.last_error) as severity,
      q.community_id,
      sc.name as community_name,
      q.id as queue_id,
      q.message_id,
      left(nullif(btrim(m.title), ''), 90) as message_label,
      m.source_type,
      case
        when m.target_user_id is not null then 'user'
        when m.id is not null then 'community'
        else 'unknown'
      end as audience_type,
      case
        when m.target_user_id is not null then coalesce(target_profile.full_name, 'user:' || left(m.target_user_id::text, 8))
        when m.id is not null then 'Community audience'
        else 'Unknown audience'
      end as audience_label,
      q.attempts,
      q.enqueue_source,
      q.created_at,
      q.claimed_at,
      q.completed_at,
      case
        when q.completed_at is not null
          then greatest(0, round(extract(epoch from (q.completed_at - q.created_at)) * 1000))::integer
        when q.processed_at is not null
          then greatest(0, round(extract(epoch from (q.processed_at - q.created_at)) * 1000))::integer
        else null::integer
      end as duration_ms,
      public._entry_notification_observability_error_code_v1(q.status, q.last_error, null) as error_code,
      case
        when lower(coalesce(q.last_error, '')) like 'no active push tokens%'
          then 'No active push tokens / no deliverable audience'
        when q.last_error is not null
          then public._entry_notification_observability_sanitize_text_v1(q.last_error)
        else null::text
      end as error_summary,
      case
        when lower(coalesce(q.last_error, '')) like 'no active push tokens%' then false
        when lower(q.status) = 'sent' then true
        when q.provider_response is not null then true
        else null::boolean
      end as provider_reached,
      case
        when lower(coalesce(q.last_error, '')) like 'no active push tokens%' then 'no_provider_retry'
        when lower(q.status) = 'failed' then 'terminal_no_auto_reclaim'
        when lower(q.status) in ('pending', 'processing') then 'open_queue_state'
        else 'none'
      end as retry_mode,
      public._entry_notification_observability_retry_summary_v1(
        'push',
        'queue',
        public._entry_notification_observability_status_v1(q.status, 'INFO', q.last_error),
        public._entry_notification_observability_error_code_v1(q.status, q.last_error, null)
      ) as retry_summary,
      case
        when lower(q.status) = 'sent' then 'Delivery success is recorded for this queue row.'
        when lower(coalesce(q.last_error, '')) like 'no active push tokens%'
          then 'No active device token was available for the selected audience; provider delivery was not reached.'
        when lower(q.status) = 'failed'
          then 'This queue row reached terminal failed state; delivery to its target cannot be proven.'
        else 'Queue state is recorded; terminal delivery impact is not proven from this row.'
      end as impact_summary,
      'community_message_push_queue'::text as source,
      q.id::text as correlation_id,
      null::timestamptz as recovered_at,
      null::text as recovery_summary
    from public.community_message_push_queue q
    join selected_communities sc on sc.id = q.community_id
    left join public.community_messages m on m.id = q.message_id
    left join lateral (
      select nullif(btrim(p.full_name), '') as full_name
      from public.profiles p
      where p.user_id = m.target_user_id
        and p.community_id = q.community_id
      order by p.created_at desc
      limit 1
    ) target_profile on true
    where coalesce(q.completed_at, q.processed_at, q.claimed_at, q.created_at) >= v_start
      and coalesce(q.completed_at, q.processed_at, q.claimed_at, q.created_at) < v_end
      and not (
        lower(q.status) in ('sent', 'failed')
        and exists (
          select 1
          from public.system_event_log explicit_push
          where explicit_push.entity_type in ('community_message_push', 'community_message_push_queue')
            and explicit_push.entity_id = q.id
            and explicit_push.event_type in ('NOTIFICATION_SENT', 'NOTIFICATION_FAILED')
            and explicit_push.created_at >= v_start
            and explicit_push.created_at < v_end
        )
      )
  ),
  system_events as (
    select
      ('system:' || s.id::text) as id,
      s.created_at as occurred_at,
      case
        when s.event_type in ('NOTIFICATION_SENT', 'NOTIFICATION_FAILED', 'SOS_PUSH_NO_GUARD_TOKENS', 'PUSH_CLAIM_RPC_ERROR')
          then 'push'
        else 'system'
      end as channel,
      case
        when s.event_type = 'PUSH_CLAIM_RPC_ERROR' then 'worker / queue claim'
        when s.event_type in ('NOTIFICATION_SENT', 'NOTIFICATION_FAILED') then 'delivery'
        when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS' then 'delivery'
        else 'worker'
      end as layer,
      case
        when s.event_type = 'PUSH_CLAIM_RPC_ERROR' then 'Claim notification queue work'
        when s.event_type = 'NOTIFICATION_SENT' then 'Push delivery completed'
        when s.event_type = 'NOTIFICATION_FAILED' then 'Push delivery failed'
        when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS' then 'SOS push audience resolution'
        else coalesce(nullif(s.event_type, ''), 'Notification system event')
      end as operation,
      case
        when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS' then 'skipped'
        else public._entry_notification_observability_status_v1(
          coalesce(s.details->>'status', s.details->>'outcome'),
          s.severity,
          coalesce(s.details->>'error', s.details->>'error_message', s.message)
        )
      end as status,
      case
        when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS' then 'WARNING'
        else public._entry_notification_observability_severity_v1(
          coalesce(s.details->>'status', s.details->>'outcome'),
          s.severity,
          coalesce(s.details->>'error', s.details->>'error_message', s.message)
        )
      end as severity,
      coalesce(q.community_id, s.community_id) as community_id,
      coalesce(sc.name, q_community.name) as community_name,
      q.id as queue_id,
      q.message_id,
      left(nullif(btrim(m.title), ''), 90) as message_label,
      m.source_type,
      case
        when s.event_type = 'PUSH_CLAIM_RPC_ERROR' then 'unknown'
        when m.target_user_id is not null then 'user'
        when m.id is not null then 'community'
        else 'unknown'
      end as audience_type,
      case
        when s.event_type = 'PUSH_CLAIM_RPC_ERROR' then null::text
        when m.target_user_id is not null then coalesce(target_profile.full_name, 'user:' || left(m.target_user_id::text, 8))
        when m.id is not null then 'Community audience'
        else 'Unknown audience'
      end as audience_label,
      coalesce(
        public._entry_observability_jsonb_integer_v1(s.details, 'attempts'),
        q.attempts
      ) as attempts,
      coalesce(nullif(s.details->>'enqueue_source', ''), q.enqueue_source) as enqueue_source,
      q.created_at,
      q.claimed_at,
      q.completed_at,
      coalesce(
        public._entry_observability_jsonb_integer_v1(s.details, 'duration_ms'),
        public._entry_observability_jsonb_integer_v1(s.details, 'durationMs')
      ) as duration_ms,
      case
        when s.event_type = 'PUSH_CLAIM_RPC_ERROR' then 'PUSH_CLAIM_RPC_ERROR'
        when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS' then 'PUSH_NO_ACTIVE_TOKENS'
        else public._entry_notification_observability_error_code_v1(
          coalesce(s.details->>'status', s.details->>'outcome'),
          coalesce(s.details->>'error', s.details->>'error_message', s.message),
          coalesce(s.details->>'error_code', s.details->>'code')
        )
      end as error_code,
      case
        when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS'
          then 'No active push tokens / no deliverable audience'
        when coalesce(s.details->>'error', s.details->>'error_message', s.details->>'reason', s.message) is not null
          then public._entry_notification_observability_sanitize_text_v1(
            coalesce(s.details->>'error', s.details->>'error_message', s.details->>'reason', s.message)
          )
        else null::text
      end as error_summary,
      case
        when s.event_type in ('PUSH_CLAIM_RPC_ERROR', 'SOS_PUSH_NO_GUARD_TOKENS') then false
        when s.event_type = 'NOTIFICATION_SENT' then true
        when q.provider_response is not null then true
        when nullif(
          coalesce(
            s.details->>'provider_response',
            s.details->>'provider_status',
            s.details->>'provider_status_code',
            s.details->>'provider_message_id',
            s.details->>'provider_ticket_id',
            s.details->>'provider_request_id',
            s.details->>'expo_ticket_id',
            s.details->>'expo_ticket'
          ),
          ''
        ) is not null then true
        else null::boolean
      end as provider_reached,
      case
        when s.event_type = 'PUSH_CLAIM_RPC_ERROR' then 'scheduled_worker_retry'
        when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS' then 'no_provider_retry'
        when q.status = 'failed' then 'terminal_no_auto_reclaim'
        else 'none'
      end as retry_mode,
      public._entry_notification_observability_retry_summary_v1(
        case
          when s.event_type in ('NOTIFICATION_SENT', 'NOTIFICATION_FAILED', 'SOS_PUSH_NO_GUARD_TOKENS', 'PUSH_CLAIM_RPC_ERROR')
            then 'push'
          else 'system'
        end,
        case
          when s.event_type = 'PUSH_CLAIM_RPC_ERROR' then 'worker'
          when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS' then 'delivery'
          else 'queue'
        end,
        case
          when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS' then 'skipped'
          else public._entry_notification_observability_status_v1(
            coalesce(s.details->>'status', s.details->>'outcome'),
            s.severity,
            coalesce(s.details->>'error', s.details->>'error_message', s.message)
          )
        end,
        case
          when s.event_type = 'PUSH_CLAIM_RPC_ERROR' then 'PUSH_CLAIM_RPC_ERROR'
          when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS' then 'PUSH_NO_ACTIVE_TOKENS'
          else public._entry_notification_observability_error_code_v1(
            coalesce(s.details->>'status', s.details->>'outcome'),
            coalesce(s.details->>'error', s.details->>'error_message', s.message),
            coalesce(s.details->>'error_code', s.details->>'code')
          )
        end
      ) as retry_summary,
      case
        when s.event_type = 'PUSH_CLAIM_RPC_ERROR'
          then 'Worker failed before identifying a queue item; impact to a specific community, message, or recipient cannot be proven.'
        when s.event_type = 'SOS_PUSH_NO_GUARD_TOKENS'
          then 'No active guard device tokens were available; provider delivery was not reached.'
        when s.event_type = 'NOTIFICATION_SENT'
          then 'Delivery success is recorded for the notification evidence.'
        when s.event_type = 'NOTIFICATION_FAILED'
          then 'Delivery failure evidence exists; use joined queue context when available.'
        else 'Notification system evidence was recorded.'
      end as impact_summary,
      coalesce(nullif(s.source, ''), nullif(s.module, ''), 'system') as source,
      s.correlation_id,
      null::timestamptz as recovered_at,
      null::text as recovery_summary
    from public.system_event_log s
    left join public.community_message_push_queue q
      on s.entity_type in ('community_message_push', 'community_message_push_queue')
     and s.entity_id = q.id
    left join public.communities q_community on q_community.id = q.community_id
    left join selected_communities sc on sc.id = coalesce(q.community_id, s.community_id)
    left join public.community_messages m on m.id = q.message_id
    left join lateral (
      select nullif(btrim(p.full_name), '') as full_name
      from public.profiles p
      where p.user_id = m.target_user_id
        and p.community_id = coalesce(q.community_id, s.community_id)
      order by p.created_at desc
      limit 1
    ) target_profile on true
    where s.created_at >= v_start
      and s.created_at < v_end
      and (
        s.event_type in ('PUSH_CLAIM_RPC_ERROR', 'NOTIFICATION_SENT', 'NOTIFICATION_FAILED', 'SOS_PUSH_NO_GUARD_TOKENS')
        or s.module = 'notifications'
        or s.source in ('smart-service', 'push_queue_trigger')
      )
      and (
        (v_selected_community is null and coalesce(q.community_id, s.community_id) is null)
        or exists (
          select 1
          from selected_communities scope
          where scope.id = coalesce(q.community_id, s.community_id)
        )
      )
  ),
  onboarding_email_events as (
    select
      ('onboarding_email:' || m.id::text) as id,
      coalesce(m.sent_at, m.failed_at, m.last_attempt_at, m.updated_at, m.created_at) as occurred_at,
      'onboarding_email'::text as channel,
      case
        when m.status in ('sent', 'failed') and nullif(m.provider, '') is not null then 'provider'
        else 'delivery'
      end as layer,
      'Onboarding email delivery'::text as operation,
      case
        when m.status = 'sent' then 'success'
        when m.status = 'failed' then 'failed'
        when m.status in ('skipped', 'cancelled') then 'skipped'
        else 'unknown'
      end as status,
      case
        when m.status = 'failed' then 'ERROR'
        when m.status in ('skipped', 'cancelled') then 'WARNING'
        else 'INFO'
      end as severity,
      m.community_id,
      sc.name as community_name,
      null::uuid as queue_id,
      m.id as message_id,
      'Onboarding campaign email'::text as message_label,
      'onboarding_campaign'::text as source_type,
      'user'::text as audience_type,
      coalesce(nullif(btrim(m.resident_name), ''), nullif(btrim(m.unit_label), ''), 'Activation queue recipient') as audience_label,
      m.attempt_count as attempts,
      'onboarding_campaign'::text as enqueue_source,
      m.created_at,
      m.last_attempt_at as claimed_at,
      coalesce(m.sent_at, m.failed_at) as completed_at,
      case
        when coalesce(m.sent_at, m.failed_at) is not null and m.last_attempt_at is not null
          then greatest(0, round(extract(epoch from (coalesce(m.sent_at, m.failed_at) - m.last_attempt_at)) * 1000))::integer
        else null::integer
      end as duration_ms,
      case
        when m.status = 'failed' then 'ONBOARDING_EMAIL_FAILED'
        when m.status = 'skipped' then 'ONBOARDING_EMAIL_SKIPPED'
        when m.status = 'cancelled' then 'ONBOARDING_EMAIL_CANCELLED'
        else null::text
      end as error_code,
      case
        when m.last_error is not null
          then public._entry_notification_observability_sanitize_text_v1(m.last_error)
        else null::text
      end as error_summary,
      case
        when m.status = 'sent' and nullif(m.provider_message_id, '') is not null then true
        when m.status in ('skipped', 'cancelled') then false
        else null::boolean
      end as provider_reached,
      case
        when m.status = 'failed' then 'campaign_worker_dependent'
        when m.status in ('pending', 'processing') then 'open_campaign_state'
        else 'none'
      end as retry_mode,
      public._entry_notification_observability_retry_summary_v1(
        'onboarding_email',
        'provider',
        case
          when m.status = 'sent' then 'success'
          when m.status = 'failed' then 'failed'
          when m.status in ('skipped', 'cancelled') then 'skipped'
          else 'unknown'
        end,
        case when m.status = 'failed' then 'ONBOARDING_EMAIL_FAILED' else null end
      ) as retry_summary,
      case
        when m.status = 'sent' then 'Onboarding email send is recorded without exposing the recipient email.'
        when m.status = 'failed' then 'Onboarding email failure is recorded without exposing the recipient email.'
        when m.status in ('skipped', 'cancelled') then 'No provider delivery can be proven for this onboarding email row.'
        else 'Onboarding email row is not terminal in this window.'
      end as impact_summary,
      'onboarding_campaign_messages'::text as source,
      m.campaign_id::text as correlation_id,
      null::timestamptz as recovered_at,
      null::text as recovery_summary
    from public.onboarding_campaign_messages m
    join selected_communities sc on sc.id = m.community_id
    where coalesce(m.sent_at, m.failed_at, m.last_attempt_at, m.updated_at, m.created_at) >= v_start
      and coalesce(m.sent_at, m.failed_at, m.last_attempt_at, m.updated_at, m.created_at) < v_end
      and m.channel = 'email'
  ),
  normalized_events as (
    select * from push_queue_events
    union all
    select * from system_events
    union all
    select * from onboarding_email_events
  ),
  events_with_recovery as (
    select
      e.*,
      recovery.recovered_at as computed_recovered_at,
      case
        when e.status <> 'failed' then null::text
        when recovery.recovered_at is not null
          then 'Later success evidence exists in this channel during the selected window.'
        else 'No later success evidence was found in this channel during the selected window.'
      end as computed_recovery_summary
    from normalized_events e
    left join lateral (
      select min(success_event.occurred_at) as recovered_at
      from normalized_events success_event
      where success_event.status = 'success'
        and success_event.channel = e.channel
        and success_event.occurred_at > e.occurred_at
        and (
          e.community_id is null
          or success_event.community_id = e.community_id
        )
    ) recovery on true
  ),
  limited_events as (
    select *
    from events_with_recovery
    order by occurred_at desc, id desc
    limit v_limit
  ),
  summary as (
    select
      count(*)::integer as event_count,
      count(*) filter (where status = 'failed')::integer as failed_count,
      count(*) filter (where status = 'skipped')::integer as skipped_count,
      count(*) filter (where status = 'success')::integer as success_count,
      max(occurred_at) as last_observed_at,
      max(occurred_at) filter (where status = 'success') as last_success_at,
      max(occurred_at) filter (where status = 'failed') as last_failure_at
    from events_with_recovery
  )
  select jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object(
      'starts_at', v_start,
      'ends_at', v_end,
      'community_id', v_selected_community
    ),
    'limit', v_limit,
    'communities', coalesce((
      select jsonb_agg(jsonb_build_object('id', ac.id, 'name', ac.name) order by ac.name asc)
      from active_communities ac
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'status', public._entry_observability_flow_status_v1(
        coalesce((select success_count from summary), 0),
        coalesce((select failed_count from summary), 0),
        (select last_success_at from summary),
        coalesce((select success_count + failed_count from summary), 0)
      ),
      'event_count', coalesce((select event_count from summary), 0),
      'failed_count', coalesce((select failed_count from summary), 0),
      'skipped_count', coalesce((select skipped_count from summary), 0),
      'success_count', coalesce((select success_count from summary), 0),
      'last_failure_at', (select last_failure_at from summary),
      'last_observed_at', (select last_observed_at from summary)
    ),
    'events', coalesce((
      select jsonb_agg(
        jsonb_strip_nulls(jsonb_build_object(
          'id', e.id,
          'occurred_at', e.occurred_at,
          'channel', e.channel,
          'layer', e.layer,
          'operation', e.operation,
          'status', e.status,
          'severity', e.severity,
          'community_id', e.community_id,
          'community_name', e.community_name,
          'queue_id', e.queue_id,
          'message_id', e.message_id,
          'message_label', e.message_label,
          'source_type', e.source_type,
          'audience_type', e.audience_type,
          'audience_label', e.audience_label,
          'attempts', e.attempts,
          'enqueue_source', e.enqueue_source,
          'created_at', e.created_at,
          'claimed_at', e.claimed_at,
          'completed_at', e.completed_at,
          'duration_ms', e.duration_ms,
          'error_code', e.error_code,
          'error_summary', e.error_summary,
          'provider_reached', e.provider_reached,
          'retry_mode', e.retry_mode,
          'retry_summary', e.retry_summary,
          'impact_summary', e.impact_summary,
          'source', e.source,
          'correlation_id', e.correlation_id,
          'recovered_at', e.computed_recovered_at,
          'recovery_summary', e.computed_recovery_summary
        ))
        order by e.occurred_at desc, e.id desc
      )
      from limited_events e
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.sa_get_entry_notification_observability_v1(
  timestamptz, timestamptz, uuid, integer
) from public, anon;
grant execute on function public.sa_get_entry_notification_observability_v1(
  timestamptz, timestamptz, uuid, integer
) to authenticated;
grant execute on function public.sa_get_entry_notification_observability_v1(
  timestamptz, timestamptz, uuid, integer
) to service_role;

comment on function public.sa_get_entry_notification_observability_v1(
  timestamptz, timestamptz, uuid, integer
) is
  'Superadmin-only ENTRY Notifications observability drill-down. Returns bounded, privacy-minimized normalized push and onboarding-email evidence without exposing tokens, emails, message bodies, or raw provider payloads.';
