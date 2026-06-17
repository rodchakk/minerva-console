# 05 — Agent Rules

These rules apply to every AI agent and every human working on Brain. They protect the separation between Operations, Products, Brain, Leads, and System.

## Hard rules (v0)

```
Brain code may not import from features/entry/**.
Brain code may not use ENTRY Supabase data.
Brain v0 is read-only and Git-backed.
Neon is reserved for v1.
```

Equivalent, in detail:

- `features/brain/**` and `content/brain/**` must not import from `features/entry/**` or any other product feature module.
- Brain code must not import any Supabase client. No `@supabase/ssr`, no `@supabase/supabase-js`, no project-specific clients.
- Brain v0 has no write paths in the UI. Edits happen in Git.
- CLI capture scripts may write only to `content/brain/inbox/` and the matching JSON registry, and those writes must be committed through Git.
- No new dependencies, no new environment variables, no migrations, no DB connections in v0.
- Brain is not the CRM. Brain does not store raw sensitive operational data from products.
- Inbox items are never authoritative knowledge until a human promotes them.

## Behavioral rules

- Prefer fewer, smaller files over one large file.
- Keep registry entries terse. Put long form in Markdown referenced by `path`.
- Never edit `03_DECISIONS.md` to overwrite a previous decision. Add a new decision that supersedes it.
- Treat `00_PROJECT_CHARTER.md` as load-bearing. Changes require a decision entry.
