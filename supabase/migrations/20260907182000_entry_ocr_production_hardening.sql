-- ENTRY-OCR-001: production hardening for plate OCR.
--
-- Goals:
--   * remove the legacy hardcoded shared bearer credential from DB dispatch
--   * authenticate internal DB -> Edge calls with the service_role JWT stored in Vault
--   * make queue retries autonomous and concurrency-safe
--   * preserve check-in availability even if OCR dispatch is unavailable
--   * make successful OCR completion monotonic so queue-write/transport races do not rebill
--
-- The Edge Function itself is recovered under supabase/functions/extract-plate-text
-- and must be deployed with verify_jwt=true after this migration is released.

create unique index if not exists idx_plate_ocr_queue_entry_log_unique
  on public.plate_ocr_queue (entry_log_id);

-- A successful Edge persistence update is the durable completion boundary. PostgreSQL
-- fires UPDATE OF even when the new plate value is NULL, so a valid Gemini NO_PLATE
-- result also closes the queue in the same transaction as the entry_logs write.
create or replace function public._entry_ocr_complete_queue_on_result_v1()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  update public.plate_ocr_queue
  set
    status = 'DONE',
    completed_at = coalesce(completed_at, now()),
    last_error = null
  where entry_log_id = NEW.id
    and status in ('PENDING', 'PROCESSING');

  return NEW;
end;
$function$;

drop trigger if exists trg_entry_ocr_complete_queue_on_result_v1 on public.entry_logs;
create trigger trg_entry_ocr_complete_queue_on_result_v1
after update of vehicle_plate_text on public.entry_logs
for each row
execute function public._entry_ocr_complete_queue_on_result_v1();

-- DONE is terminal for the autonomous worker. If an Edge request loses its HTTP
-- response after the DB transaction committed, its catch/retry path must not reopen
-- the already-completed queue row and accidentally pay for the same image again.
create or replace function public._entry_ocr_preserve_done_queue_v1()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
begin
  if OLD.status = 'DONE' then
    NEW.status := 'DONE';
    NEW.completed_at := coalesce(OLD.completed_at, NEW.completed_at, now());
    NEW.last_error := null;
  end if;

  return NEW;
end;
$function$;

drop trigger if exists trg_plate_ocr_queue_preserve_done_v1 on public.plate_ocr_queue;
create trigger trg_plate_ocr_queue_preserve_done_v1
before update on public.plate_ocr_queue
for each row
execute function public._entry_ocr_preserve_done_queue_v1();

revoke all on function public._entry_ocr_complete_queue_on_result_v1() from public, anon, authenticated;
revoke all on function public._entry_ocr_preserve_done_queue_v1() from public, anon, authenticated;

create or replace function public.trigger_plate_ocr_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_service_role_key text;
begin
  if NEW.action::text <> 'CHECK_IN' then
    return NEW;
  end if;

  if NEW.vehicle_photo_path is null or btrim(NEW.vehicle_photo_path) = '' then
    return NEW;
  end if;

  if NEW.vehicle_plate_text is not null then
    return NEW;
  end if;

  -- Keep exactly one durable queue row per access log. Give the immediate
  -- fire-and-forget attempt two minutes to finish before the retry worker is eligible.
  insert into public.plate_ocr_queue (
    entry_log_id,
    image_path,
    status,
    scheduled_at
  )
  values (
    NEW.id,
    NEW.vehicle_photo_path,
    'PENDING',
    now() + interval '2 minutes'
  )
  on conflict (entry_log_id) do update
    set image_path = excluded.image_path
    where public.plate_ocr_queue.status in ('PENDING', 'PROCESSING');

  select ds.decrypted_secret
  into v_service_role_key
  from vault.decrypted_secrets ds
  where ds.name = 'SUPABASE_SERVICE_ROLE_KEY'
  limit 1;

  -- Missing Vault auth must never break gate check-in. The queue row remains
  -- durable and Observability will surface it if the worker cannot recover.
  if nullif(v_service_role_key, '') is null then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://ytzvislhvrcdtkbtpbmu.supabase.co/functions/v1/extract-plate-text',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key,
      'apikey', v_service_role_key
    ),
    body := jsonb_build_object(
      'image_path', NEW.vehicle_photo_path,
      'bucket', 'entry-photos',
      'entry_log_id', NEW.id::text
    ),
    timeout_milliseconds := 25000
  );

  return NEW;
exception
  when others then
    -- OCR is auxiliary. Never fail a real gate check-in because dispatch failed.
    return NEW;
end;
$function$;

create or replace function public.process_plate_ocr_queue()
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $function$
declare
  v_item record;
  v_service_role_key text;
  v_dispatched integer := 0;
  v_failed_dispatch integer := 0;
begin
  select ds.decrypted_secret
  into v_service_role_key
  from vault.decrypted_secrets ds
  where ds.name = 'SUPABASE_SERVICE_ROLE_KEY'
  limit 1;

  if nullif(v_service_role_key, '') is null then
    return jsonb_build_object(
      'dispatched', 0,
      'dispatch_failed', 0,
      'status', 'internal_auth_unavailable'
    );
  end if;

  -- Reconcile successful legacy/partial writes before selecting retry work. This
  -- avoids dispatching a duplicate provider call for a row whose plate was already
  -- persisted by an older OCR version.
  update public.plate_ocr_queue q
  set
    status = 'DONE',
    completed_at = coalesce(q.completed_at, now()),
    last_error = null
  from public.entry_logs el
  where el.id = q.entry_log_id
    and el.vehicle_plate_text is not null
    and q.status in ('PENDING', 'PROCESSING');

  for v_item in
    select
      q.id,
      q.entry_log_id,
      q.image_path,
      q.attempts,
      q.max_attempts
    from public.plate_ocr_queue q
    join public.entry_logs el on el.id = q.entry_log_id
    where q.status = 'PENDING'
      and q.scheduled_at <= now()
      and q.attempts < q.max_attempts
      and el.vehicle_plate_text is null
    order by q.created_at
    limit 10
    for update of q skip locked
  loop
    begin
      update public.plate_ocr_queue
      set
        status = 'PROCESSING',
        attempts = attempts + 1,
        last_error = null
      where id = v_item.id;

      perform net.http_post(
        url := 'https://ytzvislhvrcdtkbtpbmu.supabase.co/functions/v1/extract-plate-text',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key,
          'apikey', v_service_role_key
        ),
        body := jsonb_build_object(
          'image_path', v_item.image_path,
          'bucket', 'entry-photos',
          'entry_log_id', v_item.entry_log_id::text
        ),
        timeout_milliseconds := 25000
      );

      -- pg_net sends after transaction commit. Keep the row retryable while the
      -- Edge Function owns the terminal DONE transition.
      update public.plate_ocr_queue
      set
        status = 'PENDING',
        scheduled_at = now() + interval '2 minutes'
      where id = v_item.id
        and status = 'PROCESSING';

      v_dispatched := v_dispatched + 1;
    exception
      when others then
        update public.plate_ocr_queue
        set
          status = case
            when attempts >= max_attempts then 'FAILED'
            else 'PENDING'
          end,
          scheduled_at = case
            when attempts >= max_attempts then scheduled_at
            else now() + interval '2 minutes'
          end,
          last_error = 'OCR_DISPATCH_FAILED'
        where id = v_item.id;

        v_failed_dispatch := v_failed_dispatch + 1;
    end;
  end loop;

  update public.plate_ocr_queue
  set
    status = 'FAILED',
    last_error = coalesce(last_error, 'OCR_MAX_ATTEMPTS_REACHED')
  where status = 'PENDING'
    and attempts >= max_attempts;

  return jsonb_build_object(
    'dispatched', v_dispatched,
    'dispatch_failed', v_failed_dispatch,
    'status', 'ok'
  );
end;
$function$;

revoke all on function public.process_plate_ocr_queue() from public, anon, authenticated;
grant execute on function public.process_plate_ocr_queue() to service_role;

-- The trigger is invoked by Postgres itself; clients do not need execute access.
revoke all on function public.trigger_plate_ocr_on_checkin() from public, anon, authenticated;

-- The old deployment had retry logic but no scheduler. Run once per minute;
-- scheduled_at provides the two-minute per-row backoff.
do $do$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'entry-plate-ocr-queue'
  ) then
    perform cron.schedule(
      'entry-plate-ocr-queue',
      '* * * * *',
      'select public.process_plate_ocr_queue();'
    );
  end if;
end;
$do$;

comment on function public.process_plate_ocr_queue() is
  'Autonomous ENTRY plate OCR retry worker. Uses Vault service_role auth and pg_net; no hardcoded bearer credential.';
comment on function public.trigger_plate_ocr_on_checkin() is
  'Queues and best-effort dispatches ENTRY plate OCR after CHECK_IN without blocking gate access.';
comment on function public._entry_ocr_complete_queue_on_result_v1() is
  'Marks plate OCR queue work DONE in the same transaction that persists the OCR result, including NO_PLATE/null results.';
comment on function public._entry_ocr_preserve_done_queue_v1() is
  'Keeps DONE plate OCR queue rows terminal so transport-error retry paths cannot reopen completed provider work.';
