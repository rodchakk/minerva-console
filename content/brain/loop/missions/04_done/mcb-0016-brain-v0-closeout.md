# Mission Brief

**Mission ID:** `MCB-0016`
**Title:** Brain v0 Closeout — Loop Dry Run, Context Export & ENTRY Knowledge Pack
**Status folder:** `04_done`
**Owner agent:** Claude
**Branch:** `mcb-0016-brain-v0-closeout`

## Scope

Close out Brain v0 with one final mission that also serves as a real dry run of the loop:

- Add `scripts/brain-export-context.mjs` and generate `content/brain/exports/brain-context.md`.
- Write the initial ENTRY Knowledge Pack in `content/brain/projects/entry.md`.
- Register MCB-0015 in the ledger (mission doc + `missions.json`).
- Produce loop dry-run artifacts (this brief + a Claude agent report).
- Add the Brain v0 freeze note and a changelog entry.

## Out of scope

UI, routes, ENTRY runtime, Seshat, `features/entry/**`, `.github/workflows/**`, `.env.local`, `.claude/settings.local.json`, `.codex-tmp/`, `c`, new dependencies, `package.json` changes, new GitHub Actions, and any DB / Supabase / Neon / RAG / embeddings / agent engine / model router / cost monitor. No merge, no direct push to master, no `git add .`.

## Files allowed

- `scripts/brain-export-context.mjs`
- `content/brain/exports/**`
- `content/brain/projects/entry.md`
- `content/brain/missions/mcb-0015.md`
- `content/brain/registries/missions.json`
- `content/brain/loop/missions/04_done/mcb-0016-brain-v0-closeout.md`
- `content/brain/loop/reports/claude/mcb-0016-agent-report.md`
- `content/brain/harness/09_V0_FREEZE.md`
- `content/brain/harness/08_CHANGELOG.md`

## Checks required

`node scripts/brain-export-context.mjs`, `node scripts/brain-guardrails.mjs`, `npm run brain:check-relations`, `npx tsc --noEmit`, then `npx next typegen`, the targeted `eslint` scope, and `npm run build`.

## Evidence required

- Verified: changed files, the export's printed counts, all check results, and (for the MCB-0015 ledger entry) PR `#13` / commit `340eb00` / `agent: claude` from the squash commit trailer.
- Unknown allowed: MCB-0015 `branch` (feature branch deleted on merge).

## Stop conditions

Stop and hand off if a step would touch anything out of scope, if a required check cannot pass without weakening it, if a required fact cannot be verified, or before any merge / direct push (those need `MERGE APPROVED` / `DIRECT PUSH APPROVED`).

## Next action

The PR is ready to merge with `MERGE APPROVED` (merge via `gh`). This brief already lives in `04_done/` in this PR, so no post-merge file move is required — Brain v0 enters master in its final state.
