# ENTRY

Official index and summary of the ENTRY product inside Minerva Core Brain. ENTRY is captured here as read-only knowledge. Brain does not connect to the ENTRY database or execute ENTRY runtime.

> Source repo analyzed (read-only): `D:\Dev\node-bridge-foundation` (npm package name `entry`, store id `com.minervatechnologies.entry`). The repo carries its own `.minerva-harness/` knowledge base, which is the ENTRY-side source of truth. This Brain capture (ENTRY-BRAIN-001) summarizes it without modifying it.

## Evidence labels used across these docs

- **Verified from code** — read directly from ENTRY source files (`.ts/.tsx/.sql/.json`, app structure, git).
- **Verified from repo backend snapshot** — schema/RPC/RLS facts the ENTRY harness verified against the live dev DB and committed under `.minerva-harness/backend-snapshot/` (marked `[db]` there). Not re-verified live by Brain.
- **Operator-provided** — facts supplied by Rudy (commercial strategy, leads, the password bug report).
- **Inferred** — reasonable but unconfirmed.
- **Unknown / Needs verification** — open gaps; not asserted as fact.

## What ENTRY is (one paragraph)

ENTRY is a Minerva Technologies mobile app (Expo / React Native) for residential / community access control, backed by Supabase (Postgres 17 + Auth + Edge Functions + Realtime + Storage). Residents create access passes (visits, deliveries, events, recurring staff, self-access) that guards validate at the gate by scanning a QR or typing a PIN; admins manage users, invites, reservations, messages, identity review and recovery. UI is Spanish (Honduras). **Verified from code.**

## Knowledge pack (this capture)

- [entry-product-foundation.md](entry-product-foundation.md) — what ENTRY is, users, problem, value, modules.
- [entry-implementation-map.md](entry-implementation-map.md) — verified technical map (stack, data model, RPCs, flows).
- [entry-current-work.md](entry-current-work.md) — active branch, WIP, mission board.
- [entry-known-issues.md](entry-known-issues.md) — bugs incl. "Forgot password", tech debt.
- [entry-voice-mvp.md](entry-voice-mvp.md) — ENTRY Voice status and contract.
- [entry-sales-and-leads.md](entry-sales-and-leads.md) — commercial strategy, colonias, competitors.
- [entry-next-missions.md](entry-next-missions.md) — prioritized recommended missions.

## Isolation principles (unchanged)

- Brain must not touch `features/entry/**` (in the Console repo) or the ENTRY app repo runtime.
- ENTRY keeps its own Supabase project; Brain does not connect to the ENTRY DB.
- Brain documents ENTRY knowledge and strategy; it does not execute ENTRY runtime.

## Status within Minerva

- **Status:** Approved, active development.
- **Current ENTRY branch:** `feature/entry-voice-mvp` (Voice MVP implemented client-only, pending native device QA). **Verified from code.**
- **Infrastructure:** dedicated Supabase dev project `gate-project-dev` (ref `ytzvislhvrcdtkbtpbmu`, Postgres 17). A second project `seshat` exists but is INACTIVE. **Verified from repo (harness `01_PROJECT_BRIEF`).**

## Risks (summary; detail in sub-docs)

- Voice MVP unverified on a real device (native module never exercised on-device).
- Many RPC bodies live only in the live DB, not mirrored as in-repo migrations — schema-change risk.
- "Forgot password" reported broken by operator; root cause not yet verified.

## Next actions (summary; detail in [entry-next-missions.md](entry-next-missions.md))

1. Verify and fix "Forgot my password".
2. Run ENTRY-I001-QA (Voice MVP native device QA).
3. Resume ENTRY-D002 (Facility Destinations design) only after Voice QA.
