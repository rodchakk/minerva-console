-- ENTRY-ONB-001: Community Registration / Pre-Onboarding schema v1.
--
-- Local migration only. Do not apply to live Supabase without review and
-- authorization. This schema keeps public registration data separate from
-- active users, final activation rows, and existing activation compatibility
-- paths.

-- Existing-table support indexes used only to enforce cross-tenant composite
-- foreign keys from the new registration tables.
create unique index if not exists idx_cr_houses_id_community_id
  on public.houses (id, community_id);

create unique index if not exists idx_cr_raq_id_community_id
  on public.resident_activation_queue (id, community_id);

create or replace function public._touch_community_registration_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public._touch_community_registration_updated_at() from public;
revoke all on function public._touch_community_registration_updated_at() from anon;
revoke all on function public._touch_community_registration_updated_at() from authenticated;

create table if not exists public.community_registration_campaigns (
  id                      uuid        not null default gen_random_uuid() primary key,
  community_id            uuid        not null
                                        references public.communities(id)
                                        on delete restrict,
  internal_name           text        not null
                                        constraint cr_campaigns_internal_name_not_blank
                                        check (btrim(internal_name) <> ''),
  public_title            text        not null
                                        constraint cr_campaigns_public_title_not_blank
                                        check (btrim(public_title) <> ''),
  public_instructions     text,
  public_slug             text        not null
                                        constraint cr_campaigns_public_slug_not_blank
                                        check (btrim(public_slug) <> ''),
  status                  text        not null default 'draft'
                                        constraint cr_campaigns_status_check
                                        check (status in (
                                          'draft', 'open', 'paused',
                                          'review', 'confirmed',
                                          'processed', 'closed'
                                        )),
  default_resident_limit  integer     not null default 3
                                        constraint cr_campaigns_default_limit_positive
                                        check (default_resident_limit > 0),
  opens_at                timestamptz,
  closes_at               timestamptz,
  confirmed_at            timestamptz,
  processed_at            timestamptz,
  closed_at               timestamptz,
  created_by              uuid
                                        references auth.users(id)
                                        on delete set null,
  updated_by              uuid
                                        references auth.users(id)
                                        on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint cr_campaigns_open_close_order
    check (opens_at is null or closes_at is null or closes_at > opens_at),
  constraint cr_campaigns_id_community_unique
    unique (id, community_id)
);

create unique index if not exists idx_cr_campaigns_public_slug_lower
  on public.community_registration_campaigns (lower(public_slug));

create index if not exists idx_cr_campaigns_community_status
  on public.community_registration_campaigns (community_id, status);

create unique index if not exists idx_cr_campaigns_one_active_per_community
  on public.community_registration_campaigns (community_id)
  where status in ('open', 'paused', 'review', 'confirmed');

create index if not exists idx_cr_campaigns_community_created
  on public.community_registration_campaigns (community_id, created_at desc);

create table if not exists public.community_registration_units (
  id                       uuid        not null default gen_random_uuid() primary key,
  campaign_id              uuid        not null,
  community_id             uuid        not null,
  house_id                 uuid        not null,
  unit_label_snapshot      text        not null
                                         constraint cr_units_label_snapshot_not_blank
                                         check (btrim(unit_label_snapshot) <> ''),
  normalized_unit_label    text        not null
                                         constraint cr_units_normalized_label_not_blank
                                         check (btrim(normalized_unit_label) <> ''),
  resident_limit_override  integer
                                         constraint cr_units_limit_override_positive
                                         check (resident_limit_override is null or resident_limit_override > 0),
  status                   text        not null default 'unregistered'
                                         constraint cr_units_status_check
                                         check (status in (
                                           'unregistered', 'submitted',
                                           'edit_enabled', 'needs_correction',
                                           'reviewed', 'confirmed', 'processed'
                                         )),
  last_submitted_at        timestamptz,
  reviewed_at              timestamptz,
  reviewed_by              uuid
                                         references auth.users(id)
                                         on delete set null,
  patronato_confirmed_at   timestamptz,
  patronato_confirmed_by   text,
  processed_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint cr_units_campaign_community_fk
    foreign key (campaign_id, community_id)
    references public.community_registration_campaigns(id, community_id)
    on delete restrict,
  constraint cr_units_house_community_fk
    foreign key (house_id, community_id)
    references public.houses(id, community_id)
    on delete restrict,
  constraint cr_units_campaign_house_unique
    unique (campaign_id, house_id),
  constraint cr_units_identity_unique
    unique (id, campaign_id, community_id, house_id),
  constraint cr_units_id_campaign_unique
    unique (id, campaign_id)
);

create index if not exists idx_cr_units_campaign_status
  on public.community_registration_units (campaign_id, status);

create unique index if not exists idx_cr_units_campaign_normalized_label_unique
  on public.community_registration_units (campaign_id, normalized_unit_label);

create index if not exists idx_cr_units_review_queue
  on public.community_registration_units (campaign_id, status, updated_at desc);

create table if not exists public.community_registration_submissions (
  id                            uuid        not null default gen_random_uuid() primary key,
  campaign_unit_id              uuid        not null,
  campaign_id                   uuid        not null,
  community_id                  uuid        not null,
  house_id                      uuid        not null,
  version_number                integer     not null
                                              constraint cr_submissions_version_positive
                                              check (version_number > 0),
  status                        text        not null default 'draft'
                                              constraint cr_submissions_status_check
                                              check (status in (
                                                'draft', 'submitted',
                                                'edit_enabled', 'superseded',
                                                'invalidated', 'reviewed',
                                                'confirmed', 'converted'
                                              )),
  submitted_at                  timestamptz,
  locked_at                     timestamptz,
  invalidated_at                timestamptz,
  invalidated_reason            text,
  reviewed_at                   timestamptz,
  reviewed_by                   uuid
                                              references auth.users(id)
                                              on delete set null,
  patronato_confirmed_at        timestamptz,
  patronato_confirmed_by        text,
  converted_at                  timestamptz,
  previous_submission_id        uuid
                                              constraint cr_submissions_previous_not_self
                                              check (previous_submission_id is null or previous_submission_id <> id),
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),

  constraint cr_submissions_unit_identity_fk
    foreign key (campaign_unit_id, campaign_id, community_id, house_id)
    references public.community_registration_units(id, campaign_id, community_id, house_id)
    on delete restrict,
  constraint cr_submissions_previous_same_unit_fk
    foreign key (campaign_unit_id, previous_submission_id)
    references public.community_registration_submissions(campaign_unit_id, id)
    on delete set null (previous_submission_id),
  constraint cr_submissions_unit_version_unique
    unique (campaign_unit_id, version_number),
  constraint cr_submissions_unit_id_unique
    unique (campaign_unit_id, id),
  constraint cr_submissions_identity_unique
    unique (id, campaign_id, community_id, campaign_unit_id, house_id),
  constraint cr_submissions_id_campaign_unique
    unique (id, campaign_id),
  constraint cr_submissions_id_unit_campaign_unique
    unique (id, campaign_unit_id, campaign_id),
  constraint cr_submissions_invalidated_requires_reason
    check (status <> 'invalidated' or (invalidated_at is not null and invalidated_reason is not null)),
  constraint cr_submissions_submitted_requires_timestamp
    check (status not in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted') or submitted_at is not null),
  constraint cr_submissions_locked_when_submitted
    check (status not in ('submitted', 'edit_enabled', 'reviewed', 'confirmed', 'converted') or locked_at is not null),
  constraint cr_submissions_reviewed_requires_timestamp
    check (status not in ('reviewed', 'confirmed', 'converted') or reviewed_at is not null),
  constraint cr_submissions_confirmed_requires_timestamp
    check (status not in ('confirmed', 'converted') or patronato_confirmed_at is not null),
  constraint cr_submissions_converted_requires_timestamp
    check (status <> 'converted' or converted_at is not null)
);

create unique index if not exists idx_cr_submissions_one_active_per_unit
  on public.community_registration_submissions (campaign_unit_id)
  where status in ('draft', 'submitted', 'edit_enabled', 'reviewed', 'confirmed');

create index if not exists idx_cr_submissions_unit_created
  on public.community_registration_submissions (campaign_unit_id, created_at desc);

create index if not exists idx_cr_submissions_campaign_status
  on public.community_registration_submissions (campaign_id, status);

create table if not exists public.community_registration_residents (
  id                         uuid        not null default gen_random_uuid() primary key,
  submission_id              uuid        not null,
  campaign_id                uuid        not null,
  community_id               uuid        not null,
  campaign_unit_id           uuid        not null,
  house_id                   uuid        not null,
  position                   integer     not null
                                           constraint cr_residents_position_positive
                                           check (position > 0),
  full_name                  text        not null
                                           constraint cr_residents_full_name_not_blank
                                           check (btrim(full_name) <> ''),
  email                      text,
  phone                      text,
  normalized_full_name       text,
  normalized_email           text,
  normalized_phone           text,
  relationship_to_house      text        not null default 'unknown'
                                           constraint cr_residents_relationship_check
                                           check (relationship_to_house in (
                                             'owner', 'tenant', 'family',
                                             'other', 'unknown'
                                           )),
  is_owner_reference         boolean     not null default false,
  validation_status          text        not null default 'unchecked'
                                           constraint cr_residents_validation_status_check
                                           check (validation_status in (
                                             'unchecked', 'valid',
                                             'needs_review', 'blocked_duplicate'
                                           )),
  activation_queue_id        uuid,
  conversion_status          text        not null default 'not_ready'
                                           constraint cr_residents_conversion_status_check
                                           check (conversion_status in (
                                             'not_ready', 'pending',
                                             'prepared', 'skipped_duplicate',
                                             'blocked_existing_active', 'failed'
                                           )),
  conversion_attempt_count   integer     not null default 0
                                           constraint cr_residents_conversion_attempts_nonnegative
                                           check (conversion_attempt_count >= 0),
  conversion_last_error      text,
  converted_at               timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint cr_residents_submission_identity_fk
    foreign key (submission_id, campaign_id, community_id, campaign_unit_id, house_id)
    references public.community_registration_submissions(id, campaign_id, community_id, campaign_unit_id, house_id)
    on delete restrict,
  constraint cr_residents_activation_queue_fk
    foreign key (activation_queue_id, community_id)
    references public.resident_activation_queue(id, community_id)
    on delete set null (activation_queue_id),
  constraint cr_residents_submission_position_unique
    unique (submission_id, position),
  constraint cr_residents_activation_queue_unique
    unique (activation_queue_id),
  constraint cr_residents_queue_requires_prepared
    check (
      activation_queue_id is null
      or (conversion_status = 'prepared' and converted_at is not null)
    ),
  constraint cr_residents_prepared_requires_queue
    check (conversion_status <> 'prepared' or activation_queue_id is not null),
  constraint cr_residents_failed_requires_attempt
    check (conversion_status <> 'failed' or conversion_attempt_count > 0),
  constraint cr_residents_last_error_only_on_failure
    check (conversion_last_error is null or conversion_status = 'failed')
);

create index if not exists idx_cr_residents_submission_position
  on public.community_registration_residents (submission_id, position);

create index if not exists idx_cr_residents_campaign_conversion
  on public.community_registration_residents (campaign_id, conversion_status);

create index if not exists idx_cr_residents_normalized_email
  on public.community_registration_residents (community_id, normalized_email)
  where normalized_email is not null;

create index if not exists idx_cr_residents_normalized_phone
  on public.community_registration_residents (community_id, normalized_phone)
  where normalized_phone is not null;

create index if not exists idx_cr_residents_pending_conversion
  on public.community_registration_residents (campaign_id, campaign_unit_id, id)
  where conversion_status in ('not_ready', 'pending', 'failed');

create table if not exists public.community_registration_access_tokens (
  id                  uuid        not null default gen_random_uuid() primary key,
  campaign_id         uuid        not null
                                  references public.community_registration_campaigns(id)
                                  on delete restrict,
  campaign_unit_id    uuid,
  submission_id       uuid,
  token_type          text        not null
                                  constraint cr_tokens_type_check
                                  check (token_type in (
                                    'campaign_access',
                                    'resident_edit',
                                    'patronato_review'
                                  )),
  token_hash          text        not null
                                  constraint cr_tokens_hash_not_blank
                                  check (length(btrim(token_hash)) >= 32),
  status              text        not null default 'active'
                                  constraint cr_tokens_status_check
                                  check (status in ('active', 'consumed', 'revoked', 'expired')),
  expires_at          timestamptz,
  consumed_at         timestamptz,
  revoked_at          timestamptz,
  created_by          uuid
                                  references auth.users(id)
                                  on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint cr_tokens_campaign_unit_fk
    foreign key (campaign_unit_id, campaign_id)
    references public.community_registration_units(id, campaign_id)
    on delete restrict,
  constraint cr_tokens_submission_scope_fk
    foreign key (submission_id, campaign_unit_id, campaign_id)
    references public.community_registration_submissions(id, campaign_unit_id, campaign_id)
    on delete restrict,
  constraint cr_tokens_id_campaign_unique
    unique (id, campaign_id),
  constraint cr_tokens_scope_check
    check (
      (
        token_type = 'campaign_access'
        and campaign_unit_id is null
        and submission_id is null
      )
      or (
        token_type = 'resident_edit'
        and campaign_unit_id is not null
        and submission_id is not null
      )
      or (
        token_type = 'patronato_review'
        and campaign_unit_id is null
        and submission_id is null
      )
    ),
  constraint cr_tokens_consumed_timestamp_check
    check ((status = 'consumed') = (consumed_at is not null)),
  constraint cr_tokens_revoked_timestamp_check
    check ((status = 'revoked') = (revoked_at is not null)),
  constraint cr_tokens_expired_requires_expiry
    check (status <> 'expired' or expires_at is not null),
  constraint cr_tokens_expiry_after_creation
    check (expires_at is null or expires_at > created_at),
  constraint cr_tokens_consumed_not_revoked
    check (consumed_at is null or revoked_at is null)
);

create unique index if not exists idx_cr_tokens_hash_unique
  on public.community_registration_access_tokens (token_hash);

create unique index if not exists idx_cr_tokens_one_active_edit_per_submission
  on public.community_registration_access_tokens (submission_id)
  where token_type = 'resident_edit' and status = 'active';

create unique index if not exists idx_cr_tokens_one_active_campaign_access
  on public.community_registration_access_tokens (campaign_id)
  where token_type = 'campaign_access' and status = 'active';

create unique index if not exists idx_cr_tokens_one_active_patronato_review
  on public.community_registration_access_tokens (campaign_id)
  where token_type = 'patronato_review' and status = 'active';

create index if not exists idx_cr_tokens_campaign_type_status
  on public.community_registration_access_tokens (campaign_id, token_type, status);

create table if not exists public.community_registration_events (
  id                    uuid        not null default gen_random_uuid() primary key,
  campaign_id           uuid        not null
                                      references public.community_registration_campaigns(id)
                                      on delete restrict,
  campaign_unit_id      uuid,
  submission_id         uuid,
  event_type            text        not null
                                      constraint cr_events_type_check
                                      check (event_type in (
                                        'campaign_created',
                                        'campaign_opened',
                                        'campaign_paused',
                                        'campaign_closed',
                                        'unit_submitted',
                                        'edit_enabled',
                                        'edit_revoked',
                                        'submission_resubmitted',
                                        'unit_reset',
                                        'internal_correction',
                                        'marked_for_correction',
                                        'internal_reviewed',
                                        'patronato_confirmed',
                                        'conversion_prepared',
                                        'conversion_failed'
                                      )),
  actor_type            text        not null
                                      constraint cr_events_actor_type_check
                                      check (actor_type in (
                                        'resident_token',
                                        'patronato_token',
                                        'superadmin',
                                        'service_role',
                                        'system'
                                      )),
  actor_user_id         uuid
                                      references auth.users(id)
                                      on delete set null,
  access_token_id       uuid,
  metadata              jsonb       not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),

  constraint cr_events_unit_campaign_fk
    foreign key (campaign_unit_id, campaign_id)
    references public.community_registration_units(id, campaign_id)
    on delete restrict,
  constraint cr_events_submission_scope_fk
    foreign key (submission_id, campaign_unit_id, campaign_id)
    references public.community_registration_submissions(id, campaign_unit_id, campaign_id)
    on delete restrict,
  constraint cr_events_token_campaign_fk
    foreign key (access_token_id, campaign_id)
    references public.community_registration_access_tokens(id, campaign_id)
    on delete restrict,
  constraint cr_events_submission_requires_unit
    check (submission_id is null or campaign_unit_id is not null),
  constraint cr_events_actor_shape_check
    check (
      (
        actor_type in ('resident_token', 'patronato_token')
        and access_token_id is not null
        and actor_user_id is null
      )
      or (
        actor_type = 'superadmin'
        and actor_user_id is not null
      )
      or actor_type in ('service_role', 'system')
    ),
  constraint cr_events_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists idx_cr_events_campaign_created
  on public.community_registration_events (campaign_id, created_at desc);

create index if not exists idx_cr_events_unit_created
  on public.community_registration_events (campaign_unit_id, created_at desc)
  where campaign_unit_id is not null;

create index if not exists idx_cr_events_submission_created
  on public.community_registration_events (submission_id, created_at desc)
  where submission_id is not null;

create index if not exists idx_cr_events_type_created
  on public.community_registration_events (event_type, created_at desc);

drop trigger if exists trg_cr_campaigns_updated_at
  on public.community_registration_campaigns;
create trigger trg_cr_campaigns_updated_at
  before update on public.community_registration_campaigns
  for each row execute function public._touch_community_registration_updated_at();

drop trigger if exists trg_cr_units_updated_at
  on public.community_registration_units;
create trigger trg_cr_units_updated_at
  before update on public.community_registration_units
  for each row execute function public._touch_community_registration_updated_at();

drop trigger if exists trg_cr_submissions_updated_at
  on public.community_registration_submissions;
create trigger trg_cr_submissions_updated_at
  before update on public.community_registration_submissions
  for each row execute function public._touch_community_registration_updated_at();

drop trigger if exists trg_cr_residents_updated_at
  on public.community_registration_residents;
create trigger trg_cr_residents_updated_at
  before update on public.community_registration_residents
  for each row execute function public._touch_community_registration_updated_at();

drop trigger if exists trg_cr_tokens_updated_at
  on public.community_registration_access_tokens;
create trigger trg_cr_tokens_updated_at
  before update on public.community_registration_access_tokens
  for each row execute function public._touch_community_registration_updated_at();

alter table public.community_registration_campaigns enable row level security;
alter table public.community_registration_units enable row level security;
alter table public.community_registration_submissions enable row level security;
alter table public.community_registration_residents enable row level security;
alter table public.community_registration_access_tokens enable row level security;
alter table public.community_registration_events enable row level security;

revoke all on table public.community_registration_campaigns from public, anon, authenticated;
revoke all on table public.community_registration_units from public, anon, authenticated;
revoke all on table public.community_registration_submissions from public, anon, authenticated;
revoke all on table public.community_registration_residents from public, anon, authenticated;
revoke all on table public.community_registration_access_tokens from public, anon, authenticated;
revoke all on table public.community_registration_events from public, anon, authenticated;

comment on table public.community_registration_campaigns is
  'Community Registration campaign configuration. Captures public registration scope only; does not create users or activation queue rows.';

comment on table public.community_registration_units is
  'Per-campaign association to an existing house. Tracks current operational state for the house inside the registration campaign.';

comment on table public.community_registration_submissions is
  'Versioned household submission. Submitted versions are preserved; corrections create new versions rather than overwriting evidence.';

comment on table public.community_registration_residents is
  'Residents declared inside a registration submission. Optional activation_queue_id is set only by future reviewed conversion.';

comment on table public.community_registration_access_tokens is
  'Hash-only access tokens for campaign, resident edit, or patronato review scopes. Plain tokens are never stored.';

comment on table public.community_registration_events is
  'Audit trail for registration actions. Metadata must stay minimal and must not duplicate full PII payloads.';
