# ENTRY Community Registration - Internal Review UI

**Mission:** `ENTRY-ONB-008`

**Status:** implementation in review; PostgreSQL engine gate passed and hardening migration applied to `gate-project-dev`; Preview runtime walkthrough pending.

## Goal

`ENTRY-ONB-008` adds the first internal Minerva Console workflow for reviewing household submissions collected through Community Registration before Patronato confirmation.

The operator flow is:

```text
open campaign
  -> inspect submitted households
  -> start review
  -> mark household reviewed
     OR request correction
  -> if correction requested, create temporary correction link
  -> resident corrects and resubmits
  -> review the new submission again
```

Patronato confirmation UI and conversion management UI remain later work.

## Console Placement

The Community Detail `Resident registration` card links submitted campaigns to:

`/products/entry/communities/<communityId>/registration`

The review workspace shows campaign review status and summary counts, all participating units and their registration state, resident count per unit, household resident details for a selected submitted unit, the current correction observation when pending, and internal review actions allowed by the existing backend state machine.

## Existing Backend Reused

This mission reuses the runtime-validated `ENTRY-ONB-003` review backend:

- `start_community_registration_review_v1`
- `get_community_registration_review_summary_v1`
- `list_community_registration_review_units_v1`
- `get_community_registration_review_unit_v1`
- `mark_community_registration_unit_reviewed_v1`
- `request_community_registration_correction_v1`
- `enable_community_registration_edit_v1`
- `resolve_community_registration_edit_v1`
- `resubmit_community_registration_household_v1`

All internal reads and mutations remain behind `requireSuperadmin()` and the service-role Supabase client.

## Starting Review

Review decisions are unavailable while the campaign remains `open`. The operator must explicitly choose `Start review`, delegating to `start_community_registration_review_v1(...)`:

```text
open -> review
```

This stops new general public household submissions while existing authorized correction access remains valid during `review`.

## Internal Unit Review

A `submitted` unit can be marked reviewed:

```text
submitted -> reviewed
```

ENTRY may instead request a correction from a `submitted` or `reviewed` unit. The operator must provide an observation of 1-1000 characters. The existing backend moves the unit to `needs_correction`.

## Correction-Link Lifecycle

Correction access remains capability-based and hash-only. For the first correction link, the server action generates 32 secure random bytes as a base64url capability, hashes it using the existing SHA-256 correction-token helper, passes only the hash to `enable_community_registration_edit_v1(...)`, and displays the plaintext URL only in the immediate authenticated action result.

Correction links expire after **72 hours** in this v1 UI. Plaintext capability values are not stored in Supabase, Brain, localStorage, sessionStorage, cookies or application logs.

## Lost-Link Recovery Hardening

Inspection found a recovery gap: after `enable_community_registration_edit_v1(...)` succeeds, a lost HTTP response would leave the household `edit_enabled` while the plaintext link was unrecoverable.

`ENTRY-ONB-008` therefore adds the forward-only hardening migration:

`supabase/migrations/20260817040516_create_entry_community_registration_review_ui_hardening_v1.sql`

The timestamp matches the canonical migration version recorded by Supabase on `gate-project-dev`.

The migration adds:

`rotate_community_registration_edit_access_v1(uuid, text, timestamptz, uuid, text)`

The replacement RPC is `SECURITY DEFINER` with fixed `search_path`, requires service-role execution and a validated internal actor, locks campaign/unit/current edit-enabled submission, accepts only an `edit_enabled` household in an available `open` or `review` campaign, revokes prior active `resident_edit` capabilities, inserts the replacement hash in the same transaction, emits `resident_edit_access_replaced`, and returns safe metadata only. It intentionally has no exception handler, so insertion failure rolls back the preceding revocation.

The UI exposes `Replace correction link` only for an `edit_enabled` household.

## Resident Correction Observation

The previous correction page allowed editing but did not tell the resident what ENTRY requested them to correct.

The migration replaces `resolve_community_registration_edit_v1(text)` without changing its capability boundary. For a valid edit token, it additionally returns only the current pending `correction_requested` observation scoped to the same campaign unit and submission. The public gateway maps this as `correctionObservation`, and the authorized correction page renders it under `Observacion de la administracion`.

No observation is exposed through general campaign access or unauthenticated unit lookup.

## Security Boundaries

- Console review routes require the existing authenticated superadmin gate.
- Database RPCs execute through the service-role client only.
- New rotation RPC is revoked from `PUBLIC`, `anon` and `authenticated`, and granted to `service_role`.
- Resident PII is read only for the internal selected-unit review view or a valid household-scoped correction capability.
- No plaintext capability is written to the database or logs.
- No auth user, profile, community member, house resident or activation queue write is introduced.

## Validation

Focused static validator:

`scripts/entry-onb-008-validate-review-ui.mjs`

PR #41 pre-SQL CI on the initial implementation head passed TypeScript, production Build, Brain/layout lint and Vercel Preview. Full lint remained informationally red only on known unrelated React-hook debt. Brain guardrails remained red on the pre-existing `DEC-0007 -> ENTRY-ONB-000` registry relation.

### PostgreSQL engine gate - PASSED

Authorized validation was executed against Supabase `gate-project-dev` (`ytzvislhvrcdtkbtpbmu`) / PostgreSQL 17.

The migration was first exercised transactionally with a final `ROLLBACK`. The real dedicated test campaign (`Residencial Prueba CR`, Casa 1) was driven through:

```text
open -> review
submitted -> reviewed -> needs_correction -> edit_enabled
```

Engine assertions verified:

- new rotation RPC compiles;
- `service_role` execute grant and PUBLIC/anon/authenticated revocation;
- correction observation is returned only through the authorized edit-token resolver;
- two existing Casa 1 residents resolve correctly;
- replacement revokes the previous active edit token and leaves exactly one active replacement;
- old edit capability becomes invalid;
- replacement capability resolves with the same scoped observation;
- intentional duplicate-hash replacement fails while preserving the previous active replacement, proving rollback of the preceding revocation;
- authenticated direct caller is rejected with `42501`;
- exactly one `resident_edit_access_replaced` audit event is emitted during the test transaction.

The rollback proof confirmed the campaign returned to `open`, Casa 1 and its submission returned to `submitted`, no test review remained, no test edit token remained, and the temporary pre-apply DDL did not persist.

### Permanent dev apply - PASSED

The exact reviewed migration was then permanently applied to `gate-project-dev` only. Supabase recorded:

`20260817040516_create_entry_community_registration_review_ui_hardening_v1`

Post-DDL checks confirmed the rotation RPC exists, `service_role` can execute it, authenticated/anon cannot, the event constraint includes `resident_edit_access_replaced`, the test campaign remained `open`, Casa 1 remained `submitted`, and the apply itself created no edit tokens.

A second transactional functional test was then run against the **installed** migration and rolled back. Review/correction/edit/rotation/invalid-old-link/failed-rotation rollback/unauthorized-caller/audit behavior all passed again. Final cleanup checks confirmed campaign/unit/submission restoration and zero test reviews/tokens.

## Remote State After SQL Gate

- hardening migration is permanently applied to `gate-project-dev` only;
- production was not touched;
- `seshat` was not touched;
- `Residencial Prueba CR` remains `open` after rollback validation;
- Casa 1 remains `submitted` with its prior two residents;
- no ONB-008 correction token or review row remains from validation;
- ENTRY mobile, Vercel env, Upstash, rate limits and secrets were not changed.

## Next Gate

Run the PR #41 Vercel Preview walkthrough against `gate-project-dev`: enter the internal review workspace, start review, inspect Casa 1, mark reviewed/request correction, generate a correction link, verify the resident sees the requested observation, exercise replacement-link recovery, resubmit, and confirm the workspace reflects the new submitted version. Use only the dedicated test community and stop before Patronato confirmation or conversion.

## Explicit Non-Scope

This mission does not implement Patronato review/confirmation UI, campaign confirmation UI, conversion management UI, activation queue UI changes, ENTRY mobile changes, Vercel environment changes, Upstash/rate-limit changes, credential/secret rotation, or unrelated Brain/full-lint/dependency debt.
