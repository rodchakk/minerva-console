# MCB-0017 — Brain Agent Operating Layer Readiness Audit

**Mission:** `MCB-0017`
**Agent:** Fable (Senior Architect)
**Branch:** `mcb-0017-brain-agent-operating-layer-audit`
**Status:** Report delivered — audit + plan only, no operating-layer code changes.

---

## Executive Summary

Brain v0 is a genuinely solid foundation: a Git-backed, read-only knowledge layer with registries, a mission ledger, an inbox/promote pipeline, a coordination loop, guardrails in CI, and a context export. Its core discipline — *if it is not in the repo or on the PR, it did not happen* — is the right spine for an agent operating layer, and nothing in v0 needs to be torn out.

What v0 is **not yet** is an operating layer. Today an agent arriving cold at this repo can read the protocol, but it cannot cheaply answer "what is the current state of the loop?", "what exactly is my contract?", or "what minimal context do I need for this one mission?". The export is a single ~164 KB monolith; the roles are four short paragraphs; mission state lives in three places that can silently disagree (ledger JSON, loop folders, GitHub); and Rudy still hand-carries briefs, prompts, and context between chat windows.

The evidence of the gap is already in the ledger itself: **MCB-0016 and ENTRY-BRAIN-001 are merged to master (`#14` / `61f4cac`, `#15` / `98d1d34`) but absent from `missions.json`** — the very drift class MCB-0010/0012/0015 existed to repair keeps recurring, because registration is manual and the guardrail (CHECK 7) only checks the direction "doc on disk → registry entry", not "merged mission → ledger entry".

The next strategic move is **not** RAG, automation, or a local model. It is three cheap, compounding foundations, in order: (1) repair and harden the ledger so state is trustworthy, (2) write real per-agent contracts so behavior is specified instead of implied, (3) make context export scoped (mission / agent / project / review / local packs) so handoff stops being a 164 KB paste. Everything else — including local AI — builds on those three.

---

## Current State Inventory

What exists today, with the exact files that support it. All items verified by direct file inspection on branch `mcb-0016-brain-v1-roadmap` (equal to `master` at `98d1d34`, verified: `git log master..HEAD` is empty).

| Capability | Supporting files |
|---|---|
| Charter, scope, non-negotiables | `content/brain/harness/00_PROJECT_CHARTER.md` |
| Harness docs (state, architecture, decisions, workflow, rules, prompts, backlog, changelog, risks, handoff) | `content/brain/harness/01…10_*.md` |
| v0 freeze + change control | `content/brain/harness/09_V0_FREEZE.md` |
| Registries (projects, decisions, prompts, agents, inbox, missions) | `content/brain/registries/*.json` |
| Mission ledger (MCB-0001 → MCB-0015) + mission docs | `content/brain/registries/missions.json`, `content/brain/missions/mcb-*.md` |
| Inbox capture → triage → promote workflow | `scripts/brain-capture.mjs`, `scripts/brain-promote.mjs`, `scripts/brain-new-inbox-item.mjs`, `content/brain/inbox/` |
| Mission creation helper | `scripts/brain-new-mission.mjs` |
| Guardrails (7 checks: ENTRY isolation, no Supabase, no DB, registry validity, required files, relation resolution, anti-ledger-drift) | `scripts/brain-guardrails.mjs`, wired into CI |
| Relation/backlink integrity | `scripts/brain-check-relations.mjs`, `features/brain/lib/relations.ts` |
| Search + tags (read-only UI) | `features/brain/lib/search.ts`, `app/(console)/brain/**` |
| Coordination loop (protocol, roles, operator guide, folder-as-status missions, per-agent reports, 3 templates) | `content/brain/loop/PROTOCOL.md`, `ROLES.md`, `OPERATOR_GUIDE.md`, `loop/missions/01_todo…05_blocked/`, `loop/reports/{claude,codex,gemini,gpt}/`, `loop/templates/*.md` |
| Context export (full-Brain, deterministic, zero-dep) | `scripts/brain-export-context.mjs` → `content/brain/exports/brain-context.md` (~164 KB) |
| ENTRY knowledge pack (8 docs, evidence-tiered) | `content/brain/projects/entry*.md` |
| npm entry points | `package.json` scripts: `brain:capture`, `brain:guardrails`, `brain:check-relations`, `brain:new-mission`, `brain:new-inbox-item`, `brain:promote` |

**Verified gap in the inventory itself:** `scripts/brain-export-context.mjs` has **no npm script alias** in `package.json`, even though `09_V0_FREEZE.md` lists "`brain-export-context`" among the runnable CLIs. It must be invoked as `node scripts/brain-export-context.mjs`.

---

## Strengths

Do not touch these; they are the load-bearing walls.

1. **Evidence discipline (verified / inferred / unknown).** Encoded in `PROTOCOL.md`, `04_WORKFLOW.md`, and both report templates. This is the single most valuable cultural asset in the repo — it is what makes agent claims auditable at all. Every future contract should inherit it verbatim.
2. **Folder-as-status mission queue.** `01_todo → 05_blocked` with `git mv` is minimal, diff-visible, merge-conflict-resistant, and needs no runtime. Correct design; keep it.
3. **Guardrails in CI.** Seven deterministic, zero-dependency, local-only checks. The pattern (pure Node, no network, exits non-zero) is exactly how all future loop checks should be built.
4. **One writer per branch, Rudy as sole merge owner, explicit `MERGE APPROVED` / `DIRECT PUSH APPROVED` phrases.** These are the safety spine. Nothing in the operating layer may weaken them.
5. **Inbox → human promote gate.** Raw model output never becomes knowledge without a human decision. This is the correct trust boundary for any future local-model integration too.
6. **The export script's design constraints** (deterministic, alphabetical, no timestamp, excludes itself, reads only `content/brain/**`). The *scope* of the export is weak (see below), but the *engineering pattern* is exactly right and should be reused for scoped packs.
7. **Boundary hygiene.** No DB, no Supabase in Brain, no ENTRY imports — enforced by machine, not by promise.

---

## Weaknesses / Friction Points

Ordered by how much they hurt agent operation.

### W1 — Ledger drift keeps recurring (state cannot be trusted without archaeology)

`missions.json` ends at MCB-0015. **MCB-0016 (merged, PR #14, commit `61f4cac`) and ENTRY-BRAIN-001 (merged, PR #15, commit `98d1d34`) are not registered** and have no docs under `content/brain/missions/`. This is the fourth drift episode (MCB-0008, MCB-0012/0013, MCB-0014, now these two) — registration after merge is a manual step nobody owns, and CHECK 7 only fires when a mission *doc* exists without a registry entry, never when a mission *merges* without either. Additionally, ENTRY-BRAIN-001 doesn't fit the `MCB-` ID validation in guardrails CHECK 4 at all — the ledger has no defined home for non-MCB missions, so it silently can't be registered without a convention decision.

### W2 — Mission state lives in three unsynchronized places

Registry `status` field (`planned/in_progress/completed`), loop folder position (`01_todo…05_blocked`), and GitHub PR state. Nothing checks they agree. MCB-0016's brief sits in `04_done/` while the ledger doesn't know MCB-0016 exists. An agent asking "what is active right now?" must cross-reference three sources and may still be wrong.

### W3 — Context handoff is all-or-nothing

One 164 KB `brain-context.md` containing every registry and every doc, including all eight ENTRY docs, all fifteen mission docs, and all harness files. For a mission-scoped task, ~90% is noise; for a small local model it exceeds any practical context budget; for GPT-as-orchestrator (no repo access) it is the only option, so Rudy pastes the whole thing. There is no mission pack, agent pack, project pack, or review pack — and no npm alias even for the full export.

### W4 — Roles are descriptions, not contracts

`ROLES.md` is four short paragraphs plus Rudy. It does not specify per agent: which paths may be written, which must never be written, which checks must be run before handoff, what a valid report must contain, or how the agent proves compliance. Fable and any local model have **no role at all** — this mission's own report folder (`reports/fable/`) had to be created because it didn't exist. Templates hard-code the agent list `(Claude | Codex | Gemini | GPT)`.

### W5 — Rudy is still the courier in four specific places

1. **Brief transport:** GPT writes briefs in chat; Rudy pastes them into `01_todo/`. Nothing verified this is ever repo-first.
2. **Context transport:** Rudy pastes `brain-context.md` (or fragments) into each agent's chat window — the monolith export forces this.
3. **Kickoff prompt transport:** the standard agent prompt lives in `OPERATOR_GUIDE.md` and Rudy retypes/pastes it per mission with hand-edited file names.
4. **Post-merge bookkeeping:** ledger registration, brief moves to `04_done/`, changelog appends — manual, and demonstrably skipped (W1).

### W6 — No queue means no next-action visibility

`loop/missions/01_todo/` contains only a README. There is no roadmap file, no prioritized backlog inside the loop (the harness `07_BACKLOG.md` is v0-era and not mission-shaped). Between missions, the system has no repo-resident answer to "what's next?" — it lives in Rudy's head or a chat scroll.

### W7 — Review has templates but no checklist/eval standard

`review-report.md` asks for findings and a verdict but there's no per-mission-type checklist (e.g., "for a ledger mission, verify PR/commit claims against `git log`"). Reviews are as good as the reviewer's improvisation. Nothing defines what a *passing* review must have actually checked.

---

## Proposed Agent Operating Layer

Design only — **none of these folders are created in MCB-0017** except `loop/reports/fable/` (required for this report's own path, one README added for consistency with sibling folders).

```
content/brain/loop/
├── PROTOCOL.md            (exists — stays authoritative)
├── ROLES.md               (exists — becomes a thin index pointing at contracts/)
├── OPERATOR_GUIDE.md      (exists)
├── missions/01…05         (exists — stays the queue)
├── reports/<agent>/       (exists — add fable/, later local/)
├── templates/             (exists — extend, don't replace)
│
├── contracts/             NEW (MCB-0019) — one file per agent
│   ├── gpt-orchestrator.md
│   ├── claude-implementer.md
│   ├── codex-reviewer.md
│   ├── gemini-auditor.md
│   ├── fable-architect.md
│   ├── local-triage.md
│   └── rudy-merge-owner.md
│
├── state/                 NEW (MCB-0021) — generated, read-only snapshot
│   └── LOOP_STATE.md      (derived from folders + ledger + git; regenerated by CLI,
│                           never hand-edited; answers "what is active/blocked/next")
│
├── roadmaps/              NEW (MCB-0018 seeds it) — decided mission order
│   └── ROADMAP.md         (ordered MCB queue with one-line scopes; the repo-resident
│                           answer to "what's next"; replaces chat-resident planning)
│
├── runbooks/              NEW (MCB-0022) — step-by-step procedures
│   ├── run-a-mission.md   (agent kickoff: exact prompt, exact checks)
│   ├── close-a-mission.md (post-merge: ledger, changelog, brief move — the W5.4 fix)
│   └── repair-drift.md    (how to register an unregistered merged mission)
│
├── evals/                 NEW (MCB-0022) — review checklists per mission type
│   ├── review-content-mission.md
│   ├── review-script-mission.md
│   └── review-ledger-mission.md
│
└── context-packs/         NEW (MCB-0020) — pack *definitions* (what goes in each pack);
    └── PACKS.md            generated pack output goes to content/brain/exports/packs/
```

Principles carried over unchanged: everything is Markdown/JSON in Git; generated files are clearly labeled and never hand-edited; nothing runs by itself; humans/agents run CLIs intentionally; GitHub stays authority.

---

## Context Pack Strategy

Extend the proven `brain-export-context.mjs` pattern (deterministic, zero-dep, no timestamps, reads only `content/brain/**`) into one scoped exporter. Because `scripts/brain-*.mjs` is frozen, this is a **named mission (MCB-0020)**, not a silent change; the existing script and its output stay untouched until then.

### Pack types

| Pack | Contents | Audience | Target size |
|---|---|---|---|
| **full** | Everything (today's behavior, unchanged) | New agent onboarding, GPT with no repo access | ~165 KB |
| **mission** | PROTOCOL + the one brief + its ledger entry + docs listed in the brief's *Files allowed* + related-entry summaries (1 hop) | The owner agent for one mission | 10–30 KB |
| **agent** | PROTOCOL + ROLES + that agent's contract + its open missions' briefs + its report template | A specific agent starting a session | 10–20 KB |
| **project** | One project's docs (e.g. all `entry*.md`) + its registry entries + related decisions | Product-scoped work | varies |
| **review** | The brief + the agent report + the relevant eval checklist + the ledger entry (diff/CI stay on GitHub — authority unchanged) | Codex/Gemini reviewing a PR | 10–20 KB |
| **local** | Hard-capped small pack: task instruction + minimal excerpts + required output schema | Local model triage tasks | ≤ 16 KB hard cap |

### CLI behavior

```bash
npm run brain:export                                   # full (alias for today's script — add this alias regardless)
npm run brain:export -- --pack mission --id MCB-0018   # → exports/packs/mission/mcb-0018-context.md
npm run brain:export -- --pack agent --id claude       # → exports/packs/agent/claude-context.md
npm run brain:export -- --pack project --id entry      # → exports/packs/project/entry-context.md
npm run brain:export -- --pack review --id MCB-0018    # → exports/packs/review/mcb-0018-review-context.md
npm run brain:export -- --pack local --id INB-0007     # → exports/packs/local/inb-0007-local-context.md
```

Rules: deterministic output (re-run = no diff unless sources changed); every pack starts with a generated header naming its sources, pack type, and the warning "convenience copy — Git/GitHub is authority"; packs never include `.env*`, `.claude/**`, app code, or anything outside `content/brain/**`; the `local` pack enforces its size cap and fails loudly rather than truncating silently.

---

## Agent Contract Strategy

One file per agent under `loop/contracts/`, each with the same five sections: **Reads / Writes / Verifies / Must never / Handoff artifact**. `ROLES.md` stays as the one-screen index. Summary of the intended contracts:

| Agent | May write | Must verify before handoff | Must never |
|---|---|---|---|
| **GPT — Orchestrator** | `loop/missions/01_todo/*.md`, `loop/roadmaps/ROADMAP.md`, `reports/gpt/` | Brief names exact files-allowed, checks, evidence, stop conditions; scope is single-writer-sized | Implement, review diffs, merge, edit other agents' files, mark anything verified without evidence |
| **Claude — Implementer** | Files named in its brief's *Files allowed*, `reports/claude/`, brief moves via `git mv` | All checks in the brief pass; every "verified" claim has cited evidence | Merge, push to master, exceed files-allowed, weaken checks, edit PROTOCOL/charter/guardrails/workflows unless the brief names them |
| **Codex — Reviewer + CI** | `reports/codex/`, plus implementer rights when a brief assigns it `scripts/**` or `features/brain/**` | Ran the eval checklist for the mission type; checks green and not weakened; report claims match the real diff | Merge, approve its own implementation, skip/disable checks |
| **Gemini — Adversarial Auditor** | `reports/gemini/` only | Attempted to falsify (not confirm) claims; checked inferred-as-verified, scope creep, boundary violations | Merge, implement (unless a brief says so), soften a verdict to be agreeable |
| **Fable — Senior Architect** | `reports/fable/`, `loop/roadmaps/`, architecture/audit docs named in its brief | Recommendations tagged with evidence levels; frozen-code changes proposed as named missions, never made inline | Merge, implement product code, silently modify frozen scripts/harness, expand scope beyond the brief |
| **Local Model — Triage Assistant** | Nothing directly. Output goes through `brain:capture` into the inbox (`status: "inbox"`) | n/a — it verifies nothing; humans verify it | Write to registries/docs/loop, be cited as evidence, run Git operations, receive secrets or ENTRY operational data |
| **Rudy — Merge Owner** | Anything (owner), but by convention: approvals, priorities, merges, `04_done` moves | CI green + review verdict + report-vs-diff spot check before merge | Merge red/unreviewed PRs, hand-edit an agent's diff, courier content between chats that belongs in a report file |

All contracts inherit globally: evidence discipline (verified/inferred/unknown), stop conditions from `PROTOCOL.md`, no `git add .`, never touch `.env.local` / `.claude/settings.local.json` / secrets, `MERGE APPROVED` / `DIRECT PUSH APPROVED` phrases required exactly as today.

---

## Local AI Readiness

How Minerva can later use a local model (Ollama-class, small context) **without giving it authority**. This is design only; nothing local is integrated in v0 or in the proposed roadmap before MCB-0023.

**Suitable tasks** (drafting/triage — output is always a *suggestion*):
- Draft inbox-item summaries and suggest tags for `INB-*` items awaiting human triage.
- Suggest `related` candidates by reading two entries and proposing a link (human adds it or not).
- Draft first-pass mission-doc prose from a merged PR description for a human to edit during ledger registration.
- Flag briefs whose *Files allowed* and *Scope* sections appear inconsistent — as a comment for a human, never as a gate.

**Unsuitable tasks:** anything that writes registries, docs, or loop files; review verdicts; evidence verification; Git operations; anything touching ENTRY/Seshat operational data, secrets, or customer data; anything whose output would be consumed by another agent as fact.

**Context format:** exactly one `local` pack (≤ 16 KB hard cap), generated by the scoped exporter — never ad-hoc pastes, never the full export. The pack embeds the task instruction and the required output schema so the model needs no other context.

**Output format:** a single Markdown file matching `TEMPLATE_inbox_item.md`, captured via the existing CLI (`npm run brain:capture -- --source local ...`). Note: `INBOX_SOURCES` in guardrails currently lacks a `local` value (`other` is the interim workaround); adding `"local"` is a one-line change bundled into the named guardrails mission (MCB-0022), not a silent edit.

**Validation requirements:** every local-model output lands as `status: "inbox"`; a human triages it exactly like any other raw output; guardrails + relation checks run as usual on any promotion. Local output is never citable as "verified" — its evidence tier is at best "inferred, machine-suggested".

**No-authority boundaries:** no write access outside the inbox capture path; no ability to move mission briefs; no participation in review verdicts; no merge phrases apply to it ever; if a local model's suggestion is wrong, the failure mode must be "a human wasted 30 seconds in triage", nothing worse.

---

## Proposed Mission Roadmap

Foundations first. Each is single-writer, small, and independently mergeable.

### MCB-0018 — Ledger Repair & Registration Runbook
- **Purpose:** Restore ledger truth (fix W1) and make post-merge registration a written procedure instead of tribal knowledge.
- **Scope:** Register MCB-0016 (verified: PR #14, commit `61f4cac`, agent claude) and MCB-0017. Decide + document the convention for non-`MCB-` missions (recommend: register ENTRY-BRAIN-001 as an `MCB-`-aliased entry or extend the documented ID convention in `04_WORKFLOW.md` — a decision entry either way, since CHECK 4 enforces the `MCB-` prefix). Seed `loop/roadmaps/ROADMAP.md` with this roadmap. Add the close-a-mission runbook.
- **Files allowed:** `content/brain/registries/missions.json`, `content/brain/missions/mcb-0016.md`, `mcb-0017.md`, `content/brain/registries/decisions.json` + decision doc, `content/brain/harness/04_WORKFLOW.md` (ID convention paragraph only), `content/brain/loop/roadmaps/**`, `content/brain/loop/runbooks/close-a-mission.md`, `content/brain/harness/08_CHANGELOG.md`.
- **Acceptance:** guardrails + check-relations green; every merged mission through MCB-0017 registered or its absence explained by the documented convention; roadmap file exists.
- **Owner:** Claude. **Risk:** Low (content-only). **Depends on:** MCB-0017 merged.

### MCB-0019 — Agent Contracts v1
- **Purpose:** Fix W4 — behavior specified per agent, Fable and Local roles exist.
- **Scope:** Create `loop/contracts/` (7 files per the table above); slim `ROLES.md` into an index; update the 3 loop templates' agent lists; add `reports/local/README.md` placeholder.
- **Files allowed:** `content/brain/loop/contracts/**`, `content/brain/loop/ROLES.md`, `content/brain/loop/templates/*.md`, `content/brain/loop/reports/local/README.md`, `content/brain/harness/08_CHANGELOG.md`.
- **Acceptance:** each contract has Reads/Writes/Verifies/Must-never/Handoff sections; no contract weakens any PROTOCOL rule; guardrails green.
- **Owner:** Claude. **Risk:** Low. **Depends on:** MCB-0018 (roadmap exists to anchor it).

### MCB-0020 — Scoped Context Pack Exporter
- **Purpose:** Fix W3/W5.2 — right-sized context per mission/agent/project/review/local.
- **Scope:** **Named freeze-lift for one script area.** Extend `brain-export-context.mjs` (or add `brain-export-pack.mjs` alongside, leaving the frozen script byte-identical — reviewer's choice at implementation) with `--pack`/`--id`; add `brain:export` npm alias for the existing full export; write `loop/context-packs/PACKS.md` defining pack contents; output under `content/brain/exports/packs/`.
- **Files allowed:** `scripts/brain-export-pack.mjs` (new) or `scripts/brain-export-context.mjs` (justified in the brief), `package.json` (scripts block only), `content/brain/loop/context-packs/PACKS.md`, `content/brain/exports/**`, `content/brain/harness/08_CHANGELOG.md`.
- **Acceptance:** all six pack types generate deterministically; zero new dependencies; local pack enforces size cap; full export output unchanged byte-for-byte; guardrails + tsc green.
- **Owner:** Codex. **Risk:** Medium (touches frozen script territory + package.json — both explicitly named). **Depends on:** MCB-0019 (agent packs embed contracts).

### MCB-0021 — Loop State Snapshot CLI
- **Purpose:** Fix W2/W6 — one generated file answering "what is active, blocked, in review, next".
- **Scope:** New zero-dep script `scripts/brain-loop-state.mjs` deriving `loop/state/LOOP_STATE.md` from the loop folders, `missions.json`, and local git (read-only; flags disagreements between folder-status and ledger-status instead of resolving them).
- **Files allowed:** `scripts/brain-loop-state.mjs`, `package.json` (scripts block only), `content/brain/loop/state/**`, `content/brain/harness/08_CHANGELOG.md`.
- **Acceptance:** deterministic; clearly labeled generated-do-not-edit; detects the MCB-0016-style mismatch class; guardrails green.
- **Owner:** Codex. **Risk:** Low-medium (new script, no frozen code touched). **Depends on:** MCB-0018 (ledger must be clean first or the snapshot just reports known noise).

### MCB-0022 — Loop Guardrails & Review Evals
- **Purpose:** Fix W7 and close the drift loophole mechanically.
- **Scope:** **Named freeze-lift for `brain-guardrails.mjs`.** Add checks: mission brief exists in exactly one status folder; a brief in `03_review`/`04_done` has a matching agent report; contracts exist for every agent with a reports folder; add `"local"` to `INBOX_SOURCES`. Seed `loop/evals/` with the three review checklists.
- **Files allowed:** `scripts/brain-guardrails.mjs`, `content/brain/loop/evals/**`, `content/brain/loop/runbooks/run-a-mission.md`, `repair-drift.md`, `content/brain/harness/08_CHANGELOG.md`.
- **Acceptance:** new checks are local/deterministic/zero-dep like the existing seven; all existing checks unchanged; CI green.
- **Owner:** Codex, adversarial review by Gemini. **Risk:** Medium (guardrails are load-bearing). **Depends on:** MCB-0019, MCB-0021.

### MCB-0023 — Local Triage Pilot (design-gated)
- **Purpose:** First concrete local-model use, inside the boundaries above.
- **Scope:** Only after MCB-0020's `local` packs exist: run a manual pilot (human runs the local model by hand with a generated pack, captures output via `brain:capture --source local`) and write an evaluation report. **No integration code, no automation, no new dependencies.** Ends with a go/no-go decision entry for anything further.
- **Files allowed:** `content/brain/loop/reports/local/**`, `content/brain/inbox/**` + inbox registry, decision entry, changelog.
- **Acceptance:** pilot report separates verified observations from opinions; a decision entry records go/no-go.
- **Owner:** Rudy (operator) + Fable (evaluation report). **Risk:** Low (manual, inbox-gated). **Depends on:** MCB-0020, MCB-0022.

---

## Recommended Immediate Next Mission

**MCB-0018 — Ledger Repair & Registration Runbook.**

Reasons: (1) it is the cheapest mission on the list and repairs a *currently false* system state — two merged missions invisible to the ledger — and an operating layer built on an untrustworthy ledger inherits the rot; (2) it forces the one open convention decision (non-MCB mission IDs) that blocks clean registration forever if deferred; (3) it seeds the roadmap file, which converts this report's plan from chat-resident to repo-resident — the exact anti-courier principle the loop exists for; (4) every later mission (state snapshot, guardrail checks, packs) consumes ledger data and is cleaner if the ledger is already true.

---

## Non-Negotiable Boundaries

Must **not** be built until an explicit later v1/v2 decision, regardless of how tempting during roadmap execution:

- No database of any kind (no Supabase, Neon, SQLite, anything) behind Brain.
- No RAG, embeddings, vector search, or semantic index — packs are deterministic file selections, not retrieval.
- No autonomous agents, schedulers, bots, watchers, or anything that runs without a human intentionally invoking it.
- No model router, no cost monitor.
- No connection from Brain to ENTRY or Seshat operational data; no ENTRY runtime changes.
- No UI write paths — Brain stays read-only in the app; writes happen in Git via PR.
- No new npm dependencies (all proposed scripts are zero-dep pure Node, same as existing).
- No weakening of: guardrails, CI checks, `MERGE APPROVED` / `DIRECT PUSH APPROVED`, one-writer-per-branch, evidence discipline, or the inbox promotion gate.
- No local-model authority: local output enters through the inbox only, forever gated by human triage.
- No silent edits to frozen surfaces (`features/brain/**`, `scripts/brain-*.mjs`, harness charter/freeze/guardrails) — only named missions, as MCB-0020/0022 are.

---

## Evidence Reviewed

**Files inspected (read in full):**
`content/brain/harness/00_PROJECT_CHARTER.md`, `04_WORKFLOW.md`, `05_AGENT_RULES.md`, `08_CHANGELOG.md`, `09_V0_FREEZE.md`; `content/brain/loop/PROTOCOL.md`, `ROLES.md`, `OPERATOR_GUIDE.md`; `loop/templates/mission-brief.md`, `agent-report.md`, `review-report.md`; `loop/missions/04_done/mcb-0016-brain-v0-closeout.md`; `loop/reports/claude/mcb-0016-agent-report.md`, `loop/reports/claude/README.md`; `content/brain/registries/missions.json`; `scripts/brain-export-context.mjs`, `scripts/brain-guardrails.mjs`; `package.json`. Full `content/brain/**` and `scripts/*.mjs` file trees enumerated.

**Commands run (read-only):**
- `git status` / `git log --oneline master` — verified master head `98d1d34`, merges `#14` (`61f4cac`, MCB-0016) and `#15` (`98d1d34`, ENTRY-BRAIN-001).
- `git log master..HEAD` on `mcb-0016-brain-v1-roadmap` — empty; branch equals master (verified).
- Export file size check — `content/brain/exports/brain-context.md` is 164,373 bytes (verified).
- `npm run brain:guardrails`, `npm run brain:check-relations`, `npx tsc --noEmit` — results recorded in the MCB-0017 PR description and final handoff.

**Key verified findings:** MCB-0016 + ENTRY-BRAIN-001 merged but unregistered (W1); no `reports/fable/` prior to this mission (W4); no npm alias for the export script (W3/inventory); `01_todo/` empty (W6); CHECK 7 covers only doc→registry direction (W1); `INBOX_SOURCES` lacks `local` (Local AI Readiness).

**Explicitly not changed (freeze respected):** `scripts/brain-*.mjs`, `features/brain/**`, all harness files, `missions.json` (MCB-0016/ENTRY-BRAIN-001 registration is *proposed* as MCB-0018, not performed here), `package.json`, guardrails, workflows. The only files this mission adds are this report and `loop/reports/fable/README.md`.
