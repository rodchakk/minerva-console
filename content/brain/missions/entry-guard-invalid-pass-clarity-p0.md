# ENTRY — Guard Invalid Pass Clarity

**Status:** IMPLEMENTED / PR #19 OPEN / FINAL RUNTIME QA IN PROGRESS — RETURN CTA + EXPIRED PASS PASS  
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
- Final patch adds completed-pass precedence and a prominent `Volver al escáner` CTA.

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

## Runtime QA findings — 2026-09-04 / 2026-09-05

### PASS — not-yet-valid

Operator tested a pass before its validity window began. The guard screen correctly rendered the **`Pase aún no disponible`** state and the timing/context was considered clear and correct.

### PASS — system/offline failure

Operator tested with no internet connection. The guard screen clearly explained that ENTRY could not validate the pass due to connection/system conditions, without falsely labeling the credential as invalid.

### PASS — nonexistent/invalid code

Operator validated the invalid/nonexistent-pass treatment and considered the copy clear.

### PASS — explicit return/back CTA

After the final PR #19 patch was installed on a real guard device, the operator validated the new **`Volver al escáner`** buttons and reported that they are clear and operationally appropriate.

This closes the prior navigation/return UX blocker. The Android hardware back action remains intentionally disabled; guards now have a visible in-app recovery action on blocked/informational result screens.

### PASS — true expired pass

Operator located and tested a genuinely expired credential on a real guard device.

Observed result:

- status rendered as **`Pase vencido`**,
- supporting copy showed the actual historical expiration date/time,
- instruction asked the guard to request a new pass,
- the prominent **`Volver al escáner`** CTA was present and visually clear.

This confirms the true-expired classification and presentation on hardware. The previously missing expired-pass runtime QA is now closed.

### APPROVED SPECIAL FLOW — resident self access

The resident `SELF_ACCESS_ACTION` / self-pass behavior is an intentionally different access dynamic and was approved previously as part of ENTRY's normal operations.

Product decision reconfirmed during QA:

- self access is not a one-time visitor pass,
- it can register resident entry/exit through its dedicated flow,
- it does not use the visitor evidence workflow,
- repeated legitimate use of that special flow is expected behavior and is **not a Guard Invalid Pass bug**,
- no additional blocker, hardening mission or extra QA is required for this behavior as part of PR #19.

Do not use self-access behavior as evidence for or against the one-time visitor-pass `Pase ya utilizado` classification.

### ORIGINAL BLOCKER — completed pass misclassified after full cycle

Operator previously performed a real guard-device lifecycle test:

1. Valid one-time visitor pass was scanned and CHECK_IN completed.
2. CHECK_OUT completed.
3. The same visitor pass was scanned again after it had already been used/closed.

Observed result before the patch:

- Guard UI displayed **`Pase vencido`**.
- Supporting copy said the pass **"venció mañana a las 11:31 AM"** and asked the guard to request a new pass.

This was semantically incorrect. PR #19 was patched so completed/consumed lifecycle state now precedes expiration classification and used-pass copy prefers `checked_out_at`.

Required final runtime confirmation:

- CHECK_IN → CHECK_OUT → rescan of a one-time visitor pass must now render **`Pase ya utilizado`**.
- It must not render impossible expiration copy such as "venció mañana".
- Active CHECK_OUT must remain valid and not be treated as used.

## Acceptance direction

1. Expired pass renders its own clear state. **Runtime PASS observed.**
2. Used/consumed one-time visitor pass renders its own clear state, including after CHECK_IN → CHECK_OUT → rescan.
3. Future/not-yet-valid pass renders its own clear state. **Runtime PASS observed.**
4. Correct date/time context is shown when available; impossible copy such as "venció mañana" must never occur.
5. No raw backend/database error codes are exposed to guards.
6. Existing valid-pass flow is unchanged.
7. Active CHECK_OUT must not be misclassified as already used.
8. Mobile layout remains fast and readable at the gate.
9. QR and PIN preserve equivalent classification semantics.
10. Every blocked/informational result has a clear **`Volver al escáner`** recovery button. **Runtime PASS observed.**
11. Offline/system failure copy is clear and distinct from invalid credential. **Runtime PASS observed.**
12. Nonexistent/invalid pass copy is clear. **Runtime PASS observed.**
13. Resident self-access remains an approved special flow and is outside the one-time visitor-pass invalid-state semantics. **Product-approved behavior reconfirmed.**

## Remaining runtime QA before closure

Verify on a real guard device:

- one-time visitor pass CHECK_IN → CHECK_OUT → rescan => `Pase ya utilizado`,
- valid CHECK_IN,
- active CHECK_OUT.

The return/back CTA, true expired-pass state and resident self-access special flow are already runtime-validated/product-approved and are no longer blockers.

This mission must be completed before ENTRY's first real operational launch.