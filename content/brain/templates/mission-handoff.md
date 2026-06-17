# Mission Handoff - Template

Copy this file when a mission is complete and the next human or agent needs a clean handoff.

## Mission

- **ID:** `MCB-XXXX`
- **Title:**
- **Date:** YYYY-MM-DD
- **Operator:** human / agent
- **Branch:**

## What changed

- Files created:
- Files modified:
- Files deleted:

## Decisions taken or confirmed

- DEC-XXXX -

## Registry changes

- `projects.json`:
- `decisions.json`:
- `prompts.json`:
- `agents.json`:
- `inbox.json`:

## Validation

- `npm run brain:guardrails`: pass / fail
- `npm run lint`: pass / fail
- `npm run build`: pass / fail
- Notes:

## Boundaries respected

- [ ] Brain remains Git-backed.
- [ ] No UI write path added.
- [ ] No imports from `features/entry/**` in Brain code.
- [ ] No Supabase client used in Brain code.
- [ ] No Neon, database client, migration, or env var added.
- [ ] No RAG, agent engine, or model router added.
- [ ] Raw inbox items remain non-authoritative until human promotion.

## Open questions

-

## Suggested next mission

- `MCB-XXXX` -
