# ENTRY

Official index and summary of the ENTRY product inside Minerva Core Brain. ENTRY is captured here as read-only knowledge. Brain does not connect to the ENTRY database or execute ENTRY runtime.

> Source repo analyzed (read-only): `D:\Dev\node-bridge-foundation` (npm package name `entry`, store id `com.minervatechnologies.entry`). The repo carries its own `.minerva-harness/` knowledge base, which is the ENTRY-side source of truth. This Brain capture (ENTRY-BRAIN-001) summarizes it without modifying it.

## Evidence labels used across these docs

- **Verified from code** — read directly from ENTRY source files (`.ts/.tsx/.sql/.json`, app structure, git).
- **Verified from repo backend snapshot** — schema/RPC/RLS facts the ENTRY harness verified against the live dev DB and committed under `.minerva-harness/backend-snapshot/` (marked `[db]` there). Not re-verified live by Brain.
- **Operator-provided** — facts supplied by Rudy (commercial strategy, leads, bugs, field reports, and priority decisions).
- **Inferred** — reasonable but unconfirmed.
- **Unknown / Needs verification** — open gaps; not asserted as fact.

## What ENTRY is (one paragraph)

ENTRY is a Minerva Technologies mobile app (Expo / React Native) for residential / community access control, backed by Supabase (Postgres 17 + Auth + Edge Functions + Realtime + Storage). Residents create access passes (visits, deliveries, events, recurring staff, self-access) that guards validate at the gate by scanning a QR or typing a PIN; admins manage users, invites, reservations, messages, identity review and recovery. UI is Spanish (Honduras). **Verified from code.**

## Knowledge pack

- [entry-product-foundation.md](entry-product-foundation.md) — what ENTRY is, users, problem, value, modules.
- [entry-implementation-map.md](entry-implementation-map.md) — verified technical map (stack, data model, RPCs, flows).
- [entry-current-work.md](entry-current-work.md) — active branch, WIP, mission board.
- [entry-known-issues.md](entry-known-issues.md) — bugs incl. "Forgot password", tech debt.
- [entry-voice-mvp.md](entry-voice-mvp.md) — ENTRY Voice status and contract.
- [entry-sales-and-leads.md](entry-sales-and-leads.md) — commercial strategy, colonias, competitors.
- [entry-first-door-patronato-package-v1.md](entry-first-door-patronato-package-v1.md) — official FIRST DOOR / Patronato Package v1 strategy, El Carmen field package, hypotheses, pricing notes, and delivery script.
- [entry-first-door-field-report-2026-08-04.md](entry-first-door-field-report-2026-08-04.md) — first field delivery outcome at Colonia El Carmen and the initial discovery of Residencial El Limonar.
- [entry-first-door-field-report-el-limonar-2026-08-07.md](entry-first-door-field-report-el-limonar-2026-08-07.md) — dedicated El Limonar discovery, qualified-lead evidence, personalized package, delivery outcome, manual visitor-control observations, and follow-up plan.
- [entry-next-missions.md](entry-next-missions.md) — operator-approved priority roadmap and recommended missions.

## Isolation principles (unchanged)

- Brain must not touch `features/entry/**` in the Console repo or the ENTRY app runtime.
- ENTRY keeps its own Supabase project; Brain does not connect to the ENTRY database.
- Brain documents ENTRY knowledge and strategy; it does not execute ENTRY runtime.

## Status within Minerva

- **Status:** Approved, active development.
- **Current ENTRY branch at last code capture:** `feature/entry-voice-mvp` (Voice MVP implemented client-only, pending native device QA). **Verified from code at capture time.**
- **Infrastructure:** dedicated Supabase dev project `gate-project-dev` (ref `ytzvislhvrcdtkbtpbmu`, Postgres 17). A second project `seshat` exists but is INACTIVE. **Verified from repo harness at capture time.**
- **Commercial strategy:** `ENTRY — FIRST DOOR / Patronato Package v1` is the approved first formal outreach standard. The El Carmen package was delivered to the head of security on 2026-08-04 and remains pending confirmed patronato receipt/review. **Operator-provided; decision recorded in `DEC-0006`.**
- **Residencial El Limonar:** now classified as a qualified lead / FIRST DOOR #2. Security reported that residents announce visits by calls and WhatsApp, visitor information is kept on paper, the barrier is manual, and the community wants to implement a system subject to patronato discussion. Security identified **Antonio Flores** as patronato president. A personalized Patronato Package was delivered at the gate on 2026-08-07 after confirmation from the prior security contact; patronato receipt, review, and meeting remain unconfirmed. **Operator-provided; detailed in the 2026-08-07 El Limonar field report.**

## Current strategic priority order

Approved by the operator on 2026-07-28:

1. Diagnose the real state of ENTRY.
2. Fix existing bugs.
3. QA existing flows.
4. Add automated tests.
5. Organize the release process.
6. Build pending or necessary functions.
7. Security and backups — penultimate.
8. Separate environments — absolute last.

A confirmed severe vulnerability, active exposure, destructive permission problem, or immediate risk of data loss may be corrected early. This does not move the full security/backups workstream from its penultimate position.

## Risks (summary; detail in sub-docs)

- Voice MVP remains unverified on real devices at the last capture.
- Several RPC bodies may live only in the live development database rather than versioned migrations.
- “Forgot password” is operator-reported broken; root cause remains to be verified.
- The documented state may have diverged from the code, branches, builds, and live backend; diagnosis is therefore the first priority.
- El Carmen's package reached security leadership, but patronato receipt and review are still unconfirmed; direct contact, meeting cadence, and community size remain unknown.
- El Limonar has stronger field evidence and an identified patronato president, but the 2026-08-07 package has only been confirmed at the security gate. Delivery to Antonio Flores or another patronato member, meeting timing, exact community size, and direct contact remain unknown.

## Next action

Run an evidence-backed ENTRY diagnostic before selecting the next implementation mission. Use the result to confirm bugs and current branch/backend state, then follow the roadmap in [entry-next-missions.md](entry-next-missions.md).

FIRST DOOR continues as a parallel commercial validation track. Follow up with El Carmen according to its existing window, and follow up with Residencial El Limonar approximately 2026-08-12 through 2026-08-14 to confirm whether the package reached Antonio Flores or another patronato member and to seek a direct presentation path. This does not reorder the technical roadmap.

Environment separation, provider migration, staging architecture, and production database selection must not begin while higher-priority work remains.
