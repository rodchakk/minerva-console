# ENTRY Community Registration Schema v1

**Mission:** `ENTRY-ONB-001`  
**Date:** 2026-08-05  
**Branch/worktree:** `codex/entry-onb-001-schema` at `.worktrees/entry-onb-001`  
**Base:** local stable `master`, commit `60589e5a5538915dbb58a5c96ab501e1201c2bfe`  
**Migration:** `supabase/migrations/20260805000100_create_entry_community_registration_schema_v1.sql`  
**Status:** local design and migration only; not applied.

## 1. Summary

`ENTRY-ONB-001` creates the local schema proposal for Community Registration / Pre-Onboarding. The schema captures public, unreviewed household data in new `community_registration_*` tables and preserves history until a later reviewed backend mission prepares approved residents for `resident_activation_queue`.

**DECIDED:** no public submission data is written directly to active user tables or final activation rows.  
**DECIDED:** `resident_activation_queue` remains the future output boundary.  
**DECIDED:** no dependency is added to the legacy invite/code lane.

## 2. Applied Decisions

| Decision | Status | Application |
| --- | --- | --- |
| Minerva Console is principal repo. | DECIDED | Migration and design doc live in this repo/worktree. |
| ENTRY mobile unchanged. | DECIDED | No files under `D:\Dev\node-bridge-foundation` were modified. |
| Data separation. | DECIDED | New `community_registration_*` tables hold registration state. |
| Activation lane. | DECIDED | Residents include nullable `activation_queue_id` only for future conversion traceability. |
| Legacy lane isolated. | DECIDED | Migration contains no references to legacy invite/code objects or Edge Functions. |
| Forward-only migrations. | DECIDED | One new local migration, not applied. |
| RLS deny-by-default. | DECIDED | RLS enabled on all new tables; no direct access policies are created. |

## 3. Entity Diagram

```text
communities
  -> community_registration_campaigns
       -> community_registration_units -> houses
            -> community_registration_submissions
                 -> community_registration_residents
                      -> resident_activation_queue (nullable future FK)
            -> community_registration_access_tokens
       -> community_registration_events
```

## 4. Entities And Fields

### `community_registration_campaigns`

| Field | Purpose |
| --- | --- |
| `id` | Campaign primary key. |
| `community_id` | Tenant scope, FK to `communities`. |
| `internal_name` | Console/internal campaign name. |
| `public_title` | Resident-facing title. |
| `public_instructions` | Resident-facing instructions. |
| `public_slug` | Non-sequential public identifier; unique lower-case index. |
| `status` | Campaign state. |
| `default_resident_limit` | Default resident limit; initial default `3`, positive, not a max. |
| `opens_at`, `closes_at` | Server-side availability window. |
| `confirmed_at`, `processed_at`, `closed_at` | Later lifecycle timestamps. |
| `created_by`, `updated_by` | Internal actors. |
| `created_at`, `updated_at` | Standard timestamps. |

### `community_registration_units`

| Field | Purpose |
| --- | --- |
| `id` | Campaign unit primary key. |
| `campaign_id`, `community_id` | Campaign and tenant scope. |
| `house_id` | Existing house. Composite FK prevents cross-community house association. |
| `unit_label_snapshot` | Stable visible label for this campaign. |
| `normalized_unit_label` | Search/dedupe label using same concept as live `normalize_unit_label`. |
| `resident_limit_override` | Positive per-house override, nullable. |
| `status` | Operational source of truth for the house inside the campaign. |
| review/confirmation/processing timestamps | Operational lifecycle markers. |
| `created_at`, `updated_at` | Standard timestamps. |

### `community_registration_submissions`

| Field | Purpose |
| --- | --- |
| `id` | Submission version primary key. |
| `campaign_unit_id`, `campaign_id`, `community_id`, `house_id` | Denormalized tenant and scope fields enforced by composite FK. |
| `version_number` | Unique, positive version per campaign unit. |
| `status` | Submission lifecycle. |
| `submitted_at`, `locked_at` | Submission/lock timestamps. |
| `invalidated_at`, `invalidated_reason` | Reset/correction invalidation evidence. |
| `reviewed_at`, `reviewed_by` | Internal ENTRY review. |
| `patronato_confirmed_at`, `patronato_confirmed_by` | Patronato confirmation trace. |
| `converted_at` | Future conversion marker. |
| `previous_submission_id` | Optional previous version pointer, constrained to the same campaign unit. |
| `created_at`, `updated_at` | Standard timestamps. |

### `community_registration_residents`

| Field | Purpose |
| --- | --- |
| `id` | Resident row primary key. |
| submission/campaign/community/unit/house IDs | Scope and tenant isolation. |
| `position` | Unique resident order within a submission. |
| `full_name` | Required resident name. |
| `email`, `phone` | Optional contact fields; not primary keys. |
| `normalized_*` | Future dedupe/search values populated by backend. |
| `relationship_to_house`, `is_owner_reference` | Occupancy/owner context. |
| `validation_status` | Pre-conversion validation marker. |
| `activation_queue_id` | Nullable future FK to `resident_activation_queue`; unique when present. |
| conversion fields | Conversion status, attempts, last error and converted timestamp. |
| `created_at`, `updated_at` | Standard timestamps. |

### `community_registration_access_tokens`

| Field | Purpose |
| --- | --- |
| `id` | Token row primary key. |
| `campaign_id`, `campaign_unit_id`, `submission_id` | Token scope. |
| `token_type` | `campaign_access`, `resident_edit`, or `patronato_review`. |
| `token_hash` | Hash only; plaintext never stored. |
| `status` | `active`, `consumed`, `revoked`, or `expired`. |
| `expires_at`, `consumed_at`, `revoked_at` | Lifecycle timestamps. |
| `created_by`, `created_at`, `updated_at` | Actor and timestamps. |

### `community_registration_events`

| Field | Purpose |
| --- | --- |
| `id` | Event primary key. |
| `campaign_id`, `campaign_unit_id`, `submission_id` | Event scope. |
| `event_type` | Audited action type. |
| `actor_type`, `actor_user_id`, `access_token_id` | Actor trace without storing token plaintext. |
| `metadata` | Minimal JSON metadata only; no full PII payload copies. |
| `created_at` | Event timestamp. |

## 5. State Source Of Truth

**Strategy C: controlled combination with derivation, invariants and future transactional functions.**

`community_registration_units.status` is the operational current state used by dashboards and campaign progress. `community_registration_submissions.status` is the immutable/version lifecycle for each submitted payload. They are intentionally related but not identical.

Anti-contradiction controls:

- the current submission is derived from `campaign_unit_id` plus active submission statuses;
- only one active submission may exist per unit via partial unique index;
- previous submissions remain `superseded`, `invalidated`, or `converted`;
- future RPCs must update unit status, submission status, and events in one transaction.

This avoids a circular unit/submission pointer while still preserving a compact operational status for dashboards.

Allowed operational alignment:

| Unit status | Active submission state | Meaning |
| --- | --- | --- |
| `unregistered` | none | Available for registration. |
| `submitted` | `submitted` | Submitted and locked. |
| `edit_enabled` | `edit_enabled` | Correction authorized by active edit token. |
| `needs_correction` | `reviewed` or `submitted` plus event/reason | Reviewed with observation; future RPC owns exact transition. |
| `reviewed` | `reviewed` | ENTRY review complete. |
| `confirmed` | `confirmed` | Patronato confirmed. |
| `processed` | `converted` | Prepared for activation lane. |

`draft` remains only a submission state. The unit stays `unregistered` until a draft is submitted, so partial resident form activity does not make the house appear operationally registered.

## 6. Campaign State Machine

```text
draft -> open -> paused -> open
open -> review -> confirmed -> processed
open -> closed
paused -> closed
review -> closed
confirmed -> closed
```

`paused` is included because it represents a temporary operational stop that cannot be derived reliably from dates alone.

## 7. Unit State Machine

```text
unregistered -> submitted -> edit_enabled -> submitted
submitted -> needs_correction -> edit_enabled
submitted -> reviewed -> confirmed -> processed
submitted -> unregistered (reset transaction)
reviewed -> needs_correction
confirmed -> needs_correction
```

Reset is not a final persistent unit status. A reset invalidates the active submission, records an event, revokes active tokens, and returns the unit to `unregistered`.

## 8. Submission Cycle

```text
draft -> submitted -> edit_enabled -> superseded
submitted -> reviewed -> confirmed -> converted
submitted -> invalidated
reviewed -> invalidated
confirmed -> invalidated
```

Submitted versions are immutable. Corrections create a new version linked by `previous_submission_id`; the old version becomes `superseded`. Invalidated versions are retained and never converted.

## 9. Limits

Effective limit:

```text
coalesce(
  community_registration_units.resident_limit_override,
  community_registration_campaigns.default_resident_limit
)
```

Schema rules:

- campaign default starts at `3`;
- campaign default must be positive;
- unit override is nullable or positive;
- no hardcoded maximum is added because Phase 0 did not confirm an operational max;
- residents are rows, not fixed columns.

Future submission RPCs must enforce the effective limit transactionally.

## 10. Edit Design

Tokens live in `community_registration_access_tokens`, not directly in submissions. This is the simplest secure MVP shape because tokens can be scoped, expired, consumed, revoked and audited without mutating submitted evidence.

`community_registration_access_tokens` is the only source of truth for secrets and authorizations. Campaigns store `public_slug`, configuration, status and dates; they do not store `access_token_hash` or patronato token hashes.

Token scopes enforced by constraints:

| Token type | Required scope | Prohibited scope | Active uniqueness |
| --- | --- | --- | --- |
| `campaign_access` | `campaign_id` | `campaign_unit_id`, `submission_id` | One active per campaign. |
| `resident_edit` | `campaign_id`, `campaign_unit_id`, `submission_id` | none | One active per submission. |
| `patronato_review` | `campaign_id` | `campaign_unit_id`, `submission_id` | One active per campaign. |

The schema enforces hash-only storage, global token hash uniqueness, consumed/revoked timestamp consistency, and no simultaneous consumed+revoked timestamps. Runtime expiry relative to `now()` remains a future backend validation because a check constraint cannot safely depend on the current time.

Edit flow supported by schema:

1. current submission is `submitted` and locked;
2. internal actor creates active `resident_edit` token hash scoped to submission/unit;
3. unit and submission become `edit_enabled`;
4. resident corrects;
5. future backend creates a new draft/submitted version;
6. old version becomes `superseded`;
7. token becomes `consumed` or `revoked`;
8. event records the change.

## 11. Reset Design

Future reset transaction:

1. lock `community_registration_units` row;
2. lock active/current submission;
3. set active submission to `invalidated`;
4. set `invalidated_at` and `invalidated_reason`;
5. set unit `status='unregistered'`;
6. revoke active edit tokens for the submission;
7. insert `unit_reset` event;
8. preserve residents and previous submission rows.

No hard delete is required for normal reset.

## 12. Conversion Traceability

Future conversion is prepared by:

- `community_registration_residents.activation_queue_id` nullable FK to `resident_activation_queue`;
- unique `activation_queue_id` so a queue row maps to only one pre-onboarding resident;
- `conversion_status`, `conversion_attempt_count`, `conversion_last_error`, and `converted_at`;
- `conversion_prepared` / `conversion_failed` events.

`conversion_status='prepared'` means the resident was successfully prepared into `resident_activation_queue`; it does not mean an Auth user was created. A separate conversion-attempt table remains a deferred option if retry history needs more detail than counters plus events.

## 13. Constraints

Principal constraints:

- campaign slug unique case-insensitively;
- one operationally active campaign per community for `open`, `paused`, `review`, or `confirmed`;
- campaign default limit positive;
- campaign open/close order valid;
- unit campaign/community composite FK;
- unit house/community composite FK;
- one house per campaign;
- one normalized unit label per campaign for unambiguous public lookup;
- unit limit override positive;
- unique submission version per unit;
- one active submission per unit;
- previous submission FK scoped to the same campaign unit;
- no reverse `superseded_by_submission_id` pointer;
- resident belongs to one submission identity;
- resident position unique within submission;
- activation queue mapping unique when present;
- token scopes must match `token_type`;
- active campaign, edit and patronato tokens are unique per equivalent scope;
- events referencing submissions/tokens must stay inside the same campaign/unit scope.

Rules left to future RPCs:

- effective resident limit count;
- allowed state transitions;
- token hash generation and comparison;
- closed campaign behavior;
- patronato permission checks;
- fuzzy duplicate checks.

## 14. Indexes

| Index | Purpose |
| --- | --- |
| `idx_cr_campaigns_public_slug_lower` | Resolve public campaign slug. |
| `idx_cr_campaigns_community_status` | Admin campaign listing/progress. |
| `idx_cr_campaigns_one_active_per_community` | Prevent concurrent operational campaigns for the same community. |
| `idx_cr_units_campaign_normalized_label_unique` | Unit lookup by normalized label and ambiguity guard. |
| `idx_cr_units_campaign_status` | Progress counts. |
| `idx_cr_submissions_one_active_per_unit` | Concurrency guard: one active submission. |
| `idx_cr_submissions_unit_created` | Submission history. |
| `idx_cr_residents_submission_position` | Ordered resident listing. |
| `idx_cr_residents_pending_conversion` | Future conversion queue. |
| `idx_cr_tokens_hash_unique` | Token hash lookup. |
| `idx_cr_tokens_one_active_campaign_access` | Campaign access token rotation guard. |
| `idx_cr_tokens_one_active_patronato_review` | Patronato token rotation guard. |
| `idx_cr_events_*` | Audit timeline by campaign/unit/submission/type. |

## 15. Initial RLS

All new tables enable RLS and revoke direct table access from `public`, `anon`, and `authenticated`. No public table policies are created in this mission.

RLS is not forced in this migration. That is intentional: `anon` and `authenticated` have no direct grants or policies, while future controlled backend/RPC/service operations need privileged execution paths. Before production application, future RPC migrations must grant only narrow function execution and keep table access deny-by-default.

Future actor model:

| Actor | Access model |
| --- | --- |
| Anonymous | No direct table access. |
| Resident with token | Future server/RPC operations only. |
| Patronato | Future limited backend/RPC access. |
| Superadmin ENTRY | Future authenticated actions/RPCs. |
| Privileged backend | Future transactional operations. |
| Worker | Future authorized conversion work only. |

## 16. Future RPC Requirements

Future missions must implement transactional operations for:

- creating campaigns and campaign units;
- opening/pausing/closing campaigns;
- public campaign lookup;
- unit search with neutral response;
- draft start/continue;
- submit and lock;
- enable/revoke edit;
- resubmit with new version;
- reset unit;
- mark needs correction;
- internal review;
- patronato confirmation;
- conversion preparation to `resident_activation_queue`.

Every `SECURITY DEFINER` function must set `search_path`, validate tenant, narrow grants, and avoid exposing broad public execution.

## 17. Concurrency

| Case | Control |
| --- | --- |
| Two users select same house. | One campaign unit per house; future RPC locks unit. |
| Two simultaneous submissions. | Partial unique index allows one active submission per unit; future RPC uses row locks. |
| Reopen while resident submits. | Future RPC checks token status and submission version under lock. |
| Reset while edit is open. | Reset revokes active tokens and invalidates submission under lock. |
| Patronato confirms while ENTRY marks correction. | Future RPC locks unit/current submission and validates expected state. |
| Duplicate conversion attempts. | Unique activation queue mapping, conversion status and future idempotency checks. |

## 18. Risks

- Supabase CLI is not installed in this environment, so the migration filename was created manually using the repository timestamp convention.
- The migration is not applied; SQL syntax is static-reviewed only here.
- Effective resident limit enforcement requires future RPCs.
- Some state consistency rules require transactional functions, not only constraints.
- Additional support indexes on existing `houses` and `resident_activation_queue` are included for tenant-safe composite FKs and should be reviewed before production application.
- The schema deliberately blocks ambiguous duplicate normalized labels inside a campaign. If a real community needs repeated labels across buildings, `ENTRY-ONB-002` must add an explicit public disambiguator before relaxing this.

## 19. Deferred Decisions

- Exact public URL and middleware matcher update.
- Campaign slug entropy format and token generation implementation.
- Patronato identity model: magic link/token versus authenticated limited user.
- Whether conversion retries need a separate attempt table.
- Phone normalization standard by country.
- Retention/archive policy for invalidated submissions.

## 20. Criteria For ENTRY-ONB-002

`ENTRY-ONB-002` may begin when:

- this migration is reviewed;
- tenant FK/index choices are accepted;
- state strategy C is accepted;
- no syntax concerns remain after local SQL review or safe local application authorization;
- backend transactional operations are scoped to RPCs/Server Actions only;
- no UI work is mixed into the backend mission.

Recommended next mission: `ENTRY-ONB-002` backend transactional operations and safe APIs for campaign/unit/submission lifecycle.
