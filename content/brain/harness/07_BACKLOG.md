# 07 — Backlog

Candidate work for after MCB-0002. Items are not committed; they are options.

## Near-term (still v0-shaped)

- `MINERVA-SUPABASE-SUPERADMIN-RECONCILIATION-001` - proposed / pending.
  Read-only follow-up to reconcile the live `public.is_superadmin()` definition
  with repository migrations. Scope: inspect live definition, source of truth,
  `SECURITY DEFINER` / `SECURITY INVOKER`, `search_path`, grants, RLS context,
  and produce an authentic migration or documentation plan. Do not modify
  Supabase as part of this backlog item without a separate explicit mission.
- Markdown rendering inside Brain pages for entries that have a `path`. Add only when needed; pulls in `gray-matter` and a renderer as the first new deps.
- "Recently updated" cross-registry list on the Overview page.
- Tag index page that lists all unique tags and the entries that use them.
- Simple search across registries (filter in the table; no index).

## v1 candidates (require Neon)

- Move registries to Postgres behind the same loader signatures.
- Write paths through `app/api/brain/**` with the inbox gate preserved.
- Embeddings + pgvector for RAG over `content/brain/` and promoted artifacts.
- Agent run records with cost tracking.
- Model router that selects a model per prompt and records cost.

## v2 candidates

- Graph view derived from `related` links across all registries.
- Connectors that drop outputs from Claude Code, Codex, GPT, and Gemini into the inbox automatically.
- GitHub, Vercel, Gmail, and Calendar integrations that land context as inbox items.
- Lead intelligence layer that analyzes commercial conversations without becoming the CRM.
- Proposal generation from project context and prompt library.

## Explicitly deferred

- Replacing ENTRY's or Seshat's databases.
- Becoming the CRM.
- Storing raw operational product data.
