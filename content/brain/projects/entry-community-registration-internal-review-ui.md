# ENTRY Community Registration - Internal Review UI

**Mission:** `ENTRY-ONB-008`

**Status:** runtime validated on PR #41 Preview; dev SQL migrations applied; ready for final PR review.

## Goal

`ENTRY-ONB-008` adds the first internal Minerva Console workflow for reviewing household submissions collected through Community Registration before Patronato confirmation.

The validated operator flow is:

```text
open campaign
  -> inspect submitted household
  -> start review
  -> mark reviewed
     OR request correction
  -> create temporary correction link
  -> replace correction link if plaintext is lost
  -> resident corrects and resubmits
  -> new submission returns to submitted
  -> ENTRY reviews the new version again
```

Patronato confirmation UI and conversion management UI remain later work.

## Console Placement

The Community Detail `Resident registration` card links to:

`/products/entry/communities/<communityId>/registration`

The review workspace shows campaign review status and summary counts, all participating units, current household status, resident count, current submission version, resident details for the selected household, current correction observation when pending, and the internal actions allowed by the backend state machine.

## Backend Reused

This mission reuses the existing ONB-003 review backend, including:

- `start_community_registration_review_v1`
- `get_community_registration_review_summary_v1`
- `list_community_registration_review_units_v1`
- `get_community_registration_review_unit_v1`
- `mark_community_registration_unit_reviewed_v1`
- `request_community_registration_correction_v1`
- `enable_community_registration_edit_v1`
- `resolve_community_registration_edit_v1`
- `resubmit_community_registration_household_v1`

Internal reads/actions remain superadmin-gated and use the service-role Supabase client.

## Review State

Review decisions are disabled while a campaign remains `open`. `Start review` transitions:

```text
open -> review
```

This stops new general public household submissions while existing authorized resident correction access remains valid.

A submitted unit can transition:

```text
submitted -> reviewed
```

ENTRY may request a correction from a `submitted` or `reviewed` unit. The operator must provide a bounded observation of 1-1000 characters.

## Correction Capability Lifecycle

Correction capabilities remain hash-only. The server generates 32 random bytes as base64url plaintext, hashes the capability before Supabase, and displays plaintext only in the immediate authenticated action result.

Correction links expire after 72 hours in this v1 UI.

The plaintext token is not persisted in Supabase, Brain, localStorage, sessionStorage, cookies, or application logs.

## Lost-Link Recovery Hardening

Migration:

`supabase/migrations/20260817040516_create_entry_community_registration_review_ui_hardening_v1.sql`

Supabase canonical version:

`20260817040516_create_entry_community_registration_review_ui_hardening_v1`

The migration adds:

`rotate_community_registration_edit_access_v1(uuid, text, timestamptz, uuid, text)`

The RPC is service-role-only, locks campaign/unit/current edit-enabled submission, revokes prior active `resident_edit` capabilities, inserts one replacement hash atomically, emits `resident_edit_access_replaced`, and returns safe metadata only. The UI exposes `Replace correction link` only for an `edit_enabled` household.

The same migration also extends `resolve_community_registration_edit_v1(text)` so a valid edit capability can return the current pending correction observation scoped to that same household/submission. The authorized correction page displays it under `Observacion de la administracion`.

## Resubmission Correction-Closeout Hotfix

The PR Preview walkthrough found one real backend defect after the first successful resident resubmission.

Observed pre-fix behavior:

- resident correction created submission Version 2;
- the edit capability was consumed;
- the unit returned to `submitted`;
- but the Version 1 `correction_requested` review remained `is_current = true` / `resolution_status = pending`.

That caused the internal review workspace to continue counting/showing an observation that the resident had already acted on.

Forward-only hotfix:

`supabase/migrations/20260817043002_fix_cr_resubmit_resolves_pending_correction.sql`

Supabase canonical version:

`20260817043002_fix_cr_resubmit_resolves_pending_correction`

The hotfix replaces `resubmit_community_registration_household_v1(...)` so a successful resubmission calls `_cr_replace_current_review_v1(...)` inside the same database transaction before consuming the edit token and returning the unit to `submitted`. A later database failure therefore rolls back the review resolution too.

It also contains a generic one-time reconciliation for stale pending correction reviews that already have a newer submission version for the same unit. No environment-specific IDs are hardcoded.

## Security Boundaries

- Console review routes require the authenticated superadmin gate.
- New correction rotation remains service-role-only.
- `resubmit_community_registration_household_v1(text,jsonb)` remains revoked from PUBLIC/anon/authenticated and executable by service role only.
- Resident PII is read only for internal review or a valid household-scoped correction capability.
- No auth user, profile, community member, house resident, activation queue, Vercel env, Upstash, rate-limit, or ENTRY mobile change is introduced.

## PostgreSQL Engine Validation

Authorized validation ran against Supabase `gate-project-dev` / PostgreSQL 17.

The original hardening migration passed a transactional `BEGIN ... ROLLBACK` test covering:

- `open -> review`;
- `submitted -> reviewed -> needs_correction -> edit_enabled`;
- correction observation resolution;
- correction-link rotation;
- old-link invalidation;
- duplicate-hash replacement rollback preserving the active replacement;
- unauthorized direct caller rejection with `42501`;
- `resident_edit_access_replaced` audit compatibility.

The exact migration was then permanently applied to `gate-project-dev` only as `20260817040516` and re-tested transactionally against the installed version.

The resubmission hotfix was also tested transactionally before permanent dev apply. The test created a temporary correction against the current household, resubmitted a Version 3 inside the transaction, verified the correction became resolved and no active edit token remained, then rolled back. Cleanup proof confirmed the real household remained Version 2 and the test token/data did not persist.

The exact hotfix was then applied to `gate-project-dev` as `20260817043002`. Post-apply checks confirmed the real Version 2 remained intact, resident count remained 2, pending corrections became 0, the prior correction became resolved, service-role execution remained granted, and authenticated execution remained blocked.

## PR #41 Preview Runtime Walkthrough - PASSED

Dedicated community: `Residencial Prueba CR`.

Runtime evidence:

1. Community Detail showed `1 / 5` submitted and exposed `Review registrations`.
2. Review workspace loaded one submitted unit with two residents and four unsubmitted units.
3. `Start review` successfully persisted campaign `open -> review` and emitted one `campaign_review_started` event.
4. Casa 1 internal detail loaded the current submission and two residents.
5. Casa 1 was marked reviewed.
6. ENTRY requested a correction with an operator observation; Casa 1 transitioned to `needs_correction` and the observation was stored as current/pending.
7. `Create correction link` transitioned Casa 1/submission to `edit_enabled` with exactly one active `resident_edit` capability.
8. The resident correction page showed the same household, existing residents, and the exact authorized correction observation.
9. `Replace correction link` left exactly one active token and one revoked token and emitted one `resident_edit_access_replaced` event.
10. Reloading the old correction link returned `Enlace no disponible`.
11. The replacement link allowed editing only Casa 1. The second resident phone was changed as a test and the resident submitted the correction.
12. Resubmission created Version 2, consumed the correction token, returned the unit to `submitted`, and preserved two residents.
13. The walkthrough exposed the stale-pending-correction defect described above; hotfix `20260817043002` was implemented, engine-tested and applied to dev.
14. Reloading the workspace after the hotfix showed Casa 1 `Submitted`, Version 2, two residents, `0 pending observations`, `Needs correction = 0`, and `Correction open = 0`.
15. Version 2 was marked reviewed. Final database state: unit `reviewed`, current submission `reviewed`, latest version 2, two residents, zero pending corrections, zero active edit tokens.

No Patronato confirmation or conversion was performed.

## Validation

Focused validator:

`scripts/entry-onb-008-validate-review-ui.mjs`

The validator covers review route/action wiring, token hashing, rotation locking/atomicity/grants, correction observation scoping, resident observation rendering, resubmission correction resolution, stale-pending reconciliation, service-role grants, no plaintext persistence/logging, and no ENTRY mobile dependency.

Prior PR CI passed TypeScript, production Build, Brain/layout lint and Vercel Preview. Full lint remained informationally red only on known unrelated debt; Brain guardrails remained red on the pre-existing `DEC-0007 -> ENTRY-ONB-000` relation. The final hotfix/documentation head must pass the same targeted gates before merge.

## Current Remote State

- campaign remains `review` in the dedicated dev test community;
- Casa 1 is `reviewed` on Version 2 with two residents;
- pending corrections = 0;
- active resident edit tokens = 0;
- both ONB-008 migrations are applied to `gate-project-dev` only;
- Production and `seshat` were not modified;
- ENTRY mobile, Vercel env, Upstash, rate limits and secret values were not changed.

## Explicit Non-Scope

This mission does not implement Patronato review/confirmation UI, campaign confirmation UI, conversion management UI, activation queue UI changes, ENTRY mobile changes, Vercel environment changes, Upstash/rate-limit changes, credential rotation, or unrelated Brain/full-lint/dependency debt.
