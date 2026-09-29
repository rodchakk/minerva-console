# ENTRY — Mobile Pre-launch Build Batch

**Date:** 2026-09-05  
**Purpose:** Minimize repeated Android/iOS preview and production builds by grouping compatible mobile changes before requesting new binaries.

## Rule

Do not request a new native build for every small JS/TS mobile correction. Whenever practical:

1. Finish code review and automated checks first.
2. Group compatible mobile fixes into the same pre-launch batch.
3. Use one preview build for final physical QA of the grouped changes.
4. Only rebuild earlier when a mission cannot be safely reviewed without device/runtime evidence.

Native/config changes that alter the runtime still require an appropriate new build.

## Current active mobile batch

### 1. Admin Mobile Unit Deactivation

**State:** confirmed gap / next active mission.

Current Admin Mobile already supports resident creation/onboarding, activation PINs, user directory/editing, user-level active/inactive control, communications, reservations and recovery access. The specific missing administrative control is **deactivate/reactivate an entire unit**, rather than disabling users one by one.

Specification: [entry-admin-mobile-unit-deactivation-p0.md](../missions/entry-admin-mobile-unit-deactivation-p0.md)

### 2. Admin Self-Deactivation Clarity

**State:** confirmed UX polish / include in same Admin batch.

Backend already blocks an administrator from deactivating their own profile, but the mobile UI currently falls back to a generic error path. Replace that with a clear administrator-facing explanation.

Preferred copy:

- Title: `Acción no permitida`
- Message: `No puedes desactivar tu propia cuenta de administrador.`
- Optional support: `Esta acción debe realizarla otro administrador autorizado.`

Keep the backend restriction unchanged; this is a UX clarity fix.

Specification: [entry-admin-self-deactivation-clarity-p0.md](../missions/entry-admin-self-deactivation-clarity-p0.md)

### 3. Support Ticket Category `Administración`

**State:** captured / pending small UI implementation.

Current code already gives ADMIN users access to the shared `/resident/support` flow because ADMIN lands on `/resident`; the resident drawer contains both **Soporte Técnico** and **Panel de Administrador**. No new Admin Support route is required.

Only add category **`Administración`** to the existing support category picker for requests such as unit creation, administrator changes and community configuration.

Specification: [entry-admin-support-administration-category-p0.md](../missions/entry-admin-support-administration-category-p0.md)

## Guard final QA

Guard Invalid Pass Clarity PR #19 is implemented and patched. Runtime PASS has already been observed for not-yet-valid, offline/system failure, pass-not-found, true expired pass and the prominent `Volver al escáner` CTA. Self Access is an approved special reusable resident flow.

Operator plans a final comprehensive physical QA pass after the remaining pre-launch work is complete. Do not create another standalone guard build now.

## Removed from active mobile backlog

### Password Recovery

Operator confirms Password Recovery is already complete. Remove it from active batch planning and do not reopen it as part of this Admin mission.

PR #18 may still appear open in GitHub as repository state; that is a separate repository-hygiene concern, not active product scope unless explicitly requested.

## Non-mobile / does not justify an Android build by itself

### Public Registration Branding Simplification

Web/public registration polish: remove the large top Minerva branding block and use discreet bottom attribution. This should not be used as a reason to create a mobile binary.

Specification: [entry-public-registration-branding-p0.md](../missions/entry-public-registration-branding-p0.md)

### Minerva Console Admin Role Activity Audit

Registered separately in [minerva-console-admin-role-audit-log.md](../missions/minerva-console-admin-role-audit-log.md). It should not widen the Admin Mobile implementation PR unless explicitly requested.

## Recommended batching strategy

- Start Admin Mobile work now without waiting for a new preview build.
- Implement Unit Deactivation + Self-Deactivation Clarity + `Administración` ticket category together where practical.
- Run static, unit and backend/RPC checks first.
- Avoid touching Guard PR #19 or reopening Password Recovery.
- After the Admin batch is code-reviewed and integrated into the intended release state, generate one consolidated preview build for Admin QA plus final comprehensive mobile verification.

This tracker is operational planning, not merge approval. Every PR still follows the normal `MERGE APPROVED` rule.