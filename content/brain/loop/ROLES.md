# Roles

Roles in the Minerva Core Brain loop are **role-based, not model-based**. A
role defines responsibilities; a mission assigns an available agent/model (or a
human) to that role. Models change over time — the role contract stays stable
while the actor varies.

> Contracts define responsibilities by role. Agents and models are assigned to
> roles per mission.

The full contracts live in
[`content/brain/loop/contracts/`](contracts/README.md). This file is the index.

## The roles

| Role | Contract | One line |
|---|---|---|
| Orchestrator | [`contracts/orchestrator.md`](contracts/orchestrator.md) | Plans missions, writes briefs, keeps the roadmap coherent. |
| Implementer | [`contracts/implementer.md`](contracts/implementer.md) | Executes one brief, writes only allowed files, opens the PR. |
| Reviewer / CI | [`contracts/reviewer-ci.md`](contracts/reviewer-ci.md) | Reviews a PR against its brief; verifies checks/CI. |
| Adversarial Auditor | [`contracts/adversarial-auditor.md`](contracts/adversarial-auditor.md) | Tries to disprove the claims; hunts scope creep and fake verification. |
| Senior Architect | [`contracts/senior-architect.md`](contracts/senior-architect.md) | Audits architecture, designs v1/v2, proposes named missions. |
| Local Triage Assistant | [`contracts/local-triage-assistant.md`](contracts/local-triage-assistant.md) | Future local model; inbox-gated suggestions only, no authority. |
| Merge Owner | [`contracts/merge-owner.md`](contracts/merge-owner.md) | Human owner (currently Rudy); approves merges, owns the approval phrases. |

## Role vs. model

The model names that used to head these sections — GPT, Claude, Codex, Gemini,
Fable — are **examples of possible assignments, not permanent owners**. Any of
these roles may be filled by a different model in a different mission, or by a
future model that does not exist yet. The merge-owner role is held by a human.

Every mission should specify, separately:

- **Assigned role** — one of the contracts above.
- **Assigned agent/model** — the actual actor for this mission (a specific
  model, or a human).
- **Human merge owner** — who holds merge authority for the mission.

The role contract governs behavior; the assigned model is only the current
actor. A single model may hold different roles across missions, but never two
conflicting roles (for example, implementer and its own reviewer) in the same
mission.

## Authority

These are Markdown contracts — auditable intent, not runtime. Git/GitHub remain
authority for branch existence, diffs, CI, and merge state; the mission brief
is the source of truth for who and what is assigned. See
[`PROTOCOL.md`](PROTOCOL.md).
