# ENTRY Community Registration Review v1

**Mission:** `ENTRY-ONB-003`
**Date:** 2026-08-05
**Branch/worktree:** `codex/entry-onb-003-review-confirmation` at `.worktrees/entry-onb-003`
**Base:** `a81de65db33fc61d0b93e6734a9d27805aeb8c7c` (`a81de65`)
**Migration:** `supabase/migrations/20260806234000_create_entry_community_registration_review_v1.sql`
**Status:** applied to hosted dev; runtime tests pending.

## 1. Summary

`ENTRY-ONB-003` adds the transactional review, observation and patronato confirmation backend for Community Registration. It does not create UI, route handlers, Server Actions, mobile changes, seeds, users, activation queue rows or ENTRY mobile changes.

Transport closeout reconciled the migration filename to the hosted-dev canonical timestamp `20260806234000` after successful individual apply. SQL content was preserved byte-for-byte; runtime validation remains pending.

The migration stays forward-only after schema v1 and backend v1. Earlier migrations are not edited.

The hosted-dev apply gate is resolved for schema v1, backend v1 and review v1. Runtime tests remain pending.

## 2. Compatibility Check

Schema v1 already supported these required fields and states:

- Unit statuses: `needs_correction`, `reviewed`, `confirmed`.
- Submission statuses: `reviewed`, `confirmed`.
- Campaign statuses: `review`, `confirmed`.
- Unit/submission timestamps: `reviewed_at`, `reviewed_by`, `patronato_confirmed_at`, `patronato_confirmed_by`.
- Access token type: `patronato_review`.
- Base audit events for earlier review/confirmation names.

The existing model did not contain a current observation/review entity. Events are audit, not the source of the current observation state, so this mission adds `community_registration_reviews`.

The existing model did not contain an ENTRY authorization for incomplete patronato campaign confirmation with `unregistered` houses. This mission adds `community_registration_incomplete_confirmation_authorizations`.

## 3. Tables Added

`community_registration_reviews` stores a minimal current and historical review record:

- campaign, unit and exact submission scope;
- decision: `reviewed`, `correction_requested`, or `confirmed`;
- actor type: `entry_admin`, `patronato`, or `system`;
- actor user or patronato access token reference;
- bounded text observation;
- current/replaced/resolved markers.

`community_registration_incomplete_confirmation_authorizations` stores ENTRY authorization to close a campaign with only `unregistered` units remaining:

- campaign scope;
- internal ENTRY actor;
- reason;
- current unregistered count;
- active/consumed/revoked status.

Both tables enable RLS and revoke table access from `PUBLIC`, `anon` and `authenticated`.

## 4. Operations Implemented

- `create_community_registration_patronato_access_v1`
- `revoke_community_registration_patronato_access_v1`
- `resolve_community_registration_patronato_access_v1`
- `start_community_registration_review_v1`
- `get_community_registration_review_summary_v1`
- `list_community_registration_review_units_v1`
- `get_community_registration_review_unit_v1`
- `mark_community_registration_unit_reviewed_v1`
- `request_community_registration_correction_v1`
- `confirm_community_registration_unit_v1`
- `authorize_incomplete_campaign_confirmation_v1`
- `confirm_community_registration_campaign_v1`

Forward-only replacements were also added for:

- `enable_community_registration_edit_v1`
- `resolve_community_registration_edit_v1`
- `resubmit_community_registration_household_v1`
- `reset_community_registration_unit_v1`

The replacements allow authorized resident corrections during campaign `review`, while general public registration remains limited to campaign `open`. Reset no longer silently operates on confirmed units.

## 5. Patronato Access

Patronato access is hash-only and scoped to one campaign through `community_registration_access_tokens.token_type = 'patronato_review'`.

The SQL never generates, stores or returns plaintext secrets. The resolver returns campaign title, community name, campaign status, close date, a non-PII summary and capabilities. It does not return token hashes, internal actors, resident data or unnecessary internal IDs.

All patronato operations receive a token hash from the future server-side layer and revalidate that token against the requested campaign.

## 6. Review Flow

ENTRY marks a submitted unit as reviewed:

```text
submitted -> reviewed
```

The function requires campaign status `review`, locks campaign, unit and current submission, verifies the current submission is still `submitted`, rejects active resident-edit tokens, writes a review record, updates unit/submission timestamps, and records a non-PII event.

Corrections can be requested by ENTRY or patronato during campaign `review`:

```text
submitted/reviewed -> needs_correction
```

The observation is required, normalized as bounded plain text, stored in `community_registration_reviews`, and not copied into events. No edit token is generated automatically.

Afterward ENTRY can explicitly choose the existing edit or reset backend. Edit and resubmit now accept campaign status `review`.

## 7. Confirmation Flow

Patronato can confirm only a unit already marked `reviewed`:

```text
reviewed -> confirmed
```

The function requires campaign status `review`, locks campaign, unit, current reviewed submission and token. It rejects pending correction reviews, active resident-edit tokens and newer active submission versions before confirming the exact reviewed submission and recording confirmation through both current state and review/audit records.

Campaign confirmation requires campaign status `review` and recalculates the summary inside the transaction after locking the campaign and campaign units. It rejects pending units in:

- `submitted`
- `edit_enabled`
- `needs_correction`
- `reviewed`

It also rejects a campaign with no confirmed units.

By default, `unregistered` units block confirmation. ENTRY can explicitly authorize incomplete confirmation only when the remaining incomplete units are `unregistered`, and the final confirmation revalidates the current count before consuming that authorization and the patronato token. Confirmed campaign units are also checked for a current confirmed submission before closing the campaign.

## 8. Security

All RPCs are `SECURITY DEFINER`, fix `search_path` to `public`, call `_cr_service_role_only_v1()`, revoke execution from `PUBLIC`, `anon` and `authenticated`, and grant execution only to `service_role`.

The migration does not write to:

- `auth.users`
- `profiles`
- `community_members`
- `house_residents`
- `resident_activation_queue`

No legacy lane dependency is added.

## 9. Events

Required events added:

- `patronato_access_created`
- `patronato_access_revoked`
- `campaign_review_started`
- `unit_reviewed`
- `correction_requested`
- `unit_confirmed`
- `incomplete_confirmation_authorized`
- `campaign_confirmed`

Events include state transitions, versions, counts, IDs and reason/observation lengths. They do not include resident names, email, phone, observation text, token values, token hashes or full resident payloads.

## 10. Deferred Decisions

Automatic reversal of confirmed units is deliberately not implemented. If a confirmed unit contains an error, ENTRY needs a future explicit administrative operation.

Conversion to `resident_activation_queue` remains out of scope.

## 11. Runtime Gate

Hosted-dev apply is complete. Before runtime approval, inspect the catalog, verify grants/RLS/function ownership, and run negative tests for invalid token scope, expired token, stale reviewed submission, correction/confirmation races, incomplete campaign confirmation and confirmed-unit reset/edit behavior.
