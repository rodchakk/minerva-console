# ENTRY-ONB-008 Runtime Closeout

**Mission:** `ENTRY-ONB-008`

**PR:** #41

**Status:** runtime walkthrough passed; final PR/CI review pending.

## Environment

- Vercel Preview for PR #41.
- Supabase `gate-project-dev` only.
- Dedicated test community: `Residencial Prueba CR`.
- Production, `seshat`, ENTRY mobile, Vercel env, Upstash, rate-limit policy and secrets were not modified.

## Runtime Walkthrough

The walkthrough validated the complete internal review and resident correction loop:

```text
campaign open
-> internal review starts
-> Casa 1 reviewed
-> correction requested
-> correction link created
-> correction link replaced
-> old link invalidated
-> resident sees observation
-> resident corrects and resubmits
-> Version 2 returns to submitted
-> Version 2 reviewed again
```

Final runtime state after the walkthrough:

- campaign status: `review`;
- Casa 1 unit status: `reviewed`;
- current submission status: `reviewed`;
- current submission version: `2`;
- current resident count: `2`;
- pending corrections: `0`;
- active `resident_edit` capabilities: `0`.

No Patronato confirmation or conversion was exercised.

## Correction Link Rotation Proof

The first correction capability successfully opened the household-scoped correction page and displayed the operator observation.

Replacement-link recovery then produced:

- exactly one replacement active `resident_edit` capability;
- exactly one previous revoked `resident_edit` capability;
- one `resident_edit_access_replaced` audit event.

Reloading the old link returned `Enlace no disponible`, proving immediate invalidation.

## Runtime Defect Found and Fixed

The first successful Version 2 resubmission exposed a backend state defect: the prior `correction_requested` review stayed current/pending after the resident had already acted on it.

The forward-only hotfix:

`supabase/migrations/20260817043002_fix_cr_resubmit_resolves_pending_correction.sql`

changes `resubmit_community_registration_household_v1(...)` so successful resident resubmission resolves/replaces the current correction review inside the same database transaction. It also reconciles already-stale pending correction reviews when a newer submission version exists for the same unit.

The hotfix passed a PostgreSQL transactional test with rollback, was then permanently applied to `gate-project-dev` only, and repaired the walkthrough household without changing its resident payload.

Post-hotfix runtime proof showed Casa 1 Version 2 as `submitted` with two residents and zero pending observations. Version 2 was then marked reviewed successfully.

## Migrations Applied to Dev

- `20260817040516_create_entry_community_registration_review_ui_hardening_v1`
- `20260817043002_fix_cr_resubmit_resolves_pending_correction`

Both are applied to `gate-project-dev` only.

## Final Gate

Before merge, the final PR head must be checked for:

- TypeScript;
- production Build;
- Brain/layout lint;
- Vercel Preview;
- focused ONB-008 validator;
- no unexpected changed files or scope expansion.

Known unrelated full-lint and Brain guardrail debt remains out of scope.
