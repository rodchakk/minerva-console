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

## Confirmed mobile items

### 1. Guard Invalid Pass Clarity — PR #19

**State:** implemented / patched / final device QA pending.

Current PR HEAD at capture: `dbacf0b040f86a172d9687a2e64dcf2340fa7e81`.

Includes clear blocked-pass states, completed-pass precedence fix and obvious `Volver al escáner` recovery CTA.

### 2. Password Recovery — PR #18

**State:** open / unmerged / manual end-to-end QA still required.

Current PR HEAD at capture: `6f6d8cddf4d24740151f2314367a6d0300d500c7`.

Remaining operational setup includes Supabase Custom SMTP, redirect/template review and real-device recovery QA.

### 3. Admin Mobile Unit Deactivation

**State:** confirmed gap / pending implementation.

Current Admin Mobile already supports resident creation/onboarding, activation PINs, user directory/editing, user-level active/inactive control, communications, reservations and recovery access. The specific missing administrative control is **deactivate/reactivate an entire unit**, rather than disabling users one by one.

Specification: [entry-admin-mobile-unit-deactivation-p0.md](../missions/entry-admin-mobile-unit-deactivation-p0.md)

### 4. Admin Self-Deactivation Clarity

**State:** confirmed UX polish / pending implementation.

Backend already blocks an administrator from deactivating their own profile, but the mobile UI currently falls back to a generic error path. Replace that with a clear administrator-facing explanation.

Preferred copy:

- Title: `Acción no permitida`
- Message: `No puedes desactivar tu propia cuenta de administrador.`
- Optional support: `Esta acción debe realizarla otro administrador autorizado.`

Keep the backend restriction unchanged; this is a UX clarity fix.

Specification: [entry-admin-self-deactivation-clarity-p0.md](../missions/entry-admin-self-deactivation-clarity-p0.md)

### 5. Support Ticket Category `Administración`

**State:** captured / pending small UI implementation.

Current code already gives ADMIN users access to the shared `/resident/support` flow because ADMIN lands on `/resident`; the resident drawer contains both **Soporte Técnico** and **Panel de Administrador**. No new Admin Support route is required.

Only add category **`Administración`** to the existing support category picker for requests such as unit creation, administrator changes and community configuration.

Specification: [entry-admin-support-administration-category-p0.md](../missions/entry-admin-support-administration-category-p0.md)

## Non-mobile / does not justify an Android build by itself

### Public Registration Branding Simplification

Web/public registration polish: remove the large top Minerva branding block and use discreet bottom attribution. This should not be used as a reason to create a mobile binary.

Specification: [entry-public-registration-branding-p0.md](../missions/entry-public-registration-branding-p0.md)

## Recommended batching strategy

- Complete the current PR #19 device QA using the already-requested preview build.
- After PR #19 is closed, avoid additional ad-hoc builds while implementing the remaining mobile items.
- Reconcile/finish PR #18 and implement Admin Mobile Unit Deactivation + Admin Self-Deactivation Clarity + `Administración` ticket category in a coordinated pre-launch mobile cleanup window.
- Run code/static/backend QA first.
- Then generate one consolidated preview build for the remaining mobile pre-launch QA whenever branch/release state allows it.

This tracker is operational planning, not merge approval. Every PR still follows the normal `MERGE APPROVED` rule.