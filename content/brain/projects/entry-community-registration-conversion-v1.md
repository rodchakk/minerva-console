# ENTRY Community Registration Conversion v1

**Mission:** `ENTRY-ONB-004`
**Date:** 2026-08-06
**Worktree:** `D:\Dev\minerva-console\.worktrees\entry-onb-004`
**Branch:** `codex/entry-onb-004-activation-conversion`
**Baseline:** `00d31f12ed23375a22a1d8e31825ed0deba5df8c` (`00d31f1`)
**Migration:** `supabase/migrations/20260806235000_create_entry_community_registration_conversion_v1.sql`
**Status:** applied to hosted dev; runtime validated under `ENTRY-ONB-005`.

## 1. Summary

This mission adds the local database conversion layer that turns a confirmed
Community Registration unit into `public.resident_activation_queue` rows. The
conversion is internal, audited, idempotent by source resident, multi-tenant,
and stops at RAQ. It does not generate PINs, send messages, create Auth users,
or write active profile/membership/house-resident tables.

Transport closeout reconciled the migration filename to the hosted-dev
canonical timestamp `20260806235000` after successful individual apply. SQL
content was preserved byte-for-byte. Hosted runtime validation later passed
after two minimal classifier hotfix migrations: `20260806235500` for
`min(uuid)` and `20260806235600` for the `public.user_role` resident literal.

## 2. Baseline

The implementation was created from the required worktree and branch at
`00d31f12ed23375a22a1d8e31825ed0deba5df8c`. The parent commit is
`e51230c12908f05c737ac0cf418b9d591473829a`. The initial worktree was clean
apart from Git's unreadable global ignore warning.

## 3. Contract RAQ

The live RAQ contract remains binding. New Community Registration queue rows
start with:

- `status = 'pending'`
- `source = 'community_registration_v1'`
- `activation_method` selected as `email`, `phone_pin`, or `username_pin`

The conversion does not call `generate_resident_activation_pins_v1` or
`complete_resident_activation_pin_v1`.

## 4. Schema Change

RAQ receives one nullable column:

```sql
community_registration_resident_id uuid null
```

Existing RAQ rows remain `null`. There is no default, no `NOT NULL`, and no
backfill.

## 5. Traceability Column

The column has FK `raq_community_registration_resident_fk` to
`public.community_registration_residents(id)` with `ON DELETE RESTRICT`.
Unique index `ux_raq_community_registration_resident` enforces one RAQ row per
source resident when the value is not null.

## 6. Idempotency

Structural idempotency is the unique source resident reference. Retrying a
converted resident reuses the existing RAQ row and restores
`community_registration_residents.activation_queue_id` when needed.

## 7. Semantic Deduplication

The shared classifier compares same community, same house or normalized unit,
normalized resident name, and email/phone/name-only criteria across RAQ states
`pending`, `invited`, `pin_generated`, and `activated`. `skipped` and `failed`
matches block for manual review in v1.

## 8. Importer Decision

The conversion does not call `confirm_resident_bulk_import_v1`. The importer
can create houses, uses Excel-specific source/raw data, and has no structural
Community Registration resident identity.

## 9. Operations

- `preview_community_registration_unit_conversion_v1(uuid, uuid)`
- `convert_community_registration_unit_to_activation_v1(uuid, uuid, text)`
- `list_community_registration_units_pending_conversion_v1(uuid, integer, integer, uuid)`
- `get_community_registration_conversion_result_v1(uuid, uuid)`
- `mark_community_registration_campaign_processed_v1(uuid, uuid)`

## 10. Signatures

All operations are `SECURITY DEFINER`, `SET search_path TO 'public'`, assert
service-role execution, validate a non-null internal actor, revoke `PUBLIC`,
`anon`, and `authenticated`, and grant only to `service_role`.

## 11. Result Model

Residents are classified as:

`ready_new`, `already_linked`, `reuse_queue`, `already_active_same_house`,
`active_identity_other_context`, `queue_conflict`, `identity_ambiguous`,
`invalid`, or `traceability_conflict`.

Resident stored outcomes include `converted`, `already_queued`,
`already_active`, and blocking statuses.

## 12. Preview

Preview is read-only and returns per-resident ID, position, name, email, phone,
activation method, planned action, category, contract code, related RAQ ID, and
blocking flag. It may become stale; conversion revalidates under locks.

## 13. Conversion

Conversion locks campaign, unit, current confirmed submission, residents, and
candidate RAQ rows. It takes deterministic identity advisory locks for email,
phone, or name-only residents scoped by community plus house/unit, reclassifies,
blocks RAQ writes on any blocking result, and otherwise inserts or links RAQ
rows.

## 14. RAQ Detection

A linked RAQ row is reused if tenant and house/unit are coherent. A single
unambiguous semantic row is linked while preserving its existing source, status,
PIN/invitation state, and activation state. An activated RAQ row is terminal
only when `activated_user_id` is present; an inconsistent activated row blocks.
Two source residents attempting to claim the same legacy RAQ row block the unit
during preflight.

## 15. Active Detection

The classifier reads `auth.users`, `profiles`, `community_members`, and
`house_residents`. Active same-community same-house resident identity becomes
`already_active_same_house`. Other-community memberships, other-house identity,
or a bare existing Auth email blocks. Phone-only active identity is treated as
ambiguous in v1.

Runtime hotfix `20260806235600` preserves this rule while comparing
`community_members.role` to `RESIDENT` as `public.user_role`, matching the live
enum contract.

## 16. Normalization

Email is `lower(trim(email))`. Unit matching uses live `normalize_unit_label`.
Names are trimmed, whitespace-collapsed, and compared case-insensitively. Phone
comparison removes spaces, periods, hyphens, and parentheses without inventing
country codes.

## 17. Owner Mapping

`community_registration_residents.is_owner_reference` maps directly to RAQ
`is_owner_reference`; unknown/non-owner relationships become false by the
existing schema/backend contract.

## 18. Atomicity

The unit is the transaction boundary. If any resident blocks, no RAQ insert or
link occurs and the unit stays `confirmed`. A unit becomes `processed` only
when all residents are `converted`, `already_queued`, or `already_active`.

## 19. Locks

Lock order is campaign, unit, submission, residents, RAQ rows. Advisory locks
serialize Community Registration conversions by normalized email or phone.

## 20. Races

The unique source resident index protects same-resident retries. RAQ rows are
revalidated after locks. A `unique_violation` on the source resident reference
is retried by selecting the existing row and validating tenant/house scope. The
legacy importer does not share advisory locks, so a residual race remains;
ambiguous or conflicting post-lock RAQ state blocks.

## 21. Multi-Tenant

Every lookup is scoped through campaign, unit, community, house, and submission
relationships. Linked queue rows must match community and house.

## 22. Security

No browser role receives execution grants. Functions are service-role only.
The migration does not widen RLS or RAQ table grants.

## 22.1 Suggested Usernames

`username_pin` rows use a conversion helper that starts from
`_raq_suggest_username`, adds a stable source-resident hash suffix, then checks
both `profiles.username` and RAQ `suggested_username`. If the candidate
collides, numeric suffixes and finally a second stable hash suffix are tried.
Failure to produce a non-colliding candidate raises
`ENTRY_CR_CONVERSION_RETRYABLE`.

## 23. Events

Events added:

- `resident_conversion_created`
- `resident_conversion_reused_queue`
- `resident_conversion_already_active`
- `resident_conversion_blocked`
- `unit_conversion_attempted`
- `unit_conversion_completed`
- `campaign_processing_completed`

Event metadata uses IDs, counts, statuses, positions, and codes only.

## 24. Errors

Stable codes include `ENTRY_CR_CONVERSION_NOT_READY`,
`ENTRY_CR_RESIDENT_INVALID`, `ENTRY_CR_RESIDENT_CONFLICT`,
`ENTRY_CR_IDENTITY_AMBIGUOUS`, `ENTRY_CR_QUEUE_CONFLICT`,
`ENTRY_CR_CONFIRMATION_STALE`, `ENTRY_CR_CONVERSION_INCOMPLETE`, and
`ENTRY_CR_TRACEABILITY_CONFLICT`.

## 25. Processed State

Unit `processed` and submission `converted` are set only after terminal resident
outcomes. Campaign `processed` is set only after no pending confirmed/review or
correction units remain, at least one unit is processed, unregistered units are
covered by consumed incomplete-confirmation authorization, and no resident has a
blocking conversion status.

## 26. Tests

Static validation is implemented in
`scripts/entry-onb-004-validate-conversion.mjs`. Hosted runtime validation is
complete through `supabase/tests/entry-onb-005-runtime.sql`.

## 27. Gate PostgreSQL

Hosted-dev apply and runtime approval are complete. The runtime harness passed
75 assertions after hotfixes `005` and `006`, with expected temporary RAQ delta
`+2`, zero protected-table deltas, rollback, and independent post-runtime
baseline verification.

## 28. Residual Risks

The legacy Excel importer can race because it does not use the new advisory
identity lock. Phone-only identity remains deliberately conservative.

## 29. Deferred Decisions

No global unique identity constraint was added. No conversion-attempt table was
added. No automatic identity merge, existing-user linkage, or skipped/failed RAQ
reuse policy was implemented.

## 30. Criteria For QA

QA should inspect the migration catalog results, grants, function ownership,
RLS posture, lock behavior, event metadata, no PII leakage, and all required
negative cases before any application to live Supabase.
