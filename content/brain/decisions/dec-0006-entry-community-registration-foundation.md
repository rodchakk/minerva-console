# Decision - ENTRY Community Registration Foundation

## Identity

- **ID:** `DEC-0006`
- **Title:** ENTRY Community Registration Foundation
- **Status:** `approved`
- **Date:** 2026-08-05
- **Tags:** entry, onboarding, community-registration, supabase, migrations
- **Related:** `ENTRY-ONB-000`, `content/brain/harness/ENTRY_COMMUNITY_ONBOARDING_ANALYSIS.md`, `content/brain/projects/entry-community-onboarding-phase-0-reconciliation.md`

## Context

ENTRY needs a public, community-distributed registration surface so residents can submit household information before accounts are activated. Phase 0 concluded `GO WITH PREREQUISITES`: the concept is approved, but product implementation is not authorized until the foundation contract fixes repository authority, activation lane, data boundaries, public route placement, migration rules, and readiness for `ENTRY-ONB-001`.

Evidence reviewed for this decision:

- **CONFIRMED:** Minerva Console contains Brain, the administrative console, public web routes, Supabase SSR middleware, onboarding actions, onboarding migrations and the email batch Edge Function. Current checkout during `ENTRY-ONB-000`: repo `D:\Dev\minerva-console`, branch `codex/minerva-console-auth-recovery-001`, HEAD `60589e5`; newer local branch `codex/entry-first-door-patronato-package-v1` exists at `94d895d`.
- **CONFIRMED:** ENTRY mobile is repo `D:\Dev\node-bridge-foundation`, branch `entry-reset-003-recovery-deeplink-evidence`, HEAD `79706be`, app name `Entry`, scheme `entry`, bundle/package `com.minervatechnologies.entry`.
- **CONFIRMED:** Supabase live project `gate-project-dev` (`ytzvislhvrcdtkbtpbmu`) is active and exposes the operational ENTRY schema inspected read-only.
- **CONFIRMED:** No live or local `community_registration*` / `pre_onboarding*` tables exist.

## Decision

### D-001 - Repository Authority

**DECIDED:** `D:\Dev\minerva-console` is the principal repository for Community Registration.

Minerva Console owns the first implementation because it already contains:

- Brain and decision artifacts under `content/brain/**`;
- the administrative ENTRY console under `app/(console)/products/entry/**`;
- the web app and public route surface;
- Supabase SSR middleware in `proxy.ts` and `lib/supabase/middleware.ts`;
- onboarding actions and migrations related to activation queue, PINs and campaigns;
- the `send-onboarding-email-batch` Edge Function.

**DECIDED:** `D:\Dev\node-bridge-foundation` remains ENTRY mobile and consumes the final activation flow. Community Registration v1 must not require mobile changes.

### D-002 - Activation Lane

**DECIDED:** Community Registration ends at `resident_activation_queue`.

The official lane is:

```text
community_registration_* approved resident
        -> resident_activation_queue
        -> resident_activation_pins / invitation
        -> validate_resident_activation_pin_v1
        -> complete_resident_activation_pin_v1
        -> Supabase Auth
        -> profiles + community_members + house_residents
```

**DECIDED:** Community Registration must not create Supabase Auth users directly.

**DECIDED:** Community Registration must not use `resident_invites`, `account_activation_codes`, `activate-account-by-code`, or `claim-resident-invite` as its primary lane.

### D-003 - Data Separation

**DECIDED:** Public capture data lives first in new pre-onboarding entities. Public, unreviewed submissions must not insert directly into:

- `auth.users`;
- `profiles`;
- `community_members`;
- `house_residents`;
- `resident_invites`;
- `resident_activation_queue`.

Conversion to `resident_activation_queue` is a later explicit, audited, idempotent internal operation.

### D-004 - Public Surface

**DECIDED:** The public web page initially lives inside Minerva Console, outside `app/(console)`, with its own layout and explicit middleware allowlist.

Preferred direction:

```text
app/
  (public)/
    entry/
      register/
        [campaignSlug]/
```

**CONFIRMED:** Next.js route groups such as `(public)` do not affect the URL path and can provide separate layouts. The existing console gate is isolated in `app/(console)/layout.tsx`, which calls `requireSuperadmin()`. Therefore a route outside `(console)` will not inherit `requireSuperadmin()` by layout.

**DECIDED:** The future implementation must update `lib/supabase/middleware.ts` explicitly so the public route does not redirect anonymous residents to `/login`.

### D-005 - Migration Authority

**DECIDED:** For new Community Registration objects, forward-only migrations under Minerva Console are the source of truth from the first schema change.

**DECIDED:** This project will not reconstruct, rename, or rewrite the 292 historical migrations already applied in Supabase live.

Rules:

- live schema is the operational baseline;
- new objects are born versioned in Minerva Console;
- new tables, RPCs, policies and changes each get their own migrations;
- no manual Dashboard objects without migration;
- no production schema change before review and authorization;
- local historical timestamps must not be assumed to match live migration versions.

## Alternatives Discarded

### Use ENTRY mobile for first capture

**Discarded.** Mobile is already a consumer of activation. It should not be required for residents who do not yet have an ENTRY account, and the first MVP must work from a WhatsApp web link.

### Insert public submissions directly into `resident_activation_queue`

**Discarded.** The queue already means "prepared for activation." Using it for raw public submissions would mix unreviewed data with operational activation and make reset, correction, patronato review and audit harder.

### Create Auth users directly from Community Registration

**Discarded.** The existing activation lane already handles PIN validation, Auth user creation, profiles, memberships and house residents. Bypassing it would duplicate sensitive account creation logic.

### Make legacy invites the new lane

**Discarded.** `resident_invites` and `account_activation_codes` remain active for compatibility and fallback paths, but Community Registration must not add new dependency to that lane.

### Rebuild historical migration history

**Discarded.** Supabase live has 292 historical migrations and local filenames do not match several live versions. Rewriting history now would create risk without being necessary for new forward-only objects.

## Consequences

- Community Registration becomes a Minerva Console web/admin module.
- ENTRY mobile remains unchanged for v1.
- The new module requires new pre-onboarding tables and RPCs in `ENTRY-ONB-001`; none are created in `ENTRY-ONB-000`.
- `resident_activation_queue` becomes the canonical integration boundary.
- The legacy activation lane remains supported but isolated.
- New migrations in this project must be forward-only and reviewed before application.
- The public route requires an explicit middleware allowlist when implemented.

## Limits

This decision does not authorize:

- table creation;
- migrations;
- DDL or DML;
- RLS/grant/Auth changes;
- Edge Function deployment;
- UI routes or components;
- mobile changes;
- commit, PR, push or deployment.

This decision stores no PII and no production rows.

## Legacy Rule

**DECIDED:** No `ENTRY-ONB-*` mission may add new dependencies to the legacy activation lane (`resident_invites`, `account_activation_codes`, `activate-account-by-code`, `claim-resident-invite`) unless a later approved decision explicitly authorizes that exception.

The legacy lane remains intact and out of scope. It must not be removed or refactored inside Community Registration foundation or MVP missions.

## Migration Rule

**DECIDED:** Every Community Registration schema object must be created by a forward-only migration in Minerva Console. Later changes must be represented as later migrations. Do not edit already-applied migrations to simulate live history.

Before applying any migration:

- review diff;
- review SQL;
- test locally or in a safe environment;
- obtain human approval.

After applying:

- verify catalog;
- run tests;
- record evidence;
- regenerate TypeScript types after approved schema changes.

## Conditions For Future Review

Review this decision only if one of these becomes true:

- ENTRY mobile must own initial capture for a product reason not present in `ENTRY-ONB-000`;
- Supabase live removes or replaces `resident_activation_queue`;
- patronato access must become a full authenticated role before MVP;
- a production incident requires retiring the legacy activation lane;
- deployment architecture moves the public route to a separate web app/domain.
