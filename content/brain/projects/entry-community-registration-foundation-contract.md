# ENTRY Community Registration Foundation Contract

**Mission:** `ENTRY-ONB-000`  
**Date:** 2026-08-05  
**Status:** foundation approved  
**Verdict:** `READY FOR ENTRY-ONB-001`  
**Scope:** architectural contract only. No product implementation, no Supabase writes, no migrations, no route/component changes.

## 1. Summary

**DECIDED:** ENTRY Community Registration will be implemented first in Minerva Console as a public web + internal admin module. It will capture unreviewed resident/household data into new pre-onboarding entities, then convert approved residents into `resident_activation_queue`.

**DECIDED:** `resident_activation_queue` is the canonical output boundary. From that point forward, the existing PIN/invitation/activation flow remains in charge of account creation.

**DECIDED:** ENTRY mobile is not part of initial capture. It continues to consume activated users and the existing activation-by-PIN flow.

**DECIDED:** New Community Registration schema objects must be forward-only migrations in Minerva Console. Historical live migrations are operational baseline and will not be rewritten.

## 2. Verified Sources

| Source | Status | Evidence |
| --- | --- | --- |
| Initial analysis | CONFIRMED | `content/brain/harness/ENTRY_COMMUNITY_ONBOARDING_ANALYSIS.md`, read fully for `ENTRY-ONB-000`. |
| Phase 0 reconciliation | CONFIRMED | `content/brain/projects/entry-community-onboarding-phase-0-reconciliation.md`, read fully for `ENTRY-ONB-000`. |
| Decision artifact | DECIDED | `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`. |
| Brain rules | CONFIRMED | `content/brain/harness/05_AGENT_RULES.md`: Brain stores no raw product operational data. |
| Minerva Console repo | CONFIRMED | `D:\Dev\minerva-console`; current checkout `codex/minerva-console-auth-recovery-001` at `60589e5`; newer local ENTRY branch `codex/entry-first-door-patronato-package-v1` at `94d895d`. |
| ENTRY mobile repo | CONFIRMED | `D:\Dev\node-bridge-foundation`; branch `entry-reset-003-recovery-deeplink-evidence`; HEAD `79706be`. |
| Supabase live | CONFIRMED | `gate-project-dev`, ref `ytzvislhvrcdtkbtpbmu`, read-only catalog inspection. |
| Next.js local docs | CONFIRMED | `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md` documents route groups and independent layouts. |

## 3. Authority Map

| Area | Official source | Consumers | Observations |
| --- | --- | --- | --- |
| Brain and decisions | Minerva Console | Human/AI agents | DEC-0007 and this contract live under `content/brain/**`. |
| Administrative UI | Minerva Console | ENTRY superadmin | Existing console routes live under `app/(console)/products/entry/**` and inherit `requireSuperadmin()`. |
| Public web registration | Minerva Console | Residents | Future route outside `(console)`, preferred `app/(public)/entry/register/[campaignSlug]`. |
| Mobile | ENTRY mobile | Active residents | No initial capture responsibility; continues PIN activation and resident app flows. |
| Live schema | Supabase `gate-project-dev` | Console and mobile | Operational baseline. Inspected read-only; no production rows stored in Brain. |
| New migrations | Minerva Console | Supabase | Forward-only source of truth for new Community Registration objects. |
| New activation lane | `resident_activation_queue` + PINs | Console/mobile | Canonical post-approval path. |
| Legacy activation | Existing legacy tables/functions | Existing compatibility | Kept intact; no new `ENTRY-ONB-*` dependency without later decision. |

## 4. Existing Operational Schema Contract

### 4.1 Tables

| Table | Purpose | Required integration fields | Keys/constraints/indexes | RLS/policies | Writers/consumers | Versioned definition | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `communities` | Community master record. | `id`, `name`, `community_code`, `is_active`, `unit_label`. | PK `id`; unique `community_code`; check `gate_status in ACTIVE/OUT_OF_SERVICE`; index `idx_communities_code`. | RLS enabled; own-community select; superadmin full access. | Created by `create_community_v1`; consumed by Console community pages and related FKs. | LIVE_ONLY for local current; live RPC exists. | New registration must scope every campaign by `community_id`. |
| `houses` | Existing residential units. | `id`, `community_id`, `house_label`, `is_active`; optional geolocation fields. | PK `id`; FK `community_id`; unique `(community_id, house_label)`; indexes on community, active, `normalize_unit_label(house_label)`. | RLS enabled; role-based select; admin/superadmin update; delete denied. | `create_houses_bulk_v2`; Console unit imports; mobile/admin house flows. | LIVE_ONLY for base table; local code consumes RPC. | Registration lookup must normalize labels and avoid exposing full household data. |
| `resident_activation_queue` | Canonical prepared-resident queue before account activation. | `community_id`, `unit_label`, `resident_name`, `activation_method`, `status`, `source`, `raw_data`; optional `house_id`, `phone`, `email`, `is_owner_reference`, `suggested_username`, `created_by`. | PK `id`; FK `community_id`; FK `house_id` set null; checks `activation_method in email/username_pin/phone_pin/unknown`, `status in pending/invited/pin_generated/activated/skipped/failed`; indexes on community, normalized unit, email, phone, status, username, activated user. | RLS enabled; `superadmin_all`. | Written by `confirm_resident_bulk_import_v1`, PIN/campaign/activation RPCs; consumed by Console activation and campaign actions. | LIVE table; related local migrations cover pins/activation/campaigns but not base creation. | This is output boundary only; do not store raw public submissions here. |
| `resident_activation_pins` | PIN credentials for queue rows. | `queue_id`, `community_id`, `pin_hash`, `visible_code`, `status`, `expires_at`. | PK `id`; FK queue/community; check `status in pending/used/expired`; unique pending PIN per queue. | RLS enabled; policies/grants must remain protected by RPCs. | Written by `generate_resident_activation_pins_v1` and worker; consumed by `/activate`, mobile activation. | `supabase/migrations/20260502140000_generate_resident_activation_pins_v1.sql`. | Registration must not write pins directly. |
| `profiles` | Active user profile. | `user_id`, `community_id`, `role`, `full_name`, `is_active`, `auth_type`; optional `house_id`, `phone`, `username`. | PK `user_id`; FKs community/house/auth user; checks role/house and auth type; unique username/synthetic email indexes. | RLS enabled; self/admin/community policies; delete denied. | Written by activation completion and user admin flows. | Base live; activation local migration writes it. | Public capture must never insert here. |
| `community_members` | User membership/role per community. | `community_id`, `user_id`, `role`, `is_active`. | PK `id`; FK community/auth user; unique `(community_id,user_id)`; indexes by user/community/role/active. | RLS enabled; self/admin policies; delete denied. | Written by activation completion and admin user flows. | Base live; activation local migration writes it. | Public capture must never insert here. |
| `house_residents` | Active resident-house linkage. | `community_id`, `house_id`, `user_id`, `is_primary`, `is_active`. | PK `id`; FKs community/house/auth user; unique `(user_id,community_id,house_id)`; unique active primary per community and active user-house. | RLS enabled; self/admin policies. | Written by activation completion and admin flows. | Base live; activation local migration writes it. | Conversion must not bypass activation semantics. |
| `onboarding_campaigns` | Existing activation email/SMS/WhatsApp campaign for queue rows. | `community_id`, `channel`, `status`, counters, `send_rate_per_minute`, `dry_run`. | PK `id`; status/channel/rate checks; FK community; one running/paused campaign per community. | RLS enabled; `superadmin_all`. | `start_onboarding_email_campaign_v1`; `send-onboarding-email-batch`. | `supabase/migrations/20260518010000_create_onboarding_campaigns.sql`. | This is activation messaging, not public registration. |
| `onboarding_campaign_messages` | Message rows per activation queue item. | `campaign_id`, `community_id`, `activation_queue_id`, `channel`, `status`, recipient fields. | PK `id`; FKs campaign/community/queue; unique `(campaign_id,activation_queue_id,channel)`; status/channel checks. | RLS enabled; `superadmin_all`. | Written by campaign RPC and worker. | `supabase/migrations/20260518010000_create_onboarding_campaigns.sql`. | Do not reuse for pre-onboarding capture. |
| `resident_invites` | Legacy invite lane. | `community_id`, `house_id`, `email`, `full_name`, `role`, `invite_code`, `status`, `created_by`. | PK `id`; unique `invite_code`; role/status/email/code checks; FKs community/house/profiles. | RLS enabled; admin insert/select/update. | Legacy mobile admin invite UI, `claim-resident-invite`, `activate-account-by-code`. | Live/mobile legacy; not canonical for ONB. | Keep intact; no new dependency. |
| `account_activation_codes` | Legacy username/recovery activation code lane. | `user_id`, `community_id`, `code_hash`, `activation_type`, `status`, `expires_at`. | PK `id`; checks activation type/status; FKs auth users/community; indexes for pending recovery/status. | RLS enabled; direct anon/authenticated access denied. | Legacy Edge Functions and recovery/admin flows. | Live/mobile legacy. | Reference only; not Community Registration output. |
| `security_event_log` | Security events/rate/abuse trace. | `event_type`, `success`, `metadata`; optional `user_id`, `identifier`. | PK `id`; indexes by event, identifier, user. | RLS enabled; own select; delete denied. | Auth and activation RPCs/functions. | Base live. | New public RPCs should record non-sensitive security events or use registration events. |
| `superadmin_audit_log` | Superadmin audit. | `action`, `metadata`; optional actor/target. | PK `id`; FK actor user; indexes by action/actor/created. | RLS enabled; superadmin select. | `_sa_audit_log` and superadmin RPCs. | Base live; helper RPC live. | Internal conversions should audit here or in new registration events. |
| `community_admin_activity_log` | Community admin activity trail. | `community_id`, `action_type`, `target_type`, `summary`, `metadata`. | PK `id`; FKs community/auth user; indexes by community/action/actor. | RLS enabled; admin read policy. | Existing triggers for admin activity. | Live table. | Patronato/admin views may need separate limited audit, not direct public exposure. |

### 4.2 RPCs and Functions

| RPC/function | Purpose | Writes | Consumers | Versioned definition | Risk for registration |
| --- | --- | --- | --- | --- | --- |
| `create_community_v1` | Create community and settings. | Communities/settings, not RAQ. | `features/entry/communities/actions.ts:264`. | Live only for current local branch. | Respect existing community IDs; do not recreate communities. |
| `create_houses_bulk_v2` | Create/import houses by label. | `houses`. | `features/entry/communities/actions.ts:219`, `:325`. | Live only for current local branch. | Registration units should reference existing `houses.id` when possible. |
| `confirm_resident_bulk_import_v1` | Import reviewed rows into `resident_activation_queue`. | Writes RAQ only. | `features/entry/communities/actions.ts:384`. | Live only; body inspected read-only. | Defines current queue row contract and duplicate behavior. |
| `list_resident_activation_queue_v1` | List activation queue by community/status. | None. | `features/entry/activation/actions.ts:298`, `features/entry/onboardingCampaigns/actions.ts:38`. | Live only. | Future conversion results must be visible here. |
| `generate_resident_activation_pins_v1` | Generate PINs for queue rows. | RAQ + pins. | `features/entry/activation/pinActions.ts:51`. | Local migration `20260502140000...`. | Registration must not bypass; use after queue conversion. |
| `validate_resident_activation_pin_v1` | Validate PIN before account setup. | Security log / pin attempt metadata; references RAQ + pins. | Console `/activate`; mobile `app/activate-account.tsx:470`. | Local migrations `20260502160000...`, `20260518000000...`. | Public registration is not PIN validation. |
| `complete_resident_activation_pin_v1` | Create Auth user/profile/member/house resident and mark queue/pin used. | RAQ, pins, `auth.users`, profiles, members, house residents. | Console `/activate`; mobile `app/activate-account.tsx:633`; Console batch action. | Local migrations `20260502170000...`, `20260517223000...`. | Final account creation remains here. |
| `start_onboarding_email_campaign_v1` | Create activation message campaign from RAQ rows. | Onboarding campaigns/messages; references RAQ. | `features/entry/onboardingCampaigns/actions.ts:140`. | Local migration `20260518011000...`. | Activation messaging after conversion only. |
| `worker_generate_resident_activation_pin_v1` | Worker-only PIN generation for email batch. | RAQ + pins. | `send-onboarding-email-batch`. | Local migration `20260519010000...`. | Worker remains post-conversion. |
| `normalize_unit_label` | Normalizes unit/house labels. | None. | Indexes on `houses` and RAQ; `confirm_resident_bulk_import_v1`. | Live function. | Future lookup/dedupe must use same semantics or call RPC. |
| `ensure_resident_activation_email_identity` | Trigger helper for RAQ email identity. | Trigger context on RAQ. | RAQ trigger. | Live function. | New conversion must respect RAQ trigger behavior. |
| `get_pending_activation_items` | Legacy/mobile pending activation list. | None. | ENTRY mobile admin pending invites. | Live/mobile legacy. | Reference only. |
| `create_resident_invite`, `cancel_resident_invite` | Legacy invite management. | `resident_invites`. | ENTRY mobile admin invite screens. | Live/mobile legacy. | Do not use for Community Registration. |
| `expire_stale_activation_codes` | Legacy activation code maintenance. | `account_activation_codes`. | `activate-account-by-code`. | Live/mobile legacy. | Do not add ONB dependency. |

## 5. Output Contract To Activation

### 5.1 Conceptual Contract

```text
ApprovedRegistrationResident
        -> validate
        -> normalize
        -> deduplicate
        -> controlled insert/upsert
ResidentActivationQueueRow
```

**DECIDED:** The output operation is internal, explicit, audited and idempotent. It is not public submission.

### 5.2 ApprovedRegistrationResident

The approved resident record must supply:

| Field | Status | Mapping / rule |
| --- | --- | --- |
| `registration_campaign_id` | DECIDED | Stored in RAQ `raw_data` for traceability; future schema may add dedicated link only in `ENTRY-ONB-001` if approved. |
| `registration_submission_id` | DECIDED | Stored in RAQ `raw_data`; used for idempotency decisions outside existing RAQ schema. |
| `registration_resident_id` | DECIDED | Stored in RAQ `raw_data`; required traceability identifier for each resident. |
| `community_id` | CONFIRMED required | Maps to RAQ `community_id`; must match campaign and house community. |
| `house_id` | CONFIRMED optional but recommended | Maps to RAQ `house_id`; may be null only when unit matching is unresolved and conversion policy permits. |
| `unit_label` | CONFIRMED required | Maps to RAQ `unit_label`; normalize with `normalize_unit_label`. |
| `resident_name` | CONFIRMED required | Maps to RAQ `resident_name`; current import RPC rejects missing name. |
| `email` | CONFIRMED optional | Maps to RAQ `email`; lower/trim if present. Email implies `activation_method='email'` in current import logic. |
| `phone` | CONFIRMED optional | Maps to RAQ `phone`; current import stores phone but does not make it primary activation when email absent. |
| `is_owner_reference` | CONFIRMED optional | Maps to RAQ `is_owner_reference`; current import accepts owner truthy values. |
| `suggested_username` | CONFIRMED optional/generated | Current import generates via `_raq_suggest_username` when no email and name exists. |
| `activation_method` | CONFIRMED required | Must be one of `email`, `username_pin`, `phone_pin`, `unknown`; current logic uses `email` when email exists, else `username_pin` when name exists. |
| `status` | CONFIRMED required | Initial RAQ status is `pending`. |
| `source` | CONFIRMED required | Must identify this path, e.g. `community_registration_v1`; existing import uses `excel_import_v2`. |
| `raw_data` | CONFIRMED required | Must include non-PII-minimized source references and normalized fields needed for audit/debug; do not store secrets. |
| `created_by` | CONFIRMED optional | Internal actor when conversion is superadmin-driven; may be auth uid. |

### 5.3 ResidentActivationQueueRow

Minimum controlled insert:

```text
community_id: uuid
house_id: uuid | null
unit_label: text
resident_name: text
phone: text | null
email: text | null
is_owner_reference: boolean | null
suggested_username: text | null
activation_method: text
status: 'pending'
source: 'community_registration_v1'
raw_data: jsonb with source identifiers
created_by: uuid | null
```

**CONFIRMED:** live `confirm_resident_bulk_import_v1` inserts these RAQ columns: `community_id`, `house_id`, `unit_label`, `resident_name`, `phone`, `email`, `is_owner_reference`, `suggested_username`, `activation_method`, `status`, `source`, `raw_data`, `created_by`.

### 5.4 Validation And Normalization Rules

| Rule | Status | Evidence / contract |
| --- | --- | --- |
| Unit label required. | CONFIRMED | Live import flags `missing_unit_label`. |
| Resident name required. | CONFIRMED | Live import flags `missing_resident_name`. |
| Unit label normalized. | CONFIRMED | Live import uses `public.normalize_unit_label`. |
| Email lower/trim. | CONFIRMED | Live import lower/trims `email`. |
| House match by community + normalized house label. | CONFIRMED | Live import matches `houses` by `normalize_unit_label(house_label)`. |
| Duplicate prepared resident. | CONFIRMED | Live import checks same community, normalized unit label and lower resident name in RAQ; returns `skipped_duplicate`. |
| Already active resident. | DECIDED | Future conversion must check profiles/community_members/house_residents and mark per-resident result instead of creating duplicates. Existing import only checks RAQ duplicate. |
| Wrong house. | DECIDED | Conversion must reject or hold the resident when `house_id` does not belong to `community_id` or normalized label mismatch cannot be resolved. |
| Existing email. | DECIDED | Conversion must check live active profile/Auth compatibility before RAQ insert; if conflict exists, return per-resident duplicate/conflict result. |
| Existing phone. | DECIDED | Conversion should check current queue/profile phone candidates and return warning/conflict depending on strictness chosen in `ENTRY-ONB-001`. |
| Idempotency. | DECIDED | Existing RAQ lacks a dedicated source FK. MVP idempotency must use registration source IDs in `raw_data` plus a conversion ledger/table in new schema. |

### 5.5 Output Results

Each conversion attempt must return per resident:

- `prepared`: inserted into RAQ;
- `already_prepared`: source resident already has RAQ row;
- `skipped_duplicate`: existing RAQ duplicate by unit/name or stronger future rule;
- `blocked_existing_active`: active user/profile/member conflict;
- `blocked_wrong_house`: house/community mismatch;
- `failed_validation`: required field missing or invalid.

**DECIDED:** A house/submission must not be marked processed if required resident rows fail.

## 6. New Activation Lane

| Layer | Objects | Current state | Usage |
| --- | --- | --- | --- |
| Prepared residents | `resident_activation_queue` | CONFIRMED live, RLS enabled. | Post-review output boundary. |
| PINs | `resident_activation_pins` | CONFIRMED live/local migration. | Generated by admin or worker. |
| Validation | `validate_resident_activation_pin_v1` | CONFIRMED live/local migration; Console and mobile consume. | Resident validates PIN/link. |
| Completion | `complete_resident_activation_pin_v1` | CONFIRMED live/local migration; writes Auth/profile/member/house resident. | Final account creation. |
| Campaigns | `onboarding_campaigns`, `onboarding_campaign_messages`, `send-onboarding-email-batch` | CONFIRMED live/local. | Send activation links/PINs after queue prep. |
| Screens | Console `/activate`; mobile `app/activate-account.tsx` | CONFIRMED. | Activation only, not initial registration. |

**DECIDED:** Community Registration uses this lane only after internal approval/conversion.

## 7. Legacy Lane

| Legacy area | Objects | Current dependency | Why it remains |
| --- | --- | --- | --- |
| Invite table | `resident_invites` | Mobile admin create/pending invite screens and legacy functions. | Existing compatibility and fallback path. |
| Code table | `account_activation_codes` | Username residents, recovery codes, activation-code functions. | Existing username/recovery functionality. |
| Edge Functions | `claim-resident-invite`, `activate-account-by-code`, `validate-activation-code`, `create-username-resident`, `regenerate-username-activation-code`, `admin-generate-recovery-code` | ENTRY mobile paths and admin/recovery flows. | Must stay intact until separate deprecation mission. |
| Mobile fallback | `app/activate-account.tsx` invokes `activate-account-by-code` after PIN RPC path. | Active fallback. | Removing it risks breaking existing users/invites. |

**DECIDED:** Community Registration must not use this lane.

Project rule:

> Ninguna mision `ENTRY-ONB-*` debe agregar nuevas dependencias al carril legacy, salvo autorizacion expresa documentada en una decision posterior.

## 8. Responsibilities By System

### Public Page

**DECIDED:** The public page is responsible for instructions, campaign resolution, neutral unit lookup/validation, resident capture, summary, submit, neutral status, and token-authorized edit reopening.

It must not require an ENTRY account, inherit `requireSuperadmin()`, expose administrative capabilities, show previously registered resident names in public lookup, or create active users.

### Community Registration Backend

**DECIDED:** The backend owns campaign validation, resident limits, normalization, concurrency, locking, versioned corrections, reset without evidence destruction, audit events, minimal public operations, and idempotent conversion.

### Internal Console

**DECIDED:** Console owns campaign creation/configuration, instructions, per-house limit changes, review, internal edits, allow-edit, reset, confirmation, conversion to activation, and operational audit.

### Patronato

**DECIDED:** Patronato can see authorized progress, review authorized information, mark observations, confirm houses and confirm the consolidated campaign. Patronato must not use superadmin, reset registrations, change structure, or convert users.

### ENTRY Mobile

**DECIDED:** Mobile does not participate in initial capture. It continues PIN activation and active-resident app usage.

### Supabase

**DECIDED:** Supabase owns persistence, constraints, RLS, secure RPCs, audit and transactional operations.

## 9. Forward-Only Migration Rules

| Rule | Status | Conflict |
| --- | --- | --- |
| Every new table starts in a migration. | DECIDED | No conflict. |
| Every new RPC starts in a migration. | DECIDED | No conflict for new objects. |
| Every new RLS policy starts in a migration. | DECIDED | No conflict. |
| Every later change gets a later migration. | DECIDED | No conflict. |
| Do not edit applied migrations to simulate live history. | DECIDED | No conflict; requires discipline because historical live versions differ from local timestamps. |
| Do not create objects manually in Dashboard. | DECIDED | No conflict. |
| Before apply: diff review, SQL review, safe test, human approval. | DECIDED | No conflict. |
| After apply: catalog verify, tests, evidence record. | DECIDED | No conflict. |
| Regenerate TypeScript types after approved schema changes. | DECIDED | No conflict; not part of `ENTRY-ONB-000`. |
| Minerva Console stores initial Community Registration migrations. | DECIDED | No conflict. |

**CONFIRMED:** live has 292 historical migrations and local timestamps do not map one-to-one for multiple equivalent objects. This does not block forward-only new migrations.

## 10. MVP Decisions

| Topic | Decision | Status |
| --- | --- | --- |
| Campaign identity | Public slug must be non-sequential; use separate secret token or a slug with sufficient entropy; status and dates are server-side. | DECIDED |
| Unit identity | Do not expose full household data; use normalized label search with neutral responses; never show existing resident names publicly. | DECIDED |
| Edit access | Random edit token, hash-only storage, scoped to submission/unit, expirable, revocable, locked after resubmit, fully audited. | DECIDED |
| Patronato access | No superadmin; limited per campaign; prefer authenticated identity or magic link/token with bounded permissions; no reset/structure/conversion power. | DECIDED |
| Conversion unit | Operate by house/submission as the logical transaction boundary; campaign batch processing may call per-house units. | DECIDED |
| Conversion retry | Idempotent per resident and per submission. | DECIDED |
| Partial failure | Do not mark a house/submission processed if required resident rows fail. | DECIDED |
| Legacy | Do not add new dependency to legacy invite/code functions. | DECIDED |
| Mobile | No mobile change for MVP. | DECIDED |

## 11. Risks

| Risk | Status | Mitigation |
| --- | --- | --- |
| Historical migration drift. | CONFIRMED | Treat live as baseline; all new objects forward-only; record catalog evidence. |
| Wrong branch/worktree for implementation. | OPEN, not model-blocking | Before `ENTRY-ONB-001`, choose the intended branch/worktree. Current checkout is not the newest local ENTRY branch. |
| Public PII exposure through WhatsApp links. | CONFIRMED | Neutral lookup, token-scoped edit, no public display of registered residents. |
| Duplicate residents/users. | CONFIRMED | Conversion checks RAQ, profiles/members/house residents, email/phone/normalized unit/name; idempotency ledger in new schema. |
| Security-definer RPC exposure. | CONFIRMED | Revoke default public execute as appropriate; explicit role grants; internal checks; RLS default deny. |
| Legacy lane confusion. | CONFIRMED | DEC-0007 legacy rule; no new ONB dependency. |
| Patronato role not modeled today. | CONFIRMED | MVP bounded token/magic-link access; full role can be Phase 2. |

## 12. Readiness Criteria

| Criterion | Status | Evidence |
| --- | --- | --- |
| Repository principal confirmed. | READY | DEC-0007 D-001; Minerva Console owns web/admin/migrations. |
| Activation lane confirmed. | READY | DEC-0007 D-002; RAQ + PIN + validation/completion RPCs. |
| `resident_activation_queue` contract documented. | READY | Section 5 of this contract. |
| Legacy lane delimited. | READY | Section 7 and DEC-0007 legacy rule. |
| Migration strategy confirmed. | READY | Section 9 and DEC-0007 D-005. |
| Public page location confirmed. | READY | Section 8; preferred `app/(public)/entry/register/[campaignSlug]`. |
| Actors and responsibilities delimited. | READY | Section 8. |
| Live objects inventoried without PII. | READY | Section 4. |
| Blocking risks identified. | READY | Section 11; none block model design. |
| No open question affects initial data model. | READY | Remaining branch/worktree choice is operational, not data-model blocking. |

## 13. Verdict

All foundation prerequisites required by `ENTRY-ONB-000` are closed. `ENTRY-ONB-001` may begin as a schema/model design mission, but must not apply migrations or production Supabase changes without explicit authorization and review.

## READY FOR ENTRY-ONB-001
