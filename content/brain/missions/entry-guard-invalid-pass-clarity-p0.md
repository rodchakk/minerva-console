# ENTRY — Guard Invalid Pass Clarity

**Status:** Captured / pending design and implementation  
**Priority:** P0 / Pre-launch  
**Date:** 2026-09-04  
**Product:** ENTRY  
**Area:** Guard / Pass Validation / UX

## Mission objective

Before ENTRY begins real operations, the guard validation screen must explain **clearly and immediately why a pass cannot be used**.

Current concern: when a pass is expired, already used, or not yet valid, the guard needs a much clearer explanation than a generic invalid/error state.

## Required states

At minimum, provide distinct and human-readable states for:

- **Expired** — pass validity period has ended.
- **Already used** — pass was previously consumed/checked in and cannot be reused.
- **Not yet available** — pass exists but its valid-from time has not started.

Additional backend validation states should be reviewed and mapped to clear guard-facing copy where appropriate, without exposing internal error codes.

## UX direction

The guard screen should make three things obvious at a glance:

1. **Status:** why the pass is not valid now.
2. **Operational explanation:** what happened / when it becomes valid if applicable.
3. **Next action:** what the guard should do, if anything.

Examples of desired clarity:

- `Pase vencido` — "Este pase venció hoy a las 2:30 PM. Solicita al residente un pase nuevo."
- `Pase ya utilizado` — "Este pase ya fue utilizado para una entrada y no puede volver a usarse."
- `Pase aún no disponible` — "Este pase será válido a partir de las 5:00 PM."

Do not rely only on color. Use strong title, concise explanation, and relevant time/context.

## Acceptance direction

1. Expired pass renders its own clear state.
2. Used pass renders its own clear state.
3. Future/not-yet-valid pass renders its own clear state.
4. Correct date/time context is shown when available.
5. No raw backend/database error codes are exposed to guards.
6. Existing valid-pass flow is unchanged.
7. Mobile layout remains fast and readable at the gate.

This mission must be completed before ENTRY's first real operational launch.