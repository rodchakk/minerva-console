-- Disposable PostgreSQL-only fixture for BEDROCK F03. No production data.
create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$roles$;

create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(current_setting('test.user_id', true), '')::uuid
$$;
create function auth.role() returns text language sql stable set search_path = '' as $$
  select nullif(current_setting('test.role', true), '')
$$;

create type public.user_role as enum
  ('RESIDENT', 'GUARD', 'ADMIN', 'UNASSIGNED', 'SUPERADMIN');

create table public.communities (
  id uuid primary key,
  name text not null
);
create table public.houses (
  id uuid primary key,
  community_id uuid not null references public.communities(id),
  house_label text not null
);
create table auth.users (
  instance_id uuid not null,
  id uuid primary key,
  aud text,
  role text,
  email text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  is_sso_user boolean,
  is_anonymous boolean
);
create table public.profiles (
  user_id uuid primary key references auth.users(id),
  community_id uuid not null references public.communities(id),
  role public.user_role not null,
  full_name text not null,
  phone text,
  house_id uuid references public.houses(id),
  username text,
  auth_type text not null check (auth_type in ('email', 'username')),
  synthetic_email text,
  pin_hash text,
  is_active boolean not null
);
create table public.community_members (
  id uuid primary key default extensions.gen_random_uuid(),
  community_id uuid not null references public.communities(id),
  user_id uuid not null references auth.users(id),
  role public.user_role not null,
  is_active boolean not null,
  unique (community_id, user_id)
);
create table public.house_residents (
  id uuid primary key default extensions.gen_random_uuid(),
  community_id uuid not null references public.communities(id),
  house_id uuid not null references public.houses(id),
  user_id uuid not null references auth.users(id),
  is_primary boolean not null,
  is_active boolean not null,
  unique (user_id, community_id, house_id)
);
create table public.resident_activation_queue (
  id uuid primary key,
  community_id uuid not null references public.communities(id),
  house_id uuid references public.houses(id),
  unit_label text,
  resident_name text,
  phone text,
  email text,
  suggested_username text,
  activation_method text not null,
  status text not null,
  activated_user_id uuid,
  processed_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
create table public.resident_activation_pins (
  id uuid primary key default extensions.gen_random_uuid(),
  queue_id uuid not null references public.resident_activation_queue(id),
  community_id uuid not null references public.communities(id),
  pin_hash text not null,
  visible_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'used', 'expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index idx_rap_queue_id_pending
  on public.resident_activation_pins(queue_id) where status = 'pending';
create table public.security_event_log (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid,
  event_type text not null,
  identifier text,
  success boolean,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create function public.is_superadmin() returns boolean
language sql stable set search_path = '' as $$
  select current_setting('test.superadmin', true) = 'true'
$$;
create function public._raq_suggest_username(value text, community_id uuid)
returns text language sql set search_path = '' as $$
  select lower(regexp_replace(value, '[^a-zA-Z0-9]', '', 'g'))
$$;

-- Minimal compatibility implementations: the v2 migration deliberately wraps
-- the existing v1 generation contracts in the same transaction.
create function public.generate_resident_activation_pins_locked_v1(
  p_community_id uuid,
  p_queue_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  q public.resident_activation_queue%rowtype;
  pin text := '111111';
  items jsonb := '[]'::jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'superadmin_required' using errcode = '42501';
  end if;
  for q in select * from public.resident_activation_queue where id = any(p_queue_ids)
  loop
    insert into public.resident_activation_pins(
      queue_id, community_id, pin_hash, visible_code, status, created_by
    ) values (
      q.id, p_community_id,
      extensions.crypt(pin, extensions.gen_salt('bf', 8)), pin, 'pending', auth.uid()
    ) on conflict (queue_id) where status = 'pending' do update
      set pin_hash = excluded.pin_hash,
          visible_code = excluded.visible_code,
          expires_at = now() + interval '7 days',
          created_at = now();
    update public.resident_activation_queue
       set status = 'pin_generated' where id = q.id;
    items := items || jsonb_build_array(jsonb_build_object(
      'queue_id', q.id, 'resident_name', q.resident_name,
      'unit_label', q.unit_label, 'phone', q.phone, 'email', q.email,
      'suggested_username', q.suggested_username,
      'activation_method', q.activation_method, 'pin', pin,
      'status', 'pin_generated', 'message', null
    ));
  end loop;
  return jsonb_build_object(
    'generated_count', jsonb_array_length(items),
    'skipped_count', 0, 'failed_count', 0, 'items', items
  );
end;
$$;

create function public.worker_generate_resident_activation_pin_v1(
  p_community_id uuid,
  p_queue_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  q public.resident_activation_queue%rowtype;
  pin text := '222222';
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'worker_only' using errcode = '42501';
  end if;
  select * into strict q from public.resident_activation_queue where id = p_queue_id;
  insert into public.resident_activation_pins(
    queue_id, community_id, pin_hash, visible_code, status
  ) values (
    q.id, p_community_id,
    extensions.crypt(pin, extensions.gen_salt('bf', 8)), pin, 'pending'
  ) on conflict (queue_id) where status = 'pending' do update
    set pin_hash = excluded.pin_hash,
        visible_code = excluded.visible_code,
        expires_at = now() + interval '7 days',
        created_at = now();
  update public.resident_activation_queue set status = 'pin_generated' where id = q.id;
  return jsonb_build_object(
    'queue_id', q.id, 'resident_name', q.resident_name,
    'unit_label', q.unit_label, 'phone', q.phone, 'email', q.email,
    'suggested_username', q.suggested_username,
    'activation_method', q.activation_method, 'pin', pin,
    'status', 'pin_generated'
  );
end;
$$;

revoke all on function public.generate_resident_activation_pins_locked_v1(uuid, uuid[]) from public;
grant execute on function public.generate_resident_activation_pins_locked_v1(uuid, uuid[]) to authenticated;
revoke all on function public.worker_generate_resident_activation_pin_v1(uuid, uuid) from public;
grant execute on function public.worker_generate_resident_activation_pin_v1(uuid, uuid) to service_role;

insert into public.communities(id, name) values
  ('10000000-0000-4000-8000-000000000001', 'Synthetic community');
insert into public.houses(id, community_id, house_label) values
  ('10000000-0000-4000-8000-000000000010',
   '10000000-0000-4000-8000-000000000001', 'A-1');
insert into public.resident_activation_queue(
  id, community_id, house_id, unit_label, resident_name, phone, email,
  suggested_username, activation_method, status
) values
  ('10000000-0000-4000-8000-000000000100',
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000010', 'A-1', 'Synthetic One',
   '+502 5550 0100', 'synthetic.one@example.invalid', null, 'email', 'pending'),
  ('10000000-0000-4000-8000-000000000101',
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000010', 'A-1', 'Synthetic Two',
   '+502 5550 0101', null, 'synthetictwo', 'username_pin', 'pending'),
  ('10000000-0000-4000-8000-000000000102',
   '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000010', 'A-1', 'Synthetic Concurrent',
   '+502 5550 0102', 'concurrent@example.invalid', null, 'email', 'pending');

grant usage on schema public, auth to anon, authenticated, service_role;
