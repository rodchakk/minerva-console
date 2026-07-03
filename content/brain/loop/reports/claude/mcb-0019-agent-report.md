# Agent Report

**Mission:** `MCB-0019`
**Assigned role:** implementer
**Assigned agent/model:** a Claude (Opus) model
**Human merge owner:** Rudy
**Branch:** `mcb-0019-role-contracts-v1`
**Commit:** pending — self-registering per
`content/brain/loop/runbooks/close-a-mission.md`; the squash commit hash is
unknowable before merge and is finalized in a fast-follow.

## Summary

Created the first version of Minerva Core Brain's role-based contracts. The
central decision — an explicit correction to the original brief — is that
contracts define responsibilities **by role, not by model**. A mission assigns
an available agent/model (or a human) to a role for that mission only; a model
may fill different roles in different missions. Added the `loop/contracts/`
folder with an index and seven contracts, converted `ROLES.md` into a
role-contract index, updated the three loop templates to separate assigned
role / assigned agent-model / human merge owner, and added a discoverability
note to `04_WORKFLOW.md`.

## Files changed

- created:
  - `content/brain/loop/contracts/README.md`
  - `content/brain/loop/contracts/orchestrator.md`
  - `content/brain/loop/contracts/implementer.md`
  - `content/brain/loop/contracts/reviewer-ci.md`
  - `content/brain/loop/contracts/adversarial-auditor.md`
  - `content/brain/loop/contracts/senior-architect.md`
  - `content/brain/loop/contracts/local-triage-assistant.md`
  - `content/brain/loop/contracts/merge-owner.md`
  - `content/brain/missions/mcb-0019.md` (in the self-registration follow-up commit)
  - `content/brain/loop/reports/claude/mcb-0019-agent-report.md` (this file)
- modified:
  - `content/brain/loop/ROLES.md` (rewritten as a role-contract index)
  - `content/brain/loop/templates/mission-brief.md`
  - `content/brain/loop/templates/agent-report.md`
  - `content/brain/loop/templates/review-report.md`
  - `content/brain/harness/04_WORKFLOW.md` (role-based assignment note)
  - `content/brain/loop/roadmaps/ROADMAP.md` (MCB-0019 in_progress + role-based framing)
  - `content/brain/harness/08_CHANGELOG.md`
  - `content/brain/registries/missions.json` (MCB-0019 entry, self-registration follow-up commit)

## Role-vs-model decision

The original brief named contracts like `claude-implementer.md` and
`codex-reviewer.md`, then corrected itself: those bind roles to model/vendor
names that will rot as the roster changes. I implemented the corrected model:

- Contracts are named by **role** (`implementer.md`, `reviewer-ci.md`, …), never
  by model.
- Each contract's **Assignment Notes** states explicitly that the role may be
  assigned to Claude, Codex, Gemini, Fable, GPT, a future model, or a human,
  and that the brief must name the assigned role and assigned model/operator
  separately.
- `ROLES.md` demotes the old model names (GPT/Claude/Codex/Gemini/Rudy) to
  *example* assignments, not owners.
- Templates now carry `Assigned role` / `Assigned agent/model` / `Human merge
  owner` as separate fields.
- The **merge-owner** role is documented as a contract but flagged as
  human-held (currently Rudy), not model-assignable — merge authority and final
  judgment stay human.

## Contracts created

orchestrator, implementer, reviewer-ci, adversarial-auditor, senior-architect,
local-triage-assistant, merge-owner — seven contracts plus a README index, all
sharing the nine-section structure from the brief (Purpose / May Read / May
Write / Must Verify / Must Never Do / Required Handoff Artifact / Stop
Conditions / Evidence Rules / Assignment Notes).

## Templates updated

`mission-brief.md`, `agent-report.md`, `review-report.md` — each now separates
role from model, and the review template notes that the reviewer/auditor must
not be the actor that implemented the PR.

## Roadmap / ledger changes

- `ROADMAP.md`: MCB-0019 retitled "Role Contracts v1", marked `in_progress`,
  and reframed as role-based; acceptance criteria updated to the nine-section
  structure.
- `missions.json` + `mcb-0019.md`: MCB-0019 self-registered with verified
  branch, verified PR number (from `gh pr create`), `commit: "unknown"` until
  merge, `status: "in_progress"`, related `MCB-0018`.

## Checks run and results

- `npm run brain:guardrails` — **PASS**
- `npm run brain:check-relations` — **PASS**
- `npx tsc --noEmit` — **PASS** (no output)

No check was weakened, skipped, or disabled.

## Intentionally left out

- Did **not** create model-named contract files (the brief's explicit
  correction).
- Did **not** touch `agents.json` — the registry personas are already
  capability descriptions, not role assignments; the contracts README notes
  this, so an `agents.json` edit was unnecessary and I avoided widening the
  diff.
- Did **not** touch any script, guardrail, `features/**`, workflow, or
  dependency.

## Recommended next mission

**MCB-0020 — Scoped Context Pack Exporter** (per `ROADMAP.md`). It is the next
foundation: right-sized context per mission/agent/project/review/local, and the
agent-pack variant can now embed these role contracts.
