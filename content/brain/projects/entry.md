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
- [entry-field-report-2026-08-12.md](entry-field-report-2026-08-12.md) — El Carmen and El Limonar patronato-receipt follow-ups plus the new Residencial Andalucía discovery and next actions.
- [entry-next-missions.md](entry-next-missions.md) — operator-approved priority roadmap and recommended missions.

## Isolation principles (unchanged)

- Brain must not touch `features/entry/**` in the Console repo or the ENTRY app runtime.
- ENTRY keeps its own Supabase project; Brain does not connect to the ENTRY database.
- Brain documents ENTRY knowledge and strategy; it does not execute ENTRY runtime.

## Status within Minerva

- **Status:** Approved, active development.
- **Current ENTRY branch at last code capture:** `feature/entry-voice-mvp` (Voice MVP implemented client-only, pending native device QA). **Verified from code at capture time.**
- **Infrastructure:** dedicated Supabase dev project `gate-project-dev` (ref `ytzvislhvrcdtkbtpbmu`, Postgres 17). A second project `seshat` exists but is INACTIVE. **Verified from repo harness at capture time.**
- **Commercial strategy:** `ENTRY — FIRST DOOR / Patronato Package v1` is the approved first formal outreach standard. On 2026-08-12 security confirmed that the El Carmen package had reached the patronato. Review/reaction, direct contact, and meeting remain unconfirmed; next follow-up is 2026-08-14. **Operator-provided.**
- **Residencial El Limonar:** qualified lead / FIRST DOOR #2. On 2026-08-12 security confirmed that the package had reached the patronato. The security contact said he expected to meet Antonio Flores that day and would raise ENTRY directly; the outcome remains unknown. Next follow-up is 2026-08-14. **Operator-provided.**
- **Residencial Andalucía:** investigated / qualified discovery lead added on 2026-08-12. Security reported no visitor-management system, resident calls, paper visitor records, manual barrier, and approximately 80 homes. Another vendor had previously approached the community without a finalized outcome. Waldina was identified by first name as the person involved with this topic and is expected at the entrance on 2026-08-15 after 5:00 p.m. **Operator-provided.**

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
- El Carmen patronato receipt is now confirmed by security, but patronato reaction, direct contact, meeting cadence, community size, and presentation interest remain unknown.
- El Limonar patronato receipt is now confirmed by security and ENTRY was expected to be raised directly with Antonio Flores on 2026-08-12, but the result of that conversation, meeting timing, exact community size, and direct contact remain unknown.
- Andalucía has a concrete discovery path but Waldina's exact role, the prior vendor failure reason, final decision-maker, confirmed home count, and actual interest in an ENTRY meeting/demo remain unknown.

## Next action

Run an evidence-backed ENTRY diagnostic before selecting the next implementation mission. Use the result to confirm bugs and current branch/backend state, then follow the roadmap in [entry-next-missions.md](entry-next-missions.md).

FIRST DOOR continues as a parallel commercial validation track. On **2026-08-14**, follow up with El Carmen and El Limonar to obtain patronato reaction, direct contact, or a meeting/demo path. On **2026-08-15 after 5:00 p.m.**, return to Residencial Andalucía to speak with Waldina, clarify her role and the prior vendor outcome, identify the decision-maker, and determine whether ENTRY should advance to a demo, meeting, or formal package.

Environment separation, provider migration, staging architecture, and production database selection must not begin while higher-priority work remains.
