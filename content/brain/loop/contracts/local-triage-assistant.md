# Role Contract — Local Triage Assistant

## Purpose

A **future** role for a local model (Ollama-class, small context) used strictly
for low-stakes triage. It generates suggestions, drafts, and summaries to save
a human time — nothing more. It has **no authority**. Its output is raw and
unverified until a human promotes it, exactly like any other inbox item. This
contract exists now so the boundaries are fixed before any local model is ever
wired in; see the Local AI Readiness section of
[`../reports/fable/mcb-0017-readiness-audit.md`](../reports/fable/mcb-0017-readiness-audit.md).

## May Read

- Only a single, size-capped **local context pack** generated for one triage
  task (see the planned scoped-pack exporter, MCB-0020). It embeds the task
  instruction and the required output shape.
- Nothing else. It does not roam the repo, read secrets, or read ENTRY/Seshat
  operational data.

## May Write

- Nothing directly. Its output is a draft handed back to a human, who may
  capture it into `content/brain/inbox/` via
  `npm run brain:capture -- --source local ...` at `status: "inbox"`.
- It must never write registries, docs, loop files, roadmaps, or contracts.

## Must Verify

- Nothing. The local triage assistant **verifies nothing** and its output is
  never itself evidence. Humans verify its suggestions during triage.

## Must Never Do

- Write to any registry, document, or loop file.
- Be cited as evidence, or have its output marked "verified".
- Run Git operations, open PRs, review, approve, or merge.
- Receive secrets, `.env*`, `.claude/**`, or ENTRY/Seshat operational data.
- Have its suggestions consumed by another agent as fact — they enter only
  through the human-gated inbox.

## Required Handoff Artifact

A single Markdown draft matching
`content/brain/inbox/TEMPLATE_inbox_item.md`, captured by a human via the
existing capture CLI at `status: "inbox"`. Its evidence tier is at best
"inferred, machine-suggested".

## Stop Conditions

Not applicable in the usual sense — the local assistant does not drive missions
and cannot "continue" past its single triage task. If its suggestion is wrong,
the only failure mode allowed is a human wasting a few seconds in triage.

## Evidence Rules

Output is **unknown / unverified** by definition until a human promotes it
through the normal inbox → triage → promote workflow
(`content/brain/harness/04_WORKFLOW.md`). It may never be promoted to verified
by the model itself.

## Assignment Notes

This role is reserved for a local model but, like every other role, is not
permanently bound to any specific model or vendor. A mission that pilots local
triage must name the assigned role and the assigned model/operator separately,
and must keep every boundary above intact. No local-model integration exists in
v0; this contract is design-ahead-of-implementation.
