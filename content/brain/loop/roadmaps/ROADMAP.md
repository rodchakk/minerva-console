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

- **Status:** in_progress
- **Purpose:** Repair mission-ledger drift (MCB-0016 and MCB-0017 were
  merged but unregistered); add the `close-a-mission.md` runbook so future
  missions register themselves instead of waiting for a repair mission.
- **Owner:** Claude (Implementer)
- **Risk:** Low — content/registry/decision docs only.
- **Dependencies:** MCB-0017 merged.
- **Acceptance:** `brain:guardrails` and `brain:check-relations` green;
  MCB-0016 and MCB-0017 registered in `missions.json`; the ENTRY-BRAIN-001
  ID-convention question resolved by a decision entry; this roadmap exists.

## MCB-0019 — Agent Contracts v1

- **Status:** planned
- **Purpose:** Replace the thin `ROLES.md` descriptions with real per-agent
  contracts (Reads / Writes / Verifies / Must never / Handoff artifact) for
  GPT, Claude, Codex, Gemini, Fable, Local Model, and Rudy.
- **Owner:** Claude (Implementer)
- **Risk:** Low — new `loop/contracts/**` files, `ROLES.md` becomes an index.
- **Dependencies:** MCB-0018.
- **Acceptance:** every contract has all five sections; no contract weakens
  any `PROTOCOL.md` rule; guardrails green.

## MCB-0020 — Scoped Context Pack Exporter

- **Status:** planned
- **Purpose:** Replace the all-or-nothing ~165 KB `brain-context.md` export
  with scoped packs: full, mission, agent, project, review, and a
  size-capped local pack.
- **Owner:** Codex (Reviewer + CI/QA — implements scripts)
- **Risk:** Medium — named freeze-lift on `scripts/brain-export-context.mjs`
  (or a new sibling script) and `package.json`'s scripts block; both must be
  explicitly justified in the mission brief.
- **Dependencies:** MCB-0019 (agent packs embed the new contracts).
- **Acceptance:** all six pack types generate deterministically; zero new
  dependencies; local pack enforces a hard size cap; today's full export
  output is unchanged; guardrails + `tsc --noEmit` green.

## MCB-0021 — Loop State Snapshot CLI

- **Status:** planned
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

- **Status:** planned
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
