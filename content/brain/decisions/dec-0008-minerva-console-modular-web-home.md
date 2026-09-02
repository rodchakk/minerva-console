# DEC-0008 — Minerva Console is the modular web home for Minerva products

## Identity

- **ID:** `DEC-0008`
- **Title:** Minerva Console is the modular web home for Minerva products
- **Status:** `approved`
- **Date:** 2026-09-01
- **Supersedes:** none
- **Tags:** minerva-console, architecture, products, modules, permissions, brain, integrations
- **Related:** `PRJ-0001`, `PRJ-0002`, `PRJ-0004`, `MINERVA-CONSOLE-001`

## Context

Minerva Console currently lands directly in ENTRY because ENTRY is the first mature product administered there. This incorrectly frames Console as an ENTRY admin panel rather than the broader Minerva operational platform.

Minerva Technologies expects multiple products and multiple builders to share the same operational web home over time. ENTRY should remain native, Seshat should gain a native future web module, and other Minerva or external products may connect through lightweight overview integrations.

The design must also preserve Brain's privacy boundary and avoid turning connected-product monitoring into a new paid infrastructure project.

## Decision

Minerva Console becomes the **shared modular web home for Minerva Technologies products and internal operational tooling**.

The authenticated root is a Minerva-level Control Center. Products are modules inside the shared shell rather than separate Console versions.

Key architectural rules:

1. **One Console** — one codebase, shell, navigation model, and design language. Do not create per-user Console implementations.
2. **Module ownership** — ENTRY, Seshat, Brain, connected products, and future systems have clear boundaries. Builders may extend shared Console infrastructure and their assigned modules without modifying unrelated modules unless explicitly scoped.
3. **Role/module authorization** — authorization decides what a user may open or execute. Restricted modules may initially remain visible as locked and may later be hidden through configuration. UI locks are not the security boundary.
4. **ENTRY remains native** — existing ENTRY operations stay intact and move conceptually one level below Control Center.
5. **Seshat becomes native in the future** — its future web/admin surface should live inside Minerva Console and use roles to control what different Minerva members can see or do.
6. **Connected products remain source-of-truth owners** — V1 integrations are Link-only or minimal read-only Overview API connections. Console should not replicate product databases or user/customer records merely to populate a dashboard.
7. **Neutral Console monitoring** — basic connected-product status/metrics belong to a neutral Console summary layer, not to Brain.
8. **Brain isolation** — Brain may store Minerva knowledge about projects, missions, decisions, QA, bugs, and implementation continuity, but connected-product operational/customer data does not automatically flow into Brain.
9. **Zero-added-cost V1** — Control Center must not introduce a new recurring AI, observability, event-stream, or always-on infrastructure bill simply to provide the visual overview.
10. **Self-documenting integration** — Add Product should eventually expose a clean AI-friendly Integration Kit / `MINERVA_CONNECTOR.md`, preferably backed by a separate shareable `minerva-console-integration-kit` repository with no private ENTRY or Brain content.

## Visual direction

Control Center adopts a calm infrastructure-console visual language inspired by Neon:

- near-black / charcoal / dark gray surfaces;
- subtle gray borders and separators;
- white and muted gray typography;
- compact, squared operational cards;
- Minerva red used only as an extremely subtle identity/interaction micro-accent;
- semantic warning/success colors only where they convey real status.

The login may remain more visibly red/black; the operational Console should be visually restrained.

## Consequences

- `/dashboard` should evolve from ENTRY Operations into Minerva Control Center.
- Existing ENTRY routes and functionality remain preserved.
- New products should register through a shared product/module seam rather than hand-coded one-off dashboard architecture.
- Seshat's future web surface should target Minerva Console.
- Brain must remain independent from connected-product operational data.
- External integrations default to read-only and minimal.
- A builder can participate in the shared Console while protected module boundaries are enforced through scope instructions, review, and eventually repository ownership rules where useful.
- Rich observability, universal API gateways, background AI analysis, drag/drop dashboards, and broad data replication remain future work requiring separate justification.

## Implementation reference

See `MINERVA-CONSOLE-001`:

`content/brain/projects/minerva-console-control-center-foundation.md`
