# ENTRY — Next Missions

Prioritized roadmap for ENTRY. Part of the ENTRY Knowledge Pack; see [entry.md](entry.md). These engineering priorities were approved by the operator on 2026-07-28. Execution belongs in the ENTRY repo/runtime, not in Brain.

## Operator-approved priority order

1. **Diagnose the real state of ENTRY.**
2. **Fix existing bugs.**
3. **QA the flows that already exist.**
4. **Add automated tests.**
5. **Organize the release process.**
6. **Build pending or necessary product functions.**
7. **Security and backups — penultimate priority.**
8. **Separate environments — absolute last priority.**

This sequence is intentionally pragmatic. ENTRY does not yet have clients, so the immediate goal is to understand, repair, validate, and finish the product before investing in environment architecture.

> **Critical exception:** a confirmed severe vulnerability, active exposure, destructive permission error, or immediate risk of data loss may be corrected as soon as it is discovered. This exception does not promote the full security/backups workstream; that workstream remains penultimate.

## Priority 1 — Diagnose the real state of ENTRY

**Why:** current code, branches, harness documentation, Supabase state, builds, and known work may have diverged.

Scope:

- Inspect repository and branch state.
- Compare code against the ENTRY harness and Brain capture.
- Run TypeScript, lint, Expo Doctor, and available checks.
- Identify broken flows, incomplete work, dangerous configuration, stale branches, and technical debt.
- Produce an evidence-backed diagnostic and prioritized implementation board.

## Priority 2 — Fix existing bugs

Start with user-trust and blocking defects.

### First known bug — “Forgot my password”

Operator-reported broken. Reproduce on web and native; verify deep-link registration, Supabase Auth redirect allowlist, recovery email/template delivery, token/code handling, and the expected recovery path for synthetic `@entry.local` or username-based accounts. Evidence first; no schema change assumed.

Other cleanup:

- Restore a green TypeScript baseline by resolving the existing `components/ExternalLink.tsx` `TS2578` issue.
- Add newly confirmed defects from the diagnostic before advancing.

See [entry-known-issues.md](entry-known-issues.md).

## Priority 3 — QA existing flows

Validate what already exists before adding surface area.

### Voice MVP native QA

Run ENTRY-I001-QA on real Android and iOS native/dev builds, not Expo Go. Validate permissions, speech-to-confirm flow, manual fallback, pass creation, QR/PIN validity, delivery mapping, rate-limit handling, duplicate-submit protection, and the no-audio-storage privacy contract.

### Core ENTRY QA

Cover at minimum:

- registration, login, logout, activation, and password recovery;
- resident pass creation and expiration;
- QR and PIN validation at the guard flow;
- resident, guard, and administrator permissions;
- community isolation and expected RLS behavior;
- notifications and other release-critical flows found during diagnosis.

## Priority 4 — Automated tests

Create a practical first suite around highest-risk behavior:

- user creation/authentication;
- password recovery;
- pass creation/validation;
- QR/PIN credential resolution;
- role/community authorization;
- Supabase RPC/RLS behavior;
- regression tests for repaired critical bugs.

Tests should run in CI on pull requests. Real-device QA remains necessary for a small release-critical layer.

## Priority 5 — Organize the release process

Define a lightweight operational checklist:

- required checks/QA;
- grouping/identification of app and backend changes;
- approval responsibility;
- publication of mobile/backend changes;
- release notes;
- failure and rollback path where technically possible.

## Priority 6 — Pending or necessary functions

Only after the existing system is diagnosed, repaired, tested, and releasable.

Known candidates:

- Facility / Internal Destination Access design and implementation.
- Improvements to frequent-access identities.
- Functions proven necessary by QA, operations, or commercial discovery.

Facility Destinations remains design-first because it may affect schema, `resolve_access_credential_v2`, guard UI, `entry_logs`, RLS, and community scoping.

The El Limonar posted authorization-list observation remains evidence relevant to frequent access, but its exact meaning is unconfirmed and must not by itself trigger new scope.

The Andalucía founder perception that Waldina may mix digital/QR visitor management with automatic-barrier automation is also **not sufficient evidence for new product scope**. Confirm actual buyer requirements with Eugenio Hernández first.

## Priority 7 — Security and backups

Penultimate planned workstream.

Scope when reached:

- formal review of RLS, policies, roles, grants, and `SECURITY DEFINER` functions;
- authentication/sensitive logging review;
- recovery options and backup ownership;
- automated backups plus at least one restore test;
- reconcile live RPC/schema definitions with versioned migrations where needed.

Routine security architecture does not interrupt earlier priorities unless the critical exception applies.

## Priority 8 — Separate environments

**Absolute last priority. Do not begin while higher priorities remain.**

Future scope may include separate development/production databases, environment-specific configuration, versioned migrations, production backup copies, and provider evaluation.

No provider decision should be made before measuring ENTRY's dependency on Supabase Auth, Storage, Realtime, Edge Functions, and database-specific behavior. Kubernetes is not justified for ENTRY's current scale.

## Commercial track

FIRST DOOR / Patronato Package v1 continues in parallel and does not reorder the engineering priorities.

### Current field state — end of 2026-08-17

**Residencial El Limonar**

- Qualified lead / FIRST DOOR #2.
- Manual calls + WhatsApp + paper + manual barrier confirmed through field discovery.
- Patronato Package receipt confirmed through security.
- On 2026-08-16 security reported that ENTRY had been mentioned to **Antonio Flores Chacón**.
- Security reported another urgent internal community issue competing for attention; exact legal/administrative status not independently verified.
- Direct contact obtained: **3293-1317**.
- On 2026-08-17 Rudy sent the first direct WhatsApp outreach from the Minerva Technologies number.
- Response, meeting, demo, quote, and decision remain pending.

**Colonia El Carmen**

- Patronato Package receipt confirmed through security.
- On 2026-08-16 security/encargados estimated approximately **700 homes / 400 paying households**.
- Security asked about price.
- Rudy gave a rough verbal reference of approximately **L 7,000**.
- That number is explicitly classified as **non-binding field guidance, not a formal quote or approved price**.
- Security said it would speak again with patronato and asked Rudy to return **2026-08-19 or 2026-08-20**.

**Residencial Andalucía**

- Manual resident calls + paper visitor records + manual barrier; no visitor-management system according to security.
- Security estimated approximately 80 homes; count not yet administration-confirmed.
- Multiple prior vendors reported.
- Personalized Patronato Package left with security on 2026-08-16; internal recipient remains unconfirmed.
- On 2026-08-17 Rudy spoke directly with Waldina. She did not appear to be the final decision-maker; exact role remains unconfirmed.
- Waldina identified **Eugenio Hernández** as patronato president and provided **3307-9910**. Direct confirmation with Eugenio is pending.
- Founder hypothesis: Waldina may conflate digital/QR access management with physical automatic-barrier automation; do not treat this as confirmed buyer requirement.

### Next commercial actions

#### 1. El Limonar — wait for direct response

- Do not return immediately to the gate after opening the direct channel.
- Wait for Antonio Flores Chacón's response to the 2026-08-17 WhatsApp message.
- If no response after a reasonable interval, send one concise, respectful follow-up.
- If Antonio engages, objective is a 20- to 30-minute discovery/demo conversation.
- Do not treat security's possible price perception as a patronato objection.

#### 2. El Carmen — 2026-08-19 or 2026-08-20

Primary objective:

> Obtain patronato reaction, direct contact, or a meeting path.

If price comes up:

- clarify that the prior ~L 7,000 figure was a quick verbal reference only;
- do not negotiate further through security;
- confirm total homes, paying/active households, entrances, and desired scope with the decision-maker before formal pricing.

Commercial issue to solve:

> Current standard plans stop at 300 homes. If the ~400 paying / ~700 total estimates are confirmed, El Carmen requires deliberate scope/pricing analysis before an economic proposal.

#### 3. Andalucía — contact Eugenio Hernández

Primary objective:

> Confirm the decision-maker and move from gate/intermediary discovery to direct patronato discovery.

First direct conversation should:

- confirm that Eugenio is current patronato president;
- ask whether he received or knows about the package;
- understand what problem the community is trying to solve;
- ask what previous vendors offered and why no implementation occurred;
- distinguish visitor/access-management software from physical barrier automation if needed;
- request a short discovery/demo meeting if fit exists.

Do not send pricing before scope is understood.

### Commercial process learning

- Direct buyer contact is now the most valuable progression metric after package handoff.
- Guards/security remain useful bridges and operational users, but should not carry the sales process indefinitely.
- Field price references must be labeled as approximate and non-binding.
- Define whether a community is being priced by total homes, paying households, active homes/users, or another operational scope before quoting.
- Prior vendor activity should trigger discovery about why previous proposals failed, not an assumption that the category is rejected.
- A package disappearing from the gate is not evidence that patronato received it.

See [entry-sales-and-leads.md](entry-sales-and-leads.md), [entry-first-door-patronato-package-v1.md](entry-first-door-patronato-package-v1.md), [entry-first-door-field-report-2026-08-04.md](entry-first-door-field-report-2026-08-04.md), [entry-first-door-field-report-el-limonar-2026-08-07.md](entry-first-door-field-report-el-limonar-2026-08-07.md), [entry-field-report-2026-08-12.md](entry-field-report-2026-08-12.md), and [entry-field-report-2026-08-16-17.md](entry-field-report-2026-08-16-17.md).

## Source-of-truth note

The detailed mission board in the ENTRY harness remains the execution-side source of truth. This Brain roadmap records the operator-approved strategic order and should guide future mission creation or reprioritization.
