# ENTRY

Official index and summary of the ENTRY product inside Minerva Core Brain. ENTRY is captured here as read-only knowledge. Brain does not connect to the ENTRY database or execute ENTRY runtime.

> Source repo analyzed (read-only): `D:\Dev\node-bridge-foundation` (npm package name `entry`, store id `com.minervatechnologies.entry`). The repo carries its own `.minerva-harness/` knowledge base, which is the ENTRY-side source of truth. This Brain capture (ENTRY-BRAIN-001) summarizes it without modifying it.

## Evidence labels used across these docs

- **Verified from code** — read directly from ENTRY source files (`.ts/.tsx/.sql/.json`, app structure, git).
- **Verified from repo backend snapshot** — schema/RPC/RLS facts the ENTRY harness verified against the live dev DB and committed under `.minerva-harness/backend-snapshot/` (marked `[db]` there). Not re-verified live by Brain.
- **Operator-provided** — facts supplied by Rudy (commercial strategy, leads, bugs, field reports, and priority decisions).
- **Inferred** — reasonable but unconfirmed.
- **Unknown / Needs verification** — open gaps; not asserted as fact.

## What ENTRY is

ENTRY is a Minerva Technologies mobile app (Expo / React Native) for residential / community access control, backed by Supabase (Postgres 17 + Auth + Edge Functions + Realtime + Storage). Residents create access passes (visits, deliveries, events, recurring staff, self-access) that guards validate at the gate by scanning a QR or typing a PIN; admins manage users, invites, reservations, messages, identity review and recovery. UI is Spanish (Honduras). **Verified from code.**

Commercial positioning:

> ENTRY helps communities move from manual visitor/access processes to connected digital management. The resident authorizes, security validates, the entrance is recorded, and patronato/administration can consult the information when needed.

## Knowledge pack

- [entry-product-foundation.md](entry-product-foundation.md) — what ENTRY is, users, problem, value, modules.
- [entry-implementation-map.md](entry-implementation-map.md) — verified technical map (stack, data model, RPCs, flows).
- [entry-current-work.md](entry-current-work.md) — active branch, WIP, mission board.
- [entry-known-issues.md](entry-known-issues.md) — bugs incl. "Forgot password", tech debt.
- [entry-voice-mvp.md](entry-voice-mvp.md) — ENTRY Voice status and contract.
- [entry-sales-and-leads.md](entry-sales-and-leads.md) — commercial strategy, current lead map, field learning, and pricing notes.
- [entry-first-door-patronato-package-v1.md](entry-first-door-patronato-package-v1.md) — official FIRST DOOR / Patronato Package v1 strategy.
- [entry-first-door-field-report-2026-08-04.md](entry-first-door-field-report-2026-08-04.md) — El Carmen first delivery and initial El Limonar discovery.
- [entry-first-door-field-report-el-limonar-2026-08-07.md](entry-first-door-field-report-el-limonar-2026-08-07.md) — El Limonar qualified-lead evidence, package, and delivery.
- [entry-field-report-2026-08-12.md](entry-field-report-2026-08-12.md) — El Carmen / El Limonar patronato-receipt follow-ups and Andalucía discovery.
- [entry-field-report-2026-08-16-17.md](entry-field-report-2026-08-16-17.md) — direct patronato contacts, El Carmen scale/price discussion, Andalucía package/Waldina/Eugenio, and first Antonio outreach.
- [entry-field-update-2026-08-18.md](entry-field-update-2026-08-18.md) — first direct WhatsApp outreach to Eugenio Hernández.
- [entry-field-update-2026-08-20.md](entry-field-update-2026-08-20.md) — Eugenio call, ~98-home scope, first prior-price reference, multi-resident/onboarding discussion, implementation/support commitments, and executive-proposal handoff for patronato review.
- [entry-next-missions.md](entry-next-missions.md) — operator-approved technical priority roadmap and current commercial actions.

## Isolation principles

- Brain must not touch `features/entry/**` in the Console repo or the ENTRY app runtime.
- ENTRY keeps its own Supabase project; Brain does not connect to the ENTRY database.
- Brain documents ENTRY knowledge and strategy; it does not execute ENTRY runtime.

## Status within Minerva

- **Status:** Approved, active development.
- **Current ENTRY branch at last code capture:** `feature/entry-voice-mvp` (Voice MVP implemented client-only, pending native device QA). **Verified from code at capture time.**
- **Infrastructure:** dedicated Supabase dev project `gate-project-dev` (ref `ytzvislhvrcdtkbtpbmu`, Postgres 17). A second project `seshat` exists but is INACTIVE. **Verified from repo harness at capture time.**
- **Commercial strategy:** `ENTRY — FIRST DOOR / Patronato Package v1` remains the approved formal outreach standard for first contact. Andalucía has now progressed beyond FIRST DOOR into a direct buyer / internal-patronato evaluation stage. **Operator-provided.**

### Current commercial status — through 2026-08-20

- **Residencial Andalucía:** currently the most advanced ENTRY opportunity. Manual calls + paper + manual barrier were confirmed during discovery. Waldina identified **Eugenio Hernández** as patronato president and provided **3307-9910**. Rudy opened direct WhatsApp on 2026-08-18. Eugenio then attempted two calls on 2026-08-19 at approximately 7:21 p.m.; Rudy missed them and returned the call on 2026-08-20, later speaking directly with Eugenio. Eugenio stated approximately **98 homes** and disclosed a prior proposal of approximately **L 35,000/year**. Scope/provider of that prior offer remain unknown. Rudy had referenced ENTRY's current L 5,000/month 51–200-home tier and verbally committed that Minerva could **match the prior annual offer** for Andalucía. Eugenio asked specifically about rental homes / multiple occupants; ENTRY supports multiple independent resident accounts associated with one home. Eugenio also said their resident list is incomplete and lacks house numbers. Rudy offered ENTRY's shareable resident-registration tool to reduce patronato data-entry work. Working implementation estimate is approximately **one week**, subject to information/coordination, with training and onsite activation support included during implementation. Eugenio requested written information to take to the patronato. On 2026-08-20 Rudy sent a 3-page executive proposal plus `https://www.minervatechs.com/entry` by WhatsApp. The proposal states that Minerva will match the prior annual investment without printing the amount. **Current next step: patronato review / reaction, ideally followed by a demo. No approval, formal economic acceptance, pilot, or customer commitment yet. Operator-provided.**
- **Residencial El Limonar:** qualified lead / FIRST DOOR #2. Package receipt by patronato confirmed through security. On 2026-08-16 security reported that ENTRY had been mentioned to **Antonio Flores Chacón** and provided his direct contact, **3293-1317**. On 2026-08-17 Rudy sent the first direct WhatsApp message from the Minerva Technologies number. No newer response is recorded in this Brain update. Security also reported another urgent internal community matter competing for attention. **Operator-provided.**
- **Colonia El Carmen:** package receipt by patronato confirmed through security. On 2026-08-16 security estimated approximately **700 homes / 400 paying households**, asked about price, and received a rough **non-binding** verbal reference of approximately **L 7,000**. Security said it would speak again with patronato and asked Rudy to return **2026-08-19 or 2026-08-20**. No newer visit result is recorded in this Brain update. Formal scope and pricing remain unconfirmed. **Operator-provided.**
- **Next new discovery zone:** Avenida Junior / Bermejo toward Segundo Anillo, with initial mapping candidates including Residencial Alondra, Residencial El Bosque, Residencial Bermejo, Residencial Los Ceibos L&M, and Residencial Milla. Jardines del Valle is excluded from this round because prior outreach already occurred there and an existing system is in place. **Operator-provided.**
- **Deferred future hypothesis:** community dues/payments may later be explored in layers (ledger/receivables → bank/reference reconciliation → optional card/recurring payments), but it is **not authorized for implementation now** and does not change the engineering priority order. **Operator-provided.**

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

## Risks / open gaps

- Voice MVP remains unverified on real devices at the last capture.
- Several RPC bodies may live only in the live development database rather than versioned migrations.
- “Forgot password” is operator-reported broken; root cause remains to be verified.
- The documented technical state may have diverged from code, branches, builds, and live backend; diagnosis remains the first engineering priority.
- El Carmen's ~700-home / ~400-paying figures are security estimates, not administration-confirmed counts. The ~L 7,000 statement was an informal field reference, not a formal quote.
- El Limonar has a direct apparent patronato contact, but response, meeting, demo, exact community size, and actual patronato price position remain unknown.
- Andalucía's **~98-home** count is customer-provided verbally, not independently audited.
- Andalucía's **~L 35,000/year** prior-offer figure is valuable competitive intelligence but scope, provider, taxes, hardware, implementation, support, and contract conditions remain unknown. Do not treat it as the general market price.
- The verbal commitment to match Andalucía's prior annual offer should be checked against **ENTRY Unit Economics v1** before formal economic documentation. Matching the amount is an Andalucía-specific commercial commitment, not a general price-table change.
- Eugenio's active role in the evaluation is now clear, but his formal title remains based on Waldina's identification unless directly confirmed later.

## Next action

### Engineering

Run an evidence-backed ENTRY diagnostic before selecting the next implementation mission. Use the result to confirm bugs and current branch/backend state, then follow [entry-next-missions.md](entry-next-missions.md).

### Commercial

- **Andalucía:** do not add immediate pressure after the 2026-08-20 executive-proposal handoff. Wait for Eugenio/patronato reaction; if they engage, move toward a short patronato demo. Before a formal economic proposal, calculate ENTRY Unit Economics v1 for approximately 98 homes and the promised onboarding/support scope.
- **El Carmen:** complete/record the planned Aug 19–20 follow-up when it occurs; objective remains direct patronato reaction/contact and scope clarification.
- **El Limonar:** maintain the direct Antonio channel; if still unanswered after the agreed interval, use one concise follow-up rather than returning immediately to gate pressure.
- **New discovery:** Avenida Junior / Bermejo remains the next new-zone mission; field objective is discovery/qualification, not immediate package delivery.

Environment separation, provider migration, staging architecture, and production database selection must not begin while higher-priority work remains.
