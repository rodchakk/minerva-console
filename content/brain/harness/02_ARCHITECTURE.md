# 02 — Architecture

## Decision

Hybrid (Option C from MCB-0001):

- **Brain UI** lives inside Minerva Console at `app/(console)/brain/**` and reuses Shell, auth, and design tokens.
- **Brain knowledge and harness** live in the same repo under `content/brain/**` as Git-backed Markdown, JSON, and YAML — a distinct, isolated tree.
- **One loader seam** (`features/brain/lib/content.ts`) is the only app-facing reader of Brain content.

Sequencing: D-first — author harness and seed content immediately, then ship the read-only UI in this mission so Brain does not become an orphan vault.

## Layers

```
content/brain/                ← Git-backed knowledge (source of truth in v0)
   harness/   registries/   projects/   decisions/   prompts/
   agents/    inbox/         docs/       templates/

features/brain/               ← code module
   lib/types.ts               types
   lib/content.ts             THE SEAM — only reader of content/brain
   components/                presentational components

app/(console)/brain/          ← routes, inherit superadmin gate
   page.tsx                   Overview
   projects/ decisions/ prompts/ agents/ inbox/
```

## The one rule

`features/brain/**` and `content/brain/**` must never import from `features/entry/**` or touch ENTRY's Supabase. Brain does not store raw operational data from any product. See `05_AGENT_RULES.md`.

## Why this shape

- Reuses the superadmin shell, auth, and tokens already built — zero new infra.
- Keeps content authorable in Git, reviewable in PRs.
- Makes the future move to Neon a swap behind a stable interface, not a rewrite.
- Preserves clean separation between Operations, Products, Brain, Leads, and System.

## Data shape (v0)

JSON registries in `content/brain/registries/` provide the listable surface. Long-form documents live as Markdown alongside them and are referenced via the `path` field on each registry entry. Frontmatter conventions to keep stable from day one: `id`, `type`, `status`, `created`, `updated`, `tags`, `related`. The `tags` field feeds future RAG; `related` feeds the future graph view.

## Product infrastructure boundary — Seshat / Supabase

As of 2026-09-03, Seshat's approved runtime infrastructure remains its existing Supabase project rather than a local, self-hosted, or synchronized replacement.

```text
Supabase
├── Minerva Technologies
│   └── gate-project-dev / ENTRY
│       └── project ref: ytzvislhvrcdtkbtpbmu
│
└── Minerva Internal (Free)
    └── seshat
        └── project ref: vfvbvywvmoevyucqgtos
```

Architectural rules:

1. Seshat remains on Free infrastructure while its internal scale and criticality allow it.
2. ENTRY may move to Supabase Pro/commercial infrastructure without pulling Seshat into the same billing organization.
3. Do not introduce a local database, PC-based sync layer, self-hosted Supabase, or a replacement Supabase project merely to avoid ENTRY's commercial billing.
4. The 2026-09-03 project transfer does not by itself require application code, `.env`, Project URL, key, Auth, Storage, or schema changes because the existing Seshat project remains the same project.
5. Resume the Seshat Free project when needed and validate actual runtime behavior before making corrective configuration changes.
6. If Seshat later becomes commercially operated, materially multi-user, higher scale, or service-critical, reevaluate its infrastructure in a separate reviewed decision/mission based on the conditions then present. There is no currently approved provider migration.
7. Brain may document this architecture and billing boundary but must not ingest Seshat's operational financial records.

## v1 path (design only)

1. Stand up Neon. Add deps and env vars **at that point**, not now.
2. Reimplement `features/brain/lib/content.ts` against Neon. UI untouched.
3. Add `app/api/brain/**` routes for write paths and jobs.
4. Layer embeddings and `pgvector` for RAG on the same content.
5. Add graph view from existing `related` links.
6. Add ingest connectors that land outputs in `inbox/` first; human-approval gate stays.
