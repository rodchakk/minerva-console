# Role Contract — Reviewer / CI

## Purpose

Reviews an implementation PR against its mission brief and confirms the checks
are real and green. The reviewer-ci role is the quality gate: it checks that
the diff matches the brief's scope, that claimed checks actually pass, and that
no check was weakened to get there.

## May Read

- The PR, its full diff, and its CI results on GitHub (authority).
- The mission brief, the agent report, and all of `content/brain/**`.
- Any review checklist/eval for the mission type, when one exists.

## May Write

- Review reports under
  `content/brain/loop/reports/<actor>/<mission>-review.md`.
- **Implementation files only when a *separate* mission assigns it the
  implementer role** (for example, a `scripts/**` or CI mission). In that
  separate mission it is bound by the implementer contract, not this one.

## Must Verify

- The diff stays inside the brief's **Files allowed** / **Scope**; flag any
  creep or boundary violation (ENTRY, Seshat, DB, Supabase, Neon, RAG,
  embeddings, UI write, `.github/workflows/**`).
- The checks the report claims as passing actually pass and were not skipped,
  disabled, or weakened.
- Each "verified" claim in the agent report is backed by evidence that matches
  the real diff and CI.
- The mission's required checks (guardrails, relations, typecheck, and any
  brief-specific ones) are green on the PR.

## Must Never Do

- Merge, or authorize a merge — that is the merge-owner role.
- **Approve its own implementation.** If it implemented the mission, a
  different actor must hold reviewer-ci or adversarial-auditor for that PR.
- Wave through a red or weakened check to unblock a merge.
- Hand-edit the PR's diff to "help"; send it back with required changes
  instead.
- Soften a blocking finding into a nit to be agreeable.

## Required Handoff Artifact

A review report from
[`../templates/review-report.md`](../templates/review-report.md) with a clear
verdict (APPROVE / REQUEST CHANGES / COMMENT), findings tied to evidence,
required changes (empty only if APPROVE), a scope assessment, and a merge
recommendation to the merge-owner.

## Stop Conditions

Stop and hand off when:

- The PR's claims cannot be reconciled with the diff or CI (REQUEST CHANGES).
- A boundary violation or scope creep is present (REQUEST CHANGES; do not fix
  it yourself).
- Reviewing would require the reviewer to modify the diff — that is the
  implementer's job under a follow-up.

## Evidence Rules

Every finding cites concrete evidence: diff lines, CI output, command output.
GitHub is authority for branch/diff/CI/merge; a report claim that disagrees
with GitHub loses. Never mark a check "verified" from the report alone —
confirm it against the PR.

## Assignment Notes

This role may be assigned to Claude, Codex, Gemini, Fable, GPT, a future
model, or a human, depending on the mission. The mission brief must name the
assigned role and the assigned model/operator separately. The reviewer-ci for
a PR must not be the same actor that implemented that PR.
