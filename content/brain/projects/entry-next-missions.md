# ENTRY — Next Missions

Prioritized roadmap for ENTRY. Part of the ENTRY Knowledge Pack; see [entry.md](entry.md). These priorities were approved by the operator on 2026-07-28. Execution belongs in the ENTRY repo/runtime, not in Brain.

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

**Why:** the current code, branches, harness documentation, Supabase state, builds, and known work may have diverged.

**Scope:**
- Inspect repository and branch state.
- Compare code against the ENTRY harness and Brain capture.
- Run TypeScript, lint, Expo Doctor, and available checks.
- Identify broken flows, incomplete work, dangerous configuration, stale branches, and technical debt.
- Produce an evidence-backed diagnostic and a prioritized implementation board.

## Priority 2 — Fix existing bugs

Start with user trust and blocking defects.

### First known bug — “Forgot my password”

**Why:** operator-reported broken; account recovery is a core trust path.

**Scope:** reproduce on web and native; verify deep-link registration, Supabase Auth redirect allowlist, recovery email/template delivery, token/code handling, and the expected recovery path for synthetic `@entry.local` or username-based accounts. Evidence first; no schema change assumed.

### Other known cleanup

- Restore a green TypeScript baseline by resolving the existing `components/ExternalLink.tsx` `TS2578` issue.
- Add newly confirmed defects from the diagnostic before advancing to lower-priority work.

See [entry-known-issues.md](entry-known-issues.md).

## Priority 3 — QA existing flows

Validate the product that already exists before adding more surface area.

### Voice MVP native QA

Run ENTRY-I001-QA on real Android and iOS native/dev builds, not Expo Go. Validate permissions, speech-to-confirm flow, manual fallback, pass creation, QR/PIN validity, delivery mapping, rate-limit handling, duplicate-submit protection, and the no-audio-storage privacy contract.

### Core ENTRY QA

Cover at minimum:
- Registration, login, logout, activation, and password recovery.
- Resident pass creation and expiration behavior.
- QR and PIN validation at the guard flow.
- Resident, guard, and administrator permissions.
- Community isolation and expected RLS behavior.
- Notifications and other release-critical flows found during diagnosis.

## Priority 4 — Automated tests

Create a practical first test suite around the highest-risk behavior rather than chasing total coverage.

Initial targets:
- User creation and authentication.
- Password recovery.
- Pass creation and validation.
- QR/PIN credential resolution.
- Role and community authorization.
- Supabase RPC and RLS behavior.
- Regression tests for every repaired critical bug.

Tests should live in the repository and run through CI on pull requests. Device and visual automation may reduce manual work, but a small real-device QA layer will still be required.

## Priority 5 — Organize the release process

This is a lightweight operational checklist, not an enterprise release platform.

Define:
- What checks and QA a version must pass.
- How app and backend changes are grouped and identified.
- Who approves a release.
- How mobile builds and backend changes are published.
- How release notes are recorded.
- What to do when a release fails, including a rollback path where technically possible.

## Priority 6 — Pending or necessary functions

Only after the existing system is diagnosed, repaired, tested, and releasable.

Known candidates:
- Facility / Internal Destination Access design and implementation.
- Improvements to frequent-access identities.
- Functions proven necessary by QA, operations, or commercial discovery.

Facility Destinations remains a design-first change because it may affect schema, `resolve_access_credential_v2`, guard UI, `entry_logs`, RLS, and community scoping.

The El Limonar field observation of a posted physical list of authorized people,
apparently connected to construction work, is relevant evidence for the existing
frequent-access concept. Its exact operational meaning is still unconfirmed and
must not by itself trigger new product scope.

## Priority 7 — Security and backups

This is the penultimate planned workstream.

Scope when reached:
- Formal review of RLS, policies, roles, grants, and `SECURITY DEFINER` functions.
- Review authentication and sensitive logging.
- Confirm recovery options and backup ownership.
- Establish automated backups and perform at least one restoration test.
- Reconcile live RPC/schema definitions with versioned migrations as needed for recoverability.

Routine security architecture and formal backup work do not interrupt the earlier product priorities unless the critical exception applies.

## Priority 8 — Separate environments

**Absolute last priority. Do not begin this work while higher priorities remain.**

Future scope may include:
- Separate development and production databases/projects.
- Environment-specific configuration for mobile and web.
- Versioned migrations for schema, functions, triggers, RLS, and policies.
- Production backup copies outside the primary provider.
- Evaluation of whether production should remain on Supabase or move elsewhere.

No provider decision should be made before measuring ENTRY’s dependency on Supabase Auth, Storage, Realtime, Edge Functions, and database-specific behavior. Kubernetes is not justified for ENTRY’s current scale.

## Commercial track

FIRST DOOR / Patronato Package v1 continues as a parallel commercial validation track and does not reorder the engineering priorities.

Current field state after 2026-08-12:

- **Colonia El Carmen:** first Patronato Package delivered to the head of security on 2026-08-04. On 2026-08-12 security confirmed that the package reached the patronato. Security did not know the reaction/review result. Rudy asked security to ask again and requested a direct contact number only with the relevant person's permission. Next follow-up: **2026-08-14**.
- **Residencial El Limonar:** qualified lead / FIRST DOOR #2. Security previously confirmed calls + WhatsApp, paper visitor records, manual barrier, interest in implementing a system, and Antonio Flores as patronato president. On 2026-08-12 security confirmed patronato receipt of the 2026-08-07 package. The security contact said he expected to meet Antonio Flores that day and would raise ENTRY directly. Outcome remains unknown. Next follow-up: **2026-08-14**.
- **Residencial Andalucía:** investigated / qualified discovery lead added on 2026-08-12. Security reported no visitor-management system, resident phone calls for visitor announcements, paper records, manual barrier, and approximately 80 homes. Another vendor previously approached the community but nothing was finalized. Waldina was identified by first name as the person who handles or is involved with this topic; exact role and surname remain unknown. Security said she will be at the entrance on **2026-08-15 after 5:00 p.m.** No package was delivered.

Next commercial actions:

- **2026-08-14 — El Carmen:** confirm patronato reaction, seek direct contact, and ask for a concrete presentation path if there is interest.
- **2026-08-14 — El Limonar:** ask what happened when security raised ENTRY with Antonio Flores; seek direct contact, patronato meeting timing, or a presentation/demo date.
- **2026-08-15 after 5:00 p.m. — Andalucía:** speak with Waldina. Confirm her role, current process, desired outcome, prior vendor proposal/failure reason, final decision-maker, and whether ENTRY should advance to demo, meeting, or package.
- Do not prepare an Andalucía Patronato Package before the Waldina discovery unless new evidence changes the plan.
- Continue building the San Pedro Sula lead map through explicit stages: mapped → observed → investigated → qualified → package → follow-up → meeting → demo → proposal → pilot/customer.

Current commercial learning:

- At both El Carmen and El Limonar, FIRST DOOR has now passed the **gate-to-patronato handoff** step according to security. The current test is whether patronato receipt can be converted into direct contact, a meeting, or a demo.
- Andalucía shows the value of discovery before formal package delivery: one field stop produced verified manual-process evidence, approximate size, prior-vendor evidence, a named follow-up person, and a specific return window.

See [entry-sales-and-leads.md](entry-sales-and-leads.md), [entry-first-door-patronato-package-v1.md](entry-first-door-patronato-package-v1.md), [entry-first-door-field-report-2026-08-04.md](entry-first-door-field-report-2026-08-04.md), [entry-first-door-field-report-el-limonar-2026-08-07.md](entry-first-door-field-report-el-limonar-2026-08-07.md), and [entry-field-report-2026-08-12.md](entry-field-report-2026-08-12.md).

## Source-of-truth note

The detailed mission board in the ENTRY harness remains the execution-side source of truth. This Brain roadmap records the operator-approved strategic order and should guide future mission creation or reprioritization.
