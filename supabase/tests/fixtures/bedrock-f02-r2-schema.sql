-- Synthetic PostgreSQL-only fixture for PROJECT BEDROCK F02 R2.
-- It intentionally contains no production credentials, user data, or Expo calls.
create extension if not exists pgcrypto;

do $fixture$
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
$fixture$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

create table public.communities (id uuid primary key);
create table public.community_messages (
  id uuid primary key,
  community_id uuid not null references public.communities(id),
  target_user_id uuid,
  title text not null default 'Synthetic notification',
  published_at timestamptz not null default now(),
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.community_message_push_queue (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  community_id uuid not null,
  push_title text not null default 'Synthetic title',
  push_body text not null default 'Synthetic body',
  status text not null default 'pending',
  attempts integer not null default 0,
  claimed_at timestamptz,
  processed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider_response jsonb,
  last_error text,
  enqueue_source text
);
create table public.community_members (
  community_id uuid not null,
  user_id uuid not null,
  is_active boolean not null default true,
  primary key (community_id, user_id)
);
create table public.user_push_tokens (
  community_id uuid not null,
  user_id uuid not null,
  is_active boolean not null default true
);
create table public.entry_mobile_push_receipts (queue_id uuid not null, token_hash text not null);
create table public.system_event_log (
  severity text, module text, event_type text, message text, source text, details jsonb
);
create table public.houses (id uuid primary key, community_id uuid not null, house_label text);
create table public.profiles (
  user_id uuid, community_id uuid, house_id uuid, full_name text, is_active boolean not null default true
);

-- These are only referenced by the welcome-recovery path; they do not deliver.
create function public.send_welcome_notification(uuid, uuid, text, text) returns void language plpgsql as $$ begin end $$;
create function public.enqueue_community_message_push(uuid) returns void language plpgsql as $$ begin end $$;
