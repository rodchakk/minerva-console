# ENTRY — Global Search & Directory Lifecycle V3

Approved prototype: entry-global-search-preview-v3.html (Nov 28, 2026).
NO-GO for production until acceptance is green. This is a partial implementation: no new destructive database or cross-community mutation is exposed.

## Draft implementation
- Global unit lookup independent of occupancy; All / Users / Units.
- Unit drawer with Overview, Household, Operational, Unit connections and Actions; original user Operational preserved.
- Reused EntryDrawerTabs, UnitRelationshipsPanel, CommunityUnitQuickActions and ResidentQuickCreate. Navigation between linked units and from user to unit.
- Superadmin authorization and existing preview read-only mutation guards.

## Remaining critical requirements
1. Unit deletion: existing admin_delete_empty_houses_bulk_v1 checks many dependencies, but review transaction locking, historical/registration/financial refs, destinations (ON DELETE SET NULL), ended relationship records (RESTRICT), and immutable audit. Inspect FK/catalog and non-FK references. No silent cascade or nulling. Preserve ended link/responsibility history separately if allowing deletion after unlink. Check and delete atomically; fail closed on unknown schema.
2. Account deletion: unused guard examples have no operational access history but DO have welcome-message actor references in community_admin_activity_log (FK to auth.users, NO ACTION) and self-targeted community_messages (FK SET NULL). Verify provenance of onboarding-only events; preserve minimal immutable audit and remove only verified welcome artifacts without changing other recipients or public message visibility. Do not bypass FK or delete real history. Check all memberships including inactive, access/manual logs, passes, reservations, financial history by membership ID, support and storage, pending registrations and responsibilities, other privileged roles. Audit lifecycle is not itself a blocker; operational audit is. Coordinate Supabase Auth deletion and revoke sessions; previously minted JWTs must be denied in sensitive operations. Recheck dependencies at execution. Explicit typed DELETE confirmation and reason; no service key in client.
3. Transfer: validate single-profile community model, community_members, RLS, RPC and mobile contracts. Never rewrite community_id of historical rows. Revoke origin, create destination membership with approved role/unit, update current context safely, revoke old authorization and verify old tokens/cross-community reads rejected. Preserve origin history and actor identity; do not carry passes/responsibilities/financial records. Block unsafe cases and last active admin. Explicit confirmation with origin/destination.
4. Add Critical actions user tab with Transfer community and conditional Delete account only; Account/Operational unchanged. Unit Actions shows Delete unit only when eligible; no dependency dashboard. Eligibility errors fail closed. No fake action.
5. Complete bidirectional navigation (unit to user, responsible person, pending activation) and refresh all result counts.

## Isolated acceptance
- Synthetic empty unit eligible; populated, pending, historical access, expired passes, linked units, responsible persons, registration history, financial record, destination refs blocked. Recheck after concurrent new reference.
- Synthetic unused inactive guard with verified onboarding artifacts eligible; operator with one historical access blocked; unrelated user/community and active sessions reject or revoke safely. Audit retained.
- Transfer operator with history to second synthetic community; origin history remains, new permissions only, no cross-tenant leak; old JWT rejected. Repeat/idempotency and failure rollback.
- Search unit with zero residents; unit -> resident -> linked unit navigation; stable drawer tabs; updates refresh without losing search; activation still works; test permissions, errors and mobile contracts.
- Full test/lint/typecheck/build in pinned Node runtime plus isolated PostgreSQL 17 + Auth/PostgREST/Storage integration and backup/restore evidence before production. No real user deletion in development. No production migration or deployment until review.

## Approved product decisions — 2026-11-28
- Unused users may be permanently removed even with verified automatic welcome and administrative setup/deactivation history; retain an administrative snapshot and the operator who deleted them. Any operational history blocks deletion.
- Previously connected units may be deleted after ending all active links/responsibilities, provided there is no operational/financial/registration history or current dependency. Archive administrative relationship history first.
- Transfer is **RESIDENT only**. Generic guard accounts, admins and superadmins are never transferable. Keep Auth identity/email/password/name/phone, select active destination community and house. Origin history and debts remain in origin, destination is a fresh membership and household; old passes/frequent accesses must not carry over, old sessions must be invalidated. Do not expose origin history to destination. No production changes authorized by this design approval.
- UI: only eligibility-approved Delete action, no dependency dashboard. Critical actions tab contains only Transfer community (residents) and Delete account when eligible. No fake action.
