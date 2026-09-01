# ENTRY Console Operations — 2026-09-01 Closeout

**Record ID:** `ENTRY-CONSOLE-OPS-001`

**Status:** CLOSED — implementation merged to `master` after owner preview QA and explicit `MERGE APPROVED`.

## Scope

This record captures the September 1, 2026 Minerva Console work that completed the current ENTRY unit/user operations surface and final console polish across PRs #100, #101, and #102.

The work is Console-side only. It does not represent an ENTRY mobile release and does not add a database migration.

## PR #100 — ENTRY Units Operations

PR #100, `Implement ENTRY units operations`, merged to `master` at:

`cf72cf80f94705d33200623a20c565804f1b891b`

Shipped:

- operational Units Directory and Unit Profile surfaces;
- Community Detail routing into the real Units Directory;
- resident summary/profile operations;
- quick resident creation using the existing Supabase Auth + profile/community/unit relationship model;
- resident password reset;
- resident activate/deactivate actions;
- inactive-unit protection for resident creation;
- honest handling of unavailable access-history/detail data instead of fake navigation or inferred records.

Security/architecture retained:

- no schema migration;
- mutations remain behind `requireSuperadmin()`;
- Supabase service-role access remains server-only;
- one-time credentials are exposed only in the immediate success state.

## PR #101 — Community User Management

PR #101, `Redesign ENTRY community user management`, merged to `master` at:

`91ba82cc1423c55d174e8e266310992c11cf435e`

Shipped:

- Community Users workspace aligned with the current Console visual language;
- compact metrics and simplified `Search + Role + Status` filtering;
- generic `Unit` terminology for resident assignment instead of house-specific wording;
- structured role/status badges;
- Create User for Resident/Admin/Guard;
- Edit User;
- Activate/Deactivate User;
- Reset/Set Password;
- resident unit validation and inactive-unit protection;
- community validation before password mutation.

## PR #102 — Final ENTRY User Operations + Console Polish

PR #102, `Finish ENTRY user operations and Console polish`, merged to `master` at:

`e78ace2b802c7ce10c7fb486a82265afc8dd2af9`

Final branch head before merge:

`4266c5f996f5324b0f075585277464e4eb9ded40`

Shipped:

- polished global `ENTRY users` directory;
- Deactivate/Reactivate from the global user action menu using the existing community-user status action;
- shared portal-based `FloatingActionMenu` using `document.body`, fixed positioning, high z-index, viewport-aware placement, and outside/Escape handling so known operational menus are not clipped by scroll containers/cards;
- floating menu applied to global ENTRY user actions and Unit Profile resident actions;
- resident-level `Last access` replaced with semantically correct `Last sign-in`;
- `Last sign-in` now reads Supabase Auth `last_sign_in_at` server-side;
- rows without a successful login show `Never signed in`; pending activation can show `Not activated`;
- unit-level `Last access` remains reserved for physical/unit activity semantics;
- Community Users top header normalized to the same open-page background/layout language as the rest of ENTRY Console;
- Minerva Console login simplified to a minimal logo + sign-in layout, removing repeated branding and unnecessary security/internal-system copy.

## Last Sign-In Finding

The prior resident-row `Last access` value was not failing to persist. The row had no resident activity query and rendered a fixed `No access recorded` state.

The approved replacement is account activity, not physical gate activity:

- resident row: **Last sign-in** = latest successful ENTRY authentication from Supabase Auth `last_sign_in_at`;
- unit summary: **Last access** = physical/unit access context when available.

This distinction should be preserved in future Console work.

## Owner QA / Approval

Before merge, PR #102 passed local TypeScript, lint, build, and test validation during the mission; GitHub Actions passed; the Vercel Preview was reviewed iteratively.

Owner visual QA explicitly approved the final login design, then issued `MERGE APPROVED` for PR #102.

## Design Decisions Retained

- ENTRY Console operational surfaces use a dark neutral base with restrained purple accents.
- Page headers should feel open and continuous with the page background rather than boxed hero cards unless a real product need requires a distinct surface.
- Role/status chips stay structured/squared rather than overly rounded SaaS pills.
- User management uses generic `Unit` terminology because communities may contain houses, apartments, condominiums, or other unit types.
- Operational `•••` menus should use the shared floating/portal pattern when clipping risk exists.
- Do not fabricate activity/history destinations or records when the backend/source does not exist.

## Follow-Up Boundary

The shared floating menu now solves the known affected user/resident action menus. Legacy menus elsewhere in Console do not need speculative rewrites, but should migrate to the shared pattern if clipping is observed.

This closeout does not claim a new production database migration, ENTRY mobile release, or new physical access-history backend.

## Final Verdict

`ENTRY-CONSOLE-OPS-001` is complete and closed.
