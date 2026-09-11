-- ENTRY Support Console foundation
-- Web-only operational semantics. Keep the canonical support_tickets.status values
-- unchanged so existing ENTRY Mobile / Field clients remain backward-compatible.

alter table public.support_tickets
  add column if not exists waiting_on_user boolean not null default false;

comment on column public.support_tickets.waiting_on_user is
  'Console workflow overlay. True only while staff is waiting for the requester; canonical status remains in_progress.';

create table if not exists public.support_ticket_staff_reads (
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ticket_id, staff_user_id)
);

create index if not exists support_ticket_staff_reads_staff_ticket_idx
  on public.support_ticket_staff_reads(staff_user_id, ticket_id);

alter table public.support_ticket_staff_reads enable row level security;

revoke all on table public.support_ticket_staff_reads from public, anon, authenticated;

comment on table public.support_ticket_staff_reads is
  'Per-operator read cursors for the ENTRY Support Console. Requester unread state remains separate on support_tickets.';

-- Existing tickets predate staff unread tracking. Baseline them as read for every
-- currently active superadmin so rollout does not create a false historical inbox.
insert into public.support_ticket_staff_reads (
  ticket_id,
  staff_user_id,
  last_read_at,
  created_at,
  updated_at
)
select
  t.id,
  sa.user_id,
  now(),
  now(),
  now()
from public.support_tickets t
join public.superadmin_users sa on sa.is_active = true
on conflict (ticket_id, staff_user_id) do nothing;

create or replace function public.support_normalize_waiting_on_user_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Legacy clients only know open / in_progress / resolved. Any transition away
  -- from in_progress must clear the Console-only waiting overlay.
  if new.status <> 'in_progress' then
    new.waiting_on_user := false;
  end if;

  return new;
end;
$$;

drop trigger if exists support_normalize_waiting_on_user_v1 on public.support_tickets;
create trigger support_normalize_waiting_on_user_v1
before insert or update on public.support_tickets
for each row
execute function public.support_normalize_waiting_on_user_v1();

create or replace function public.support_clear_waiting_on_requester_message_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.support_tickets
  set waiting_on_user = false
  where id = new.ticket_id
    and waiting_on_user = true;

  return new;
end;
$$;

drop trigger if exists support_clear_waiting_on_requester_message_v1
  on public.support_ticket_messages;
create trigger support_clear_waiting_on_requester_message_v1
after insert on public.support_ticket_messages
for each row
when (new.author_type = 'user')
execute function public.support_clear_waiting_on_requester_message_v1();

create or replace function public.support_admin_mark_ticket_read_v2(
  p_ticket_id uuid,
  p_read_through timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_latest_user_activity timestamptz;
  v_effective_read_at timestamptz;
begin
  if v_user_id is null or not public.is_superadmin(v_user_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  if p_ticket_id is null or p_read_through is null then
    raise exception 'Ticket ID and read-through timestamp are required'
      using errcode = '22023';
  end if;

  select greatest(
      t.created_at,
      coalesce(
        max(m.created_at) filter (where m.author_type = 'user'),
        t.created_at
      )
    )
  into v_latest_user_activity
  from public.support_tickets t
  left join public.support_ticket_messages m on m.ticket_id = t.id
  where t.id = p_ticket_id
  group by t.created_at;

  if v_latest_user_activity is null then
    raise exception 'Support ticket not found' using errcode = 'P0002';
  end if;

  -- Never let a client move its cursor beyond activity that actually exists.
  v_effective_read_at := least(
    p_read_through,
    v_latest_user_activity,
    now()
  );

  insert into public.support_ticket_staff_reads as r (
    ticket_id,
    staff_user_id,
    last_read_at
  )
  values (
    p_ticket_id,
    v_user_id,
    v_effective_read_at
  )
  on conflict (ticket_id, staff_user_id)
  do update
  set
    last_read_at = greatest(r.last_read_at, excluded.last_read_at),
    updated_at = now()
  returning last_read_at into v_effective_read_at;

  return v_effective_read_at;
end;
$$;

create or replace function public.support_admin_update_workflow_v2(
  p_ticket_id uuid,
  p_state text
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_state text := lower(trim(coalesce(p_state, '')));
  v_ticket public.support_tickets;
begin
  if v_user_id is null or not public.is_superadmin(v_user_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  if p_ticket_id is null then
    raise exception 'p_ticket_id is required' using errcode = '22023';
  end if;

  if v_state not in ('open', 'in_progress', 'waiting_user', 'resolved') then
    raise exception 'Invalid support workflow state' using errcode = '22023';
  end if;

  update public.support_tickets
  set
    status = case
      when v_state = 'open' then 'open'
      when v_state = 'resolved' then 'resolved'
      else 'in_progress'
    end,
    waiting_on_user = (v_state = 'waiting_user'),
    resolved_at = case
      when v_state = 'resolved' then coalesce(resolved_at, now())
      else null
    end,
    updated_at = now()
  where id = p_ticket_id
  returning * into v_ticket;

  if not found then
    raise exception 'Support ticket not found' using errcode = 'P0002';
  end if;

  return v_ticket;
end;
$$;

create or replace function public.support_admin_list_tickets_v2(
  p_filter text default null
)
returns table (
  id uuid,
  ticket_number text,
  created_by uuid,
  community_id uuid,
  community_name text,
  requester_name text,
  source text,
  category text,
  description text,
  status text,
  waiting_on_user boolean,
  workflow_state text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz,
  unread_count bigint,
  last_user_activity_at timestamptz,
  last_message_at timestamptz,
  last_message_author_type text,
  last_read_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_filter text := nullif(lower(trim(coalesce(p_filter, ''))), '');
begin
  if v_user_id is null or not public.is_superadmin(v_user_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  if v_filter is not null
     and v_filter not in ('unread', 'open', 'in_progress', 'waiting_user', 'resolved') then
    raise exception 'Invalid support inbox filter' using errcode = '22023';
  end if;

  return query
  with inbox as (
    select
      t.id,
      t.ticket_number,
      t.created_by,
      t.community_id,
      coalesce(c.name, 'Sin comunidad')::text as community_name,
      coalesce(
        nullif(p.full_name, ''),
        nullif(p.username, ''),
        'Usuario ENTRY'
      )::text as requester_name,
      t.source,
      t.category,
      t.description,
      t.status,
      t.waiting_on_user,
      case
        when t.status = 'resolved' then 'resolved'
        when t.status = 'in_progress' and t.waiting_on_user then 'waiting_user'
        else t.status
      end::text as workflow_state,
      t.metadata,
      t.created_at,
      t.updated_at,
      t.resolved_at,
      case
        when t.status = 'resolved' then 0::bigint
        else (
          case
            when sr.last_read_at is null or t.created_at > sr.last_read_at then 1::bigint
            else 0::bigint
          end
          + coalesce(message_activity.unread_user_messages, 0::bigint)
        )
      end::bigint as unread_count,
      greatest(
        t.created_at,
        coalesce(message_activity.last_user_message_at, t.created_at)
      ) as last_user_activity_at,
      greatest(
        t.created_at,
        coalesce(message_activity.last_message_at, t.created_at)
      ) as last_message_at,
      case
        when message_activity.last_message_at is null then 'user'
        else coalesce(last_message.author_type, 'user')
      end::text as last_message_author_type,
      sr.last_read_at
    from public.support_tickets t
    left join public.communities c on c.id = t.community_id
    left join public.profiles p on p.user_id = t.created_by
    left join public.support_ticket_staff_reads sr
      on sr.ticket_id = t.id
     and sr.staff_user_id = v_user_id
    left join lateral (
      select
        count(*) filter (
          where m.author_type = 'user'
            and (sr.last_read_at is null or m.created_at > sr.last_read_at)
        )::bigint as unread_user_messages,
        max(m.created_at) filter (
          where m.author_type = 'user'
        ) as last_user_message_at,
        max(m.created_at) as last_message_at
      from public.support_ticket_messages m
      where m.ticket_id = t.id
    ) message_activity on true
    left join lateral (
      select m.author_type
      from public.support_ticket_messages m
      where m.ticket_id = t.id
      order by m.created_at desc, m.id desc
      limit 1
    ) last_message on true
  )
  select
    i.id,
    i.ticket_number,
    i.created_by,
    i.community_id,
    i.community_name,
    i.requester_name,
    i.source,
    i.category,
    i.description,
    i.status,
    i.waiting_on_user,
    i.workflow_state,
    i.metadata,
    i.created_at,
    i.updated_at,
    i.resolved_at,
    i.unread_count,
    i.last_user_activity_at,
    i.last_message_at,
    i.last_message_author_type,
    i.last_read_at
  from inbox i
  where
    v_filter is null
    or (v_filter = 'unread' and i.unread_count > 0)
    or (v_filter = 'open' and i.workflow_state = 'open')
    or (v_filter = 'in_progress' and i.workflow_state = 'in_progress')
    or (v_filter = 'waiting_user' and i.workflow_state = 'waiting_user')
    or (v_filter = 'resolved' and i.workflow_state = 'resolved')
  order by
    case
      when i.unread_count > 0 then 0
      when i.workflow_state = 'open' then 1
      when i.workflow_state = 'in_progress' then 2
      when i.workflow_state = 'waiting_user' then 3
      else 4
    end,
    i.last_message_at desc,
    i.ticket_number desc;
end;
$$;

create or replace function public.support_admin_get_ticket_v2(
  p_ticket_id uuid
)
returns table (
  id uuid,
  ticket_number text,
  created_by uuid,
  community_id uuid,
  community_name text,
  requester_name text,
  source text,
  category text,
  description text,
  status text,
  waiting_on_user boolean,
  workflow_state text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_superadmin(auth.uid()) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  return query
  select
    t.id,
    t.ticket_number,
    t.created_by,
    t.community_id,
    coalesce(c.name, 'Sin comunidad')::text,
    coalesce(
      nullif(p.full_name, ''),
      nullif(p.username, ''),
      'Usuario ENTRY'
    )::text,
    t.source,
    t.category,
    t.description,
    t.status,
    t.waiting_on_user,
    case
      when t.status = 'resolved' then 'resolved'
      when t.status = 'in_progress' and t.waiting_on_user then 'waiting_user'
      else t.status
    end::text,
    t.metadata,
    t.created_at,
    t.updated_at,
    t.resolved_at
  from public.support_tickets t
  left join public.communities c on c.id = t.community_id
  left join public.profiles p on p.user_id = t.created_by
  where t.id = p_ticket_id;
end;
$$;

revoke all on function public.support_normalize_waiting_on_user_v1() from public, anon, authenticated;
revoke all on function public.support_clear_waiting_on_requester_message_v1() from public, anon, authenticated;

revoke all on function public.support_admin_mark_ticket_read_v2(uuid, timestamptz)
  from public, anon;
revoke all on function public.support_admin_update_workflow_v2(uuid, text)
  from public, anon;
revoke all on function public.support_admin_list_tickets_v2(text)
  from public, anon;
revoke all on function public.support_admin_get_ticket_v2(uuid)
  from public, anon;

grant execute on function public.support_admin_mark_ticket_read_v2(uuid, timestamptz)
  to authenticated;
grant execute on function public.support_admin_update_workflow_v2(uuid, text)
  to authenticated;
grant execute on function public.support_admin_list_tickets_v2(text)
  to authenticated;
grant execute on function public.support_admin_get_ticket_v2(uuid)
  to authenticated;
