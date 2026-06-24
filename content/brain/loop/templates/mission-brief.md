# Mission Brief

Copy this file into `missions/01_todo/` named `<mission-id>-<slug>.md`. The folder it lives in is the mission status.

---

**Mission ID:** `MCB-XXXX`
**Title:**
**Status folder:** `01_todo`
**Owner agent:** (Claude | Codex | Gemini | GPT)
**Branch:** `mcb-xxxx-<slug>`

## Scope

What this mission is allowed to do. Keep it small and single-writer.

## Out of scope

What this mission must not do. Be explicit about boundaries (ENTRY, DB, Supabase, Neon, RAG, UI write, `.github/workflows/**`, other missions' files).

## Files allowed

The exact paths/globs this mission may create or edit. Anything not listed is off-limits.

## Checks required

Commands that must pass before the PR can be opened (e.g. `node scripts/brain-guardrails.mjs`, `npm run brain:check-relations`, `npx tsc --noEmit`).

## Evidence required

What must be recorded as **verified** in the report (e.g. commit hash, PR number, check results) and what may remain **unknown**.

## Stop conditions

When the agent must stop and hand off (scope boundary, unverifiable fact, red CI outside scope, ambiguity, irreversible action).

## Next action

The single next step to take, and who takes it.
