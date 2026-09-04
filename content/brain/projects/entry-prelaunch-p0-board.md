# ENTRY — Pre-launch P0 Board

**Date:** 2026-09-04  
**Rule:** The missions in this board are expected to be completed before ENTRY begins its first real community operations.

## 1. Manual Access Evidence-First Redesign — ✅ CLOSED

Specification: [entry-manual-access-evidence-first-p0.md](../missions/entry-manual-access-evidence-first-p0.md)  
Closeout: [entry-manual-access-evidence-first-closeout-2026-09-04.md](../missions/entry-manual-access-evidence-first-closeout-2026-09-04.md)

**Status:** ✅ COMPLETED / MERGED / PRODUCTION-VALIDATED

Validated outcome:

- Backend migrations applied and reconciled.
- Real Android manual-access QA passed.
- Vehicle and pedestrian flows passed.
- Required evidence behavior passed.
- Real plate OCR observed and propagated into admin history.
- Manual checkout passed.
- Admin web passed runtime/visual QA.
- Minerva Console destination manager passed final production visual QA.
- Mobile/backend PR #17, admin web PR #5, and Console PR #131 were merged.
- After deployment, operator confirmed destination CRUD works in the published Console and configured destinations appear correctly to guards.

This item is no longer part of the remaining launch blockers.

## 2. Guard Invalid Pass Clarity — P0.1

Specification: [entry-guard-invalid-pass-clarity-p0.md](../missions/entry-guard-invalid-pass-clarity-p0.md)

**Status:** Captured / pending design and implementation.

**Why next:** this affects the gate's immediate operational decision. A guard must instantly understand whether a pass is expired, already used, or not yet valid, without interpreting a generic error.

Required outcome: guards see clear, distinct explanations for expired, already-used, and not-yet-valid passes, including relevant time/context and next action.

## 3. Admin Mobile Unit Deactivation — P0.2

Specification: [entry-admin-mobile-unit-deactivation-p0.md](../missions/entry-admin-mobile-unit-deactivation-p0.md)

**Status:** Captured / pending design and implementation.

**Why next:** mobile administrators currently have user-level deactivation but still need a safe reversible control for suspending/reactivating a complete unit without disabling members one by one.

Required outcome: mobile administrators can safely deactivate/reactivate a complete unit, with explicit and reversible operational semantics across residents, passes and guard behavior.

## 4. Public Registration Branding Simplification — P0.3

Specification: [entry-public-registration-branding-p0.md](../missions/entry-public-registration-branding-p0.md)

**Status:** Captured / pending implementation.

**Why next:** this is a public onboarding polish issue rather than a core access-control risk, but it should be corrected before residents begin registering at scale.

Required outcome: remove the large black `Minerva Technologies` top branding block from the public registration link and replace it with discreet bottom attribution so registration content remains the focus.

## Recommended execution order

1. **Guard Invalid Pass Clarity** — highest operational/gate priority.
2. **Admin Mobile Unit Deactivation** — next operational control priority.
3. **Public Registration Branding Simplification** — final resident-facing pre-launch polish.

## Launch gate

Manual Access Evidence-First is closed. ENTRY still has **three remaining P0 pre-launch missions**. Do not treat the current pre-launch board as fully closed until those three are completed or explicitly waived by product decision.
