# 09 — Brain v0 Freeze

After MCB-0016, Minerva Core Brain v0 is **complete enough**. This note marks the operational freeze so focus can return to ENTRY.

## Status

Brain v0 is frozen as of MCB-0016 (Brain v0 Closeout). The Git-backed, read-only Brain — harness, registries, missions ledger, inbox/promote, search/tags, relations, the coordination loop, and the context export — is considered done for v0. No further v0 scaffolding is planned.

## What stays allowed after the freeze

- Adding **content**: new missions, decisions, prompts, projects, agents, inbox items, and Markdown docs through the normal Git + PR workflow.
- Running the existing CLIs (`brain:capture`, `brain:promote`, `brain:new-mission`, `brain:check-relations`, `brain:guardrails`, `brain-export-context`).
- Regenerating `content/brain/exports/brain-context.md` by re-running the export script.
- Keeping the mission ledger honest and complete.
- Loop coordination through `content/brain/loop/**` (briefs, reports, status folders).

## What is postponed (not in v0)

- DB, Supabase, Neon, RAG, embeddings, agent engine, model router, and cost monitor. None of these are added in v0.
- Any connection from Brain to the ENTRY database or ENTRY runtime.
- UI write paths for Brain (Brain stays read-only in the app; writes happen in Git).
- A graph view (Obsidian-style relation graph) is **postponed**; the text-based relations views remain the v0 surface.
- Automation: no bots, schedulers, or autonomous agents.

## Back to ENTRY

The next focus is ENTRY. See the ENTRY Knowledge Pack in `content/brain/projects/entry.md` for current knowledge, leads, the pending "Forgot my password" bug, and recommended ENTRY missions.

## Change control after freeze

- Do **not** modify `features/brain/**` or `scripts/brain-*.mjs` except under an explicit, named mission. Brain code and CLIs are load-bearing and frozen for v0.
- Harness files (`00_PROJECT_CHARTER.md`, this freeze note, guardrails, CI) change only through a decision entry and review.
- Lifting any postponed item (DB, RAG, graph view, etc.) is a v1 decision, not a v0 change.
