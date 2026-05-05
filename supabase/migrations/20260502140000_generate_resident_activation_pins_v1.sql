-- ─────────────────────────────────────────────────────────────────────────────
-- resident_activation_pins + generate_resident_activation_pins_v1
--
-- Pre-activation PIN credentials for resident_activation_queue rows.
-- Queue rows are NOT real users yet — no auth.users / profiles /
-- community_members rows exist at this stage.
--
-- Design mirrors account_activation_codes (visible_code + pin_hash + expires_at)
-- but is intentionally decoupled because account_activation_codes.user_id is
-- NOT NULL and requires a real authenticated user to exist first.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Table ────────────────────────────────────────────────────────────────────

create table if not exists public.resident_activation_pins (
  id           uuid        not null default gen_random_uuid() primary key,
  queue_id     uuid        not null
                             references public.resident_activation_queue(id)
                             on delete cascade,
  community_id uuid        not null
                             references public.communities(id)
                             on delete cascade,
  -- bcrypt hash of the 6-digit PIN — used for future mobile verification
  pin_hash     text        not null,
  -- plaintext 6-digit PIN stored for admin console display only (follows
  -- account_activation_codes.visible_code pattern; expires after 7 days)
  visible_code text        not null,
  status       text        not null default 'pending'
                             constraint resident_activation_pins_status_check
                             check (status in ('pending', 'used', 'expired')),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_at      timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now()
);

-- One active (pending) PIN per queue row at a time.
-- Expired/used rows may coexist; only pending is unique.
create unique index if not exists idx_rap_queue_id_pending
  on public.resident_activation_pins (queue_id)
  where (status = 'pending');

-- Community-scoped lookups (future admin listing RPCs).
create index if not exists idx_rap_community_id
  on public.resident_activation_pins (community_id);

-- Expiry sweeps (analogous to expire_stale_activation_codes).
create index if not exists idx_rap_status_expires
  on public.resident_activation_pins (status, expires_at)
  where (status = 'pending');

-- All access via SECURITY DEFINER RPCs — no direct public access.
alter table public.resident_activation_pins enable row level security;


-- ── RPC ──────────────────────────────────────────────────────────────────────

create or replace function public.generate_resident_activation_pins_v1(
  p_community_id uuid,
  p_queue_ids    uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
/*
  Generates 6-digit PIN credentials for selected resident_activation_queue rows.

  Security: superadmin-only. Each queue row is verified against p_community_id
  before processing — cross-community access is blocked per row.

  PIN storage: bcrypt hash in resident_activation_pins.pin_hash (for future
  mobile verification); plaintext in visible_code (for admin console display,
  following account_activation_codes pattern) with 7-day expiry.

  Raw PINs are returned only in the RPC response and are never written to logs.

  This RPC does NOT create auth.users, profiles, or community_members rows.
*/
declare
  v_qid            uuid;
  v_row            public.resident_activation_queue%rowtype;
  v_pin            text;
  v_pin_hash       text;
  v_method         text;
  v_username       text;
  v_base_username  text;
  v_uname_counter  int;
  -- tracks usernames assigned in this call to prevent within-batch collisions
  v_used_usernames text[] := '{}';

  v_generated_count int  := 0;
  v_skipped_count   int  := 0;
  v_failed_count    int  := 0;
  v_items           jsonb := '[]'::jsonb;
begin

  -- ── Auth ──────────────────────────────────────────────────────────────────
  if not public.is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- ── Validate community ────────────────────────────────────────────────────
  if not exists (select 1 from public.communities where id = p_community_id) then
    raise exception 'community_not_found' using errcode = 'P0404';
  end if;

  -- ── Short-circuit empty input ─────────────────────────────────────────────
  if p_queue_ids is null or array_length(p_queue_ids, 1) is null then
    return jsonb_build_object(
      'generated_count', 0,
      'skipped_count',   0,
      'failed_count',    0,
      'items',           '[]'::jsonb
    );
  end if;

  -- ── Process each queue ID ─────────────────────────────────────────────────
  foreach v_qid in array p_queue_ids loop
    begin  -- implicit savepoint: one row failure does not roll back the batch

      -- Fetch queue row
      select * into v_row
      from public.resident_activation_queue
      where id = v_qid;

      -- Skip: not found
      if not found then
        v_skipped_count := v_skipped_count + 1;
        v_items := v_items || jsonb_build_object(
          'queue_id',           v_qid,
          'resident_name',      null,
          'unit_label',         null,
          'phone',              null,
          'email',              null,
          'suggested_username', null,
          'activation_method',  null,
          'pin',                null,
          'status',             'skipped',
          'message',            'queue_row_not_found'
        );
        continue;
      end if;

      -- Skip: cross-community access attempt
      if v_row.community_id <> p_community_id then
        v_skipped_count := v_skipped_count + 1;
        v_items := v_items || jsonb_build_object(
          'queue_id',           v_qid,
          'resident_name',      v_row.resident_name,
          'unit_label',         v_row.unit_label,
          'phone',              v_row.phone,
          'email',              v_row.email,
          'suggested_username', v_row.suggested_username,
          'activation_method',  v_row.activation_method,
          'pin',                null,
          'status',             'skipped',
          'message',            'cross_community_access_denied'
        );
        continue;
      end if;

      -- Skip: terminal statuses (activated / skipped)
      if v_row.status in ('activated', 'skipped') then
        v_skipped_count := v_skipped_count + 1;
        v_items := v_items || jsonb_build_object(
          'queue_id',           v_qid,
          'resident_name',      v_row.resident_name,
          'unit_label',         v_row.unit_label,
          'phone',              v_row.phone,
          'email',              v_row.email,
          'suggested_username', v_row.suggested_username,
          'activation_method',  v_row.activation_method,
          'pin',                null,
          'status',             'skipped',
          'message',            'row_already_' || v_row.status
        );
        continue;
      end if;

      -- ── Determine activation_method ──────────────────────────────────────
      -- Preserve 'email' for rows with a valid email address.
      -- Re-evaluate to phone_pin / username_pin for rows without email.
      if v_row.email is not null
         and v_row.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        v_method := 'email';
      elsif v_row.phone is not null and trim(v_row.phone) <> '' then
        v_method := 'phone_pin';
      else
        v_method := 'username_pin';
      end if;

      -- ── Resolve suggested_username ───────────────────────────────────────
      -- Email-method rows keep their existing suggested_username (or none).
      -- PIN-method rows require a username; generate one if missing.
      v_username := v_row.suggested_username;

      if v_method in ('username_pin', 'phone_pin')
         and (v_username is null or trim(v_username) = '') then

        -- Initial suggestion via existing helper (checks profiles.username)
        v_username := public._raq_suggest_username(v_row.resident_name, p_community_id);

        if v_username is not null then
          v_base_username := v_username;
          v_uname_counter := 1;

          -- Widen collision check: existing queue rows + current batch
          while (
            v_username = any(v_used_usernames)
            or exists (
              select 1
              from public.resident_activation_queue
              where community_id            = p_community_id
                and lower(suggested_username) = lower(v_username)
                and id                      <> v_qid
            )
          ) and v_uname_counter <= 99 loop
            v_username      := v_base_username || v_uname_counter::text;
            v_uname_counter := v_uname_counter + 1;
          end loop;
        end if;
      end if;

      -- Track within-batch to prevent issuing the same username twice
      if v_username is not null then
        v_used_usernames := array_append(v_used_usernames, lower(v_username));
      end if;

      -- ── Generate 6-digit PIN ─────────────────────────────────────────────
      v_pin := lpad((floor(random() * 1000000))::int::text, 6, '0');

      -- ── Hash with bcrypt (consistent with community_members.pin_hash) ─────
      v_pin_hash := extensions.crypt(v_pin, extensions.gen_salt('bf', 8));

      -- ── Upsert PIN credential ─────────────────────────────────────────────
      -- ON CONFLICT targets the partial unique index (queue_id) WHERE pending.
      -- Regeneration (repeat call) replaces the existing pending PIN.
      insert into public.resident_activation_pins (
        queue_id,    community_id, pin_hash,    visible_code,
        status,      expires_at,   created_by,  created_at
      ) values (
        v_qid,       p_community_id, v_pin_hash, v_pin,
        'pending',   now() + interval '7 days',  auth.uid(), now()
      )
      on conflict (queue_id) where (status = 'pending')
      do update set
        pin_hash     = excluded.pin_hash,
        visible_code = excluded.visible_code,
        expires_at   = excluded.expires_at,
        created_by   = excluded.created_by,
        created_at   = excluded.created_at;

      -- ── Update queue row ──────────────────────────────────────────────────
      update public.resident_activation_queue
      set
        status             = 'pin_generated',
        activation_method  = v_method,
        suggested_username = coalesce(v_username, suggested_username),
        last_error         = null,
        updated_at         = now()
      where id = v_qid;

      v_generated_count := v_generated_count + 1;

      v_items := v_items || jsonb_build_object(
        'queue_id',           v_qid,
        'resident_name',      v_row.resident_name,
        'unit_label',         v_row.unit_label,
        'phone',              v_row.phone,
        'email',              v_row.email,
        'suggested_username', v_username,
        'activation_method',  v_method,
        'pin',                v_pin,   -- plaintext; only in this response, never logged
        'status',             'pin_generated',
        'message',            null
      );

    exception when others then
      -- Per-row failure: record and continue; do not abort the batch
      v_failed_count := v_failed_count + 1;
      v_items := v_items || jsonb_build_object(
        'queue_id',           v_qid,
        'resident_name',      null,
        'unit_label',         null,
        'phone',              null,
        'email',              null,
        'suggested_username', null,
        'activation_method',  null,
        'pin',                null,
        'status',             'failed',
        'message',            sqlerrm
      );
    end;
  end loop;

  -- ── Audit log (no raw PINs) ───────────────────────────────────────────────
  perform public._sa_audit_log(
    'generate_resident_activation_pins',
    'community',
    p_community_id,
    jsonb_build_object(
      'requested_count', coalesce(array_length(p_queue_ids, 1), 0),
      'generated_count', v_generated_count,
      'skipped_count',   v_skipped_count,
      'failed_count',    v_failed_count
    )
  );

  return jsonb_build_object(
    'generated_count', v_generated_count,
    'skipped_count',   v_skipped_count,
    'failed_count',    v_failed_count,
    'items',           v_items
  );
end;
$function$;

comment on function public.generate_resident_activation_pins_v1(uuid, uuid[]) is
  'Generates 6-digit PIN credentials for selected resident_activation_queue rows. '
  'Superadmin-only. Does not create auth.users, profiles, or community_members. '
  'Stores bcrypt hash in resident_activation_pins and returns plaintext PIN once '
  'in the response for admin display (follows account_activation_codes pattern).';

revoke all on function public.generate_resident_activation_pins_v1(uuid, uuid[]) from public;
grant execute on function public.generate_resident_activation_pins_v1(uuid, uuid[]) to anon;
grant execute on function public.generate_resident_activation_pins_v1(uuid, uuid[]) to authenticated;
grant execute on function public.generate_resident_activation_pins_v1(uuid, uuid[]) to service_role;
