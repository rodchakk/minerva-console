# Roadmap

The repo-resident answer to "what's next?" for the Minerva Core Brain Agent
Operating Layer. Seeded from the MCB-0017 readiness audit
(`content/brain/loop/reports/fable/mcb-0017-readiness-audit.md`). Update this
file as part of closing each mission — see
`content/brain/loop/runbooks/close-a-mission.md`.

Status values: `planned` (not started) · `in_progress` (branch/PR open) ·
`done` (merged) · `blocked` (see the mission's brief or doc for why).

This file is a plan, not authority — Git/GitHub remain authority for what
actually merged. Foundations first; no RAG, embeddings, autonomous agents, or
local-model integration before the boundaries in the MCB-0017 audit are
satisfied.

---

## MCB-0018 — Ledger Repair & Registration Runbook

- **Status:** done (PR #17, commit `065c12b`)
- **Purpose:** Repair mission-ledger drift (MCB-0016 and MCB-0017 were
  merged but unregistered); add the `close-a-mission.md` runbook so future
  missions register themselves instead of waiting for a repair mission.
- **Owner:** Claude (Implementer)
- **Risk:** Low — content/registry/decision docs only.
- **Dependencies:** MCB-0017 merged.
- **Acceptance:** `brain:guardrails` and `brain:check-relations` green;
  MCB-0016 and MCB-0017 registered in `missions.json`; the ENTRY-BRAIN-001
  ID-convention question resolved by a decision entry; this roadmap exists.

## MCB-0019 — Role Contracts v1

- **Status:** done (PR #19, commit `59db08e`)
- **Purpose:** Replace the thin `ROLES.md` descriptions with real **role-based**
  contracts (not model-bound) under `loop/contracts/`: orchestrator,
  implementer, reviewer-ci, adversarial-auditor, senior-architect,
  local-triage-assistant, merge-owner. A mission assigns a model/operator to a
  role; models are not permanently bound to roles.
- **Owner:** implementer role (a Claude/Opus model this mission).
- **Risk:** Low — new `loop/contracts/**` files; `ROLES.md` becomes an index;
  templates gain role/model/merge-owner fields.
- **Dependencies:** MCB-0018.
- **Acceptance:** every contract has the shared structure (Purpose / May Read /
  May Write / Must Verify / Must Never Do / Required Handoff Artifact / Stop
  Conditions / Evidence Rules / Assignment Notes); no contract weakens any
  `PROTOCOL.md` rule; guardrails + relations + typecheck green.

## MCB-0020 — Scoped Context Pack Exporter

- **Status:** done (PR #21, commit `0efa9e2c68e9a8e286b7c2426dd4eac7970ca564`)
- **Purpose:** Add scoped context packs alongside the all-or-nothing
  `brain-context.md` export: full, mission, agent, project, review, and a
  size-capped local pack.
- **Owner:** implementer role (Codex this mission).
- **Risk:** Medium — named freeze-lift on `scripts/brain-export-context.mjs`
  (or a new sibling script) and `package.json`'s scripts block; both must be
  explicitly justified in the mission brief.
- **Dependencies:** MCB-0019 (agent packs embed the new contracts).
- **Acceptance:** all six pack types generate deterministically; zero new
  dependencies; local pack enforces a hard size cap; today's full export
  behavior is preserved; pack docs exist; guardrails + relation checks +
  `tsc --noEmit` green.

## MCB-0021 — Loop State Snapshot CLI

- **Status:** done (PR #23, commit `3eb35910f58c4304099defbebe0c1e6d3fbe5ee7`)
- **Purpose:** Generate `loop/state/LOOP_STATE.md` from the loop folders,
  `missions.json`, and local Git — one file answering "what's active,
  blocked, in review, next" and flagging folder-vs-ledger mismatches instead
  of silently trusting either side.
- **Owner:** Codex
- **Risk:** Low-medium — new zero-dependency script; no frozen code touched.
- **Dependencies:** MCB-0018 (ledger should be clean before snapshotting it).
- **Acceptance:** deterministic output, clearly labeled
  generated/do-not-edit; detects the MCB-0016/MCB-0017-style ledger gap
  class; guardrails green.

## MCB-0022 — Loop Guardrails & Review Evals

- **Status:** done (PR #25, commit a7d261dbc7ef685c4ada8edffa9443293d079cdd)
- **Purpose:** Close the drift loophole mechanically: add guardrail checks
  for brief-in-exactly-one-folder, review-report-exists-for-PR-review-stage,
  and contracts-exist-per-agent; add `"local"` to `INBOX_SOURCES`; seed
  `loop/evals/` with per-mission-type review checklists.
- **Owner:** Codex, adversarial review by Gemini.
- **Risk:** Medium — `scripts/brain-guardrails.mjs` is load-bearing; a named
  freeze-lift, additive only, all seven existing checks stay unchanged.
- **Dependencies:** MCB-0019, MCB-0021.
- **Acceptance:** new checks are local, deterministic, zero-dependency, like
  the existing seven; CI stays green.

## MCB-0023 — Local Triage Pilot (design-gated)

- **Status:** planned
- **Purpose:** First concrete local-model use, strictly inside the
  boundaries in the MCB-0017 audit: manual, inbox-gated, no authority. Human
  runs a local model by hand against a generated `local` pack, captures its
  output via `brain:capture --source local`, and evaluates the result.
- **Owner:** Rudy (operator) + Fable (evaluation report).
- **Risk:** Low — manual and inbox-gated; no integration code, no
  automation, no new dependencies.
- **Dependencies:** MCB-0020 (local packs must exist), MCB-0022 (`"local"`
  inbox source must exist).
- **Acceptance:** pilot report separates verified observations from
  opinion; a decision entry records a go/no-go for anything further.
