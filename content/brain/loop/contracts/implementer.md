# Role Contract — Implementer

## Purpose

Executes exactly one mission brief. Creates the mission branch, does only the
work the brief allows, runs the required checks, writes an agent report, and
opens the PR. The implementer is the single writer for its mission's branch.

## May Read

- All of `content/brain/**`.
- Its mission brief (authority for scope, files allowed, checks, evidence).
- The role contracts, protocol, roles index, and any context pack it was given.
- The wider repo for reference, but it may only **write** what its brief
  allocates.

## May Write

- Only the exact paths/globs named in its brief's **Files allowed**.
- Its agent report under `content/brain/loop/reports/<actor>/<mission>-<actor>.md`.
- Mission-brief moves via `git mv` between loop status folders when the brief
  or protocol calls for it.
- The mission ledger and mission doc for its own mission when the brief
  includes self-registration (see
  [`../runbooks/close-a-mission.md`](../runbooks/close-a-mission.md)).

## Must Verify

- Every check listed in the brief's **Checks required** passes before the PR
  is opened (typically `npm run brain:guardrails`,
  `npm run brain:check-relations`, `npx tsc --noEmit`).
- No file outside **Files allowed** was modified (`git status` /
  `git diff --stat` before staging).
- Every "verified" claim in its report is backed by concrete evidence (commit
  hash, merge subject, command output, CI result).
- Staging was done by explicit path — never `git add .`.

## Must Never Do

- Merge, or push directly to `master`. Those require the merge-owner's
  `MERGE APPROVED` / `DIRECT PUSH APPROVED` phrases, and even then the merge is
  the merge-owner's decision.
- Exceed the brief's scope or write files it does not allow.
- Weaken, skip, or disable a check to get it green.
- Edit load-bearing files not named in the brief (`../PROTOCOL.md`, the
  charter, guardrails, `.github/workflows/**`).
- Touch `.env.local`, `.claude/settings.local.json`, `.codex-tmp/`, `c`, or any
  secret.
- Also act as reviewer or adversarial-auditor for its own mission in the same
  mission.
- Record an inferred or unknown fact as verified.

## Required Handoff Artifact

An agent report from
[`../templates/agent-report.md`](../templates/agent-report.md), plus an open PR.
The report lists changed files, verified vs. inferred facts, commands run,
results, risks, blockers, and the next request.

## Stop Conditions

Stop and hand off (write the report, leave the brief where it is or move it to
`05_blocked/`) when:

- The next step would touch something outside **Files allowed** / **Scope**.
- A required fact cannot be verified and continuing would require guessing.
- CI is red and the fix is out of scope.
- The brief is ambiguous or depends on another unfinished mission.
- The next action is irreversible (merge, delete, force-push) — those belong to
  the merge-owner.

## Evidence Rules

Follow the verified / inferred / unknown discipline in
[`../PROTOCOL.md`](../PROTOCOL.md). Prefer `unknown` over a confident guess.
A commit hash that does not yet exist (before squash-merge) is `unknown`, not
invented.

## Assignment Notes

This role may be assigned to Claude, Codex, Gemini, Fable, GPT, a future
model, or a human, depending on the mission. The mission brief must name the
assigned role and the assigned model/operator separately. No model permanently
owns the implementer role — a model that implements one mission may review or
audit a different mission.
