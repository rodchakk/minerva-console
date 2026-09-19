
alter table public.user_push_tokens
  add column if not exists expo_push_token_hash text
  generated always as (encode(extensions.digest(expo_push_token,'sha256'),'hex')) stored;

create index if not exists idx_user_push_tokens_hash_active
  on public.user_push_tokens (expo_push_token_hash)
  where is_active=true;

create table if not exists public.entry_mobile_push_receipts (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.community_message_push_queue(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  ticket_id text not null unique,
  token_hash text not null,
  status text not null default 'accepted',
  provider_code text null,
  provider_message text null,
  accepted_at timestamptz not null default now(),
  checked_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entry_mobile_push_receipts_status_ck
    check (status in ('accepted','delivered','failed','unknown')),
  constraint entry_mobile_push_receipts_ticket_ck
    check (char_length(ticket_id) between 1 and 256),
  constraint entry_mobile_push_receipts_hash_ck
    check (char_length(token_hash)=64)
);

create index if not exists idx_entry_mobile_push_receipts_pending
  on public.entry_mobile_push_receipts (accepted_at)
  where status in ('accepted','unknown');
create index if not exists idx_entry_mobile_push_receipts_community_created
  on public.entry_mobile_push_receipts (community_id,created_at desc);

alter table public.entry_mobile_push_receipts enable row level security;
revoke all on table public.entry_mobile_push_receipts from public,anon,authenticated;
grant select,insert,update,delete on table public.entry_mobile_push_receipts to service_role;

do $$
declare
  v_existing uuid;
  v_secret text;
  v_match text[];
begin
  select id into v_existing
  from vault.secrets
  where name='entry_community_message_worker_secret'
  order by created_at desc
  limit 1;

  if v_existing is null then
    select regexp_match(
      pg_get_functiondef('public.trigger_community_message_push_worker()'::regprocedure),
      'Bearer ([A-Za-z0-9._-]+)'
    ) into v_match;

    v_secret := case when v_match is not null then v_match[1] else null end;

    if nullif(v_secret,'') is null then
      raise exception 'Could not migrate existing community message worker credential to Vault';
    end if;

    perform vault.create_secret(
      v_secret,
      'entry_community_message_worker_secret',
      'ENTRY community message and mobile push receipt internal worker credential'
    );
  end if;
end $$;

create or replace function public.trigger_community_message_push_worker()
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_secret text;
begin
  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets ds
  where ds.name='entry_community_message_worker_secret'
  order by ds.created_at desc
  limit 1;

  if nullif(v_secret,'') is null then
    raise exception 'ENTRY community message worker credential is not configured'
      using errcode='55000';
  end if;

  perform net.http_post(
    url => 'https://ytzvislhvrcdtkbtpbmu.supabase.co/functions/v1/smart-service',
    headers => jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || v_secret
    ),
    body => jsonb_build_object('limit',20),
    timeout_milliseconds => 10000
  );
end;
$$;

create or replace function public.trigger_entry_mobile_push_receipt_worker()
returns bigint
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets ds
  where ds.name='entry_community_message_worker_secret'
  order by ds.created_at desc
  limit 1;

  if nullif(v_secret,'') is null then
    raise exception 'ENTRY mobile push receipt worker credential is not configured'
      using errcode='55000';
  end if;

  select net.http_post(
    url => 'https://ytzvislhvrcdtkbtpbmu.supabase.co/functions/v1/entry-push-receipts',
    headers => jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || v_secret
    ),
    body => jsonb_build_object('limit',300),
    timeout_milliseconds => 10000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.trigger_community_message_push_worker() from public,anon,authenticated;
grant execute on function public.trigger_community_message_push_worker() to service_role;
revoke all on function public.trigger_entry_mobile_push_receipt_worker() from public,anon,authenticated;
grant execute on function public.trigger_entry_mobile_push_receipt_worker() to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='entry-mobile-push-receipts';
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;

  perform cron.schedule(
    'entry-mobile-push-receipts',
    '*/2 * * * *',
    'select public.trigger_entry_mobile_push_receipt_worker();'
  );
end $$;
