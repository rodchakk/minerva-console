# Role Contract — Orchestrator

## Purpose

Plans the work. Turns broad goals into small, single-writer missions; writes
or proposes mission briefs; keeps the roadmap coherent and sequenced. The
orchestrator decides *what* should happen next and in what order — not *how*
the code is written or *whether* a PR merges.

## May Read

- All of `content/brain/**` (charter, harness, registries, missions, loop,
  reports, roadmaps, runbooks, contracts).
- Exported context packs handed to it (the orchestrator often works without
  direct repo access and plans from an export).
- Git/GitHub history when available, as authority for what has actually
  landed.

## May Write

- Mission briefs in `content/brain/loop/missions/01_todo/`.
- `content/brain/loop/roadmaps/ROADMAP.md`.
- Its own reports under `content/brain/loop/reports/<actor>/`.
- Nothing else. It does not write implementation code, registries (beyond a
  brief it authors being picked up later), scripts, or product features.

## Must Verify

- Every brief it writes names **Assigned role**, **Assigned agent/model**, and
  **Human merge owner** separately.
- Every brief has a small, single-writer **Scope**, an explicit **Out of
  scope**, a concrete **Files allowed** list, **Checks required**, **Evidence
  required**, and **Stop conditions**.
- The roadmap order it proposes respects stated dependencies and the v0
  freeze.

## Must Never Do

- Implement mission code or edit files a brief allocates to an implementer.
- Review or approve its own briefs as though they were independently verified.
- Merge, or authorize a merge — that is the merge-owner role.
- Mark a roadmap item `done` before Git shows it merged.
- Bind a role to a permanent model owner in a brief. Assign a model to a role
  *for that mission only*.

## Required Handoff Artifact

A mission brief (from `content/brain/loop/templates/mission-brief.md`) placed
in `01_todo/`, and/or an updated `ROADMAP.md`. If planning produced analysis,
a short report under `reports/<actor>/`.

## Stop Conditions

Stop and hand off when:

- A goal cannot be split into single-writer missions without guessing intent.
- Planning would require a decision only the merge-owner can make (priority,
  scope trade-off, lifting a frozen item).
- A brief would need to allocate frozen files (`scripts/brain-*.mjs`,
  `features/brain/**`, harness charter/freeze/guardrails, `.github/workflows/**`)
  — those require an explicit named mission and merge-owner sign-off.

## Evidence Rules

Tag claims as **verified** / **inferred** / **unknown** per
[`../PROTOCOL.md`](../PROTOCOL.md). Plans are inherently forward-looking; the
orchestrator must not record a planned outcome as verified. Roadmap status
must match Git, not intent.

## Assignment Notes

This role may be assigned to Claude, Codex, Gemini, Fable, GPT, a future
model, or a human, depending on the mission. The mission brief must name the
assigned role and the assigned model/operator separately. No model permanently
owns the orchestrator role.
