-- ─────────────────────────────────────────────────────────────────────────────
-- Helper RPCs for onboarding campaigns
--
-- get_onboarding_campaign_summary_v1 (superadmin):
--   Returns campaign row + status breakdown of its messages for the UI.
--
-- refresh_onboarding_campaign_counters_v1 (worker, internal):
--   Recomputes pending/processing/sent/failed/skipped/total from the
--   messages table, and transitions running→completed when there is
--   nothing left in flight. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── get_onboarding_campaign_summary_v1 ──────────────────────────────────────

create or replace function public.get_onboarding_campaign_summary_v1(
  p_campaign_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_campaign  public.onboarding_campaigns%rowtype;
  v_breakdown jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select * into v_campaign
    from public.onboarding_campaigns
   where id = p_campaign_id;

  if not found then
    raise exception 'campaign_not_found' using errcode = 'P0404';
  end if;

  select coalesce(jsonb_object_agg(status, c), '{}'::jsonb)
    into v_breakdown
    from (
      select status, count(*) as c
        from public.onboarding_campaign_messages
       where campaign_id = p_campaign_id
       group by status
    ) s;

  return jsonb_build_object(
    'id',                   v_campaign.id,
    'community_id',         v_campaign.community_id,
    'name',                 v_campaign.name,
    'channel',              v_campaign.channel,
    'status',               v_campaign.status,
    'dry_run',              v_campaign.dry_run,
    'send_rate_per_minute', v_campaign.send_rate_per_minute,
    'total_count',          v_campaign.total_count,
    'pending_count',        v_campaign.pending_count,
    'processing_count',     v_campaign.processing_count,
    'sent_count',           v_campaign.sent_count,
    'failed_count',         v_campaign.failed_count,
    'skipped_count',        v_campaign.skipped_count,
    'started_at',           v_campaign.started_at,
    'paused_at',            v_campaign.paused_at,
    'completed_at',         v_campaign.completed_at,
    'created_at',           v_campaign.created_at,
    'updated_at',           v_campaign.updated_at,
    'breakdown',            v_breakdown
  );
end;
$function$;

revoke all on function public.get_onboarding_campaign_summary_v1(uuid) from public;
grant execute on function public.get_onboarding_campaign_summary_v1(uuid) to authenticated;
grant execute on function public.get_onboarding_campaign_summary_v1(uuid) to service_role;

comment on function public.get_onboarding_campaign_summary_v1(uuid) is
  'Returns an onboarding campaign with its message status breakdown. '
  'Superadmin-only.';


-- ── refresh_onboarding_campaign_counters_v1 ─────────────────────────────────
-- Called by the worker after a batch to keep the campaign counters in sync.
-- Also auto-transitions running→completed when there is no remaining work.
-- Allowed from service_role (worker) or superadmin (manual reconciliation).

create or replace function public.refresh_onboarding_campaign_counters_v1(
  p_campaign_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pending     int := 0;
  v_processing  int := 0;
  v_sent        int := 0;
  v_failed      int := 0;
  v_skipped     int := 0;
  v_cancelled   int := 0;
  v_total       int := 0;
  v_role        text := current_user;
  v_new_status  text;
  v_completed_at timestamptz;
  v_current     public.onboarding_campaigns%rowtype;
begin
  if not public.is_superadmin() and v_role <> 'service_role' then
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

  -- Auto-complete when no work remains and the campaign is currently running.
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
    'campaign_id',      p_campaign_id,
    'status',           v_new_status,
    'total',            v_total,
    'pending',          v_pending,
    'processing',       v_processing,
    'sent',             v_sent,
    'failed',           v_failed,
    'skipped',          v_skipped,
    'cancelled',        v_cancelled
  );
end;
$function$;

revoke all on function public.refresh_onboarding_campaign_counters_v1(uuid) from public;
grant execute on function public.refresh_onboarding_campaign_counters_v1(uuid) to authenticated;
grant execute on function public.refresh_onboarding_campaign_counters_v1(uuid) to service_role;

comment on function public.refresh_onboarding_campaign_counters_v1(uuid) is
  'Recomputes onboarding_campaigns counters from onboarding_campaign_messages. '
  'Auto-transitions running/paused -> completed when no work remains. '
  'Worker (service_role) or superadmin only.';
