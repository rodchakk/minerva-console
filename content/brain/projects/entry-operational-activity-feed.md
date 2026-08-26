# ENTRY — Operational Activity Feed

Official Brain capture for `ENTRY-OPS-001`, the Minerva Console Operational Activity feed for ENTRY.

This document records product and architecture knowledge only. Brain must not connect to ENTRY operational data or read the ENTRY Supabase runtime directly; see `DEC-0004`.

## Status

- **Mission:** `ENTRY-OPS-001 — Operational Activity Feed`
- **Status:** Completed and merged.
- **PR:** `#71`
- **Feature branch:** `entry-ops-001-operational-activity`
- **Final feature commit before squash:** `5fd9edaaff1a8da61070a981d9d0404ce2b63f32`
- **Squash commit on `master`:** `e6f52b8fc16e045fca4b4b730e45d12571f4e0ca`
- **Production:** Vercel deployment for the squash commit reached `READY` and is aliased to `console.minervatechs.com`.
- **Date closed:** 2026-08-26.

## Product purpose

The ENTRY dashboard previously reserved an empty Operational Activity table for future system events. `ENTRY-OPS-001` connected that surface to real ENTRY activity while intentionally avoiding a raw audit-log experience.

The dashboard should answer one simple question:

> What important thing happened recently in ENTRY?

The feed is deliberately curated so it remains useful to Minerva operators without competing visually with higher-priority dashboard KPIs and community setup cards.

## Activity shown

The feed is designed around meaningful human-operational events, including:

- community created;
- units added/imported;
- resident registration submitted or resubmitted;
- correction requested;
- registration reviewed or confirmed;
- residents moved/prepared for activation;
- activation queue reviewed;
- onboarding completed;
- community message published;
- important user/community administrative state changes;
- selected operational failures that need attention.

The dashboard intentionally hides noisy or overly granular events such as facilities configuration, activation-PIN generation, internal conversion attempts, raw system events, token operations, and other implementation-level audit noise.

## Security and privacy contract

The feed is not a raw database log.

The database read model exposes only sanitized fields required by the dashboard. It does not return raw metadata, message bodies, access tokens, phone numbers, email addresses, or other contact data.

The new RPC is protected for superadmin use and independently validates authorization inside the database function. Anonymous/public execution is not allowed. The mission also removed unnecessary anonymous execution from the existing community activity RPC while preserving authenticated use.

## Backend implementation

A formal Supabase migration added the curated read model:

`supabase/migrations/20260826072215_entry_ops_001_operational_activity_feed.sql`

Primary RPC:

`list_entry_operational_activity_v1`

The migration was applied to ENTRY's `gate-project-dev` Supabase project (`ytzvislhvrcdtkbtpbmu`).

The read model normalizes relevant existing ENTRY activity sources instead of introducing a parallel event system. This keeps the feature based on existing audit/event instrumentation and avoids duplicating writes.

## Console implementation

Relevant runtime files:

- `app/(console)/dashboard/page.tsx`
- `app/api/entry/operational-activity/route.ts`
- `features/entry/operations/OperationalActivityFeed.tsx`
- `features/entry/operations/queries.ts`

The dashboard loads the initial activity server-side and the client feed refreshes through a small authenticated API route.

Refresh behavior:

- polls every 30 seconds;
- pauses while the browser tab is hidden;
- refreshes again when the tab becomes visible;
- keeps the last known-good feed visible if a background refresh fails;
- does not require publishing audit tables to Supabase Realtime.

## Visual contract

The final approved design intentionally treats Operational Activity as a quiet system log rather than a colorful status dashboard.

Approved presentation:

- neutral event text for normal events;
- no colored event pills or decorative status dots;
- subtle amber/red text only for real warning/error severity;
- fixed-height internal scroll area (`max-h-[340px]`);
- sticky table header;
- approximately 6–7 rows visible at once on desktop;
- recent events remain available through internal scroll;
- community names remain navigable to Community Detail;
- status copy reads `Auto-refreshes every 30s` rather than claiming true realtime behavior.

This visual direction is intentional: Operational Activity should recede below the KPI and setup surfaces instead of competing with them.

## Messages metric

The mission also replaced the dashboard's hard-coded `Messages today / Pending` placeholder with a real rolling 24-hour published community-message count.

The metric is labeled `Messages (24h)` and degrades safely to an unavailable state if the count query cannot be loaded.

## Validation evidence

Before merge, the implementation passed:

- TypeScript;
- targeted ESLint;
- full repository lint;
- production build;
- Brain/layout lint;
- Brain guardrails;
- Vercel Preview deployment;
- Supabase authorization and sanitized-output checks.

GitHub Actions for the final feature commit completed successfully. The final Vercel production deployment for squash commit `e6f52b8fc16e045fca4b4b730e45d12571f4e0ca` reached `READY`.

## Architectural decisions retained

- Do not turn the dashboard feed into the canonical audit log.
- Do not expose raw event metadata in the UI.
- Do not add Supabase Realtime publication solely for this dashboard while 30-second polling is sufficient.
- Keep the visible event vocabulary small and human-readable.
- Preserve a separate path for deeper audit/history tooling if Minerva needs it later.
- Brain records this architecture and product state only; it does not consume the underlying operational feed.

## Future considerations

Possible future work, only if operational need appears:

- dedicated full audit/history screen with filters and pagination;
- stronger grouping/deduplication when multiple events describe one workflow transition;
- event retention/archival policy if log volume materially grows;
- Realtime delivery only if 30-second freshness becomes insufficient.

None of these are required for the completed `ENTRY-OPS-001` dashboard scope.
