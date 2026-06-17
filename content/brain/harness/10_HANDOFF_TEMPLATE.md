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

## Validation

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
