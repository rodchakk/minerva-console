# 08 — Changelog

Append-only. Most recent first.

## 2026-06-17 — MCB-0006 — Brain promotion workflow

- Added `scripts/brain-promote.mjs` to promote inbox items into approved Brain knowledge (decisions, prompts, projects, agents).
- The promote CLI creates a Markdown document in the target folder, updates the target registry, and sets the inbox item status to `promoted`.
- Raw inbox material is preserved in the promoted document under "Original Raw Material".
- Added `brain:promote` npm script.
- Added `scripts/brain-promote.mjs` to guardrails required files.
- Updated workflow docs to document the promotion flow.
- Promotion is manual. The human intentionally runs the script. This is not RAG, not automation, not an agent engine.
- No UI write paths. No Neon, DB, Supabase, RAG, embeddings, model router, cost monitor, agent engine, or new dependencies.

## 2026-06-17 — MCB-0005 — Brain search and tag index

- Added `features/brain/lib/search.ts` with functions to build a search index from all Brain registries and Markdown docs.
- Added search page at `/brain/search` with free-text query and filters for kind, tag, and status via URL query params.
- Added tag index page at `/brain/tags` listing all tags with counts, linking to filtered search results.
- Added Search and Tags links to sidebar and Brain overview.
- Search is Git-backed, local, and read-only. No database, RAG, embeddings, model router, agent engine, or write UI.
- Tags help human triage and future promotion. They are not semantic vectors.

## 2026-06-17 - MCB-0004 - Brain inbox capture CLI

- Added `scripts/brain-capture.mjs` to capture raw Claude Code, GPT, Codex, Gemini, human, or other outputs into `content/brain/inbox/`.
- The capture CLI appends a matching `INB-####` entry to `content/brain/registries/inbox.json`.
- Added npm scripts for `brain:capture`, `brain:guardrails`, and `brain:new-inbox-item`.
- Added a reusable mission handoff template under `content/brain/templates/`.
- Updated workflow and agent rules to keep capture Git-backed and non-authoritative until human promotion.
- No UI write paths. No Neon, DB, Supabase, RAG, agent engine, migrations, env vars, or new dependencies.

## 2026-06-16 — MCB-0002 — Brain v0 shell shipped

- Created `content/brain/**` knowledge tree: harness, registries (projects, decisions, prompts, agents, inbox), and folder INDEX pages.
- Added `features/brain/lib/{types,content}.ts` as the only app-facing reader of Brain content.
- Added `features/brain/components/{BrainOverview,RegistryTable,InboxList}.tsx`.
- Added routes under `app/(console)/brain/` for Overview, Projects, Decisions, Prompts, Agents, and Inbox.
- Reorganized `components/layout/AppSidebar.tsx` into Console / Products / Brain groups.
- Extended `components/layout/PageHeader.tsx` with an optional `eyebrow` prop (default unchanged). Brain pages set a Brain eyebrow.
- No new dependencies. No env vars. No migrations. No Supabase calls in Brain.

## 2026-06-16 — MCB-0001 — Recon completed

- Approved Option C (Hybrid): Brain UI in Console, Brain content in same repo under `content/brain/`, loader seam in `features/brain/lib/content.ts`.
- Neon deferred to v1.
- ENTRY/Seshat isolation rules established.
