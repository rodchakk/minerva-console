-- ─────────────────────────────────────────────────────────────────────────────
-- start_onboarding_email_campaign_v1
--
-- Creates an onboarding email campaign for a community, populating one
-- onboarding_campaign_messages row per resident in resident_activation_queue.
--
-- This RPC does NOT:
--   * Generate activation PINs (worker does this per send, just-in-time).
--   * Send emails (worker does this).
--   * Create auth.users or community_members rows.
--
-- It DOES:
--   * Reject a second active campaign for the same community.
--   * Reject cross-community / non-existent communities.
--   * Skip residents already activated.
--   * Skip residents with invalid / missing email (recorded as 'skipped'
--     in the messages table for traceability).
--   * Skip residents already invited unless p_include_already_invited.
--   * Audit the action in superadmin_audit_log via _sa_audit_log (no PII).
--
-- Idempotency:
--   * The partial unique index `idx_oc_one_active_per_community` prevents
--     two concurrent calls from creating duplicate running campaigns.
--   * The composite unique (campaign_id, activation_queue_id, channel)
--     prevents duplicate messages within a single campaign.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.start_onboarding_email_campaign_v1(
  p_community_id            uuid,
  p_send_rate_per_minute    integer default 10,
  p_include_already_invited boolean default false,
  p_name                    text    default null,
  p_dry_run                 boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign_id             uuid;
  v_actor                   uuid := auth.uid();
  v_rate                    int  := greatest(1, least(120, coalesce(p_send_rate_per_minute, 10)));
  v_dry_run                 boolean := coalesce(p_dry_run, true);
  v_include_invited         boolean := coalesce(p_include_already_invited, false);

  v_existing_active         uuid;

  v_ready                   int := 0;
  v_skipped_missing_email   int := 0;
  v_already_invited         int := 0;
  v_already_activated       int := 0;
  v_total                   int := 0;
begin
  -- ── Auth ──────────────────────────────────────────────────────────────────
  if not public.is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- ── Validate community ────────────────────────────────────────────────────
  if not exists (select 1 from public.communities where id = p_community_id) then
    raise exception 'community_not_found' using errcode = 'P0404';
  end if;

  -- ── Reject duplicate active campaign ──────────────────────────────────────
  select id
    into v_existing_active
    from public.onboarding_campaigns
   where community_id = p_community_id
     and status in ('running', 'paused')
   limit 1;

  if v_existing_active is not null then
    raise exception 'active_campaign_exists: %', v_existing_active
      using errcode = 'P0409';
  end if;

  -- ── Create campaign shell with zero counts ────────────────────────────────
  insert into public.onboarding_campaigns (
    community_id,
    name,
    channel,
    status,
    total_count,
    pending_count,
    skipped_count,
    send_rate_per_minute,
    dry_run,
    started_at,
    created_by
  )
  values (
    p_community_id,
    coalesce(
      nullif(trim(p_name), ''),
      'Email onboarding ' || to_char(now() at time zone 'utc', 'YYYY-MM-DD HH24:MI')
    ),
    'email',
    'running',
    0, 0, 0,
    v_rate,
    v_dry_run,
    now(),
    v_actor
  )
  returning id into v_campaign_id;

  -- ── Classify + insert messages in one pass ────────────────────────────────
  -- A single CTE evaluates each queue row once and dispatches to either the
  -- pending or skipped INSERT, while also returning the bucket counts.
  with src as (
    select
      q.id,
      q.email,
      q.status as queue_status,
      q.resident_name,
      q.unit_label,
      case
        -- 'activated' = real auth.user already exists.
        -- 'skipped'   = admin explicitly chose not to onboard this resident.
        -- Both are terminal and are reported together as already_activated.
        when q.status in ('activated', 'skipped') then
          'already_activated'
        when q.status = 'invited' and not v_include_invited then
          'already_invited'
        when q.email is null
             or btrim(q.email) = ''
             or q.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
          'missing_email'
        else
          'ready'
      end as bucket
    from public.resident_activation_queue q
    where q.community_id = p_community_id
  ),
  ins_pending as (
    insert into public.onboarding_campaign_messages (
      campaign_id, community_id, activation_queue_id, channel,
      recipient_email, resident_name, unit_label, status, dry_run
    )
    select
      v_campaign_id, p_community_id, src.id, 'email',
      src.email, src.resident_name, src.unit_label, 'pending', v_dry_run
    from src
    where src.bucket = 'ready'
    on conflict (campaign_id, activation_queue_id, channel) do nothing
    returning 1
  ),
  ins_skipped as (
    insert into public.onboarding_campaign_messages (
      campaign_id, community_id, activation_queue_id, channel,
      recipient_email, resident_name, unit_label, status, last_error, dry_run
    )
    select
      v_campaign_id, p_community_id, src.id, 'email',
      src.email, src.resident_name, src.unit_label,
      'skipped', 'missing_or_invalid_email', v_dry_run
    from src
    where src.bucket = 'missing_email'
    on conflict (campaign_id, activation_queue_id, channel) do nothing
    returning 1
  )
  select
    count(*) filter (where bucket = 'ready'),
    count(*) filter (where bucket = 'missing_email'),
    count(*) filter (where bucket = 'already_invited'),
    count(*) filter (where bucket = 'already_activated')
  into v_ready, v_skipped_missing_email, v_already_invited, v_already_activated
  from src;

  v_total := v_ready + v_skipped_missing_email;

  -- ── Update campaign counters ──────────────────────────────────────────────
  update public.onboarding_campaigns
     set total_count   = v_total,
         pending_count = v_ready,
         skipped_count = v_skipped_missing_email,
         -- If nothing to send AT ALL (no ready rows), mark completed
         -- so the worker does not pick it up.
         status        = case
                           when v_ready = 0 then 'completed'
                           else status
                         end,
         completed_at  = case
                           when v_ready = 0 then now()
                           else completed_at
                         end
   where id = v_campaign_id;

  -- ── Audit (no PINs, no PII row data) ──────────────────────────────────────
  perform public._sa_audit_log(
    'start_onboarding_email_campaign',
    'onboarding_campaign',
    v_campaign_id,
    jsonb_build_object(
      'community_id',            p_community_id,
      'send_rate_per_minute',    v_rate,
      'include_already_invited', v_include_invited,
      'dry_run',                 v_dry_run,
      'total',                   v_total,
      'ready_to_send',           v_ready,
      'skipped_missing_email',   v_skipped_missing_email,
      'already_invited',         v_already_invited,
      'already_activated',       v_already_activated
    )
  );

  return jsonb_build_object(
    'campaign_id',           v_campaign_id,
    'status',                case when v_ready = 0 then 'completed' else 'running' end,
    'dry_run',               v_dry_run,
    'total',                 v_total,
    'ready_to_send',         v_ready,
    'skipped_missing_email', v_skipped_missing_email,
    'already_invited',       v_already_invited,
    'already_activated',     v_already_activated
  );
end;
$function$;

comment on function public.start_onboarding_email_campaign_v1(uuid, integer, boolean, text, boolean) is
  'Creates an onboarding email campaign for a community. Populates '
  'onboarding_campaign_messages with one row per eligible resident '
  '(pending) or skipped row (missing/invalid email). Does NOT generate '
  'PINs, send emails, or create real users. Superadmin-only. '
  'Audited via _sa_audit_log.';

revoke all on function public.start_onboarding_email_campaign_v1(uuid, integer, boolean, text, boolean) from public;
grant execute on function public.start_onboarding_email_campaign_v1(uuid, integer, boolean, text, boolean) to authenticated;
grant execute on function public.start_onboarding_email_campaign_v1(uuid, integer, boolean, text, boolean) to service_role;
