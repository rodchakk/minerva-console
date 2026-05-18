-- ─────────────────────────────────────────────────────────────────────────────
-- worker_generate_resident_activation_pin_v1
--
-- Worker-only counterpart to generate_resident_activation_pins_v1.
-- The user-facing RPC gates on is_superadmin() (which reads auth.uid()).
-- The onboarding campaign worker runs with the service role JWT, where
-- auth.uid() is NULL, so is_superadmin() always returns false there.
--
-- This function:
--   * Defends in depth: hard-asserts auth.role() = 'service_role' inside the
--     body, AND is only GRANT EXECUTE'd to service_role (revoke from public,
--     anon, authenticated).
--   * Operates on a single queue_id at a time — the worker iterates already.
--   * Returns the freshly-generated plaintext PIN ONCE in the response.
--     The PIN is never written outside resident_activation_pins (hashed) and
--     resident_activation_pins.visible_code (admin-display copy).
--   * Does NOT create auth.users, profiles, or community_members.
--   * Does NOT audit per-PIN (the campaign launch is already audited).
--
-- Also fixes refresh_onboarding_campaign_counters_v1: the previous version
-- used current_user, which inside SECURITY DEFINER returns the function
-- owner (postgres), not the JWT role. We switch to auth.role().
-- ─────────────────────────────────────────────────────────────────────────────


-- ── worker_generate_resident_activation_pin_v1 ──────────────────────────────

create or replace function public.worker_generate_resident_activation_pin_v1(
  p_community_id uuid,
  p_queue_id     uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_row            public.resident_activation_queue%rowtype;
  v_pin            text;
  v_pin_hash       text;
  v_method         text;
  v_username       text;
  v_base_username  text;
  v_uname_counter  int;
begin
  -- Defense in depth: only allow callers with the service_role JWT.
  -- GRANTs already restrict this, but checking auth.role() in-body
  -- prevents accidental privilege escalation if grants are ever widened.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'worker_only' using errcode = '42501';
  end if;

  -- ── Fetch + validate queue row ───────────────────────────────────────────
  select * into v_row
    from public.resident_activation_queue
   where id = p_queue_id;

  if not found then
    raise exception 'queue_row_not_found' using errcode = 'P0404';
  end if;

  if v_row.community_id <> p_community_id then
    raise exception 'cross_community_access_denied' using errcode = '42501';
  end if;

  if v_row.status in ('activated', 'skipped') then
    raise exception 'queue_row_terminal: %', v_row.status using errcode = 'P0409';
  end if;

  -- ── Determine activation_method (mirrors generate_resident_activation_pins_v1)
  if v_row.email is not null
     and v_row.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_method := 'email';
  elsif v_row.phone is not null and trim(v_row.phone) <> '' then
    v_method := 'phone_pin';
  else
    v_method := 'username_pin';
  end if;

  -- ── Resolve suggested_username for PIN-method rows ───────────────────────
  v_username := v_row.suggested_username;

  if v_method in ('username_pin', 'phone_pin')
     and (v_username is null or trim(v_username) = '') then
    v_username := public._raq_suggest_username(v_row.resident_name, p_community_id);
    if v_username is not null then
      v_base_username := v_username;
      v_uname_counter := 1;
      while exists (
        select 1
          from public.resident_activation_queue
         where community_id            = p_community_id
           and lower(suggested_username) = lower(v_username)
           and id                      <> p_queue_id
      ) and v_uname_counter <= 99 loop
        v_username      := v_base_username || v_uname_counter::text;
        v_uname_counter := v_uname_counter + 1;
      end loop;
    end if;
  end if;

  -- ── Generate + hash 6-digit PIN ──────────────────────────────────────────
  v_pin      := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_pin_hash := extensions.crypt(v_pin, extensions.gen_salt('bf', 8));

  -- ── Upsert pending PIN credential ────────────────────────────────────────
  insert into public.resident_activation_pins (
    queue_id, community_id, pin_hash, visible_code,
    status,   expires_at,   created_by, created_at
  ) values (
    p_queue_id, p_community_id, v_pin_hash, v_pin,
    'pending',  now() + interval '7 days', null, now()
  )
  on conflict (queue_id) where (status = 'pending')
  do update set
    pin_hash     = excluded.pin_hash,
    visible_code = excluded.visible_code,
    expires_at   = excluded.expires_at,
    created_by   = excluded.created_by,
    created_at   = excluded.created_at;

  -- ── Promote queue row ────────────────────────────────────────────────────
  update public.resident_activation_queue
     set status             = 'pin_generated',
         activation_method  = v_method,
         suggested_username = coalesce(v_username, suggested_username),
         last_error         = null,
         updated_at         = now()
   where id = p_queue_id;

  return jsonb_build_object(
    'queue_id',           p_queue_id,
    'resident_name',      v_row.resident_name,
    'unit_label',         v_row.unit_label,
    'email',              v_row.email,
    'phone',              v_row.phone,
    'suggested_username', v_username,
    'activation_method',  v_method,
    -- Plaintext returned only in this response, never logged.
    'pin',                v_pin,
    'status',             'pin_generated'
  );
end;
$function$;

comment on function public.worker_generate_resident_activation_pin_v1(uuid, uuid) is
  'Worker-only PIN generator for the onboarding campaign worker. Asserts '
  'auth.role() = service_role internally and only grants execute to '
  'service_role externally. Returns plaintext PIN ONCE; PIN is never '
  'persisted outside resident_activation_pins.';

revoke all on function public.worker_generate_resident_activation_pin_v1(uuid, uuid) from public;
revoke all on function public.worker_generate_resident_activation_pin_v1(uuid, uuid) from anon;
revoke all on function public.worker_generate_resident_activation_pin_v1(uuid, uuid) from authenticated;
grant execute on function public.worker_generate_resident_activation_pin_v1(uuid, uuid) to service_role;


-- ── Patch refresh_onboarding_campaign_counters_v1 ───────────────────────────
-- The previous body used `current_user` to detect the worker. Inside a
-- SECURITY DEFINER function `current_user` resolves to the function owner
-- (postgres) instead of the JWT role, so worker calls were rejected with
-- "unauthorized" — the campaign counters never updated. We switch to
-- auth.role() which reads the JWT claim correctly.

create or replace function public.refresh_onboarding_campaign_counters_v1(
  p_campaign_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pending       int := 0;
  v_processing    int := 0;
  v_sent          int := 0;
  v_failed        int := 0;
  v_skipped       int := 0;
  v_cancelled     int := 0;
  v_total         int := 0;
  v_jwt_role      text := coalesce(auth.role(), '');
  v_new_status    text;
  v_completed_at  timestamptz;
  v_current       public.onboarding_campaigns%rowtype;
begin
  if not public.is_superadmin() and v_jwt_role <> 'service_role' then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into v_current
    from public.onboarding_campaigns
   where id = p_campaign_id;

  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0404';
  end if;

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'processing'),
    count(*) filter (where status = 'sent'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'skipped'),
    count(*) filter (where status = 'cancelled'),
    count(*)
  into v_pending, v_processing, v_sent, v_failed, v_skipped, v_cancelled, v_total
  from public.onboarding_campaign_messages
  where campaign_id = p_campaign_id;

  v_new_status   := v_current.status;
  v_completed_at := v_current.completed_at;

  if (v_pending + v_processing) = 0
     and v_current.status in ('running', 'paused') then
    v_new_status   := 'completed';
    v_completed_at := coalesce(v_current.completed_at, now());
  end if;

  update public.onboarding_campaigns
     set pending_count    = v_pending,
         processing_count = v_processing,
         sent_count       = v_sent,
         failed_count     = v_failed,
         skipped_count    = v_skipped,
         total_count      = v_total,
         status           = v_new_status,
         completed_at     = v_completed_at
   where id = p_campaign_id;

  return jsonb_build_object(
    'campaign_id', p_campaign_id,
    'status',      v_new_status,
    'total',       v_total,
    'pending',     v_pending,
    'processing',  v_processing,
    'sent',        v_sent,
    'failed',      v_failed,
    'skipped',     v_skipped,
    'cancelled',   v_cancelled
  );
end;
$function$;
