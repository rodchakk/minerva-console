# ENTRY — Admin Mobile Unit Deactivation

**Status:** Captured / pending design and implementation  
**Priority:** P0 / Pre-launch  
**Date:** 2026-09-04  
**Product:** ENTRY  
**Area:** Admin Mobile / Units / Access Control  

## Mission objective

Before ENTRY begins real operations, the mobile administrator experience must be able to **deactivate and reactivate an entire unit**, not only individual users.

Current operational gap: the mobile administrator can deactivate users, but there is no equivalent unit-level control. In real community operations, administration may need to suspend a house/apartment/unit as a whole without manually disabling every member one by one.

## Product direction

Add an authorized mobile-admin action to deactivate/reactivate a unit.

Expected principles:

- Deactivation is reversible; do not delete the unit or rewrite history.
- The UI must clearly distinguish **Deactivate unit** from user deactivation.
- Existing historical access/activity for the unit remains intact.
- Reactivation restores the unit to normal operational state.
- Authorization remains community-scoped and role-protected.
- The state change should be auditable where ENTRY already supports audit metadata/activity.

## Required design review before implementation

Explicitly define what an inactive unit means for:

- resident/member access to ENTRY,
- creation of new passes,
- use of already-issued passes,
- guard visibility and messaging,
- invitations and member management,
- reactivation behavior.

Do not silently cascade destructive changes to users. Prefer a unit-level active/inactive state that operational flows can respect consistently.

## Minimum acceptance direction

1. Authorized admin can deactivate a unit from mobile.
2. Authorized admin can reactivate it.
3. Unauthorized/cross-community users cannot change unit state.
4. Historical data remains intact.
5. Runtime behavior of passes/members for inactive units is explicit and consistently enforced.
6. UI clearly communicates current unit status and consequences before confirmation.

This mission must be completed before ENTRY's first real operational launch.