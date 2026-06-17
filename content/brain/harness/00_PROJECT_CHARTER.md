# 00 — Project Charter

**Project:** Minerva Core Brain / Minerva Console Intelligence Layer
**Owner:** Minerva Technologies (internal)
**Status:** v0 — Git-backed, read-only

## Purpose

Brain is Minerva's internal intelligence layer. It keeps the knowledge that connects Minerva's products, decisions, prompts, agents, and operations in one place — so context never lives only inside a person's head or a chat window.

## v0 mandate

- Operate as a Git-backed knowledge surface inside Minerva Console.
- Hold the harness, project registry, decision log, prompt library, agent registry, and an inbox for raw AI outputs.
- Stay simple, static, and safe. No database, no agents engine, no model router.

## Scope — in

- Internal knowledge base.
- Project context for Minerva products.
- Approved decisions.
- Versioned prompts.
- Agent definitions.
- Inbox for unprocessed outputs from Claude Code, GPT, Codex, Gemini, and humans.

## Scope — out (now)

- RAG / embeddings / vector search.
- Graph visualization.
- Autonomous agents and dynamic jobs.
- Model router.
- AI cost monitor.
- Replacing ENTRY's, Seshat's, or any product's database.
- Acting as the CRM.
- Storing raw sensitive operational data from products.

## Non-negotiables

- Brain reads only `content/brain/`.
- `features/brain/**` does not import from `features/entry/**`.
- Brain does not use ENTRY's or Seshat's Supabase projects.
- Human approval is required before any inbox item becomes Brain knowledge.

## Success in v0

- The Brain section renders behind the existing superadmin gate.
- Each registry page lists seeded content from JSON files.
- The Inbox is visibly labeled as raw and unprocessed.
- No new dependencies, env vars, migrations, or DB connections were introduced.
- ENTRY operations continue to work unchanged.
