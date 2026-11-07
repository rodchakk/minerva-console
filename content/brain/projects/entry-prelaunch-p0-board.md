# ENTRY — Pre-launch P0 Board

**Updated:** 2026-09-05  
**Rule:** These missions are expected to be completed before ENTRY begins its first real community operations, unless explicitly waived by product decision.

## 1. Manual Access Evidence-First Redesign — ✅ CLOSED

Specification: [entry-manual-access-evidence-first-p0.md](../missions/entry-manual-access-evidence-first-p0.md)  
Closeout: [entry-manual-access-evidence-first-closeout-2026-09-04.md](../missions/entry-manual-access-evidence-first-closeout-2026-09-04.md)

**Status:** ✅ COMPLETED / MERGED / PRODUCTION-VALIDATED

Validated outcome includes real Android vehicle/pedestrian manual-access QA, required evidence, OCR propagation, manual checkout, Admin Web QA, Minerva Console destination management and merged implementation PRs.

## 2. Guard Invalid Pass Clarity — P0.1

Specification: [entry-guard-invalid-pass-clarity-p0.md](../missions/entry-guard-invalid-pass-clarity-p0.md)

**Status:** IMPLEMENTED / PR #19 OPEN / FINAL COMPREHENSIVE DEVICE QA PENDING.

Current implementation includes explicit expired / used / not-yet-valid states, safe lookup/network failure copy, completed-pass classification before expiration, `checked_out_at` as used-pass context and high-visibility `Volver al escáner` CTA.

Current PR #19 HEAD at capture: `dbacf0b040f86a172d9687a2e64dcf2340fa7e81`.

Runtime PASS already observed for not-yet-valid, offline/system failure, pass-not-found, true expired pass and the new return CTA. Self Access is an approved special reusable resident flow and is not part of the one-time-pass blocker. Operator plans one broader end-to-end guard verification after the remaining pre-launch changes are complete.

## 3. Admin Mobile Unit Deactivation — P0.2

Specification: [entry-admin-mobile-unit-deactivation-p0.md](../missions/entry-admin-mobile-unit-deactivation-p0.md)

**Status:** CONFIRMED GAP / next active mission.

Current-code review confirms Admin Mobile already provides its main operational features: create/onboard residents, activation PINs, directory/user editing, user-level active/inactive control, communications, reservations and recovery access.

The specific missing control is **deactivate/reactivate an entire unit** instead of disabling each resident/user one by one.

The implementation must remain reversible and explicitly define effects on residents, pass creation/use, guard messaging, invitations/member management and reactivation, while preserving history.

## 4. Admin Self-Deactivation Clarity — P0.3

Specification: [entry-admin-self-deactivation-clarity-p0.md](../missions/entry-admin-self-deactivation-clarity-p0.md)

**Status:** CONFIRMED UX GAP / include in Admin Mobile batch.

Backend already prevents an administrator from deactivating their own profile. Mobile currently falls back to a generic error path. Replace it with a clear message such as:

- `Acción no permitida`
- `No puedes desactivar tu propia cuenta de administrador.`
- optional: `Esta acción debe realizarla otro administrador autorizado.`

Do not weaken or remove the backend restriction.

## 5. `Administración` Support Ticket Category — P0.4

Specification: [entry-admin-support-administration-category-p0.md](../missions/entry-admin-support-administration-category-p0.md)

**Status:** Captured / pending small mobile implementation.

ADMIN users already have access to the shared `/resident/support` flow, so no new Admin-only support route is needed.

The actual gap is only adding category **`Administración`** to the existing native support picker for requests such as unit creation, administrator changes and community configuration. This category is also intentional operations/product telemetry.

## 6. Public Registration Branding Simplification — P0.5

Specification: [entry-public-registration-branding-p0.md](../missions/entry-public-registration-branding-p0.md)

**Status:** Captured / pending implementation.

Remove the large black `Minerva Technologies` top branding block from the public registration link and replace it with discreet bottom attribution so registration remains the focus.

This is web/public registration polish and does **not** justify a new mobile binary by itself.

## Removed from active backlog

### Password Recovery / No-reply Email Flow

**Status:** Operator confirms this work is complete. Remove it from the active pre-launch pending list and do not reopen it as part of the Admin mission.

Repository PR #18 may still appear open as historical/repository state; that alone is not authorization to re-add the feature to active scope. Reconcile repository hygiene separately only if explicitly requested.

## Adjacent Minerva Console mission — not part of Admin Mobile build

### Admin Role Activity Audit

Specification: [minerva-console-admin-role-audit-log.md](../missions/minerva-console-admin-role-audit-log.md)

Minerva Console must eventually show who created/promoted/demoted administrators, who performed the action, the target user, community, timestamp and before/after role state. This is registered, but it is a separate Console/audit mission and should not widen the Admin Mobile PR unless explicitly requested.

## Mobile build batching

Tracker: [entry-mobile-prelaunch-build-batch.md](entry-mobile-prelaunch-build-batch.md)

Because preview/native builds are taking meaningful time, compatible mobile changes should be grouped whenever practical. Current mobile batch candidates are:

1. Admin Mobile Unit Deactivation,
2. Admin Self-Deactivation Clarity,
3. `Administración` support category.

Guard PR #19 will receive final comprehensive physical QA in the broader final verification pass. Do code/static/backend QA first, then prefer one consolidated preview build for the remaining compatible mobile work rather than a new build for every small correction.

## Recommended execution order

1. Start the consolidated Admin Mobile pre-launch mission.
2. Implement unit deactivate/reactivate semantics safely.
3. Add self-deactivation clarity and `Administración` ticket category in the same mobile cleanup batch.
4. Run code/static/backend QA before requesting another preview build.
5. Generate one consolidated preview build for Admin + final comprehensive mobile verification.
6. Complete Public Registration Branding separately on web.
7. Keep Minerva Console Admin Role Activity Audit as a separate later mission.

## Launch gate

Manual Access Evidence-First is closed. Password Recovery is removed from the active backlog by operator confirmation. Remaining explicitly tracked launch work is Guard final comprehensive QA, Admin Mobile Unit Deactivation, Admin Self-Deactivation Clarity, `Administración` support category and Public Registration Branding. None should be considered closed merely because code exists; runtime/operational QA and explicit merge approval still apply.