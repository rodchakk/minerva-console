# 03 — Decisions

Authoritative, append-only record of approved decisions for Brain. The machine-readable list lives in `content/brain/registries/decisions.json`. Long-form rationale lives here.

## DEC-0001 — Brain v0 is Git-backed

**Status:** approved · **Date:** 2026-06-16

Brain v0 stores knowledge as Markdown, JSON, and YAML files under `content/brain/`. JSON registries are imported directly (Next has `resolveJsonModule: true`), so no parser dependency is required.

**Why.** Fastest path to useful internal memory. Knowledge becomes reviewable via PR. No database to operate. No env vars to manage. Free Supabase project limit avoided. Migration to Neon is a v1 swap behind the loader seam.

## DEC-0002 — Brain UI lives inside Minerva Console

**Status:** approved · **Date:** 2026-06-16

Brain routes live under `app/(console)/brain/**` and inherit the superadmin gate from `app/(console)/layout.tsx`. Brain reuses the Shell, the design tokens, the UI primitives (`Badge`, `Button`, `EmptyState`), and `PageHeader`. The feature module lives under `features/brain/**`.

**Why.** Reuses superadmin auth and the existing shell. One deploy. One design system. Keeps Brain internal-only by construction.

## DEC-0003 — Neon Postgres reserved for v1

**Status:** approved · **Date:** 2026-06-16

A Neon project exists but is intentionally not connected in v0. No DB dependencies, no migrations, no environment variables added.

**Why.** v0 needs to prove Brain's shape, not its scale. The loader seam in `features/brain/lib/content.ts` makes the Neon swap straightforward later.

## DEC-0004 — Brain must not use ENTRY or Seshat operational data

**Status:** approved · **Date:** 2026-06-16

`features/brain/**` does not import from `features/entry/**`. Brain does not read from ENTRY's or Seshat's Supabase projects. Brain stores no raw sensitive operational data from any product. Brain is not the CRM.

**Why.** Preserves separation between Operations, Products, Brain, Leads, and System. Keeps Brain extractable into its own repo or backend later.
