# ENTRY Community Registration Conversion v1 QA

**Mission:** `ENTRY-ONB-004`
**Date:** 2026-08-06
**Worktree:** `D:\Dev\minerva-console\.worktrees\entry-onb-004`
**Branch:** `codex/entry-onb-004-activation-conversion`
**Baseline:** `00d31f12ed23375a22a1d8e31825ed0deba5df8c`
**Verdict:** `READY TO COMMIT ENTRY-ONB-004`; hosted-dev apply resolved; runtime validated under `ENTRY-ONB-005`.

## 0. Integrity Audit Summary

The migration was audited function-by-function against the activation queue
conversion contract. Confirmed defects were corrected in-place without touching
migrations 001, 002, or 003.

Corrections applied during QA:

- Added advisory locks for name-only residents scoped by community and house/unit.
- Added deterministic per-resident username suggestion with checks against
  `profiles` and RAQ `suggested_username` collisions.
- Added preflight detection for two source residents claiming the same legacy
  RAQ row.
- Reclassified coherent activated RAQ reuse as `already_active`, not
  `already_queued`.
- Blocked inconsistent activated RAQ rows that lack `activated_user_id`.
- Revalidated null-house linked RAQ rows by normalized unit label.
- Added `unique_violation` retry for the source-resident RAQ unique index.
- Hardened active-user detection for bare Auth emails and cross-community
  memberships.
- Hardened phone-only active identity detection to include `auth.users.phone`.
- Extended validator 004 to enforce the new invariants structurally.

## 1. Function Inventory

| Function | Type | Writes | Grants |
| --- | --- | --- | --- |
| `preview_community_registration_unit_conversion_v1` | internal read | none | `service_role` only |
| `convert_community_registration_unit_to_activation_v1` | internal mutating | RAQ, CR residents/submission/unit/events | `service_role` only |
| `list_community_registration_units_pending_conversion_v1` | internal read | none | `service_role` only |
| `get_community_registration_conversion_result_v1` | internal read | none | `service_role` only |
| `mark_community_registration_campaign_processed_v1` | internal mutating | CR campaign/events | `service_role` only |

Private helpers normalize identity values, select activation method, generate
collision-checked suggested usernames, take advisory identity locks, write
non-PII events, and classify residents.

## 2. Lock Table

| Step | Lock |
| --- | --- |
| Campaign | `FOR UPDATE` |
| Unit | `FOR UPDATE` |
| Current confirmed submission | `FOR UPDATE` |
| Residents | ordered `FOR UPDATE` |
| Identity | advisory transaction lock by normalized email, phone, or name-only community/house/name |
| RAQ candidates | ordered `FOR UPDATE` |

## 3. State Table

Campaign must be `confirmed`. Unit must be `confirmed` unless already
`processed`. Current submission must be `confirmed` and bound to the same
unit/house/community. Successful conversion sets submission `converted`, unit
`processed`, and later campaign `processed`.

## 4. Result Table

Terminal resident outcomes:

- `converted`
- `already_queued`
- `already_active`

Blocking outcomes:

- `invalid`
- `queue_conflict`
- `identity_ambiguous`
- `active_identity_other_context`
- `traceability_conflict`
- `failed`

## 5. Idempotency

RAQ has nullable `community_registration_resident_id` plus unique partial index
`ux_raq_community_registration_resident`. Replays find or link the same queue
row instead of inserting a second source row.

## 6. Concurrency

Same-unit conversions serialize through campaign/unit/submission/resident locks
and the unique RAQ source index. Same-identity conversions serialize through
Community Registration advisory locks, including name-only residents. The
traditional importer remains a documented residual race.

## 7. Security

All new public RPCs are `SECURITY DEFINER`, set `search_path` to `public`,
assert service-role execution, reject missing actors, revoke `PUBLIC`, `anon`,
and `authenticated`, and grant only to `service_role`.

## 8. Grants

No RAQ table grants were changed. No new function is granted to browser roles.
Helpers have no direct public/client grants.

## 9. PII

RAQ columns receive normal resident name/email/phone fields. `raw_data` stores
only operational IDs and relationship. Events store IDs, counts, positions,
status/category names, and contract codes; no names, emails, phones, tokens,
PINs, observations, or resident payload arrays.

## 10. Errors

The migration uses stable contract codes for not-ready, invalid resident,
resident conflict, identity ambiguity, queue conflict, stale confirmation,
incomplete conversion, retryable username exhaustion, and traceability conflict.
Raw SQL errors are not intentionally surfaced as business responses.

## 11. Events

Required conversion events are present:

- `resident_conversion_created`
- `resident_conversion_reused_queue`
- `resident_conversion_already_active`
- `resident_conversion_blocked`
- `unit_conversion_completed`
- `campaign_processing_completed`

Optional `unit_conversion_attempted` is also included.

## 12. RAQ Compatibility

The migration adds only a nullable FK column and partial unique index to RAQ.
It respects existing RAQ status/method checks, source values, updated-at trigger,
and activated-user trigger. New rows use `community_registration_v1`.

## 13. Tests Executed

Static:

- Baseline verification with `git rev-parse`, branch, parent, and status.
- Required contract documents and prior migrations inspected.
- Static validator created for migration 004.
- `node --check scripts/entry-onb-004-validate-conversion.mjs`
- `node scripts/entry-onb-001-validate-schema.mjs`
- `node scripts/entry-onb-002-validate-backend.mjs`
- `node scripts/entry-onb-003-validate-review.mjs`
- `node scripts/entry-onb-004-validate-conversion.mjs`
- `git diff --check`
- Tool availability checks for `psql`, Supabase CLI, and Docker.

All validators passed after QA hardening. `psql`, Supabase CLI, and Docker were
not available on PATH, so the engine gate remains pending.

## 14. Limitations

The migration has now been applied to hosted dev through the ENTRY-ONB-005
transport closeout. Runtime validation later passed after two minimal
classifier hotfixes: `20260806235500` fixed `min(uuid)` queue candidate
selection, and `20260806235600` fixed the lowercase `resident` enum literal.

## 15. Gate Status

Hosted-dev apply and runtime validation are resolved. The full
`ENTRY-ONB-005` harness passed 75 assertions, produced the expected temporary
RAQ delta `+2`, produced zero protected-table deltas, rolled back, and had an
independent post-runtime baseline verification with zero residual runtime
fixtures.
