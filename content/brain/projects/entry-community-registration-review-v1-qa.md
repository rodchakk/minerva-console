# ENTRY Community Registration Review v1 QA

**Mission:** `ENTRY-ONB-003-QA`
**Date:** 2026-08-05
**Worktree:** `D:\Dev\minerva-console\.worktrees\entry-onb-003`
**Branch:** `codex/entry-onb-003-review-confirmation`
**Base:** `a81de65db33fc61d0b93e6734a9d27805aeb8c7c`
**Verdict:** `CHANGES APPLIED - STATIC QA COMPLETE - HOSTED DEV APPLY RESOLVED - RUNTIME TESTS PENDING`

## 1. Verdict

`CHANGES APPLIED - STATIC QA COMPLETE - HOSTED DEV APPLY RESOLVED - RUNTIME TESTS PENDING`.

The local review/confirmation backend was audited and hardened for stricter state-machine and patronato confirmation requirements. Hosted-dev apply is resolved; catalog objects, grants, RLS posture and negative transactional behavior still require runtime validation.

No live Supabase DDL or DML was executed.

## 2. Files Added

- `supabase/migrations/20260806234000_create_entry_community_registration_review_v1.sql`
- `scripts/entry-onb-003-validate-review.mjs`
- `content/brain/projects/entry-community-registration-review-v1.md`
- `content/brain/projects/entry-community-registration-review-v1-qa.md`

## 3. Files Inspected

- `content/brain/projects/entry-community-registration-index.md`
- `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`
- `content/brain/projects/entry-community-registration-foundation-contract.md`
- `content/brain/projects/entry-community-registration-schema-v1.md`
- `content/brain/projects/entry-community-registration-schema-v1-qa.md`
- `content/brain/projects/entry-community-registration-backend-v1.md`
- `content/brain/projects/entry-community-registration-backend-v1-qa.md`
- `supabase/migrations/20260806232141_create_entry_community_registration_schema_v1.sql`
- `supabase/migrations/20260806233000_create_entry_community_registration_backend_v1.sql`
- `scripts/entry-onb-001-validate-schema.mjs`
- `scripts/entry-onb-002-validate-backend.mjs`

## 4. Static Coverage

The new validator checks:

- new migration presence;
- schema v1 and backend v1 immutability against `HEAD`;
- required RPC inventory;
- `SECURITY DEFINER`;
- fixed `search_path`;
- service-role assertion;
- internal actor validation;
- service-role-only grants;
- no function grants to `PUBLIC`, `anon` or `authenticated`;
- no writes to active user tables;
- no `resident_activation_queue` conversion;
- no legacy lane references;
- patronato token scope and expiry;
- review records;
- correction to `needs_correction`;
- unit confirmation from `reviewed`;
- campaign confirmation pending-state rejection;
- incomplete confirmation authorization;
- required events;
- event metadata without copied PII or token hashes.

## 5. QA Corrections Applied

- Restricted `mark_community_registration_unit_reviewed_v1`, `request_community_registration_correction_v1`, `confirm_community_registration_unit_v1`, `authorize_incomplete_campaign_confirmation_v1`, and `confirm_community_registration_campaign_v1` to campaign status `review`.
- Added active resident-edit-token rejection before ENTRY marks a unit reviewed.
- Added pending correction, active resident-edit-token and newer active submission rejection before patronato confirms a unit.
- Added campaign confirmation conflict checks for confirmed units without a current confirmed submission and unregistered units with an active submission.
- Changed patronato access revocation event metadata from raw reason text to `reason_length`.
- Extended `scripts/entry-onb-003-validate-review.mjs` to enforce these invariants.

## 6. Function Inventory

| Function | Signature | Returns | Definer/search path/caller | Grants | Reads | Writes | Locks | Events | PII returned | Actor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `create_community_registration_patronato_access_v1` | `(uuid, text, timestamptz, uuid)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, tokens, auth users | tokens, events | campaign | `patronato_access_created` | no | ENTRY actor |
| `revoke_community_registration_patronato_access_v1` | `(uuid, uuid, text)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, tokens, auth users | tokens, events | campaign | `patronato_access_revoked` | no | ENTRY actor |
| `resolve_community_registration_patronato_access_v1` | `(text)` | `jsonb` | yes / `public` / service_role | service_role only | tokens, campaigns, communities, units, reviews | none | token | none | no | patronato token |
| `start_community_registration_review_v1` | `(uuid, uuid)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, auth users | campaigns, events | campaign | `campaign_review_started` | no | ENTRY actor |
| `get_community_registration_review_summary_v1` | `(uuid, text)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, tokens, units, submissions, residents, reviews | none | token when provided | none | no | ENTRY or patronato token |
| `list_community_registration_review_units_v1` | `(uuid, text, text, text, integer, integer)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, tokens, units, submissions, residents, reviews | none | token when provided | none | no | ENTRY or patronato token |
| `get_community_registration_review_unit_v1` | `(uuid, uuid, text)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, tokens, units, submissions, residents, reviews | none | token when provided | none | current unit residents only | ENTRY or patronato token |
| `mark_community_registration_unit_reviewed_v1` | `(uuid, uuid)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, units, submissions, tokens, reviews, auth users | submissions, units, reviews, events | campaign, unit, submission | `unit_reviewed` | no | ENTRY actor |
| `request_community_registration_correction_v1` | `(uuid, uuid, text, uuid, text)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, units, submissions, tokens, reviews, auth users | units, reviews, events | campaign, unit, submission, token for patronato | `correction_requested` | no | ENTRY actor or patronato token |
| `confirm_community_registration_unit_v1` | `(uuid, uuid, text)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, units, submissions, tokens, reviews | submissions, units, reviews, events | campaign, unit, submission, token | `unit_confirmed` | no | patronato token |
| `authorize_incomplete_campaign_confirmation_v1` | `(uuid, uuid, text)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, units, auth users | incomplete authorizations, events | campaign, units | `incomplete_confirmation_authorized` | no | ENTRY actor |
| `confirm_community_registration_campaign_v1` | `(uuid, text)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, units, submissions, residents, tokens, incomplete authorizations | campaigns, tokens, incomplete authorizations, events | campaign, units, token, authorization | `campaign_confirmed` | no | patronato token |
| `enable_community_registration_edit_v1` | `(uuid, text, timestamptz, uuid, text)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, units, submissions, tokens, auth users | tokens, submissions, units, events | campaign, unit, submission | `resident_edit_token_revoked`, `resident_edit_enabled` | no | ENTRY actor |
| `resolve_community_registration_edit_v1` | `(text)` | `jsonb` | yes / `public` / service_role | service_role only | tokens, campaigns, units, submissions, residents | none | token | none | token-authorized current residents | resident edit token |
| `resubmit_community_registration_household_v1` | `(text, jsonb)` | `jsonb` | yes / `public` / service_role | service_role only | tokens, campaigns, units, submissions, residents | submissions, residents, units, tokens, events | campaign, unit, submission, token | `household_resubmitted` | no | resident edit token |
| `reset_community_registration_unit_v1` | `(uuid, uuid, text)` | `jsonb` | yes / `public` / service_role | service_role only | campaigns, units, submissions, tokens, reviews, auth users | submissions, tokens, reviews, units, events | campaign, unit, submission | `registration_reset` | no | ENTRY actor |

Helpers `_cr_validate_observation_v1`, `_cr_replace_current_review_v1`, and `_cr_patronato_token_v1` fix `search_path`, have no direct grants, and are revoked from `PUBLIC`, `anon` and `authenticated`.

## 7. Lock And Race Matrix

| Mutating function | Lock order | Race disposition |
| --- | --- | --- |
| `create_community_registration_patronato_access_v1` | campaign, token write | Serializes token rotation per campaign through campaign lock and active-token uniqueness. |
| `revoke_community_registration_patronato_access_v1` | campaign, token update | Serializes with token users that also lock campaign before token. |
| `start_community_registration_review_v1` | campaign | Repeated calls return `ENTRY_CR_INVALID_REVIEW_STATE` after first transition. |
| `mark_community_registration_unit_reviewed_v1` | campaign, unit, submission | Revalidates unit/submission state and rejects active edit tokens. |
| `request_community_registration_correction_v1` | campaign, unit, submission, token for patronato | Competes safely with unit confirmation through unit/submission locks. |
| `confirm_community_registration_unit_v1` | campaign, unit, submission, token | Revalidates reviewed state, no active edit token, no pending correction and no newer active version. |
| `authorize_incomplete_campaign_confirmation_v1` | campaign, units | Recalculates pending and unregistered counts under campaign/unit locks. |
| `confirm_community_registration_campaign_v1` | campaign, units, token, authorization | Recalculates states, checks current-submission consistency, consumes token/authorization. |
| `enable_community_registration_edit_v1` | campaign, unit, submission | Allows `review` correction only through ENTRY action and revokes previous edit tokens. |
| `resubmit_community_registration_household_v1` | campaign, unit, submission, token | Creates a new version, clears review/confirmation timestamps, consumes edit token. |
| `reset_community_registration_unit_v1` | campaign, unit, submission | Rejects confirmed units and preserves historical submissions/residents/reviews/events. |

## 8. Error Codes

| Code | Use |
| --- | --- |
| `ENTRY_CR_REVIEW_NOT_READY` | Missing ready reviewed/submitted state for review or final confirmation. |
| `ENTRY_CR_CORRECTION_REQUIRED` | Missing correction text or unresolved current correction blocking confirmation. |
| `ENTRY_CR_ALREADY_CONFIRMED` | Confirmed unit or campaign cannot be silently reopened/reconfirmed. |
| `ENTRY_CR_PATRONATO_ACCESS_INVALID` | Missing, revoked, consumed, wrong-type or wrong-scope patronato token. |
| `ENTRY_CR_PATRONATO_ACCESS_EXPIRED` | Expired patronato token. |
| `ENTRY_CR_CAMPAIGN_INCOMPLETE` | Pending or unauthorized unregistered units block campaign confirmation. |
| `ENTRY_CR_CONFIRMATION_CONFLICT` | Stale/inconsistent unit or submission confirmation state. |
| `ENTRY_CR_INVALID_REVIEW_STATE` | Operation attempted outside allowed review state machine. |

## 9. Limitations

The SQL was later applied to hosted dev during ENTRY-ONB-005. Runtime checks still need to prove trigger behavior, lock behavior, constraint timing, function ownership and concurrency.

## 10. Required Engine Gate

Before runtime approval:

- inspect created tables, constraints, indexes, RLS and function grants;
- verify function owners and `SECURITY DEFINER` blast radius;
- run negative tests for expired/revoked patronato token, cross-campaign token use, stale reviewed submission confirmation, correction versus confirmation race, incomplete campaign confirmation, and confirmed-unit reset rejection;
- destroy or roll back the disposable environment.

## 11. Status

Hosted-dev apply is resolved; runtime tests remain pending.

No push, PR, deployment, ENTRY mobile change or next mission work was performed in this QA pass.
