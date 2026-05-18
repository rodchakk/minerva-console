-- ─────────────────────────────────────────────────────────────────────────────
-- onboarding_campaigns + onboarding_campaign_messages
--
-- Backing tables for the "Launch onboarding campaign" feature.
-- A campaign represents a gradual, batched send of activation invites to
-- residents prepared in resident_activation_queue.
--
-- Key constraints:
--   * Only ONE running/paused campaign per community (partial unique index).
--   * (campaign_id, activation_queue_id, channel) is globally unique per
--     campaign — prevents duplicate sends within the same campaign even if
--     start_onboarding_email_campaign_v1 is called twice.
--
-- All access is gated by RLS — superadmin-only — mirroring the existing
-- pattern used for resident_activation_queue, resident_activation_pins, etc.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── onboarding_campaigns ────────────────────────────────────────────────────

create table if not exists public.onboarding_campaigns (
  id                    uuid        not null default gen_random_uuid() primary key,
  community_id          uuid        not null
                                      references public.communities(id)
                                      on delete cascade,
  name                  text,
  channel               text        not null default 'email'
                                      constraint onboarding_campaigns_channel_check
                                      check (channel in ('email', 'sms', 'whatsapp')),
  status                text        not null default 'draft'
                                      constraint onboarding_campaigns_status_check
                                      check (status in (
                                        'draft', 'running', 'paused',
                                        'completed', 'failed', 'cancelled'
                                      )),
  total_count           integer     not null default 0,
  pending_count         integer     not null default 0,
  processing_count      integer     not null default 0,
  sent_count            integer     not null default 0,
  failed_count          integer     not null default 0,
  skipped_count         integer     not null default 0,
  send_rate_per_minute  integer     not null default 10
                                      constraint onboarding_campaigns_rate_check
                                      check (send_rate_per_minute between 1 and 120),
  -- When true, the worker marks messages as sent without calling the email
  -- provider. Defaults to true so a misconfigured deploy cannot blast emails.
  dry_run               boolean     not null default true,
  started_at            timestamptz,
  paused_at             timestamptz,
  completed_at          timestamptz,
  created_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- At most one running OR paused campaign per community.
-- completed / cancelled / failed campaigns may coexist for history.
create unique index if not exists idx_oc_one_active_per_community
  on public.onboarding_campaigns (community_id)
  where (status in ('running', 'paused'));

create index if not exists idx_oc_status
  on public.onboarding_campaigns (status);

create index if not exists idx_oc_community_created
  on public.onboarding_campaigns (community_id, created_at desc);


-- ── onboarding_campaign_messages ────────────────────────────────────────────

create table if not exists public.onboarding_campaign_messages (
  id                    uuid        not null default gen_random_uuid() primary key,
  campaign_id           uuid        not null
                                      references public.onboarding_campaigns(id)
                                      on delete cascade,
  community_id          uuid        not null
                                      references public.communities(id)
                                      on delete cascade,
  activation_queue_id   uuid        not null
                                      references public.resident_activation_queue(id)
                                      on delete cascade,
  channel               text        not null default 'email'
                                      constraint onboarding_campaign_messages_channel_check
                                      check (channel in ('email', 'sms', 'whatsapp')),
  recipient_email       text,
  recipient_phone       text,
  resident_name         text,
  unit_label            text,
  status                text        not null default 'pending'
                                      constraint onboarding_campaign_messages_status_check
                                      check (status in (
                                        'pending', 'processing', 'sent',
                                        'failed', 'skipped', 'cancelled'
                                      )),
  provider              text,
  provider_message_id   text,
  attempt_count         integer     not null default 0,
  last_attempt_at       timestamptz,
  sent_at               timestamptz,
  failed_at             timestamptz,
  last_error            text,
  dry_run               boolean     not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint onboarding_campaign_messages_unique
    unique (campaign_id, activation_queue_id, channel)
);

-- Worker uses this hot path: "give me pending rows for this campaign,
-- oldest first" and "anything still in flight?"
create index if not exists idx_ocm_campaign_status_created
  on public.onboarding_campaign_messages (campaign_id, status, created_at);

create index if not exists idx_ocm_in_flight
  on public.onboarding_campaign_messages (campaign_id, status)
  where status in ('pending', 'processing');

create index if not exists idx_ocm_queue_id
  on public.onboarding_campaign_messages (activation_queue_id);


-- ── updated_at trigger ──────────────────────────────────────────────────────

create or replace function public._touch_onboarding_campaign_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_onboarding_campaigns_updated_at
  on public.onboarding_campaigns;
create trigger trg_touch_onboarding_campaigns_updated_at
  before update on public.onboarding_campaigns
  for each row execute function public._touch_onboarding_campaign_updated_at();

drop trigger if exists trg_touch_onboarding_campaign_messages_updated_at
  on public.onboarding_campaign_messages;
create trigger trg_touch_onboarding_campaign_messages_updated_at
  before update on public.onboarding_campaign_messages
  for each row execute function public._touch_onboarding_campaign_updated_at();


-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.onboarding_campaigns enable row level security;
alter table public.onboarding_campaign_messages enable row level security;

drop policy if exists superadmin_all on public.onboarding_campaigns;
create policy superadmin_all on public.onboarding_campaigns
  for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

drop policy if exists superadmin_all on public.onboarding_campaign_messages;
create policy superadmin_all on public.onboarding_campaign_messages
  for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

comment on table public.onboarding_campaigns is
  'Onboarding email/SMS/WhatsApp campaigns for resident_activation_queue. '
  'Worker reads campaigns in status=running and processes campaign messages '
  'in batches, respecting send_rate_per_minute. dry_run=true blocks any '
  'real provider call.';

comment on table public.onboarding_campaign_messages is
  'Per-recipient row inside an onboarding campaign. Status transitions: '
  'pending -> processing -> (sent | failed). skipped is set at creation '
  'for rows without a usable contact channel. The PIN is never persisted '
  'here; the worker generates a fresh PIN per send via '
  'generate_resident_activation_pins_v1.';
