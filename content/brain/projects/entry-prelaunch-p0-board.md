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

**Status:** IMPLEMENTED / PR #19 OPEN / FINAL REAL-DEVICE QA PENDING.

Current implementation now includes:

- explicit expired / used / not-yet-valid states,
- safe lookup/network failure copy,
- completed-pass classification before expiration,
- `checked_out_at` as used-pass context,
- high-visibility `Volver al escáner` CTA for blocked/informational states.

Current PR #19 HEAD at capture: `dbacf0b040f86a172d9687a2e64dcf2340fa7e81`.

Previous real-device QA passed for `Pase aún no disponible`, no-internet/system failure, pass-not-found and normal valid behavior. The original CHECK_IN → CHECK_OUT → rescan defect was patched and must now be re-tested, together with the new return CTA, before merge approval.

## 3. Admin Mobile Unit Deactivation — P0.2

Specification: [entry-admin-mobile-unit-deactivation-p0.md](../missions/entry-admin-mobile-unit-deactivation-p0.md)

**Status:** Captured / pending design and implementation.

Mobile administrators currently have user-level deactivation but still need safe reversible unit-level deactivate/reactivate behavior without destructive cascades or history loss.

The implementation must explicitly define effects on residents, pass creation/use, guard messaging, invitations/member management and reactivation.

## 4. Admin Support + `Administración` Ticket Category — P0.3

Specification: [entry-admin-support-administration-category-p0.md](../missions/entry-admin-support-administration-category-p0.md)

**Status:** Captured / pending implementation.

ENTRY's native ticket system currently exists in the resident mobile support surface, but Admin Mobile has no equivalent Support entry. Add a clear Admin Mobile support path and category **`Administración`** for requests such as:

- create a unit,
- add/change an administrator,
- community configuration/operational changes.

This category is also intentionally useful product telemetry: Minerva should be able to separate administrative demand from resident support and identify recurring requests that deserve future self-service features.

## 5. Password Recovery / No-reply Email Flow — P0.4

**Status:** PR #18 OPEN / UNMERGED / operational configuration + end-to-end QA pending.

PR #18 implements the mobile recovery-flow hardening and routes recovery through Minerva's existing HTTPS bridge. Remaining work includes production-like Supabase SMTP/redirect/template configuration and real-device end-to-end recovery QA.

Current PR #18 HEAD at capture: `6f6d8cddf4d24740151f2314367a6d0300d500c7`.

Do not treat the historical `Olvidé mi contraseña` bug as closed until this flow is configured, tested and merged.

## 6. Public Registration Branding Simplification — P0.5

Specification: [entry-public-registration-branding-p0.md](../missions/entry-public-registration-branding-p0.md)

**Status:** Captured / pending implementation.

Remove the large black `Minerva Technologies` top branding block from the public registration link and replace it with discreet bottom attribution so registration remains the focus.

This is web/public registration polish and does **not** justify a new mobile binary by itself.

## Mobile build batching

Tracker: [entry-mobile-prelaunch-build-batch.md](entry-mobile-prelaunch-build-batch.md)

Because preview/native builds are taking meaningful time, compatible mobile changes should be grouped whenever practical. Current mobile batch candidates are:

1. finish PR #19 final device QA using the already-requested preview build,
2. password recovery PR #18,
3. Admin Mobile Unit Deactivation,
4. Admin Support + `Administración` category,
5. visually verify generic `unidad` terminology in admin create-resident/assignment UX before the final mobile release build.

Do code/static/backend QA first, then prefer one consolidated preview build for the remaining compatible mobile work rather than a new build for every small correction.

## Recommended execution order

1. Finish PR #19 real-device QA and close Guard Invalid Pass Clarity.
2. Implement Admin Mobile Unit Deactivation and Admin Support/`Administración` in the same mobile cleanup window where practical.
3. Reconcile and finish Password Recovery PR #18 with required external SMTP/redirect setup and real-device QA.
4. Perform one consolidated mobile pre-launch QA build after the remaining compatible mobile changes are integrated into the intended release state.
5. Complete Public Registration Branding separately on web.

## Launch gate

Manual Access Evidence-First is closed. The remaining launch board now explicitly tracks Guard Invalid Pass Clarity, Admin Mobile Unit Deactivation, Admin Support/`Administración`, Password Recovery and Public Registration Branding. None should be considered closed merely because code exists; runtime/operational QA and explicit merge approval still apply.