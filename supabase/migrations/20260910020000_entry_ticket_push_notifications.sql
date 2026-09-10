-- ENTRY Web Push: durable ticket notifications for Minerva Console and Minerva Field.
--
-- Release boundary:
-- - This migration creates the data model, service-role RPCs, enqueue triggers,
--   and opt-in pg_cron/pg_net scheduler helpers.
-- - It deliberately DOES NOT install the cron job automatically. Production
--   must first configure Vault secrets, then invoke
--   install_entry_web_push_dispatch_schedule_v1().
-- - No browser push endpoint, encryption key, auth secret, or message body is
--   exposed through authenticated table grants.

create table if not exists public.entry_web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 20 and 4096),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth_secret text not null check (char_length(auth_secret) between 8 and 512),
  surface text not null default 'console' check (surface in ('console', 'field')),
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create index if not exists entry_web_push_subscriptions_user_idx
  on public.entry_web_push_subscriptions (user_id, is_active);

create unique index if not exists entry_web_push_subscriptions_active_endpoint_uidx
  on public.entry_web_push_subscriptions (endpoint)
  where is_active = true;

create table if not exists public.entry_web_push_events (
  id uuid primary key default gen_random_uuid(),
  source_table text not null check (source_table in ('support_tickets', 'support_ticket_messages')),
  source_id uuid not null,
  event_type text not null check (event_type in ('ticket_created', 'incoming_message')),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts between 0 and 8),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_table, source_id, event_type)
);

create index if not exists entry_web_push_events_claim_idx
  on public.entry_web_push_events (status, available_at, created_at)
  where status = 'pending';

create table if not exists public.entry_web_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.entry_web_push_events(id) on delete cascade,
  subscription_id uuid not null references public.entry_web_push_subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'pruned')),
  attempts integer not null default 0 check (attempts between 0 and 8),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  provider_status integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, subscription_id)
);

create index if not exists entry_web_push_deliveries_claim_idx
  on public.entry_web_push_deliveries (status, next_attempt_at, created_at)
  where status = 'pending';

alter table public.entry_web_push_subscriptions enable row level security;
alter table public.entry_web_push_events enable row level security;
alter table public.entry_web_push_deliveries enable row level security;

revoke all on table public.entry_web_push_subscriptions from public, anon, authenticated;
revoke all on table public.entry_web_push_events from public, anon, authenticated;
revoke all on table public.entry_web_push_deliveries from public, anon, authenticated;

grant select, insert, update, delete on table public.entry_web_push_subscriptions to service_role;
grant select, insert, update, delete on table public.entry_web_push_events to service_role;
grant select, insert, update, delete on table public.entry_web_push_deliveries to service_role;

comment on table public.entry_web_push_subscriptions is
  'Server-only browser Web Push subscriptions for currently authorized Minerva operators. Endpoint and encryption keys are sensitive operational data.';
comment on table public.entry_web_push_events is
  'Durable minimal ENTRY support-ticket Web Push events. No ticket message body or resident contact data is stored here.';
comment on table public.entry_web_push_deliveries is
  'Per-device delivery state for ENTRY support-ticket Web Push events.';

create or replace function public.upsert_entry_web_push_subscription_v1(
  p_user_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_surface text default 'console',
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_endpoint text := btrim(coalesce(p_endpoint, ''));
  v_p256dh text := btrim(coalesce(p_p256dh, ''));
  v_auth text := btrim(coalesce(p_auth_secret, ''));
  v_surface text := case when p_surface = 'field' then 'field' else 'console' end;
begin
  if p_user_id is null or not public.is_superadmin(p_user_id) then
    raise exception 'Current superadmin authorization required' using errcode = '42501';
  end if;

  if v_endpoint !~ '^https://[^[:space:]]+$'
     or char_length(v_endpoint) > 4096
     or char_length(v_p256dh) not between 20 and 512
     or char_length(v_auth) not between 8 and 512 then
    raise exception 'Invalid Web Push subscription payload' using errcode = '22023';
  end if;

  -- One browser PushSubscription endpoint may belong to only one active
  -- Minerva operator. Serialize ownership changes for this endpoint.
  perform pg_advisory_xact_lock(hashtext(v_endpoint));

  update public.entry_web_push_subscriptions s
  set
    is_active = false,
    deactivated_at = now(),
    updated_at = now()
  where s.endpoint = v_endpoint
    and s.is_active = true
    and s.user_id <> p_user_id;

  select s.id
  into v_id
  from public.entry_web_push_subscriptions s
  where s.endpoint = v_endpoint
    and s.user_id = p_user_id
  order by s.created_at desc
  limit 1
  for update;

  if v_id is null then
    insert into public.entry_web_push_subscriptions (
      user_id,
      endpoint,
      p256dh,
      auth_secret,
      surface,
      user_agent,
      is_active,
      last_seen_at,
      deactivated_at
    )
    values (
      p_user_id,
      v_endpoint,
      v_p256dh,
      v_auth,
      v_surface,
      left(nullif(btrim(coalesce(p_user_agent, '')), ''), 300),
      true,
      now(),
      null
    )
    returning id into v_id;
  else
    update public.entry_web_push_subscriptions s
    set
      p256dh = v_p256dh,
      auth_secret = v_auth,
      surface = v_surface,
      user_agent = left(nullif(btrim(coalesce(p_user_agent, '')), ''), 300),
      is_active = true,
      last_seen_at = now(),
      deactivated_at = null,
      updated_at = now()
    where s.id = v_id;
  end if;

  return v_id;
end;
$function$;

revoke all on function public.upsert_entry_web_push_subscription_v1(
  uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.upsert_entry_web_push_subscription_v1(
  uuid, text, text, text, text, text
) to service_role;

create or replace function public.deactivate_entry_web_push_subscription_v1(
  p_user_id uuid,
  p_endpoint text
)
returns integer
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_count integer := 0;
  v_endpoint text := btrim(coalesce(p_endpoint, ''));
begin
  if p_user_id is null or v_endpoint = '' then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_endpoint));

  update public.entry_web_push_subscriptions s
  set
    is_active = false,
    deactivated_at = now(),
    updated_at = now()
  where s.user_id = p_user_id
    and s.endpoint = v_endpoint
    and s.is_active = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.deactivate_entry_web_push_subscription_v1(uuid, text)
  from public, anon, authenticated;
grant execute on function public.deactivate_entry_web_push_subscription_v1(uuid, text)
  to service_role;

create or replace function public.enqueue_entry_web_push_ticket_event_v1()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  insert into public.entry_web_push_events (
    source_table,
    source_id,
    event_type,
    ticket_id
  )
  values (
    'support_tickets',
    new.id,
    'ticket_created',
    new.id
  )
  on conflict (source_table, source_id, event_type) do nothing;

  return new;
end;
$function$;

revoke all on function public.enqueue_entry_web_push_ticket_event_v1()
  from public, anon, authenticated;

drop trigger if exists entry_web_push_support_ticket_insert on public.support_tickets;
create trigger entry_web_push_support_ticket_insert
  after insert on public.support_tickets
  for each row execute function public.enqueue_entry_web_push_ticket_event_v1();

create or replace function public.enqueue_entry_web_push_message_event_v1()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  -- Staff-authored replies are deliberately excluded. Only messages authored
  -- by the ENTRY user create an incoming-message alert for operators.
  if lower(coalesce(new.author_type, '')) <> 'user' then
    return new;
  end if;

  insert into public.entry_web_push_events (
    source_table,
    source_id,
    event_type,
    ticket_id
  )
  values (
    'support_ticket_messages',
    new.id,
    'incoming_message',
    new.ticket_id
  )
  on conflict (source_table, source_id, event_type) do nothing;

  return new;
end;
$function$;

revoke all on function public.enqueue_entry_web_push_message_event_v1()
  from public, anon, authenticated;

drop trigger if exists entry_web_push_support_message_insert on public.support_ticket_messages;
create trigger entry_web_push_support_message_insert
  after insert on public.support_ticket_messages
  for each row execute function public.enqueue_entry_web_push_message_event_v1();

create or replace function public.finalize_entry_web_push_event_v1(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_pending integer;
  v_sent integer;
  v_failed integer;
  v_pruned integer;
begin
  if p_event_id is null then
    return;
  end if;

  select
    count(*) filter (where d.status in ('pending', 'processing')),
    count(*) filter (where d.status = 'sent'),
    count(*) filter (where d.status = 'failed'),
    count(*) filter (where d.status = 'pruned')
  into v_pending, v_sent, v_failed, v_pruned
  from public.entry_web_push_deliveries d
  where d.event_id = p_event_id;

  if v_pending > 0 then
    update public.entry_web_push_events
    set status = 'processing', updated_at = now()
    where id = p_event_id and status not in ('sent', 'failed', 'skipped');
    return;
  end if;

  update public.entry_web_push_events e
  set
    status = case
      when v_sent > 0 then 'sent'
      when v_failed > 0 then 'failed'
      else 'skipped'
    end,
    completed_at = now(),
    last_error = case
      when v_sent > 0 then null
      when v_failed > 0 then 'All deliverable Web Push attempts failed'
      when v_pruned > 0 then 'No active authorized Web Push subscription remained'
      else 'No active authorized Web Push subscription was available'
    end,
    updated_at = now()
  where e.id = p_event_id;
end;
$function$;

revoke all on function public.finalize_entry_web_push_event_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_entry_web_push_event_v1(uuid)
  to service_role;

create or replace function public.claim_entry_web_push_deliveries_v1(
  p_limit integer default 50
)
returns table (
  delivery_id uuid,
  event_id uuid,
  subscription_id uuid,
  endpoint text,
  p256dh text,
  auth_secret text,
  ticket_id uuid,
  ticket_number text,
  event_type text,
  surface text,
  attempts integer
)
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_event record;
begin
  -- Authorization is checked again at dispatch time, not only when a browser
  -- originally subscribed. Revoked operators are deactivated before fan-out.
  update public.entry_web_push_subscriptions s
  set
    is_active = false,
    deactivated_at = coalesce(s.deactivated_at, now()),
    updated_at = now()
  where s.is_active = true
    and not public.is_superadmin(s.user_id);

  -- Any already-enqueued work for a subscription that is now inactive or no
  -- longer authorized is terminally pruned before it can be returned to Node.
  update public.entry_web_push_deliveries d
  set
    status = 'pruned',
    completed_at = now(),
    claimed_at = null,
    last_error = 'Subscription inactive or operator authorization revoked',
    updated_at = now()
  from public.entry_web_push_subscriptions s
  where d.subscription_id = s.id
    and d.status in ('pending', 'processing')
    and (s.is_active = false or not public.is_superadmin(s.user_id));

  -- Recover abandoned claims. Eight attempts is terminal.
  update public.entry_web_push_deliveries d
  set
    status = 'pending',
    claimed_at = null,
    next_attempt_at = now(),
    last_error = 'Recovered stale processing claim',
    updated_at = now()
  where d.status = 'processing'
    and d.claimed_at < now() - interval '15 minutes'
    and d.attempts < 8;

  update public.entry_web_push_deliveries d
  set
    status = 'failed',
    completed_at = now(),
    claimed_at = null,
    last_error = coalesce(d.last_error, 'Maximum Web Push attempts reached'),
    updated_at = now()
  where d.status = 'processing'
    and d.claimed_at < now() - interval '15 minutes'
    and d.attempts >= 8;

  -- Fan out newly queued events exactly once per active device. The event row
  -- itself is locked with SKIP LOCKED so concurrent dispatchers cannot race.
  for v_event in
    select e.id, e.ticket_id
    from public.entry_web_push_events e
    where e.status = 'pending'
      and e.available_at <= now()
      and e.attempts < 8
    order by e.created_at
    for update skip locked
    limit v_limit
  loop
    update public.entry_web_push_events e
    set
      status = 'processing',
      attempts = least(e.attempts + 1, 8),
      claimed_at = now(),
      updated_at = now()
    where e.id = v_event.id;

    insert into public.entry_web_push_deliveries (
      event_id,
      subscription_id,
      user_id
    )
    select
      v_event.id,
      s.id,
      s.user_id
    from public.entry_web_push_subscriptions s
    where s.is_active = true
      and public.is_superadmin(s.user_id)
    on conflict (event_id, subscription_id) do nothing;

    perform public.finalize_entry_web_push_event_v1(v_event.id);
  end loop;

  -- Close any events whose final delivery was pruned/recovered above.
  for v_event in
    select e.id
    from public.entry_web_push_events e
    where e.status = 'processing'
      and not exists (
        select 1
        from public.entry_web_push_deliveries d
        where d.event_id = e.id
          and d.status in ('pending', 'processing')
      )
  loop
    perform public.finalize_entry_web_push_event_v1(v_event.id);
  end loop;

  return query
  with picked as (
    select d.id
    from public.entry_web_push_deliveries d
    join public.entry_web_push_subscriptions s on s.id = d.subscription_id
    where d.status = 'pending'
      and d.next_attempt_at <= now()
      and d.attempts < 8
      and s.is_active = true
      and public.is_superadmin(s.user_id)
    order by d.created_at
    for update of d skip locked
    limit v_limit
  ),
  claimed as (
    update public.entry_web_push_deliveries d
    set
      status = 'processing',
      attempts = least(d.attempts + 1, 8),
      claimed_at = now(),
      updated_at = now()
    from picked p
    where d.id = p.id
    returning d.*
  )
  select
    c.id as delivery_id,
    c.event_id,
    c.subscription_id,
    s.endpoint,
    s.p256dh,
    s.auth_secret,
    e.ticket_id,
    t.ticket_number,
    e.event_type,
    s.surface,
    c.attempts
  from claimed c
  join public.entry_web_push_subscriptions s on s.id = c.subscription_id
  join public.entry_web_push_events e on e.id = c.event_id
  join public.support_tickets t on t.id = e.ticket_id;
end;
$function$;

revoke all on function public.claim_entry_web_push_deliveries_v1(integer)
  from public, anon, authenticated;
grant execute on function public.claim_entry_web_push_deliveries_v1(integer)
  to service_role;

create or replace function public.complete_entry_web_push_delivery_v1(
  p_delivery_id uuid,
  p_outcome text,
  p_provider_status integer default null,
  p_error text default null,
  p_retry_after_seconds integer default 60
)
returns text
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_delivery public.entry_web_push_deliveries%rowtype;
  v_outcome text := lower(btrim(coalesce(p_outcome, 'failed')));
  v_final_status text;
  v_retry_seconds integer := least(greatest(coalesce(p_retry_after_seconds, 60), 30), 3600);
begin
  select *
  into v_delivery
  from public.entry_web_push_deliveries d
  where d.id = p_delivery_id
  for update;

  if not found then
    raise exception 'Unknown Web Push delivery' using errcode = '22023';
  end if;

  if v_outcome = 'sent' then
    v_final_status := 'sent';
    update public.entry_web_push_deliveries
    set
      status = 'sent',
      completed_at = now(),
      provider_status = p_provider_status,
      last_error = null,
      updated_at = now()
    where id = p_delivery_id;
  elsif v_outcome = 'pruned' then
    v_final_status := 'pruned';
    update public.entry_web_push_deliveries
    set
      status = 'pruned',
      completed_at = now(),
      provider_status = p_provider_status,
      last_error = left(nullif(btrim(coalesce(p_error, '')), ''), 500),
      updated_at = now()
    where id = p_delivery_id;

    update public.entry_web_push_subscriptions
    set
      is_active = false,
      deactivated_at = coalesce(deactivated_at, now()),
      updated_at = now()
    where id = v_delivery.subscription_id;
  elsif v_outcome = 'retry' and v_delivery.attempts < 8 then
    v_final_status := 'pending';
    update public.entry_web_push_deliveries
    set
      status = 'pending',
      claimed_at = null,
      next_attempt_at = now() + make_interval(secs => v_retry_seconds),
      provider_status = p_provider_status,
      last_error = left(nullif(btrim(coalesce(p_error, '')), ''), 500),
      updated_at = now()
    where id = p_delivery_id;
  else
    v_final_status := 'failed';
    update public.entry_web_push_deliveries
    set
      status = 'failed',
      completed_at = now(),
      provider_status = p_provider_status,
      last_error = coalesce(
        left(nullif(btrim(coalesce(p_error, '')), ''), 500),
        'Permanent Web Push delivery failure'
      ),
      updated_at = now()
    where id = p_delivery_id;
  end if;

  perform public.finalize_entry_web_push_event_v1(v_delivery.event_id);
  return v_final_status;
end;
$function$;

revoke all on function public.complete_entry_web_push_delivery_v1(
  uuid, text, integer, text, integer
) from public, anon, authenticated;
grant execute on function public.complete_entry_web_push_delivery_v1(
  uuid, text, integer, text, integer
) to service_role;

-- Scheduler helper. Secrets are looked up at execution time in Supabase Vault;
-- no URL credential or dispatch secret is embedded in repository SQL.
create or replace function public.invoke_entry_web_push_dispatch_v1()
returns bigint
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_url text;
  v_secret text;
  v_request_id bigint;
begin
  select ds.decrypted_secret
  into v_url
  from vault.decrypted_secrets ds
  where ds.name = 'entry_web_push_dispatch_url'
  order by ds.created_at desc
  limit 1;

  select ds.decrypted_secret
  into v_secret
  from vault.decrypted_secrets ds
  where ds.name = 'entry_web_push_dispatch_secret'
  order by ds.created_at desc
  limit 1;

  if nullif(btrim(coalesce(v_url, '')), '') is null
     or nullif(btrim(coalesce(v_secret, '')), '') is null then
    raise exception 'ENTRY Web Push scheduler Vault secrets are not configured'
      using errcode = '55000';
  end if;

  if v_url !~ '^https://[^[:space:]]+/api/entry/push/dispatch$' then
    raise exception 'ENTRY Web Push dispatch URL is invalid'
      using errcode = '22023';
  end if;

  select net.http_post(
    url := v_url,
    body := jsonb_build_object('source', 'pg_cron'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

revoke all on function public.invoke_entry_web_push_dispatch_v1()
  from public, anon, authenticated;
grant execute on function public.invoke_entry_web_push_dispatch_v1()
  to service_role;

create or replace function public.install_entry_web_push_dispatch_schedule_v1()
returns bigint
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_job_id bigint;
  v_url_ready boolean;
  v_secret_ready boolean;
begin
  select exists(
    select 1 from vault.decrypted_secrets ds
    where ds.name = 'entry_web_push_dispatch_url'
      and nullif(btrim(ds.decrypted_secret), '') is not null
  ) into v_url_ready;

  select exists(
    select 1 from vault.decrypted_secrets ds
    where ds.name = 'entry_web_push_dispatch_secret'
      and nullif(btrim(ds.decrypted_secret), '') is not null
  ) into v_secret_ready;

  if not v_url_ready or not v_secret_ready then
    raise exception 'Configure ENTRY Web Push scheduler Vault secrets before installing cron'
      using errcode = '55000';
  end if;

  perform cron.unschedule('entry-web-push-dispatch')
  where exists (
    select 1 from cron.job j where j.jobname = 'entry-web-push-dispatch'
  );

  select cron.schedule(
    'entry-web-push-dispatch',
    '* * * * *',
    'select public.invoke_entry_web_push_dispatch_v1();'
  ) into v_job_id;

  return v_job_id;
end;
$function$;

revoke all on function public.install_entry_web_push_dispatch_schedule_v1()
  from public, anon, authenticated;
grant execute on function public.install_entry_web_push_dispatch_schedule_v1()
  to service_role;

create or replace function public.remove_entry_web_push_dispatch_schedule_v1()
returns boolean
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if exists (select 1 from cron.job j where j.jobname = 'entry-web-push-dispatch') then
    return cron.unschedule('entry-web-push-dispatch');
  end if;
  return true;
end;
$function$;

revoke all on function public.remove_entry_web_push_dispatch_schedule_v1()
  from public, anon, authenticated;
grant execute on function public.remove_entry_web_push_dispatch_schedule_v1()
  to service_role;
