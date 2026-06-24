# 08 — Changelog

Append-only. Most recent first.

## 2026-06-17 — MCB-0012 — Ledger integrity pack

- Registered MCB-0010 (Mission Ledger Completion Pass, PR #9, commit daafb98) and MCB-0011 (Register MCB-0009 in Mission Ledger, PR #10, commit a79c679) in `content/brain/registries/missions.json` with new mission docs `mcb-0010.md` and `mcb-0011.md`. The Mission Ledger is now complete through MCB-0011.
- Verified each registered field from local Git: PR/commit from the merge subject and hash, `agent: "claude"` from the commit `Co-authored-by` trailer. Both missions' branches are registered as `unknown`: MCB-0010 has no surviving ref, and for MCB-0011 the only available evidence is a local `origin/mcb-0011-register-mcb-0009-ledger` remote-tracking ref, which is not reliable proof — local remote-tracking refs can be stale and the live branch ref currently 404s on GitHub.
- Added guardrail CHECK 7 (anti ledger-drift): every `content/brain/missions/mcb-*.md` doc must be registered in `missions.json`. Purely local and deterministic — no GitHub/remote dependency. Complements CHECK 4, which already verifies the forward direction.
- Documented the convention for unverifiable mission fields (`branch`/`agent` = `unknown`) in `04_WORKFLOW.md`: record only verifiable values, never register inferences as facts.
- Ledger-only and guardrail-only. No DB, Supabase, Neon, RAG, embeddings, model router, cost monitor, agent engine, routes, ENTRY, Seshat, or UI write path.

## 2026-06-17 — MCB-0008 — Brain relations map

- Added `features/brain/lib/relations.ts` deriving outgoing relations, incoming backlinks, and broken references from registry `related` arrays.
- Added `/brain/relations` page with per-entry outgoing/incoming counts, a broken-relation banner, and a `?focus=ID` detail view.
- Added a Relations section to every Brain detail page (`/brain/{kind}/{id}`) via a shared `RelationsPanel` component.
- Added `scripts/brain-check-relations.mjs` and `brain:check-relations` to report broken relations from the CLI (exits non-zero on broken references).
- Integrated a relation-resolution check (CHECK 6) into `scripts/brain-guardrails.mjs`; guardrails now fail when a `related` ID does not exist in any registry.
- Added Relations links to the sidebar and Brain overview.
- Outgoing relations are explicit; incoming backlinks are derived. Relations are Git-backed metadata — not RAG, not embeddings, not an agent engine. No DB, Supabase, model router, cost monitor, or UI write path.

## 2026-06-17 — MCB-0007 — Brain mission control ledger

- Added `content/brain/registries/missions.json` and `content/brain/missions/` as the Git-backed ledger for Brain missions.
- Seeded mission records for MCB-0001, MCB-0002, MCB-0002.5, MCB-0002.7, MCB-0003, MCB-0004, MCB-0005, MCB-0006, and MCB-0007.
- Added missions as a Brain registry kind, including `/brain/missions`, detail routes like `/brain/missions/MCB-0006`, search, tags, sidebar navigation, and the Brain overview card.
- Added `scripts/brain-new-mission.mjs` and `brain:new-mission` to create future mission docs and registry entries together.
- Updated guardrails to require the mission registry, mission directory, and mission creation script.
- Mission control is Git-backed project metadata. It is not an agent engine, not automation, not RAG, not embeddings, and not a UI write path.

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
