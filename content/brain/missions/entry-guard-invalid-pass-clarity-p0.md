# ENTRY — Guard Invalid Pass Clarity

**Status:** IMPLEMENTED / PR #19 OPEN / RUNTIME QA IN PROGRESS — BLOCKED BY CLASSIFICATION + NAVIGATION FIXES  
**Priority:** P0 / Pre-launch  
**Date:** 2026-09-04  
**Product:** ENTRY  
**Area:** Guard / Pass Validation / UX

## Mission objective

Before ENTRY begins real operations, the guard validation screen must explain **clearly and immediately why a pass cannot be used**.

The guard must not have to interpret a generic invalid/error state. The result must distinguish the operational reason and show the next useful action.

## Implementation state

Implementation exists in mobile PR #19:

- Repository: `rodchakk/node-bridge-foundation`
- Branch: `codex/entry-guard-invalid-pass-clarity-p0`
- PR: `#19 — ENTRY: clarify invalid pass states for guards`
- Backend/schema changes: none.
- Structured guard-facing states implemented for expired, already used, not-yet-valid, cancelled, inactive, schedule-blocked, capacity reached, unknown blocked state, pass not found, rate limit and system/connection validation failure.
- QR and PIN share the same result presentation.
- Existing valid CHECK_IN / CHECK_OUT behavior is intended to remain unchanged.
- Automated status/lookup mapping tests were added.

## Required states

At minimum, provide distinct and human-readable states for:

- **Expired** — pass validity period has ended.
- **Already used** — pass was previously consumed/closed and cannot be reused.
- **Not yet available** — pass exists but its valid-from time has not started.

Additional backend validation states should be mapped to clear guard-facing copy without exposing internal error codes.

## UX direction

The guard screen should make three things obvious at a glance:

1. **Status:** why the pass is not valid now.
2. **Operational explanation:** what happened / when it becomes valid if applicable.
3. **Next action:** what the guard should do, if anything.

Desired examples:

- `Pase vencido` — "Este pase venció hoy a las 2:30 PM. Solicita al residente un pase nuevo."
- `Pase ya utilizado` — "Este pase fue utilizado hoy a las 10:42 AM y no puede volver a usarse."
- `Pase aún no disponible` — "Este pase será válido a partir de las 5:00 PM."

Do not rely only on color. Use strong title, concise explanation, and relevant time/context.

## Runtime QA findings — 2026-09-04

### PASS — not-yet-valid

Operator tested a pass before its validity window began. The guard screen correctly rendered the **`Pase aún no disponible`** state and the timing/context was considered clear and correct.

### PASS — system/offline failure

Operator tested with no internet connection. The guard screen clearly explained that ENTRY could not validate the pass due to connection/system conditions, without falsely labeling the credential as invalid.

### PASS — nonexistent/invalid code

Operator validated the invalid/nonexistent-pass treatment and considered the copy clear.

### BLOCKER — completed pass misclassified after full cycle

Operator performed a real guard-device lifecycle test:

1. Valid pass was scanned and CHECK_IN completed.
2. CHECK_OUT completed.
3. The same pass was scanned again after it had already been used/closed.

Observed result:

- Guard UI displayed **`Pase vencido`**.
- Supporting copy said the pass **"venció mañana a las 11:31 AM"** and asked the guard to request a new pass.

This is semantically incorrect for this lifecycle. The pass had already been used and closed; its future `expires_at` should not override the consumed/used lifecycle state.

Required correction:

- Title must be **`Pase ya utilizado`**.
- Copy should explain that it was already used and, when a reliable timestamp is available, show the relevant previous-use/checkout time.
- It must **not** classify as `Pase vencido` merely because an expiration timestamp exists or is evaluated incorrectly.
- A future `expires_at` must never produce copy like "venció mañana".
- Classification precedence must respect lifecycle truth: completed/consumed state before expiration messaging.

### BLOCKER — explicit return/back CTA required on all message/result states

The Android hardware back action is intentionally disabled in Guard screens. The current reset affordance (for example `Escanear otro pase`) is too visually subtle for the operational context.

All blocked/informational guard result screens must have an obvious, high-visibility recovery CTA. Product direction:

- Prefer a clear button labeled **`Volver al escáner`**.
- It must be visually unmistakable as an actionable button, not quiet footer text.
- It should reset the current result and return the guard to the normal scan/input state.
- Apply consistently to: used, expired, not-yet-valid, nonexistent pass, offline/system failure, rate limit, cancelled/inactive/schedule/capacity/unknown blocked states.
- Do not depend on the disabled hardware back gesture/button.

The design criterion is operational simplicity: a guard under time pressure should instantly know how to leave the result and process the next visitor.

## Acceptance direction

1. Expired pass renders its own clear state.
2. Used/consumed pass renders its own clear state, including after CHECK_IN → CHECK_OUT → rescan.
3. Future/not-yet-valid pass renders its own clear state. **Runtime PASS observed.**
4. Correct date/time context is shown when available; impossible copy such as "venció mañana" must never occur.
5. No raw backend/database error codes are exposed to guards.
6. Existing valid-pass flow is unchanged.
7. Active CHECK_OUT must not be misclassified as already used.
8. Mobile layout remains fast and readable at the gate.
9. QR and PIN preserve equivalent classification semantics.
10. Every blocked/informational result has a clear **`Volver al escáner`** recovery button.
11. Offline/system failure copy is clear and distinct from invalid credential. **Runtime PASS observed.**
12. Nonexistent/invalid pass copy is clear. **Runtime PASS observed.**

## Remaining runtime QA before closure

After the two blockers above are patched, verify on a real guard device:

- CHECK_IN → CHECK_OUT → rescan => `Pase ya utilizado`,
- clear `Volver al escáner` CTA across blocked/informational screens,
- valid CHECK_IN,
- active CHECK_OUT,
- true expired pass when a suitable test credential is available.

A truly expired pass could not yet be tested because no suitable expired credential was available. This does not block applying the known classification/navigation fixes, but the expired state should be verified before final closure if practical.

This mission must be completed before ENTRY's first real operational launch.