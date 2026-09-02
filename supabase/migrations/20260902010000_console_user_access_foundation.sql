-- MINERVA-CONSOLE-USERS-001A: Console Access Foundation.
-- Phase A keeps production Console access on requireSuperadmin()/is_superadmin().

create table if not exists public.console_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint console_members_role_check
    check (role in ('owner', 'builder', 'viewer')),
  constraint console_members_status_check
    check (status in ('active', 'disabled'))
);

comment on table public.console_members is
  'Future Minerva Console membership records. Phase A does not switch route access to this table.';
comment on column public.console_members.role is
  'Console role: owner, builder, or viewer. Superadmins are mapped to owner by get_console_access_context_v1 for compatibility.';
comment on column public.console_members.status is
  'Console membership status. Only active members can be authorized by the Phase A access helper.';

create or replace function public.set_console_members_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_console_members_updated_at on public.console_members;
create trigger set_console_members_updated_at
before update on public.console_members
for each row
execute function public.set_console_members_updated_at();

alter table public.console_members enable row level security;

revoke all on table public.console_members from anon;
revoke all on table public.console_members from authenticated;

create or replace function public.get_console_access_context_v1()
returns table (
  user_id uuid,
  role text,
  status text,
  is_superadmin boolean,
  source text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_superadmin boolean := false;
  v_role text;
  v_status text;
begin
  if v_user_id is null then
    return;
  end if;

  v_is_superadmin := coalesce(public.is_superadmin(v_user_id), false);

  if v_is_superadmin then
    return query
      select v_user_id, 'owner'::text, 'active'::text, true, 'superadmin'::text;
    return;
  end if;

  select cm.role, cm.status
    into v_role, v_status
  from public.console_members cm
  where cm.user_id = v_user_id;

  if v_role in ('owner', 'builder', 'viewer') and v_status = 'active' then
    return query
      select v_user_id, v_role, v_status, false, 'console_members'::text;
    return;
  end if;

  return query
    select
      v_user_id,
      case when v_role in ('owner', 'builder', 'viewer') then v_role else null end,
      case
        when v_status in ('active', 'disabled') then v_status
        when v_role is null then 'missing'
        else null
      end,
      false,
      null::text;
end;
$$;

revoke all on function public.get_console_access_context_v1() from public;
grant execute on function public.get_console_access_context_v1() to authenticated;

comment on function public.get_console_access_context_v1() is
  'Server-consumable Console access context. Existing is_superadmin users map to active owner for Phase A compatibility.';
