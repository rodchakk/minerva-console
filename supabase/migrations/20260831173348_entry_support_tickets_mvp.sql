create sequence if not exists public.support_ticket_number_seq start 1;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default ('ENT-' || lpad(nextval('public.support_ticket_number_seq')::text, 6, '0')),
  created_by uuid not null references auth.users(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  source text not null check (source in ('mobile', 'web')),
  category text not null check (char_length(trim(category)) between 2 and 80),
  description text not null check (char_length(trim(description)) between 3 and 4000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_type text not null check (author_type in ('user', 'staff')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_created_by_created_at_idx on public.support_tickets(created_by, created_at desc);
create index if not exists support_tickets_status_updated_at_idx on public.support_tickets(status, updated_at desc);
create index if not exists support_tickets_community_id_idx on public.support_tickets(community_id);
create index if not exists support_ticket_messages_ticket_created_at_idx on public.support_ticket_messages(ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

create policy support_tickets_select_own_or_superadmin
  on public.support_tickets
  for select
  to authenticated
  using (created_by = auth.uid() or public.is_superadmin(auth.uid()));

create policy support_ticket_messages_select_own_or_superadmin
  on public.support_ticket_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = support_ticket_messages.ticket_id
        and (t.created_by = auth.uid() or public.is_superadmin(auth.uid()))
    )
  );

revoke insert, update, delete on public.support_tickets from anon, authenticated;
revoke insert, update, delete on public.support_ticket_messages from anon, authenticated;
grant select on public.support_tickets to authenticated;
grant select on public.support_ticket_messages to authenticated;

create or replace function public.support_create_ticket(
  p_category text,
  p_description text,
  p_source text,
  p_community_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_community_id uuid := p_community_id;
  v_ticket public.support_tickets;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if trim(coalesce(p_category, '')) = '' or char_length(trim(p_category)) > 80 then
    raise exception 'Invalid support category' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_description, ''))) < 3 or char_length(trim(p_description)) > 4000 then
    raise exception 'Description must be between 3 and 4000 characters' using errcode = '22023';
  end if;
  if p_source not in ('mobile', 'web') then
    raise exception 'Invalid support source' using errcode = '22023';
  end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Metadata must be a JSON object' using errcode = '22023';
  end if;

  if v_community_id is null then
    select p.community_id into v_community_id
    from public.profiles p
    where p.user_id = v_user_id and p.is_active = true and p.community_id is not null
    limit 1;
  end if;

  if v_community_id is null then
    select cm.community_id into v_community_id
    from public.community_members cm
    where cm.user_id = v_user_id and cm.is_active = true and cm.deactivated_by_community = false
    order by cm.updated_at desc
    limit 1;
  end if;

  if not public.is_superadmin(v_user_id) then
    if v_community_id is null or not exists (
      select 1 from public.community_members cm
      where cm.user_id = v_user_id
        and cm.community_id = v_community_id
        and cm.is_active = true
        and cm.deactivated_by_community = false
    ) then
      raise exception 'No active ENTRY community membership found' using errcode = '42501';
    end if;
  end if;

  insert into public.support_tickets (created_by, community_id, source, category, description, metadata)
  values (v_user_id, v_community_id, p_source, trim(p_category), trim(p_description), p_metadata)
  returning * into v_ticket;

  return v_ticket;
end;
$$;

create or replace function public.support_add_message(p_ticket_id uuid, p_body text)
returns public.support_ticket_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.support_tickets;
  v_author_type text;
  v_message public.support_ticket_messages;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) < 1 or char_length(trim(p_body)) > 4000 then
    raise exception 'Message must be between 1 and 4000 characters' using errcode = '22023';
  end if;

  select * into v_ticket from public.support_tickets where id = p_ticket_id;
  if not found then
    raise exception 'Support ticket not found' using errcode = 'P0002';
  end if;

  if public.is_superadmin(v_user_id) then
    v_author_type := 'staff';
  elsif v_ticket.created_by = v_user_id then
    v_author_type := 'user';
  else
    raise exception 'Not authorized for this support ticket' using errcode = '42501';
  end if;

  insert into public.support_ticket_messages (ticket_id, author_id, author_type, body)
  values (p_ticket_id, v_user_id, v_author_type, trim(p_body))
  returning * into v_message;

  update public.support_tickets
  set status = case
        when v_author_type = 'staff' and status = 'open' then 'in_progress'
        when v_author_type = 'user' and status = 'resolved' then 'open'
        else status
      end,
      resolved_at = case when v_author_type = 'user' and status = 'resolved' then null else resolved_at end,
      updated_at = now()
  where id = p_ticket_id;

  return v_message;
end;
$$;

create or replace function public.support_update_status(p_ticket_id uuid, p_status text)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_ticket public.support_tickets;
begin
  if v_user_id is null or not public.is_superadmin(v_user_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;
  if p_status not in ('open', 'in_progress', 'resolved') then
    raise exception 'Invalid support status' using errcode = '22023';
  end if;

  update public.support_tickets
  set status = p_status,
      resolved_at = case when p_status = 'resolved' then coalesce(resolved_at, now()) else null end,
      updated_at = now()
  where id = p_ticket_id
  returning * into v_ticket;

  if not found then
    raise exception 'Support ticket not found' using errcode = 'P0002';
  end if;
  return v_ticket;
end;
$$;

create or replace function public.support_admin_list_tickets(p_status text default null)
returns table (
  id uuid, ticket_number text, created_by uuid, community_id uuid, community_name text,
  requester_name text, source text, category text, description text, status text,
  metadata jsonb, created_at timestamptz, updated_at timestamptz, resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_superadmin(auth.uid()) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('open', 'in_progress', 'resolved') then
    raise exception 'Invalid support status' using errcode = '22023';
  end if;

  return query
  select t.id, t.ticket_number, t.created_by, t.community_id,
    coalesce(c.name, 'Sin comunidad')::text,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), 'Usuario ENTRY')::text,
    t.source, t.category, t.description, t.status, t.metadata, t.created_at, t.updated_at, t.resolved_at
  from public.support_tickets t
  left join public.communities c on c.id = t.community_id
  left join public.profiles p on p.user_id = t.created_by
  where p_status is null or t.status = p_status
  order by case t.status when 'open' then 0 when 'in_progress' then 1 else 2 end, t.updated_at desc;
end;
$$;

create or replace function public.support_admin_get_ticket(p_ticket_id uuid)
returns table (
  id uuid, ticket_number text, created_by uuid, community_id uuid, community_name text,
  requester_name text, source text, category text, description text, status text,
  metadata jsonb, created_at timestamptz, updated_at timestamptz, resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_superadmin(auth.uid()) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  return query
  select t.id, t.ticket_number, t.created_by, t.community_id,
    coalesce(c.name, 'Sin comunidad')::text,
    coalesce(nullif(p.full_name, ''), nullif(p.username, ''), 'Usuario ENTRY')::text,
    t.source, t.category, t.description, t.status, t.metadata, t.created_at, t.updated_at, t.resolved_at
  from public.support_tickets t
  left join public.communities c on c.id = t.community_id
  left join public.profiles p on p.user_id = t.created_by
  where t.id = p_ticket_id;
end;
$$;

revoke all on function public.support_create_ticket(text, text, text, uuid, jsonb) from public, anon;
revoke all on function public.support_add_message(uuid, text) from public, anon;
revoke all on function public.support_update_status(uuid, text) from public, anon;
revoke all on function public.support_admin_list_tickets(text) from public, anon;
revoke all on function public.support_admin_get_ticket(uuid) from public, anon;

grant execute on function public.support_create_ticket(text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.support_add_message(uuid, text) to authenticated;
grant execute on function public.support_update_status(uuid, text) to authenticated;
grant execute on function public.support_admin_list_tickets(text) to authenticated;
grant execute on function public.support_admin_get_ticket(uuid) to authenticated;
