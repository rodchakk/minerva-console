# ENTRY — Pre-launch P0 Board

**Date:** 2026-09-04  
**Rule:** The missions in this board are expected to be completed before ENTRY begins its first real community operations.

## 1. Manual Access Evidence-First Redesign

Specification: [entry-manual-access-evidence-first-p0.md](../missions/entry-manual-access-evidence-first-p0.md)

Current operational state as of 2026-09-04:

- Backend migration applied and reconciled in `gate-project-dev`.
- Real Android preview-device manual access QA passed for the tested flows.
- Real OCR result observed (`HCM5024`).
- Manual checkout tested.
- Admin web preview visually/runtime tested and polished.
- Minerva Console destination manager is in final runtime QA.
- Vercel Preview writes are intentionally blocked by Console's preview read-only guard, so create/rename/deactivate cannot be validated against Supabase from the Preview deployment.
- Related PRs remain open/unmerged until final review.

## 2. Admin Mobile Unit Deactivation

Specification: [entry-admin-mobile-unit-deactivation-p0.md](../missions/entry-admin-mobile-unit-deactivation-p0.md)

**Status:** Captured / pending design and implementation.

Required outcome: mobile administrators can safely deactivate/reactivate a complete unit, with explicit and reversible operational semantics.

## 3. Guard Invalid Pass Clarity

Specification: [entry-guard-invalid-pass-clarity-p0.md](../missions/entry-guard-invalid-pass-clarity-p0.md)

**Status:** Captured / pending design and implementation.

Required outcome: guards see clear, distinct explanations for expired, already-used, and not-yet-valid passes, including relevant time/context and next action.

## 4. Public Registration Branding Simplification

Specification: [entry-public-registration-branding-p0.md](../missions/entry-public-registration-branding-p0.md)

**Status:** Captured / pending implementation.

Required outcome: remove the large black `Minerva Technologies` top branding block from the public registration link and replace it with discreet bottom attribution so registration content remains the focus.

## Launch gate

Do not treat ENTRY as fully pre-launch ready until all four P0 items above are closed or explicitly waived by product decision.