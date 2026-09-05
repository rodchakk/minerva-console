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

Includes:

- clear expired / used / future / lookup-failure states,
- completed-pass precedence fix,
- obvious `Volver al escáner` recovery CTA.

Real-device QA already passed for not-yet-valid, no-internet/system failure and pass-not-found before the final patch. Final build/device verification remains for the patched used-pass state and return CTA.

### 2. Password Recovery — PR #18

**State:** open / unmerged / manual end-to-end QA still required.

Current PR HEAD at capture: `6f6d8cddf4d24740151f2314367a6d0300d500c7`.

Remaining operational setup includes Supabase Custom SMTP using Minerva's dedicated no-reply sender, redirect allowlist/template review, then real-device recovery QA.

### 3. Admin Mobile Unit Deactivation

**State:** captured / pending implementation.

Need reversible unit deactivate/reactivate behavior with explicit semantics for residents, passes, invitations, guard behavior and historical data.

Specification: [entry-admin-mobile-unit-deactivation-p0.md](../missions/entry-admin-mobile-unit-deactivation-p0.md)

### 4. Admin Support + `Administración` Ticket Category

**State:** captured / pending implementation.

Admin Mobile currently has no native Support entry, while resident support exists. Add Admin Mobile access to the existing ticket system and category `Administración` for requests such as unit creation, new/change administrator and community configuration.

Specification: [entry-admin-support-administration-category-p0.md](../missions/entry-admin-support-administration-category-p0.md)

## Mobile item to verify before the final batch

### Generic unit terminology in admin create-user/onboarding UX

Prior product direction: visible administrator UI should use generic **unidad** terminology rather than assuming every destination is a `casa`.

Current code still carries internal `house_*` names for compatibility, which is acceptable. Before the final mobile build, visually verify that user-facing Create Resident / assignment copy remains generic (`unidad`) and does not regress to a house-only assumption.

Treat this as a verification/polish item unless a visible regression is confirmed.

## Non-mobile / does not justify an Android build by itself

### Public Registration Branding Simplification

Web/public registration polish: remove the large top Minerva branding block and use discreet bottom attribution. This should not be used as a reason to create a mobile binary.

Specification: [entry-public-registration-branding-p0.md](../missions/entry-public-registration-branding-p0.md)

## Recommended batching strategy

- Complete the current PR #19 device QA using the already-requested preview build.
- After PR #19 is closed, avoid additional ad-hoc builds while implementing the remaining mobile items.
- Reconcile/finish PR #18 and implement Admin Mobile Unit Deactivation + Admin Support in a coordinated pre-launch mobile batch.
- Run code/static/backend QA first.
- Then generate one consolidated preview build for the remaining mobile pre-launch QA whenever branch/release state allows it.

This tracker is operational planning, not merge approval. Every PR still follows the normal `MERGE APPROVED` rule.