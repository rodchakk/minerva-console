# Role Contracts

Role contracts define **what a role does**, not **which model does it**. This
is the core principle of the Minerva Core Brain loop:

> Contracts define responsibilities by role. Agents and models are assigned to
> roles per mission.

Models change. Vendors change. A role that a Claude model performs today may be
performed by Codex, Gemini, Fable, GPT, a future model, or a human tomorrow.
Binding behavior to a model name would rot the moment the roster changes.
Binding behavior to a **role** keeps the contract stable while the actor
varies.

## The roles

| Contract | Role in one line |
|---|---|
| [`orchestrator.md`](orchestrator.md) | Plans missions, writes briefs, keeps the roadmap coherent. |
| [`implementer.md`](implementer.md) | Executes one mission brief, writes only allowed files, opens the PR. |
| [`reviewer-ci.md`](reviewer-ci.md) | Reviews an implementation PR against its brief; verifies checks/CI. |
| [`adversarial-auditor.md`](adversarial-auditor.md) | Tries to disprove the claims; hunts scope creep and fake verification. |
| [`senior-architect.md`](senior-architect.md) | Audits architecture, designs v1/v2, proposes named missions. |
| [`local-triage-assistant.md`](local-triage-assistant.md) | Future local model; inbox-gated suggestions only, no authority. |
| [`merge-owner.md`](merge-owner.md) | Human owner (currently Rudy); approves merges, owns the approval phrases. |

## How assignment works

1. A **mission brief** names, separately:
   - **Assigned role** — one of the contracts above.
   - **Assigned agent/model** — the actual actor for this mission (e.g. a
     Claude model, Codex, Gemini, Fable, GPT, a future model, or a human).
   - **Human merge owner** — who holds merge authority for the mission.
2. The **role contract** governs behavior, permissions, boundaries, required
   verification, and the handoff artifact. The assigned model is only the
   current actor filling that role.
3. A single model may hold **different roles in different missions**. It may
   never hold two conflicting roles in the *same* mission (for example,
   implementer and its own reviewer) — see each contract's `Must Never Do`.

## Authority

These contracts are Markdown — auditable intent, not runtime. Nothing here
executes by itself. As stated in [`../PROTOCOL.md`](../PROTOCOL.md):

- **Git/GitHub are authority** for branch existence, diffs, CI results, and
  merge state.
- **The mission brief is the source of truth** for who and what is assigned in
  that mission.
- **Markdown records intent and claims**, and is corrected when it disagrees
  with Git.

The registry personas in `content/brain/registries/agents.json`
(Architecture Reviewer, Codebase Analyst, Prompt Librarian, Product
Strategist, QA Verifier) are **reusable capability descriptions**, not
permanent role assignments. A mission may draw on a persona while assigning a
role contract to whichever model performs it.
