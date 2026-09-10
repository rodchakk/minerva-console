-- Fix ENTRY Web Push dispatcher claim failure caused by PL/pgSQL output-column
-- name ambiguity in the ON CONFLICT inference clause.
--
-- `claim_entry_web_push_deliveries_v1()` returns an OUT column named event_id,
-- so `ON CONFLICT (event_id, subscription_id)` can be interpreted as either
-- the function output variable or the table column at runtime. Target the
-- existing unique constraint explicitly instead.

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
  update public.entry_web_push_subscriptions s
  set is_active = false,
      deactivated_at = coalesce(s.deactivated_at, now()),
      updated_at = now()
  where s.is_active = true
    and not public.is_superadmin(s.user_id);

  update public.entry_web_push_deliveries d
  set status = 'pruned',
      completed_at = now(),
      claimed_at = null,
      last_error = 'Subscription inactive or operator authorization revoked',
      updated_at = now()
  from public.entry_web_push_subscriptions s
  where d.subscription_id = s.id
    and d.status in ('pending', 'processing')
    and (s.is_active = false or not public.is_superadmin(s.user_id));

  update public.entry_web_push_deliveries d
  set status = 'pending',
      claimed_at = null,
      next_attempt_at = now(),
      last_error = 'Recovered stale processing claim',
      updated_at = now()
  where d.status = 'processing'
    and d.claimed_at < now() - interval '15 minutes'
    and d.attempts < 8;

  update public.entry_web_push_deliveries d
  set status = 'failed',
      completed_at = now(),
      claimed_at = null,
      last_error = coalesce(d.last_error, 'Maximum Web Push attempts reached'),
      updated_at = now()
  where d.status = 'processing'
    and d.claimed_at < now() - interval '15 minutes'
    and d.attempts >= 8;

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
    set status = 'processing',
        attempts = least(e.attempts + 1, 8),
        claimed_at = now(),
        updated_at = now()
    where e.id = v_event.id;

    insert into public.entry_web_push_deliveries (event_id, subscription_id, user_id)
    select v_event.id, s.id, s.user_id
    from public.entry_web_push_subscriptions s
    where s.is_active = true
      and public.is_superadmin(s.user_id)
    on conflict on constraint entry_web_push_deliveries_event_id_subscription_id_key
    do nothing;

    perform public.finalize_entry_web_push_event_v1(v_event.id);
  end loop;

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
    set status = 'processing',
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
