-- MINERVA-FIELD-WORK-TIMER-001: durable ENTRY field work timer.
-- Field records actual human time only.

create table if not exists public.field_work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_key text not null default 'ENTRY',
  target_scope text not null,
  community_id uuid references public.communities(id) on delete restrict,
  community_name_snapshot text,
  activity_category text not null,
  work_mode text not null default 'ONSITE',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'ACTIVE',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_work_sessions_product_key_check
    check (product_key = 'ENTRY'),
  constraint field_work_sessions_target_scope_check
    check (target_scope in ('PRODUCT', 'CLIENT')),
  constraint field_work_sessions_activity_category_check
    check (
      activity_category in (
        'ONBOARDING',
        'SUPPORT',
        'PRODUCT_MAINTENANCE',
        'PRODUCT_DEVELOPMENT_RND',
        'OTHER'
      )
    ),
  constraint field_work_sessions_work_mode_check
    check (work_mode in ('ONSITE', 'REMOTE')),
  constraint field_work_sessions_status_check
    check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  constraint field_work_sessions_note_length_check
    check (note is null or char_length(note) <= 500),
  constraint field_work_sessions_target_shape_check
    check (
      (
        target_scope = 'CLIENT'
        and community_id is not null
        and nullif(trim(coalesce(community_name_snapshot, '')), '') is not null
      )
      or (
        target_scope = 'PRODUCT'
        and community_id is null
        and community_name_snapshot is null
      )
    ),
  constraint field_work_sessions_end_shape_check
    check (
      (status = 'ACTIVE' and ended_at is null)
      or (status in ('COMPLETED', 'CANCELLED') and ended_at is not null)
    ),
  constraint field_work_sessions_non_negative_duration_check
    check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists field_work_sessions_one_active_per_user_idx
  on public.field_work_sessions(user_id)
  where status = 'ACTIVE';

create index if not exists field_work_sessions_user_started_idx
  on public.field_work_sessions(user_id, started_at desc);

create index if not exists field_work_sessions_user_ended_idx
  on public.field_work_sessions(user_id, ended_at desc)
  where status = 'COMPLETED';

create index if not exists field_work_sessions_community_idx
  on public.field_work_sessions(community_id)
  where community_id is not null;

create or replace function public.set_field_work_sessions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_field_work_sessions_updated_at
on public.field_work_sessions;

create trigger set_field_work_sessions_updated_at
before update on public.field_work_sessions
for each row
execute function public.set_field_work_sessions_updated_at();

alter table public.field_work_sessions enable row level security;

revoke all privileges on table public.field_work_sessions
from public, anon, authenticated;

grant select on table public.field_work_sessions to authenticated;

drop policy if exists field_work_sessions_select_own_or_superadmin
on public.field_work_sessions;

create policy field_work_sessions_select_own_or_superadmin
on public.field_work_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select public.is_superadmin(auth.uid()))
);

create or replace function public.field_work_start_session_v1(
  p_target_scope text,
  p_community_id uuid default null,
  p_activity_category text default 'OTHER',
  p_work_mode text default 'ONSITE',
  p_note text default null
)
returns public.field_work_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.field_work_sessions%rowtype;
  v_community public.communities%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_session public.field_work_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_superadmin(v_user_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  select *
    into v_existing
  from public.field_work_sessions
  where user_id = v_user_id
    and status = 'ACTIVE'
  order by started_at desc
  limit 1;

  if found then
    return v_existing;
  end if;

  if p_target_scope not in ('PRODUCT', 'CLIENT') then
    raise exception 'Invalid work target' using errcode = '22023';
  end if;

  if p_activity_category not in (
    'ONBOARDING',
    'SUPPORT',
    'PRODUCT_MAINTENANCE',
    'PRODUCT_DEVELOPMENT_RND',
    'OTHER'
  ) then
    raise exception 'Invalid activity category' using errcode = '22023';
  end if;

  if p_work_mode not in ('ONSITE', 'REMOTE') then
    raise exception 'Invalid work mode' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Note is too long' using errcode = '22023';
  end if;

  if p_target_scope = 'CLIENT' then
    if p_community_id is null then
      raise exception 'Community is required' using errcode = '22023';
    end if;

    select *
      into v_community
    from public.communities
    where id = p_community_id;

    if not found then
      raise exception 'Community not found' using errcode = '42501';
    end if;
  elsif p_community_id is not null then
    raise exception 'Community must be empty for ENTRY general work' using errcode = '22023';
  end if;

  begin
    insert into public.field_work_sessions (
      user_id,
      product_key,
      target_scope,
      community_id,
      community_name_snapshot,
      activity_category,
      work_mode,
      note
    ) values (
      v_user_id,
      'ENTRY',
      p_target_scope,
      case when p_target_scope = 'CLIENT' then p_community_id else null end,
      case when p_target_scope = 'CLIENT' then v_community.name else null end,
      p_activity_category,
      p_work_mode,
      v_note
    )
    returning * into v_session;
  exception
    when unique_violation then
      select *
        into v_session
      from public.field_work_sessions
      where user_id = v_user_id
        and status = 'ACTIVE'
      order by started_at desc
      limit 1;
  end;

  if v_session.id is null then
    raise exception 'Unable to start work timer' using errcode = '40001';
  end if;

  return v_session;
end;
$$;

create or replace function public.field_work_stop_session_v1(
  p_session_id uuid
)
returns public.field_work_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.field_work_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_superadmin(v_user_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  select *
    into v_session
  from public.field_work_sessions
  where id = p_session_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Work session not found' using errcode = 'P0002';
  end if;

  if v_session.status = 'ACTIVE' then
    update public.field_work_sessions
       set status = 'COMPLETED',
           ended_at = greatest(now(), started_at)
     where id = p_session_id
       and user_id = v_user_id
       and status = 'ACTIVE'
     returning * into v_session;
  end if;

  return v_session;
end;
$$;

create or replace function public.field_work_cancel_session_v1(
  p_session_id uuid
)
returns public.field_work_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.field_work_sessions%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_superadmin(v_user_id) then
    raise exception 'Superadmin access required' using errcode = '42501';
  end if;

  select *
    into v_session
  from public.field_work_sessions
  where id = p_session_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Work session not found' using errcode = 'P0002';
  end if;

  if v_session.status = 'ACTIVE' then
    update public.field_work_sessions
       set status = 'CANCELLED',
           ended_at = greatest(now(), started_at)
     where id = p_session_id
       and user_id = v_user_id
       and status = 'ACTIVE'
     returning * into v_session;
  end if;

  return v_session;
end;
$$;

revoke all on function public.field_work_start_session_v1(text, uuid, text, text, text)
from public, anon;
revoke all on function public.field_work_stop_session_v1(uuid)
from public, anon;
revoke all on function public.field_work_cancel_session_v1(uuid)
from public, anon;

grant execute on function public.field_work_start_session_v1(text, uuid, text, text, text)
to authenticated;
grant execute on function public.field_work_stop_session_v1(uuid)
to authenticated;
grant execute on function public.field_work_cancel_session_v1(uuid)
to authenticated;

comment on table public.field_work_sessions is
  'Durable Minerva Field work-time evidence for ENTRY operations. Manual transfer only.';

comment on column public.field_work_sessions.product_key is
  'Current V1 value is ENTRY. Product management is intentionally out of scope.';

comment on column public.field_work_sessions.community_name_snapshot is
  'Historical community label captured when client-directed work starts.';
