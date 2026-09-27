-- Activation Queue follow-up lifecycle.
--
-- Separates queue state (pending/invited/activated) from follow-up age.
-- Invitation history is based on provider-accepted activation emails; PIN
-- generation stays visible separately because generating a PIN does not prove
-- it was delivered to the resident.

alter table public.resident_activation_queue
  add column if not exists first_invitation_sent_at timestamptz,
  add column if not exists last_invitation_sent_at timestamptz,
  add column if not exists invitation_attempt_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resident_activation_queue_invitation_attempt_count_check'
      and conrelid = 'public.resident_activation_queue'::regclass
  ) then
    alter table public.resident_activation_queue
      add constraint resident_activation_queue_invitation_attempt_count_check
      check (invitation_attempt_count >= 0);
  end if;
end;
$$;

-- Recover exact historical email invitation counts where observability retained
-- the provider-accepted events.
with email_history as (
  select
    s.entity_id as queue_id,
    min(s.created_at) as first_sent_at,
    max(s.created_at) as last_sent_at,
    count(*)::integer as attempt_count
  from public.system_event_log s
  where s.entity_type = 'resident_activation_queue'
    and s.event_type = 'ACTIVATION_EMAIL_SENT'
    and coalesce(s.details->>'status', '') = 'success'
    and s.entity_id is not null
  group by s.entity_id
)
update public.resident_activation_queue q
   set first_invitation_sent_at = h.first_sent_at,
       last_invitation_sent_at = h.last_sent_at,
       invitation_attempt_count = greatest(q.invitation_attempt_count, h.attempt_count)
  from email_history h
 where h.queue_id = q.id;

-- Older rows can predate the retained telemetry window. Preserve the known
-- invite_sent_at value as a one-attempt fallback instead of pretending no
-- invitation ever happened.
update public.resident_activation_queue q
   set first_invitation_sent_at = coalesce(q.first_invitation_sent_at, q.invite_sent_at),
       last_invitation_sent_at = coalesce(q.last_invitation_sent_at, q.invite_sent_at),
       invitation_attempt_count = case
         when q.invite_sent_at is not null then greatest(q.invitation_attempt_count, 1)
         else q.invitation_attempt_count
       end
 where q.invite_sent_at is not null;

create or replace function public.sync_resident_activation_invitation_tracking_v1()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    if new.invite_sent_at is not null then
      new.first_invitation_sent_at := coalesce(new.first_invitation_sent_at, new.invite_sent_at);
      new.last_invitation_sent_at := coalesce(new.last_invitation_sent_at, new.invite_sent_at);
      new.invitation_attempt_count := greatest(coalesce(new.invitation_attempt_count, 0), 1);
    end if;

    return new;
  end if;

  if new.invite_sent_at is distinct from old.invite_sent_at then
    if new.invite_sent_at is null then
      -- A contact correction invalidates the previous delivery for the current
      -- address. Keep lifetime history, but make the current contact eligible
      -- for the Not invited follow-up bucket.
      new.last_invitation_sent_at := null;
    else
      new.first_invitation_sent_at := coalesce(
        old.first_invitation_sent_at,
        new.first_invitation_sent_at,
        new.invite_sent_at
      );
      new.last_invitation_sent_at := new.invite_sent_at;
      new.invitation_attempt_count := coalesce(old.invitation_attempt_count, 0) + 1;
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_sync_resident_activation_invitation_tracking
  on public.resident_activation_queue;

create trigger trg_sync_resident_activation_invitation_tracking
before insert or update of invite_sent_at
on public.resident_activation_queue
for each row
execute function public.sync_resident_activation_invitation_tracking_v1();

create index if not exists resident_activation_queue_follow_up_idx
  on public.resident_activation_queue (
    community_id,
    status,
    last_invitation_sent_at
  );

create or replace function public.list_resident_activation_queue_v3(
  p_community_id uuid,
  p_status text default null
)
returns table(
  id uuid,
  community_id uuid,
  house_id uuid,
  unit_label text,
  resident_name text,
  phone text,
  email text,
  is_owner_reference boolean,
  suggested_username text,
  activation_method text,
  status text,
  invite_sent_at timestamptz,
  last_pin_generated_at timestamptz,
  first_invitation_sent_at timestamptz,
  last_invitation_sent_at timestamptz,
  invitation_attempt_count integer,
  follow_up_status text,
  days_since_last_invitation integer,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    q.id,
    q.community_id,
    q.house_id,
    q.unit_label,
    q.resident_name,
    q.phone,
    q.email,
    q.is_owner_reference,
    q.suggested_username,
    q.activation_method,
    q.status,
    q.invite_sent_at,
    pins.last_pin_generated_at,
    q.first_invitation_sent_at,
    q.last_invitation_sent_at,
    q.invitation_attempt_count,
    case
      when q.status in ('activated', 'skipped') then 'completed'
      when q.last_invitation_sent_at is null then 'not_invited'
      when q.last_invitation_sent_at >= now() - interval '3 days' then 'recent'
      when q.last_invitation_sent_at >= now() - interval '7 days' then 'waiting'
      else 'needs_follow_up'
    end as follow_up_status,
    case
      when q.last_invitation_sent_at is null then null
      else greatest(
        0,
        floor(extract(epoch from (now() - q.last_invitation_sent_at)) / 86400)
      )::integer
    end as days_since_last_invitation,
    q.processed_at,
    q.last_error,
    q.created_at
  from public.resident_activation_queue q
  left join lateral (
    select max(p.created_at) as last_pin_generated_at
      from public.resident_activation_pins p
     where p.queue_id = q.id
  ) pins on true
  where q.community_id = p_community_id
    and (p_status is null or q.status = p_status)
  order by
    case
      when q.status not in ('activated', 'skipped')
       and q.last_invitation_sent_at < now() - interval '7 days' then 0
      else 1
    end,
    q.last_invitation_sent_at asc nulls first,
    q.created_at asc;
end;
$function$;

revoke all on function public.list_resident_activation_queue_v3(uuid, text) from public;
revoke all on function public.list_resident_activation_queue_v3(uuid, text) from anon;
grant execute on function public.list_resident_activation_queue_v3(uuid, text) to authenticated;
grant execute on function public.list_resident_activation_queue_v3(uuid, text) to service_role;

comment on function public.list_resident_activation_queue_v3(uuid, text) is
  'Superadmin Activation Queue listing with invitation history and derived follow-up buckets: not_invited, recent (0-3d), waiting (4-7d), needs_follow_up (>7d), completed.';

create or replace function public.sa_get_activation_follow_up_summary_v1(
  p_community_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'open_count', count(*) filter (
      where q.status in ('pending', 'pin_generated', 'invited')
    ),
    'not_invited_count', count(*) filter (
      where q.status in ('pending', 'pin_generated', 'invited')
        and q.last_invitation_sent_at is null
    ),
    'recently_invited_count', count(*) filter (
      where q.status in ('pending', 'pin_generated', 'invited')
        and q.last_invitation_sent_at >= now() - interval '3 days'
    ),
    'waiting_count', count(*) filter (
      where q.status in ('pending', 'pin_generated', 'invited')
        and q.last_invitation_sent_at < now() - interval '3 days'
        and q.last_invitation_sent_at >= now() - interval '7 days'
    ),
    'needs_follow_up_count', count(*) filter (
      where q.status in ('pending', 'pin_generated', 'invited')
        and q.last_invitation_sent_at < now() - interval '7 days'
    ),
    'needs_follow_up_14d_count', count(*) filter (
      where q.status in ('pending', 'pin_generated', 'invited')
        and q.last_invitation_sent_at < now() - interval '14 days'
    ),
    'high_attempt_count', count(*) filter (
      where q.status in ('pending', 'pin_generated', 'invited')
        and q.invitation_attempt_count >= 5
    ),
    'oldest_open_at', min(q.created_at) filter (
      where q.status in ('pending', 'pin_generated', 'invited')
    ),
    'oldest_last_invitation_at', min(q.last_invitation_sent_at) filter (
      where q.status in ('pending', 'pin_generated', 'invited')
        and q.last_invitation_sent_at is not null
    )
  )
  into v_result
  from public.resident_activation_queue q
  where p_community_id is null or q.community_id = p_community_id;

  return coalesce(v_result, '{}'::jsonb);
end;
$function$;

revoke all on function public.sa_get_activation_follow_up_summary_v1(uuid) from public;
revoke all on function public.sa_get_activation_follow_up_summary_v1(uuid) from anon;
grant execute on function public.sa_get_activation_follow_up_summary_v1(uuid) to authenticated;
grant execute on function public.sa_get_activation_follow_up_summary_v1(uuid) to service_role;

comment on function public.sa_get_activation_follow_up_summary_v1(uuid) is
  'Superadmin aggregate for activation follow-up aging. Uses last invitation delivery rather than queue creation age.';
