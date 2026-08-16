# 08 — Changelog

Append-only. Most recent first.

## 2026-08-16 - ENTRY-ONB-006 - Production rate-limit verification closeout

- Closed `ENTRY-ONB-006` after production Community Registration rate limiting
  was verified on `master` commit
  `6687e7e792f667f2f49e52c688279528cfdba14d`.
- Public Community Registration flow PR #35 is merged. PR #37 added safe
  rate-limit failure diagnostics and is intentionally retained in production.
- The production Redis authentication issue was resolved by correcting the
  Upstash REST token outside this repository.
- Campaign access quota proof: from one stable shell/network identity, a
  brand-new synthetic slug/token context returned non-429 responses for
  requests 1-10 under the 10 requests / 10 minutes policy, then `429` on
  request 11.
- Correction access quota proof: from the same stable shell/network identity,
  a second synthetic slug/token context returned non-429 responses for
  requests 1-6 under the 6 requests / 10 minutes policy, then `429` on request
  7.
- `Retry-After` was present on both quota responses.
- Production runtime logs showed zero
  `entry_cr_rate_limit_failure=` occurrences after the credential correction.
- Safety verification found no Supabase writes, no resident records, no
  household records, `resident_activation_queue` untouched, and only Redis
  rate-limit counters created.
- Final status: `RATE LIMITING - PRODUCTION VERIFIED`;
  `ENTRY-ONB-006 - PRODUCTION RUNTIME BLOCKER CLEARED`.
- Closeout documentation only. No code, Vercel env, Upstash configuration,
  Supabase state, migrations, redeploy, or policy changes were made in this
  closeout branch.

## 2026-08-04 - MINERVA-CONSOLE-AUTH-RECOVERY-001 - Auth recovery closeout

- Closed the Minerva Console auth recovery incident after owner QA succeeded
  in production at `https://console.minervatechs.com/login`.
- Original incident: the owner was trapped in a redirect cycle between
  `/login`, `/dashboard`, and `/unauthorized`; `/unauthorized` did not offer a
  real sign-out path, so changing accounts or recovering the login form was not
  possible from that screen.
- Implementation shipped through PR #30 and squash commit
  `5422737850af823b73207956b6b9c7185593bdfd` on `master`.
- Runtime change scope was limited to:
  `app/login/page.tsx`, `app/page.tsx`, `app/unauthorized/page.tsx`,
  `features/auth/actions.ts`, `features/auth/requireSuperadmin.ts`, and
  `lib/supabase/middleware.ts`.
- Result: the middleware no longer performs the blind authenticated
  `/login -> /dashboard` redirect; `/unauthorized` has a real Server Action
  sign-out; auth state distinguishes `unauthenticated`, `authorized`,
  `forbidden`, and `authorization_error`; the dashboard remains protected by
  `requireSuperadmin()`.
- Evidence: GitHub Actions completed successfully, Vercel production deployment
  for commit `5422737850af823b73207956b6b9c7185593bdfd` completed successfully,
  production smoke tests returned `/login -> 200`, `/dashboard` without session
  `-> 307 /login?next=%2Fdashboard`, and `/unauthorized` without session
  `-> 307 /login`.
- Owner QA: login succeeded, Minerva Console access worked, and the corrected
  flow was declared successful. Final verdict: COMPLETED.
- Supabase was not modified. Follow-up debt is tracked separately as
  `MINERVA-SUPABASE-SUPERADMIN-RECONCILIATION-001` and was not started in this
  closeout.

## 2026-08-03 - ENTRY-BRAIN-002 - FIRST DOOR commercial strategy capture

- Added `DEC-0006` approving `ENTRY — FIRST DOOR / Patronato Package v1` as the official first formal outreach standard for ENTRY.
- Created `content/brain/projects/entry-first-door-patronato-package-v1.md` with the Patronato Package v1 doctrine, El Carmen field observations, hypotheses, package structure, delivery script, internal pricing, readiness notes, and next actions.
- Updated `entry-sales-and-leads.md` with the new commercial doctrine, lead map, Colonia El Carmen as priority #1, internal pricing, and pending validations.
- Updated `entry.md` and `entry-next-missions.md` so the ENTRY Knowledge Pack points to FIRST DOOR and prioritizes field evidence before scaling outreach or adding speculative features.
- No application code, Supabase, configuration, dependencies, product runtime, push, or merge changes.

## 2026-07-03 - MCB-0022 - Loop Guardrails & Review Evals

- Added loop mission folder guardrails to `scripts/brain-guardrails.mjs`:
  - CHECK 8-F: Verifies that the five core loop mission folders exist.
  - CHECK 8-A: Verifies that no mission ID appears in more than one folder.
  - CHECK 8-B: Verifies that any mission placed in `03_review/` has a matching review report under `content/brain/loop/reports/`.
  - CHECKS 8-C, 8-D, 8-E: Verifies that mission folder assignments sync with their ledger statuses in `missions.json`.
- Added role contract guardrail (CHECK 9) to `scripts/brain-guardrails.mjs`, verifying that all `Assigned role` declarations in mission docs, reports, or loop briefs map to a valid contract under `content/brain/loop/contracts/`.
- Added LOOP_STATE freshness guardrail (CHECK 10) to `scripts/brain-guardrails.mjs`, running a new check mode in the loop state snapshot script to prevent stale or missing snapshots.
- Added a `--check` flag to `scripts/brain-loop-state.mjs` that compares the expected snapshot against `content/brain/loop/state/LOOP_STATE.md` and exits nonzero if they differ.
- Added `"local"` as an allowed inbox source in `scripts/brain-capture.mjs`, `scripts/brain-new-inbox-item.mjs`, and `scripts/brain-guardrails.mjs` to prepare for local model triage.
- Seeded `content/brain/loop/evals/` with evaluation checklists (`README.md`, `review-report-checklist.md`, `agent-report-checklist.md`) and added a `review-evals.md` runbook.
- No DB, RAG, embeddings, UI, ENTRY/Seshat runtime, GitHub workflows, or new dependencies introduced.

## 2026-07-03 - MCB-0021 - Loop State Snapshot CLI

- Added `scripts/brain-loop-state.mjs`, a zero-dependency local CLI that reads
  loop mission folders, `content/brain/registries/missions.json`, and
  `content/brain/loop/roadmaps/ROADMAP.md` to generate one deterministic
  snapshot.
- Generated `content/brain/loop/state/LOOP_STATE.md` with summary, folder
  state, mission ledger state, roadmap state, cross-checks, current focus,
  recommended next mission, and notes.
- Added `npm run brain:loop-state`.
- Implemented report-only mismatch checks for ledger/roadmap status drift,
  in-progress missions without active/review folder files, review/done folder
  status drift, missing mission docs, and completed missions missing PR/commit
  metadata.
- Report-only CLI mission. No dependencies, DB, Supabase, Neon, RAG,
  embeddings, vector search, model router, cost monitor, autonomous agents,
  schedulers, background jobs, ENTRY runtime, Seshat runtime,
  `.github/workflows/**`, or UI write path introduced.

## 2026-07-03 - MCB-0020 - Scoped Context Pack Exporter

- Added `scripts/brain-export-context-packs.mjs`, a zero-dependency sibling
  exporter that generates deterministic scoped context packs under
  `content/brain/exports/packs/` while preserving the existing
  `content/brain/exports/brain-context.md` exporter.
- Generated pack types: `full`, `mission`, `agent`, `project`, `review`, and
  `local`; single-pack CLI flags support mission/project/review IDs and agent
  roles.
- Added npm scripts: `brain:export-context`, `brain:export-packs`, and
  `brain:export-pack`.
- Implemented the local pack hard cap in code at 25,000 characters with a
  visible truncation marker when the cap is reached.
- Added `content/brain/exports/README.md` documenting pack purpose,
  regeneration, generated-artifact authority, local-pack caveats, and no
  secrets / no ENTRY or Seshat operational data.
- Export-only mission. No dependencies, DB, Supabase, Neon, RAG, embeddings,
  vector search, model router, cost monitor, agent engine, scheduler,
  ENTRY runtime, Seshat runtime, `.github/workflows/**`, or UI write path
  introduced. Existing full export behavior remains available.

## 2026-07-02 — MCB-0019 — Role contracts v1

- Added `content/brain/loop/contracts/` with an index (`README.md`) and seven
  **role-based** contracts: `orchestrator.md`, `implementer.md`,
  `reviewer-ci.md`, `adversarial-auditor.md`, `senior-architect.md`,
  `local-triage-assistant.md`, `merge-owner.md`. Each uses the same structure
  (Purpose / May Read / May Write / Must Verify / Must Never Do / Required
  Handoff Artifact / Stop Conditions / Evidence Rules / Assignment Notes).
- Contracts are **role-based, not model-based**: a mission assigns an available
  agent/model (or a human) to a role, and a model may fill different roles in
  different missions. Every contract's Assignment Notes states that no model is
  permanently bound to the role. The merge-owner role is held by a human.
- Rewrote `content/brain/loop/ROLES.md` from model-headed descriptions (GPT /
  Claude / Codex / Gemini / Rudy) into a role-contract index that treats those
  model names as example assignments, not permanent owners, and requires each
  mission to name assigned role, assigned agent/model, and human merge owner
  separately.
- Updated the three loop templates
  (`mission-brief.md`, `agent-report.md`, `review-report.md`) to carry
  **Assigned role**, **Assigned agent/model**, and **Human merge owner**
  fields instead of model-bound owner/agent/reviewer lines.
- Added a short "Role-based mission assignment" note to `04_WORKFLOW.md` and
  corrected the MCB-0019 entry in `ROADMAP.md` to the role-based framing.
- Docs and contracts only. No scripts, guardrails, `features/brain/**`,
  `.github/workflows/**`, dependencies, DB, Supabase, Neon, RAG, embeddings,
  model router, cost monitor, agent engine, ENTRY runtime, Seshat, or UI write
  path touched. No guardrail weakened.

## 2026-07-02 — MCB-0018 — Ledger repair & registration runbook

- Repaired mission-ledger drift: registered `MCB-0016` (Brain v0 Closeout, PR
  #14, commit `61f4cac`, agent `claude`) and `MCB-0017` (Brain Agent
  Operating Layer Readiness Audit, PR #16, commit `f1cbd2d`, agent `fable`)
  in `content/brain/registries/missions.json`, with matching mission docs
  `content/brain/missions/mcb-0016.md` and `mcb-0017.md`. Both branches
  confirmed deleted from the remote (`git fetch --prune` + `gh api
  .../branches`), so `branch` is recorded as `unknown` per convention.
- Added `DEC-0005`: the mission ledger tracks only `MCB-*` Brain-process
  missions; non-`MCB` product knowledge captures such as `ENTRY-BRAIN-001`
  (PR #15, commit `98d1d34`) are documented via their content docs and this
  changelog, not the mission ledger, unless a future decision extends the ID
  convention. Added a short clarifying note to `04_WORKFLOW.md`.
- Added `content/brain/loop/runbooks/close-a-mission.md`: the exact
  post-merge checklist (confirm PR/commit from Git, update mission doc and
  ledger, move loop brief if one exists, update changelog, run guardrails +
  relation checks, never invent branch/agent values, never treat a stale
  local branch ref as verified) plus guidance to self-register a mission
  during its own PR instead of deferring to a later repair mission.
- Added `content/brain/loop/roadmaps/ROADMAP.md`, seeded from the MCB-0017
  audit with the MCB-0018 → MCB-0023 mission sequence (status, purpose,
  owner, risk, dependencies, acceptance criteria) — the repo-resident answer
  to "what's next".
- Ledger, decision, and documentation content only. No DB, Supabase, Neon,
  RAG, embeddings, model router, cost monitor, agent engine, routes, ENTRY
  runtime, Seshat, `.github/workflows/**`, or UI write path. No frozen script
  (`scripts/brain-*.mjs`) or `features/brain/**` file touched; no guardrail
  weakened.

## 2026-06-28 — ENTRY-BRAIN-001 — ENTRY knowledge capture

- Captured the ENTRY product (analyzed read-only from `D:\Dev\node-bridge-foundation`, including its `.minerva-harness/` knowledge base and code) into Minerva Core Brain as eight knowledge docs under `content/brain/projects/`: rewrote `entry.md` as the official index and added `entry-product-foundation.md`, `entry-implementation-map.md`, `entry-current-work.md`, `entry-known-issues.md`, `entry-voice-mvp.md`, `entry-sales-and-leads.md`, and `entry-next-missions.md`.
- Every doc separates Verified from code / Verified from repo backend snapshot / Operator-provided / Inferred / Unknown-Needs-verification / Risks / Next actions. No ENTRY runtime, schema, auth, or files were modified; no secrets read; no live Supabase connection.
- Verified ENTRY stack (Expo SDK 54 / RN 0.81 / React 19 / Supabase Postgres 17), the standard-entry + pull-based-guard model, the `create_pass_v2` reuse contract, and that Voice MVP (ENTRY-I001) is implemented client-only pending native device QA. Current ENTRY branch `feature/entry-voice-mvp`.
- Recorded the operator-reported "Forgot my password" bug with code-verified flow + inferred (unverified) candidate causes, plus the sales/leads + competitors (Access, ISSY, SSA) knowledge.
- No reference to a Supabase project literally named "nodebridge foundation" was found; the verified dev project is `gate-project-dev` (ref `ytzvislhvrcdtkbtpbmu`). Live Supabase access was not requested or needed.
- Regenerated `content/brain/exports/brain-context.md`. Knowledge-only; no DB, RAG, embeddings, agent engine, model router, cost monitor, routes, or UI write path in Brain.

## 2026-06-28 — MCB-0016 — Brain v0 closeout

- Added `scripts/brain-export-context.mjs`: a zero-dependency ESM exporter that concatenates safe Brain content under `content/brain/**` (registries + Markdown docs) into `content/brain/exports/brain-context.md` for handoff to ChatGPT/Claude/Codex/Gemini. Reads no app code, DB, Supabase, Neon, RAG, secrets, or `.env*`/`.claude/**`; excludes `content/brain/exports/**`; stable alphabetical order with no dynamic timestamp.
- Wrote the initial ENTRY Knowledge Pack in `content/brain/projects/entry.md`: what ENTRY is, status within Minerva, Voice MVP, residential commercial strategy, observed competitors (Access, ISSY, SSA), known colonias/leads, the pending "Forgot my password" bug, isolation principles, an explicit "Unknown / Needs verification" section, open questions, and next ENTRY missions. Unverified technical detail is isolated, not asserted as fact.
- Registered the previously unrecorded MCB-0015 in the ledger (`missions.json` + `mcb-0015.md`): verified PR `#13`, commit `340eb00`, `agent: claude` (from the squash commit's `Co-authored-by` trailer); `branch: unknown` (deleted on merge).
- Added loop dry-run artifacts: brief `loop/missions/04_done/mcb-0016-brain-v0-closeout.md` and `loop/reports/claude/mcb-0016-agent-report.md`, exercising the loop structure end to end (no bots, no automation). The brief enters master already in `04_done` so no post-merge move is needed.
- Added the Brain v0 freeze note `09_V0_FREEZE.md`: v0 is "complete enough", content/loop work stays allowed, DB/RAG/embeddings/Neon/agent engine/model router/cost monitor and an Obsidian-style graph view stay postponed, and `features/brain/**` / `scripts/brain-*.mjs` are not touched except under an explicit mission. Focus returns to ENTRY.
- Docs, knowledge, and one read-only script only. No DB, Supabase, Neon, RAG, embeddings, model router, cost monitor, agent engine, routes, ENTRY runtime, Seshat, `.github/workflows/**`, or UI write path.

## 2026-06-24 — MCB-0015 — Register MCB-0014 in mission ledger

- Registered MCB-0014 in `missions.json` with mission doc `mcb-0014.md`. Verified `commit: ef6e20e` (the final squash on master); `pr` and `branch` are `unknown` because MCB-0014 closed via local squash + direct push (no reliable PR number) and its branch was deleted.
- Closed pre-existing ledger drift surfaced while registering MCB-0014: registered the previously unrecorded MCB-0012 (PR #11, commit 8c4a942) and MCB-0013 (PR #12, commit 7774d34) with mission docs `mcb-0012.md` and `mcb-0013.md`. Both `agent` values are `unknown` (squash commits carry no `Co-authored-by` trailer); both branches are `unknown` (no surviving refs). The ledger is now complete through MCB-0014.
- Clarified the Delegated Git Ops rule in `loop/PROTOCOL.md` and `loop/OPERATOR_GUIDE.md`: `MERGE APPROVED` authorizes merge via GitHub UI/`gh` only and does **not** authorize direct push to master; `DIRECT PUSH APPROVED` is the separate phrase required for any direct push to master.
- Ledger-and-docs only. No DB, Supabase, Neon, RAG, embeddings, model router, cost monitor, agent engine, routes, ENTRY, Seshat, `.github/workflows/**`, or UI write path.

## 2026-06-24 — MCB-0014 — Minimal AI mission loop bootstrap

- Added `content/brain/loop/` as a Git-backed, Markdown-first coordination skeleton: `PROTOCOL.md`, `ROLES.md`, `OPERATOR_GUIDE.md`, status folders `missions/01_todo`…`05_blocked`, per-agent `reports/{claude,codex,gemini,gpt}`, and `templates/{mission-brief,agent-report,review-report}.md`.
- Folder = status: a mission brief's state is the folder it lives in; `git mv` moves it. No `QUEUE.json` — by design.
- Documents the evidence discipline (verified / inferred / unknown), one-writer-per-branch, Rudy as sole merge owner, and that GitHub/Git are authority for branch/diff/CI/merge while Markdown is auditable handoff.
- Skeleton only. No scripts, no GitHub Actions, no scheduler, no bot, no agent engine. No DB, Supabase, Neon, RAG, embeddings, model router, cost monitor, routes, ENTRY, Seshat, or UI write path.

## 2026-06-17 — MCB-0012 — Ledger integrity pack

- Registered MCB-0010 (Mission Ledger Completion Pass, PR #9, commit daafb98) and MCB-0011 (Register MCB-0009 in Mission Ledger, PR #10, commit a79c679) in `content/brain/registries/missions.json` with new mission docs `mcb-0010.md` and `mcb-0011.md`. The Mission Ledger is now complete through MCB-0011.
- Verified each registered field from local Git: PR/commit from the merge subject and hash, `agent: "claude"` from the commit `Co-authored-by` trailer. Both missions' branches are registered as `unknown`: MCB-0010 has no surviving ref, and for MCB-0011 the only available evidence is a local `origin/mcb-0011-register-mcb-0009-ledger` remote-tracking ref, which is not reliable proof — local remote-tracking refs can be stale and the live branch ref currently 404s on GitHub.
- Added guardrail CHECK 7 (anti ledger-drift): every `content/brain/missions/mcb-*.md` doc must be registered in `missions.json`. Purely local and deterministic — no GitHub/remote dependency. Complements CHECK 4, which already verifies the forward direction.
- Documented the convention for unverifiable mission fields (`branch`/`agent` = `unknown`) in `04_WORKFLOW.md`: record only verifiable values, never register inferences as facts.
- Ledger-only and guardrail-only. No DB, Supabase, Neon, RAG, embeddings, model router, cost monitor, agent engine, routes, ENTRY, Seshat, or UI write path.

## 2026-06-17 — MCB-0008 — Brain relations map

- Added `features/brain/lib/relations.ts` deriving outgoing relations, incoming backlinks, and broken references from registry `related` arrays.
- Added `/brain/relations` page with per-entry outgoing/incoming counts, a broken-relation banner, and a `?focus=ID` detail view.
- Added a Relations section to every Brain detail page (`/brain/{kind}/{id}`) via a shared `RelationsPanel` component.
- Added `scripts/brain-check-relations.mjs` and `brain:check-relations` to report broken relations from the CLI (exits non-zero on broken references).
- Integrated a relation-resolution check (CHECK 6) into `scripts/brain-guardrails.mjs`; guardrails now fail when a `related` ID does not exist in any registry.
- Added Relations links to the sidebar and Brain overview.
- Outgoing relations are explicit; incoming backlinks are derived. Relations are Git-backed metadata — not RAG, not embeddings, not an agent engine. No DB, Supabase, model router, cost monitor, or UI write path.

## 2026-06-17 — MCB-0007 — Brain mission control ledger

- Added `content/brain/registries/missions.json` and `content/brain/missions/` as the Git-backed ledger for Brain missions.
- Seeded mission records for MCB-0001, MCB-0002, MCB-0002.5, MCB-0002.7, MCB-0003, MCB-0004, MCB-0005, MCB-0006, and MCB-0007.
- Added missions as a Brain registry kind, including `/brain/missions`, detail routes like `/brain/missions/MCB-0006`, search, tags, sidebar navigation, and the Brain overview card.
- Added `scripts/brain-new-mission.mjs` and `brain:new-mission` to create future mission docs and registry entries together.
- Updated guardrails to require the mission registry, mission directory, and mission creation script.
- Mission control is Git-backed project metadata. It is not an agent engine, not automation, not RAG, not embeddings, and not a UI write path.

## 2026-06-17 — MCB-0006 — Brain promotion workflow

- Added `scripts/brain-promote.mjs` to promote inbox items into approved Brain knowledge (decisions, prompts, projects, agents).
- The promote CLI creates a Markdown document in the target folder, updates the target registry, and sets the inbox item status to `promoted`.
- Raw inbox material is preserved in the promoted document under "Original Raw Material".
- Added `brain:promote` npm script.
- Added `scripts/brain-promote.mjs` to guardrails required files.
- Updated workflow docs to document the promotion flow.
- Promotion is manual. The human intentionally runs the script. This is not RAG, not automation, not an agent engine.
- No UI write paths. No Neon, DB, Supabase, RAG, embeddings, model router, cost monitor, agent engine, or new dependencies.

## 2026-06-17 — MCB-0005 — Brain search and tag index

- Added `features/brain/lib/search.ts` with functions to build a search index from all Brain registries and Markdown docs.
- Added search page at `/brain/search` with free-text query and filters for kind, tag, and status via URL query params.
- Added tag index page at `/brain/tags` listing all tags with counts, linking to filtered search results.
- Added Search and Tags links to sidebar and Brain overview.
- Search is Git-backed, local, and read-only. No database, RAG, embeddings, model router, agent engine, or write UI.
- Tags help human triage and future promotion. They are not semantic vectors.

## 2026-06-17 - MCB-0004 - Brain inbox capture CLI

- Added `scripts/brain-capture.mjs` to capture raw Claude Code, GPT, Codex, Gemini, human, or other outputs into `content/brain/inbox/`.
- The capture CLI appends a matching `INB-####` entry to `content/brain/registries/inbox.json`.
- Added npm scripts for `brain:capture`, `brain:guardrails`, and `brain:new-inbox-item`.
- Added a reusable mission handoff template under `content/brain/templates/`.
- Updated workflow and agent rules to keep capture Git-backed and non-authoritative until human promotion.
- No UI write paths. No Neon, DB, Supabase, RAG, agent engine, migrations, env vars, or new dependencies.

## 2026-06-16 — MCB-0002 — Brain v0 shell shipped

- Created `content/brain/**` knowledge tree: harness, registries (projects, decisions, prompts, agents, inbox), and folder INDEX pages.
- Added `features/brain/lib/{types,content}.ts` as the only app-facing reader of Brain content.
- Added `features/brain/components/{BrainOverview,RegistryTable,InboxList}.tsx`.
- Added routes under `app/(console)/brain/` for Overview, Projects, Decisions, Prompts, Agents, and Inbox.
- Reorganized `components/layout/AppSidebar.tsx` into Console / Products / Brain groups.
- Extended `components/layout/PageHeader.tsx` with an optional `eyebrow` prop (default unchanged). Brain pages set a Brain eyebrow.
- No new dependencies. No env vars. No migrations. No Supabase calls in Brain.

## 2026-06-16 — MCB-0001 — Recon completed

- Approved Option C (Hybrid): Brain UI in Console, Brain content in same repo under `content/brain/`, loader seam in `features/brain/lib/content.ts`.
- Neon deferred to v1.
- ENTRY/Seshat isolation rules established.
