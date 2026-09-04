# DEC-0009 — Seshat Infrastructure / Supabase Billing Separation

## Identity

- **ID:** `DEC-0009`
- **Title:** Seshat Infrastructure / Supabase Billing Separation
- **Status:** `approved`
- **Date:** 2026-09-03
- **Supersedes:** the previously approved direction that Seshat should eventually migrate away from Supabase
- **Tags:** seshat, infrastructure, supabase, billing, free-tier, internal-tool, cost-control
- **Related:** `PRJ-0002`, `PRJ-0001`, `DEC-0004`, `DEC-0008`

## Context

Seshat is currently an internal Minerva Technologies financial operating tool used primarily at very small scale while the product continues to be built. It does not presently justify its own paid infrastructure.

Seshat and ENTRY previously lived under the same Free Supabase organization, `Minerva Technologies`. ENTRY is approaching commercial use and may need that organization to move to Supabase Pro. Keeping Seshat in the same billing organization could cause Seshat to participate in the paid compute/cost model even though its current internal usage is minimal.

Alternatives considered included local storage, SQLite, manual synchronization through a Minerva PC, and self-hosted Supabase. They were rejected for the current stage because they would introduce unnecessary synchronization, backup, availability, Auth, Storage, and maintenance complexity.

## Decision

Seshat remains on its existing Supabase project and stays on Free infrastructure while its scale and criticality permit.

On 2026-09-03 the existing Seshat project was transferred from the `Minerva Technologies` Supabase organization to a separate organization named `Minerva Internal` on the Free plan.

The existing project remains:

- **Project:** `seshat`
- **Project ref:** `vfvbvywvmoevyucqgtos`
- **Organization:** `Minerva Internal`
- **Plan:** Free
- **Current state at capture:** paused

ENTRY remains separate:

- **Project:** `gate-project-dev`
- **Product:** ENTRY
- **Project ref:** `ytzvislhvrcdtkbtpbmu`
- **Organization:** `Minerva Technologies`
- **Commercial direction:** may move to Supabase Pro independently when required by real client operation

## Architectural rules

1. **Keep Seshat Free while practical.** Seshat should remain on Free infrastructure while its internal scale, usage, and criticality permit.
2. **No new database or data migration was performed.** The operation was an organization transfer of the existing Supabase project, not a database migration.
3. **No local architecture is approved.** Do not create local storage, SQLite, a PC-based synchronization mechanism, or another offline-first replacement solely to avoid Supabase billing.
4. **No self-hosting is approved.** Do not self-host Supabase for the current internal stage.
5. **No replacement Supabase project is approved.** Continue using project ref `vfvbvywvmoevyucqgtos`.
6. **No transfer-driven code/config changes are approved.** Do not modify Seshat application code, `.env`, Project URL, keys, Auth, Storage, or schema merely because the project changed Supabase organizations.
7. **Validate before correcting.** When Seshat work resumes, unpause the Free project and first QA login, existing financial data, clients, expenses/financial records, a safe test write, and any Storage asset used by the application. Make corrective configuration changes only if a real failure is observed.
8. **ENTRY and Seshat are financially decoupled.** ENTRY may evolve to paid commercial infrastructure without forcing Seshat into the same cost model.
9. **Future infrastructure remains open, not preselected.** If Seshat later becomes a commercial product, materially larger multi-user system, or service-critical runtime, its infrastructure must be reevaluated in a separate reviewed decision/mission. No provider migration is currently planned or approved.
10. **Brain boundary remains unchanged.** Brain may store this architecture decision but must not ingest Seshat operational financial data.

## Consequences

- Seshat retains the existing Supabase database, Auth, Storage, project identity, and current application integration unless QA proves otherwise.
- Minerva avoids introducing a second engineering problem (local sync/self-hosting) merely to solve a billing-boundary problem.
- ENTRY can be upgraded for commercial needs independently.
- The previous Brain statement that Seshat should eventually migrate away from Supabase is no longer the approved direction and must be removed from current-state/product summaries.
- A future Seshat infrastructure move requires fresh evidence and explicit approval; it is not a standing migration backlog item.

## Scope confirmation

This decision records an **infrastructure / Supabase organization and billing separation only**.

It does **not** record any Seshat application-code change, schema migration, environment-variable change, key rotation, Auth change, Storage change, or product feature implementation.
