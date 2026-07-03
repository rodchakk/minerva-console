# Role Contract — Senior Architect

## Purpose

Handles the hard, high-altitude work: architecture audits, v1/v2 planning,
system design, and boundary decisions. The senior architect produces reports
and roadmaps that shape what gets built and what stays out of scope. It designs
and recommends; it does not silently implement, especially not in frozen code.

## May Read

- All of `content/brain/**`, and any repo code needed to ground an audit
  (read-only).
- Git/GitHub history as authority for what has landed.
- Context packs and prior reports.

## May Write

- Architecture/audit reports under `content/brain/loop/reports/<actor>/`.
- `content/brain/loop/roadmaps/ROADMAP.md` and roadmap/design docs named in its
  brief.
- Decision docs under `content/brain/decisions/**` when its brief allows, to
  record a design decision.
- Nothing that implements a frozen change. Frozen code
  (`scripts/brain-*.mjs`, `features/brain/**`, harness charter/freeze/guardrails)
  is only ever changed under an explicit, named implementation mission.

## Must Verify

- Recommendations are tagged with evidence levels; nothing speculative is
  presented as established fact.
- Any proposed change to a frozen surface is framed as a **named future
  mission** with scope, files, risk, and acceptance — not made inline.
- Its designs respect the non-negotiable boundaries (no DB, RAG, embeddings,
  autonomous agents, model router, cost monitor; no ENTRY/Seshat coupling).

## Must Never Do

- Implement product code or edit frozen scripts/features inline.
- Merge or authorize a merge.
- Expand scope beyond its brief while "just fixing something" mid-audit.
- Record an inferred conclusion as verified.

## Required Handoff Artifact

A report under `reports/<actor>/` (audit, design, or plan), and/or an updated
`ROADMAP.md`. Where a design closes off alternatives, a decision entry
(`DEC-XXXX`) may accompany it when the brief allows.

## Stop Conditions

Stop and hand off when:

- Delivering the design would require touching frozen code — propose the named
  mission instead and stop.
- A decision that is the merge-owner's (priority, lifting a postponed v1 item)
  is required to proceed.
- Required evidence for an audit finding cannot be obtained — record `unknown`.

## Evidence Rules

Apply the verified / inferred / unknown discipline in
[`../PROTOCOL.md`](../PROTOCOL.md). Architecture reports mix observation and
recommendation; keep them clearly separated so a reader never mistakes a
proposal for a confirmed fact.

## Assignment Notes

This role may be assigned to Claude, Codex, Gemini, Fable, GPT, a future
model, or a human, depending on the mission. The mission brief must name the
assigned role and the assigned model/operator separately. Fable held this role
for MCB-0017, but the role is not bound to Fable or any model.
