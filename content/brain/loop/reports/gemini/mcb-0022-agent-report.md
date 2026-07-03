# Agent Report: MCB-0022 — Loop Guardrails & Review Evals

## Metadata
- **Assigned role:** implementer
- **Assigned agent/model:** Gemini 3.5 Flash (High)
- **Human merge owner:** Rudy
- **Branch:** `unknown`
- **PR:** `#25`
- **Commit:** `a7d261dbc7ef685c4ada8edffa9443293d079cdd`

## Summary
This mission implements a deterministic hardening layer around the Minerva Core Brain loop to catch process drift early. It adds loop mission folder structure validation, uniqueness checks, review report completeness checks, ledger status cross-referencing, role contract verification, and a Loop State freshness guardrail. It also enables the `"local"` inbox source for future local triage pilots, and seeds evaluation checklists to enforce quality gates on incoming work and reviews.

## Files Changed
- `scripts/brain-guardrails.mjs`
- `scripts/brain-loop-state.mjs`
- `scripts/brain-capture.mjs`
- `scripts/brain-new-inbox-item.mjs`
- `content/brain/loop/evals/README.md`
- `content/brain/loop/evals/review-report-checklist.md`
- `content/brain/loop/evals/agent-report-checklist.md`
- `content/brain/loop/runbooks/review-evals.md`
- `content/brain/missions/mcb-0022.md`
- `content/brain/registries/missions.json`
- `content/brain/loop/roadmaps/ROADMAP.md`
- `content/brain/harness/08_CHANGELOG.md`
- `content/brain/loop/reports/gemini/mcb-0022-agent-report.md`
- `content/brain/exports/brain-context.md`
- `content/brain/exports/packs/full.md`
- `content/brain/exports/packs/mission-MCB-0020.md`
- `content/brain/exports/packs/agent-implementer.md`
- `content/brain/exports/packs/project-PRJ-0001.md`
- `content/brain/exports/packs/review-MCB-0020.md`
- `content/brain/exports/packs/local-MCB-0023.md`
- `content/brain/loop/state/LOOP_STATE.md`

## Guardrails Added (scripts/brain-guardrails.mjs)
- **CHECK 8-F (Folder Existence):** Verifies that all 5 core loop folders (`01_todo`, `02_active`, `03_review`, `04_done`, `05_blocked`) exist.
- **CHECK 8-A (Uniqueness):** Assures that no mission ID (extracted from brief filenames via `/MCB-\d{4}(?:\.\d+)?/i`) exists in more than one folder.
- **CHECK 8-B (Review Report Presence):** Requires that any brief in `03_review/` has at least one matching markdown report under `content/brain/loop/reports/` containing the mission ID and either `review`, `reviewer`, `adversarial`, or `audit`.
- **CHECKS 8-C, 8-D, 8-E (Ledger Alignment):** Compares folder placement against their status in `missions.json` (`04_done` -> `completed`, `02_active`/`03_review` -> `in_progress`, `05_blocked` -> `blocked`).
- **CHECK 9 (Role Contract Consistency):** Scans all markdown documents in missions, loop missions, and reports directories for `Assigned role: <role>` lines and checks that they map to a valid contract file in `content/brain/loop/contracts/`. Placeholders/multiple role assignments are safely skipped.
- **CHECK 10 (LOOP_STATE Freshness):** Runs `scripts/brain-loop-state.mjs --check` and fails if the snapshot is missing or stale.

## Inbox Source Support
- The `"local"` inbox source is now fully supported. Added to the allowlists in `scripts/brain-capture.mjs`, `scripts/brain-new-inbox-item.mjs`, and `scripts/brain-guardrails.mjs`.

## LOOP_STATE Check Mode
- Added a `--check` flag to `scripts/brain-loop-state.mjs`.
- Instead of writing `LOOP_STATE.md`, it reads it and compares its contents against the newly computed output. If the file is missing or out of sync, it exits with status 1.

## Eval Checklists Added (content/brain/loop/evals/)
- `README.md` (index/intro)
- `agent-report-checklist.md` (metadata, summary, verification, boundaries)
- `review-report-checklist.md` (identity, verification rigor, scope, recommendations)
- `runbooks/review-evals.md` (step-by-step workflow & quality gates)

## Checks Run and Results
All checks were run and passed successfully:
1. `npm run brain:loop-state` -> Passed (wrote updated LOOP_STATE.md).
2. `node scripts/brain-loop-state.mjs --check` -> Passed ("LOOP_STATE.md is up to date.").
3. `npm run brain:export-context` -> Passed (updated brain-context.md).
4. `npm run brain:export-packs` -> Passed (updated context packs).
5. `npm run brain:guardrails` -> Passed (all 10 guardrails green).
6. `npm run brain:check-relations` -> Passed (no broken relations).
7. `npx tsc --noEmit` -> Passed (0 TypeScript errors).

## Scope Boundaries Respected
- No DB, RAG, embeddings, UI, ENTRY/Seshat runtime, GitHub workflows, or new dependencies were introduced or modified.
- Only the allowed files specified in the mission brief/plan were modified or created.

## Recommended Next Mission
- **MCB-0023 — Local Triage Pilot (design-gated)**

---

## Agent Report Quality Checklist Verification
- [x] **Assigned Role & Model:** Declared in metadata.
- [x] **Branch & PR:** Declared in metadata.
- [x] **Files Changed:** Listed in files changed section.
- [x] **Implementation Summary:** Summarized.
- [x] **Checks Run:** Documented.
- [x] **Scope Boundaries Respected:** Explicitly confirmed.
- [x] **Evidence Claims:** Validated by successful local runs.
- [x] **Known Limitations:** None identified; system is fully local and deterministic.
- [x] **Next Recommended Action:** Recommended MCB-0023.
