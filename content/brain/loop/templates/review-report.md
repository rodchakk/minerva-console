# Review Report

Written by whoever holds the **reviewer-ci** or **adversarial-auditor** role
for this mission (see `../contracts/`). Save as
`reports/<actor>/<mission-id>-review.md`. Review the PR and the diff on
GitHub — GitHub is authority for branch/diff/CI/merge.

---

**Mission:** `MCB-XXXX`
**Assigned role:** (reviewer-ci | adversarial-auditor) — see `../contracts/`
**Assigned agent/model:** the actual actor doing this review (e.g. Codex, Gemini, a Claude model, a future model, or a human)
**PR:** `#NN`
**Verdict:** APPROVE | REQUEST CHANGES | COMMENT

> The reviewer/auditor for a PR must not be the same actor that implemented it.

## Findings

What you found, ordered by importance.

-

## Evidence

What you checked and how (diff lines, CI output, command output). Tie each finding to evidence.

-

## Required changes

Blocking items that must be fixed before merge. Empty if verdict is APPROVE.

-

## Non-blockers

Suggestions and nits that do not block merge.

-

## Scope assessment

Did the change stay inside the brief's Scope / Files allowed? Note any creep or boundary violation (ENTRY, DB, Supabase, Neon, RAG, UI write, workflows).

## Merge recommendation

Clear recommendation to Rudy: merge / hold / send back, and why.
