# ENTRY — Admin Mobile Pre-launch Batch

**Status:** READY TO START  
**Priority:** P0 / Pre-launch  
**Date:** 2026-09-05  
**Product:** ENTRY  
**Primary repo:** `rodchakk/node-bridge-foundation`  
**Area:** Admin Mobile / Units / User Management / Support

## Mission objective

Complete the remaining confirmed Admin Mobile gaps in one coordinated batch so ENTRY does not require a separate native preview build for every small correction.

This mission has exactly three active product items:

1. **Deactivate/reactivate an entire unit** safely and reversibly.
2. **Explain admin self-deactivation clearly** instead of showing a generic error.
3. **Add `Administración` to the existing native support ticket categories**.

Do not broaden this mission without explicit product approval.

## Verified current Admin Mobile state

Admin Mobile is not missing its core administration surface. Current code already supports the main operational features, including:

- create/onboard residents,
- activation PINs / pending invitations,
- directory and user editing,
- user-level active/inactive control,
- communications,
- reservations,
- recovery access.

ADMIN users also already have access to the shared resident shell where **Soporte Técnico** is available, plus a separate **Panel de Administrador** entry. Therefore, do not build a second Admin Support route.

## Item A — Unit deactivate/reactivate

### Current gap

Admin can deactivate individual users but cannot suspend a whole unit/house/apartment as one operational object.

### Product rules

- Deactivation must be reversible.
- Do not delete the unit.
- Do not rewrite or erase historical access/activity.
- Do not silently deactivate every resident profile as a destructive cascade.
- Prefer a true unit-level state that the operational system can enforce consistently.
- Authorization must remain community-scoped and role-protected.
- UI must clearly distinguish unit state from individual-user state.
- Reactivation restores normal operation without reconstructing users/history.

### Required implementation discovery before mutation

Inspect the current `houses`/unit schema and all relevant RPCs/flows before choosing the persistence model. Confirm whether an existing active/status field already exists. Do not add a redundant column if a canonical status already exists.

Map the effect of an inactive unit across:

- resident/member access,
- creation of new passes,
- already-issued passes,
- self access if tied to the unit,
- guard credential resolution/messaging,
- invitations/member management,
- admin directory/unit UI,
- reactivation.

If the current architecture makes a consistent unit-level state possible with a small safe migration/RPC layer, implement it. If the change requires a broad architectural rewrite or ambiguous destructive semantics, stop after the design/audit report and request product direction rather than guessing.

### Minimum acceptance

1. Authorized community admin can deactivate a unit.
2. Authorized community admin can reactivate it.
3. Cross-community/unauthorized actors cannot change it.
4. Historical data remains intact.
5. Resident/pass/guard behavior for inactive units is deterministic and documented.
6. UI shows current unit state and asks for confirmation before deactivation.
7. Reactivation is explicit and safe.

## Item B — Admin self-deactivation clarity

Backend RPC `admin_set_profile_active_status(uuid, boolean)` already rejects self-deactivation with SQLSTATE `42501` and backend message `You cannot deactivate your own profile`.

Keep that server-side protection.

Mobile currently surfaces a generic failure path. Replace it with clear product copy:

- Title: **`Acción no permitida`**
- Message: **`No puedes desactivar tu propia cuenta de administrador.`**
- Optional support: **`Esta acción debe realizarla otro administrador autorizado.`**

Prefer preventing the confusing request in UI when the current actor/target identity is reliably known, while still preserving backend enforcement. Never expose raw backend/database wording as the primary user message.

Do not regress deactivation/reactivation of other manageable users.

## Item C — Support category `Administración`

Reuse the existing native support system. Do not create a new Admin-only ticket backend, route or conversation model.

Add category:

**`Administración`**

Suggested helper copy:

`Unidades, administradores y configuración de la comunidad.`

Typical tickets:

- create a unit,
- add/change an administrator,
- community configuration/operational request.

This category is intentional operations/product telemetry so Minerva can separate administrative demand from resident support and identify recurring requests that later deserve self-service features.

Existing ticket history/detail/reply behavior and requester/community/role context must remain intact.

## Related registered work — explicitly OUT OF SCOPE

### Guard PR #19

Guard Invalid Pass Clarity is on a separate open PR. Do not modify or absorb PR #19 in this mission. Final comprehensive physical QA will be done later in the consolidated verification pass.

### Password Recovery

Operator confirms Password Recovery is complete and it has been removed from the active backlog. Do not reopen or touch it in this mission even if an older GitHub PR remains open.

### Public Registration Branding

Web-only mission; separate from this mobile batch.

### Minerva Console Admin Role Activity Audit

Separate registered mission: Minerva Console should later show admin creation/promotion/demotion activity with actor, target, community, timestamp and before/after role state. Do not widen this mobile PR to implement the Console audit surface unless explicitly requested.

## Terminology

Visible product language should prefer **`unidad`** rather than assuming every property is a `casa`. Internal legacy fields such as `house_id`, `house_label`, or table name `houses` may remain where changing them would create unnecessary migration risk.

## Engineering guardrails

- Start from the latest intended base branch after fetching remote state.
- One branch / one PR for this Admin Mobile batch.
- No direct push to `main`.
- No merge or auto-merge.
- No secrets.
- Preserve RLS and community scoping.
- Use SECURITY DEFINER RPCs only when consistent with existing project patterns and with explicit authorization checks.
- Avoid client-side-only security.
- No destructive cascade to residents/history for unit deactivation.
- No new native dependency unless absolutely required; none is expected for these items.
- Do not trigger an EAS build during implementation. Build only after code review and product approval of the batch.

## Required QA before requesting a build

At minimum:

- dependency install/check using the repo's established environment,
- existing tests,
- new focused tests for any pure status/authorization mapping introduced,
- TypeScript check,
- `git diff --check`,
- migration/RPC review if backend changes are required,
- inspect final diff for unrelated files.

For unit state, explicitly verify authorization, reversibility, historical preservation and behavior of passes/guard resolution in code/tests before physical QA.

## Expected delivery report

Return:

1. Current-state findings from code/schema inspection.
2. Exact unit-deactivation semantics chosen and why.
3. Backend/schema/RPC changes, if any.
4. Admin Mobile UX changes.
5. Self-deactivation error mapping behavior.
6. `Administración` category implementation.
7. Files changed.
8. Tests/checks and results.
9. Migration deployment status — distinguish created vs actually applied.
10. Commit SHA and PR URL/state.
11. Explicit confirmation: OPEN / UNMERGED / NO AUTO-MERGE / clean working tree.
12. A concise real-device QA checklist for the later consolidated build.

End with: **READY FOR GPT REVIEW — DO NOT MERGE**.