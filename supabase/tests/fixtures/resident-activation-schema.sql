-- Minimal disposable schema. Identity/audit helpers are test stand-ins;
-- the two queue writers are exact deployed definitions in the companion fixture.
create schema if not exists auth;
create schema if not exists extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create table public.communities (id uuid primary key, name text not null);
create table public.houses (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities,
  house_label text not null, is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create table public.resident_activation_queue (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities,
  house_id uuid references public.houses, unit_label text not null, resident_name text not null,
  phone text, email text, is_owner_reference boolean, suggested_username text,
  activation_method text not null check (activation_method in ('email','phone_pin','username_pin','unknown')),
  status text not null check (status in ('pending','invited','pin_generated','activated','failed','skipped')),
  source text, raw_data jsonb, created_by uuid, activated_user_id uuid,
  community_registration_resident_id uuid,
  invite_sent_at timestamptz, last_error text, processed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index ux_raq_community_registration_resident on public.resident_activation_queue
  (community_registration_resident_id) where community_registration_resident_id is not null;
create table public.test_audit (action text, entity text, entity_id uuid, detail jsonb);
create function public.is_superadmin() returns boolean language sql as
  $$ select coalesce(current_setting('test.superadmin', true) = 'true', false) $$;
create function auth.uid() returns uuid language sql as
  $$ select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid $$;
create function public.normalize_unit_label(value text) returns text language sql immutable as
  $$ select lower(regexp_replace(btrim(value), '\s+', '', 'g')) $$;
create function public._raq_suggest_username(value text, community_id uuid) returns text language sql as
  $$ select lower(regexp_replace(value, '[^a-zA-Z0-9]', '', 'g')) $$;
create function public._sa_audit_log(action text, entity text, entity_id uuid, detail jsonb)
  returns void language sql as $$ insert into public.test_audit values (action, entity, entity_id, detail) $$;

insert into public.communities values
  ('11111111-1111-1111-1111-111111111111','Test community'),
  ('22222222-2222-2222-2222-222222222222','Other community');
insert into public.houses (id,community_id,house_label,is_active) values
  ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','10',true),
  ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','11',false),
  ('55555555-5555-5555-5555-555555555555','22222222-2222-2222-2222-222222222222','20',true);
