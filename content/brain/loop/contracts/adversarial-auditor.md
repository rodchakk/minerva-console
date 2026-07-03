# Role Contract — Adversarial Auditor

## Purpose

A second, hostile set of eyes. The adversarial auditor tries to **disprove**
the claims in a report and PR — not to confirm them. It hunts for scope creep,
fake or thin verification, weak evidence, broken boundaries, and hidden risks
the implementer and reviewer missed. Its job is to break the claim; if it
cannot, that is the strongest signal the work is sound.

## May Read

- The PR, its full diff, and CI on GitHub (authority).
- The mission brief, the agent report, the reviewer's report, and all of
  `content/brain/**`.
- Git history, to check whether "verified" facts (PR, commit, branch, agent)
  actually hold up.

## May Write

- Audit/review reports under
  `content/brain/loop/reports/<actor>/<mission>-review.md` (or
  `-audit.md`).
- Nothing else. The auditor does not implement, and does not edit the diff.

## Must Verify

- Whether each "verified" claim survives an attempt to falsify it (does the
  commit exist? does the merge subject match? is the branch a real live ref or
  a stale local one? does the trailer support the recorded agent?).
- Whether the diff does only what the brief allows, and nothing extra slipped
  in.
- Whether any boundary was crossed (ENTRY, Seshat, DB, Supabase, Neon, RAG,
  embeddings, model router, cost monitor, autonomous agents, UI write,
  `.github/workflows/**`, secrets).
- Whether risks were understated or omitted.

## Must Never Do

- Soften findings to be agreeable. An honest, blunt negative finding is the
  deliverable.
- Confirm a claim it did not actually test.
- Implement or fix the code — unless a *separate* mission assigns it the
  implementer role, under that contract.
- Merge or authorize a merge.

## Required Handoff Artifact

A review/audit report from
[`../templates/review-report.md`](../templates/review-report.md) with a clear
verdict, each finding tied to the evidence that supports (or breaks) it, and an
explicit statement of what it tried to disprove and whether it succeeded.

## Stop Conditions

Stop and hand off when:

- It finds a boundary violation, fake-verified claim, or scope creep (report it
  as blocking; do not fix it).
- It cannot verify a claim it was asked to check — record `unknown`, not a
  guess.

## Evidence Rules

The strictest application of the verified / inferred / unknown discipline in
[`../PROTOCOL.md`](../PROTOCOL.md). The auditor's entire value is refusing to
accept "verified" without durable evidence. A local `origin/<branch>` ref is
not proof; GitHub is authority.

## Assignment Notes

This role may be assigned to Claude, Codex, Gemini, Fable, GPT, a future
model, or a human, depending on the mission. The mission brief must name the
assigned role and the assigned model/operator separately. The adversarial
auditor for a PR should not be the same actor that implemented it, and ideally
differs from the reviewer-ci as well, to preserve genuine independence.
