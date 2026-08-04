# ENTRY — Next Missions

Prioritized, recommended next missions for ENTRY. Part of the ENTRY Knowledge Pack; see [entry.md](entry.md). These are recommendations for the ENTRY repo/runtime (executed there, not from Brain).

## Priority 1 — Fix "Forgot my password"
**Why:** operator-reported broken; core account-recovery trust path.
**Type:** bug fix (likely config + deep-link, not screen logic).
**Scope:** reproduce on web + native; verify (1) `entry://reset-password` deep-link registration and `code` param delivery, (2) Supabase Auth redirect-URL allowlist, (3) recovery email delivery/template, (4) expected behavior for synthetic `@entry.local` / username accounts (may need the admin recovery-code path instead). Evidence-first; no schema change expected. See [entry-known-issues.md](entry-known-issues.md).

## Priority 2 — FIRST DOOR field test evidence capture
**Why:** `DEC-0006` makes FIRST DOOR / Patronato Package v1 the approved commercial motion; the first experiment should be observed before scaling distribution or adding speculative features.
**Type:** field evidence / commercial validation.
**Scope:** deliver `ENTRY Patronato Package — El Carmen v1` to Colonia El Carmen, record date/time, receiving guard, comments, patronato meeting cadence, follow-up path, and outcome level. Confirm whether the planned 2026-08-04 afternoon delivery occurred. See [entry-first-door-patronato-package-v1.md](entry-first-door-patronato-package-v1.md).

## Priority 3 — Clean production environment for pilot
**Why:** ENTRY is considered technically ready for a pilot, but the main known production-readiness blocker is separating a clean production environment from the development environment with test data.
**Type:** production readiness / environment hygiene.
**Scope:** define and prepare a clean pilot-ready environment without mixing development test data into production operations. Exact implementation belongs in the ENTRY repo/runtime, not Brain.

## Priority 4 — ENTRY-I001-QA (Voice MVP native device QA)
**Why:** Voice MVP is implemented but unverified on a real device; required before it ships.
**Type:** QA on a native dev/EAS build (not Expo Go).
**Scope:** run the harness checklist (`VOICE_MVP_HANDOFF.md` §7) on real Android + iOS: permission prompts (Spanish copy), manual fallback when unavailable, happy path speak→confirm→create, edited transcript respected, 12h VISIT pass with valid PIN/QR, DELIVERY mapping, `[Voz]` note present, `55000` rate-limit copy, 60s double-submit guard, guard resolves identically, and **no audio written/uploaded/logged**. Resolve Q-V2 (locale) + Q-V3 (on-device policy); then finalize Q-V7 (trigger placement). See [entry-voice-mvp.md](entry-voice-mvp.md).

## Priority 5 — Restore a green TypeScript baseline (quick win)
**Why:** removes the one known pre-existing tsc error so any new error is meaningful.
**Type:** trivial cleanup.
**Scope:** delete the unused `@ts-expect-error` directive in `components/ExternalLink.tsx` (harness Q-B5). Optionally add a minimal `typecheck` npm script (Q-B3/Q-B7). No deps, no behavior change.

## Priority 6 — Reconcile RPC/migration source of truth
**Why:** several RPC bodies live only in the live DB, not in `supabase/migrations/` (Q-B1); this blocks safe schema work.
**Type:** backend hygiene / design prerequisite.
**Scope:** determine whether there is an out-of-band migration history or manual DB management; capture the missing RPC definitions as migrations or a documented snapshot before any schema change.

## Priority 7 (deferred) — ENTRY-D002 Facility / Internal Destination Access (design)
**Why:** strategic, but blocked behind Voice QA and the `visit_passes.house_id NOT NULL` structural change.
**Type:** design mission (no code).
**Scope:** evaluate data-model options (nullable `house_id` + `destination_facility_id` vs polymorphic destination vs new entity); assess blast radius on `resolve_access_credential_v2`, guard UI, `entry_logs`, RLS, community scoping; answer Q-F1..Q-F6. Decide in design, not code. Deferred until after Voice MVP QA per approved sequencing.

## Commercial track (parallel, non-engineering)
- Execute the Colonia El Carmen FIRST DOOR test first and record evidence before distributing the package broadly. After that result, build a per-colonia lead tracker with verified contacts, patronato meeting dates, package delivery dates, receiving guard, follow-up path, and FIRST DOOR outcome level. Verify Access/ISSY/SSA specifics before recording as fact. See [entry-sales-and-leads.md](entry-sales-and-leads.md).

## Notes on sequencing

- Voice (reuses existing infra) is sequenced before Facility Destinations (needs schema + resolver changes), per the ENTRY harness.
- The password fix is placed first here because it is an operator-flagged trust bug independent of the Voice/Facilities track and can proceed in parallel.
- FIRST DOOR evidence capture is a commercial validation track. It should not trigger speculative product features until evidence is recorded.

## Unknown / Needs verification

- Whether the operator wants the password fix or Voice QA first (this doc recommends password fix P1; adjust if the operator prioritizes shipping Voice).
- Open PR/branch status for `feature/entry-voice-mvp`, Sentry, and security-gate branches (see [entry-current-work.md](entry-current-work.md)).
