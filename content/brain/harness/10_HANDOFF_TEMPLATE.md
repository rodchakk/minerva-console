# 10 — Handoff Template

Use this template when you finish a mission and hand off to the next agent or human.

Reusable copy lives at `content/brain/templates/mission-handoff.md`.

---

## Mission

**ID:** `MCB-XXXX`
**Title:**
**Date:**
**Operator:** (human or agent)

## What changed

- Files created:
- Files modified:
- Files deleted:

## Decisions taken or confirmed

- DEC-XXXX —

## New entries added to registries

- `projects.json`:
- `decisions.json`:
- `prompts.json`:
- `agents.json`:
- `inbox.json`:
- `missions.json`:

## Mission control

Mission planned -> branch created -> agent or human executes -> PR/checks -> merge -> mission status completed -> next mission planned.

- Mission ledger entry:
- Mission Markdown file:
- Branch:
- PR:
- Commit:
- This is Git-backed project control, not an agent engine or automation.

## Promotion flow

Inbox item → human review → `brain-promote` script → approved registry + Markdown doc → inbox status `promoted`

- Promotion is manual. The human intentionally runs `npm run brain:promote`.
- Promotion does not mean final wording is perfect. Promoted docs should be reviewed and refined after creation.
- Raw inbox material is preserved in the promoted document.
- This is not RAG, not automation, not an agent engine.

## Relations

Brain entries reference each other through `related`.

- Outgoing relations are explicit; incoming backlinks are derived automatically.
- Broken relations (related IDs that exist in no registry) must be fixed before merge.
- Relations are Git-backed metadata. This is not RAG, not embeddings, and not an agent engine.

## Validation

- `npm run brain:guardrails`: pass / fail
- `npm run brain:check-relations`: pass / fail
- `npm run lint`: pass / fail
- `npm run build`: pass / fail
- Notes:

## Boundaries respected

- [ ] No imports from `features/entry/**` in Brain code.
- [ ] No Supabase client used in Brain code.
- [ ] No new env vars.
- [ ] No new dependencies (or: list and justify each).
- [ ] No migrations.
- [ ] No DB connection added.

## Open questions

-

## Suggested next mission

- `MCB-XXXX` —
