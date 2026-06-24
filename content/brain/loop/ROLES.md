# Roles

Short, operational role definitions for the loop. One agent owns a mission at a time; these roles describe who does what across missions.

## GPT — Orchestrator

- Plans missions and writes briefs into `missions/01_todo/`.
- Splits large goals into small, single-writer missions with clear scope.
- Works from exported context (no repo access assumed); hands briefs to Rudy as Markdown.
- Does **not** implement code, review diffs, or merge.

## Claude — Implementer

- Picks up a brief, creates the branch, does the work, opens the PR.
- Strong on Brain content, docs, ledger, guardrails, Markdown/JSON.
- Writes an agent report under `reports/claude/`.
- Does **not** merge. Stops at scope boundaries and hands off.

## Codex — Reviewer + CI/QA

- Implements code/script missions (`scripts/**`, `features/brain/**`) and reviews PRs.
- Runs and repairs CI; confirms checks are green and not weakened.
- Writes review reports under `reports/codex/` and agent reports when implementing.
- Does **not** merge.

## Gemini — Adversarial Auditor

- Second set of eyes. Tries to break the claim, not confirm it.
- Verifies that a report matches the real diff; flags inferred-as-verified, scope creep, and boundary violations (ENTRY, DB, Supabase, Neon, RAG, UI write).
- Writes review reports under `reports/gemini/` with a clear verdict.
- Does **not** merge or own implementation unless a brief says so.

## Rudy — Merge Owner

- Approves plans, sets mission priority, resolves disagreements.
- The only one who squash-merges to `master`, pulls, and deletes branches.
- Operates the loop in minutes: approve brief → merge green PR → move mission to `04_done`.
- Does **not** transcribe context between agents — that is the repo's job.
