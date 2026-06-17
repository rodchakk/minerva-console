# 01 — Current State

Snapshot of Minerva Console at the start of Brain v0. Findings are taken from the live repo, not inferred.

## Stack

- Next.js 16.2.4 (App Router, RSC, Server Actions, typed routes).
- React 19.2.4.
- TypeScript with `@/*` → repo root (no `src/`).
- Tailwind CSS v4 via `@tailwindcss/postcss`, design tokens in `app/globals.css`.
- Supabase (`@supabase/ssr`, `@supabase/supabase-js`) used by ENTRY only.
- ESLint with `eslint-config-next` (core-web-vitals + typescript).
- `resolveJsonModule: true` — JSON registries can be imported directly.
- Deployment target: Vercel.

## Routing

Two zones inside `app/`:

- **Public:** `app/login`, `app/activate`, `app/reset-password`, `app/unauthorized`, `app/page.tsx`.
- **Protected route group:** `app/(console)/` — all operational and intelligence routes.

The protected layout (`app/(console)/layout.tsx`) calls `requireSuperadmin()` and wraps children in `<Shell>`. Anything placed under `(console)` inherits this gate automatically.

## Modules present

- `dashboard` (ENTRY ops home).
- `products/entry/**` (Communities, Users, Messages, Settings, Onboarding, Activation).
- Neutral placeholders: `clients`, `finance`, `invoices`, `reports`, `settings`.
- **Added in MCB-0002:** `brain/**`.

## Auth

Server-enforced at the route-group boundary. `features/auth/requireSuperadmin.ts` is the single gate. Brain inherits it for free — no auth change is needed or allowed.

## Data layer

Feature-folder pattern under `features/<product>/<domain>/{queries,actions,detailQueries}.ts`. ENTRY uses Supabase RPCs and Server Actions. Brain v0 uses none of this.

## Shell and components

- `components/layout/Shell.tsx` — client wrapper over `AppSidebar` + `Topbar`.
- `components/layout/AppSidebar.tsx` — restructured in MCB-0002 into Console / Products / Brain groups.
- `components/layout/PageHeader.tsx` — additively extended in MCB-0002 to accept a custom eyebrow so Brain pages do not display the ENTRY pill.
- `components/ui/{Badge,Button,EmptyState}.tsx` — reused by Brain.
- `components/cards/{MetricCard,ProductCard,StatusCard}.tsx`.

## What Brain adds in v0

- `content/brain/**` — Git-backed knowledge tree.
- `features/brain/lib/{types,content}.ts` — the loader seam.
- `features/brain/components/{BrainOverview,RegistryTable,InboxList}.tsx`.
- `app/(console)/brain/{page,projects,decisions,prompts,agents,inbox}/page.tsx`.
- Brain navigation group in `AppSidebar`.

## What Brain explicitly does NOT add in v0

- No new dependencies.
- No new environment variables.
- No Supabase calls.
- No database connections.
- No migrations.
- No agents engine, RAG, graph, or cost monitor.
