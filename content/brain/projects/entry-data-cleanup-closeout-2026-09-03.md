# ENTRY Data Cleanup — 2026-09-03 Closeout

**Record ID:** `ENTRY-DATA-001`

**Status:** CLOSED — operator-directed cleanup completed and smoke-tested successfully.

## Purpose

This record captures the September 3, 2026 cleanup of accumulated non-production test data in the ENTRY Supabase project before prospective-customer demos and onboarding work.

This is an operational closeout record only. It does not change ENTRY product architecture, runtime code, schemas, RLS, application features, or release artifacts.

## Approved Retention Boundary

The cleanup used an explicit whitelist:

- retain `Residencial Paradis` as the single stable demo/test community;
- retain all users and operational records belonging to `Residencial Paradis`;
- retain the Minerva Console internal account;
- retain the ENTRY Superadmin internal account;
- remove all other test communities and their dependent test data;
- remove Auth users that no longer had a protected purpose after cleanup.

The retained community is identified by the fixed community UUID used during the operation rather than name-only destructive matching.

## Pre-Cleanup State

Before cleanup, the hosted ENTRY environment contained:

- 25 communities;
- 325 Supabase Auth users;
- 314 community-membership rows;
- substantial historical test data across passes, logs, alerts, notifications, units, onboarding campaigns, profiles, visitors, invites, and related tables.

A second community named simply `Paradis` existed independently from `Residencial Paradis`; it was not part of the retention whitelist and was removed with the other test communities.

## Recovery Point

Before any destructive operation, a database-side recovery snapshot was created under:

`entry_cleanup_backup_20260903`

The snapshot captured 65 tables plus the original Auth user/identity state needed for recovery. At creation time it included:

- 25 communities;
- 314 community memberships;
- 325 Auth users;
- 324 Auth identities.

The backup schema is intentionally unavailable to the normal `anon`, `authenticated`, and `public` roles.

The recovery snapshot is temporary and should remain until the operator is satisfied that post-cleanup demos/onboarding remain stable. Its later removal is a separate maintenance action.

## Execution Method

The operation was performed conservatively:

1. inventory communities, Auth users, protected internal accounts, and dependency relationships;
2. create and verify the recovery snapshot;
3. perform transaction-based dry-runs before any persistent delete;
4. resolve deletion-order constraints revealed by foreign keys and check constraints;
5. repeat the full cleanup as a dry-run until the expected terminal state was reached;
6. execute the same validated sequence persistently;
7. run post-cleanup integrity checks.

Dry-runs surfaced two important dependency-order issues before the real commit:

- the community-registration resident / activation-queue relationship contains a restrictive cycle that required controlled ordering;
- `entry_logs` must be removed before related frequent-visitor rows in affected non-retained communities to avoid invalid intermediate states.

Those failed dry-runs were rolled back completely and did not persist partial cleanup state.

## Final Verified State

Post-cleanup verification returned:

- **1 community:** `Residencial Paradis`;
- **233 community memberships**;
- **233 profiles**;
- **235 Auth users total**;
- **235 Auth identities**;
- **1 Superadmin row**;
- **1 Minerva Console member row**;
- **0 memberships outside the retained community**;
- **0 profiles outside the retained community**;
- **0 unprotected Auth users remaining**.

Retained ENTRY role distribution:

- 230 Residents;
- 2 Admins;
- 1 Guard.

## Retained Data Integrity Check

Representative `Residencial Paradis` counts were compared before and after the cleanup and remained unchanged:

- 26 units;
- 796 visit passes;
- 1,166 entry logs;
- 116 authorized frequent visitors;
- 103 resident invites;
- 526 community notifications;
- 222 emergency alerts;
- 3 community facilities.

No retained membership, Superadmin, or Console-member account was left without its corresponding Auth user.

## Operator Smoke Test

After the cleanup, the operator exercised multiple ENTRY flows and reported no noticeable problem or regression.

The cleanup is therefore considered operationally successful.

## Current Demo/Test Convention

Until intentionally changed by a future approved maintenance action:

- `Residencial Paradis` is the canonical stable ENTRY demo/test community in the hosted environment;
- temporary QA communities should not be allowed to accumulate indefinitely;
- future disposable test tenants should be explicitly removed after their test purpose is complete.

This convention is operational hygiene, not a product limitation: ENTRY remains a multi-community system.

## Boundaries

This record does **not** claim:

- that `Residencial Paradis` contains real customer data;
- that ENTRY has moved to a single-tenant architecture;
- that the recovery snapshot replaces a formal production backup strategy;
- that staging/environment-separation work has been completed;
- that any application code or database schema changed as part of this cleanup.

All cleaned community/user data was test data per operator confirmation.

## Final Verdict

`ENTRY-DATA-001` is complete and closed. ENTRY's hosted test/demo environment is materially cleaner, `Residencial Paradis` is preserved as the canonical demo tenant, protected internal access remains intact, and a temporary rollback snapshot is available if a later regression is discovered.
