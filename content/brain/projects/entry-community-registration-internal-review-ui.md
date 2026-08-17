# ENTRY Community Registration - Internal Review UI

**Mission:** `ENTRY-ONB-008`

**Status:** implementation in review; remote SQL/runtime gate pending.

## Goal

`ENTRY-ONB-008` adds the first internal Minerva Console workflow for reviewing
household submissions collected through Community Registration before Patronato
confirmation.

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

The review workspace shows:

- campaign review status and summary counts;
- all participating units and their registration state;
- current resident count per unit;
- household resident details for a selected submitted unit;
- current correction observation when one is pending;
- internal review actions allowed by the existing backend state machine.

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

All internal reads and mutations remain behind `requireSuperadmin()` and the
service-role Supabase client. The database functions retain their service-role
execution boundary.

## Starting Review

Review decisions are intentionally unavailable while the campaign remains
`open`.

The operator must explicitly choose `Start review`, which calls the existing
`start_community_registration_review_v1(...)` transition:

```text
open -> review
```

That transition stops new general public household submissions. Existing
resident correction access remains valid during `review`, as already supported
by the approved backend.

## Internal Unit Review

A unit in `submitted` can be marked reviewed:

```text
submitted -> reviewed
```

The action delegates to `mark_community_registration_unit_reviewed_v1(...)`.
The database remains responsible for current-submission validation, active edit
token conflicts, locking, audit records and state transition safety.

ENTRY may instead request a correction from a `submitted` or `reviewed` unit.
The operator must write a bounded observation of 1-1000 characters. The action
delegates to `request_community_registration_correction_v1(...)` and the unit
moves to `needs_correction`.

## Correction-Link Lifecycle

Correction access stays capability-based and hash-only.

For the first correction link, the server action:

1. generates 32 secure random bytes as a base64url plaintext capability;
2. hashes it with the existing correction-token SHA-256 helper;
3. passes only the hash to `enable_community_registration_edit_v1(...)`;
4. receives safe metadata from Supabase;
5. shows the plaintext URL only in the immediate authenticated Server Action
   response.

Correction links expire after **72 hours** in this v1 UI.

The plaintext token is not stored in Supabase, Brain, localStorage,
sessionStorage, cookies or application logs.

## Lost-Link Recovery Hardening

Inspection found a recovery gap in the existing backend contract. After
`enable_community_registration_edit_v1(...)` succeeds, the unit becomes
`edit_enabled`. If the HTTP response carrying the plaintext capability is lost,
the same enable operation cannot safely be repeated because it no longer
accepts an `edit_enabled` unit.

`ENTRY-ONB-008` therefore adds one forward-only hardening migration:

`supabase/migrations/20260817032000_create_entry_community_registration_review_ui_hardening_v1.sql`

The migration adds:

`rotate_community_registration_edit_access_v1(uuid, text, timestamptz, uuid, text)`

The replacement RPC:

- is `SECURITY DEFINER` with fixed `search_path`;
- requires service-role execution and a validated internal actor;
- locks campaign, campaign unit and current edit-enabled submission;
- accepts only a currently `edit_enabled` unit/submission in an available
  `open` or `review` campaign;
- revokes existing active `resident_edit` capabilities for that household;
- inserts one replacement active hash inside the same PostgreSQL transaction;
- emits `resident_edit_access_replaced` with non-secret metadata;
- returns only safe IDs, public slug, expiry and revoked count;
- does not catch database failures, so an insertion failure rolls back the
  preceding revocation.

The UI exposes `Replace correction link` only for an `edit_enabled` household.
The replacement immediately invalidates the previous active correction link.

## Resident Correction Observation

The existing correction page allowed a resident to edit the household but did
not tell the resident what ENTRY had requested them to correct.

The hardening migration therefore replaces
`resolve_community_registration_edit_v1(text)` without changing its capability
boundary. For a valid edit token, it additionally returns only the current
pending `correction_requested` observation scoped to the same campaign unit and
same submission.

The server gateway maps this as `correctionObservation`, and the authorized
public correction page renders it under `Observacion de la administracion`.
No observation is exposed through general campaign access or unauthenticated
unit lookup.

## Security Boundaries

- Console review routes require the existing authenticated superadmin gate.
- Database RPCs continue to execute through the service-role client only.
- New correction rotation RPC is revoked from `PUBLIC`, `anon` and
  `authenticated`, and granted only to `service_role`.
- Resident PII is read only for the internal selected-unit review view or for a
  valid household-scoped correction capability.
- No plaintext capability is written to the database or logs.
- No auth user, profile, community member, house resident or activation queue
  write is introduced by this mission.

## Validation

Focused static validator:

`scripts/entry-onb-008-validate-review-ui.mjs`

It checks the review route, existing review RPC reuse, superadmin boundary,
explicit start-review transition, correction observation requirement, hash-only
correction capability handling, first-link creation, lost-link replacement,
transactional replacement shape, service-role grants, observation scoping,
public observation rendering, absence of plaintext persistence/logging, and no
ENTRY mobile dependency.

PostgreSQL engine validation is still required before the new migration can be
approved for permanent application.

## Remote State

At implementation time:

- the new ONB-008 migration has **not** been applied to Supabase;
- no campaign state has been changed by ONB-008;
- no correction token has been created by ONB-008;
- `Residencial Prueba CR` remains the dedicated runtime test community from the
  prior Community Registration gates;
- remote SQL/runtime testing requires an explicit authorization gate before any
  mutation.

## Explicit Non-Scope

This mission does not implement:

- Patronato review/confirmation UI;
- campaign confirmation UI;
- conversion management UI;
- activation queue UI changes;
- ENTRY mobile changes;
- Vercel environment changes;
- Upstash/rate-limit changes;
- credential or secret rotation;
- unrelated Brain guardrail, full-lint or dependency-audit debt.
