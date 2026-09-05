# ENTRY — Admin Self-Deactivation Clarity

**Status:** Captured / pending implementation  
**Priority:** P0 polish / Pre-launch mobile batch  
**Date:** 2026-09-05  
**Product:** ENTRY  
**Area:** Admin Mobile / User Management / UX

## Mission objective

When an administrator attempts to deactivate their own administrator account/profile, ENTRY must not show a generic error. The UI should clearly explain that self-deactivation is not allowed.

## Current backend behavior

`admin_set_profile_active_status(uuid, boolean)` already blocks self-deactivation at the backend level with:

`You cannot deactivate your own profile`

using SQLSTATE `42501`.

Therefore, the safety rule already exists server-side. The remaining product gap is guardrail clarity in the mobile administrator UX.

## Product decision

When the current administrator attempts to set their own profile inactive, show a clear Spanish message before or after the protected RPC result instead of exposing a generic failure.

Preferred UX:

**Title:** `Acción no permitida`

**Message:** `No puedes desactivar tu propia cuenta de administrador.`

Optional supporting copy if useful:

`Esta acción debe realizarla otro administrador autorizado.`

Keep the backend restriction in place even if the UI pre-validates the action.

## Acceptance direction

1. Admin attempts to deactivate their own account/profile.
2. No destructive state change occurs.
3. UI shows `Acción no permitida` with clear explanation that self-deactivation is not allowed.
4. Do not show raw backend/database copy or a generic `Error / No se pudo guardar` as the primary explanation.
5. Deactivation of other authorized manageable users keeps current behavior.
6. Backend self-deactivation protection remains unchanged.

## Build batching

This is a small Admin Mobile JS/TS UX polish item and should be grouped with the remaining Admin Mobile pre-launch batch rather than triggering a standalone preview build.