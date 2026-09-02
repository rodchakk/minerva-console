# MINERVA-CONSOLE-001 — Minerva Console Control Center Foundation

## Status

Planned — ready for implementation.

## Summary

Reframe Minerva Console from an ENTRY-first admin panel into the shared web home for Minerva Technologies products and internal operational tooling.

The authenticated root experience should become **Minerva Control Center**: one shared Console shell where native Minerva products, connected products, system activity, integration tooling, and the private Brain surface coexist without becoming separate applications.

The foundation must stay intentionally simple, visual, low-cost, and modular. It should create the correct architecture and UX now without forcing universal APIs, observability infrastructure, AI processing, replicated product data, or paid background services.

ENTRY is the **first real product integration pilot** for this architecture. The initial `Add Product` experience is deliberately manual and guided: Console provides the integration instructions, a human or AI agent implements the required contract, the user enters the connection/configuration values manually, and `Test connection` verifies the supported read-only connection on demand.

Detailed pilot specification:

`content/brain/projects/minerva-console-entry-first-integration-pilot.md`

## Core product definition

> Minerva Console is the web home for Minerva Technologies products. The administrative and operational “guts” of Minerva systems live here.

The Console is not an ENTRY dashboard with extra links. ENTRY becomes one native product module inside a broader Minerva shell.

Conceptual hierarchy:

```text
Minerva Console
├── Control Center
│   ├── Product overview
│   ├── Basic system status
│   ├── Recent activity
│   └── New product setup / integration guidance
├── Products
│   ├── ENTRY
│   ├── Seshat
│   ├── Connected / external products
│   └── Future Minerva products
├── Brain
│   └── Private Minerva knowledge / work-continuity surface
└── System
    ├── Activity
    ├── Integrations
    └── Settings / access
```

## One Console, not per-user Console versions

There is one Minerva Console codebase, one shell, one navigation model, and one design system.

Do not create separate dashboard implementations for Rudy, another Minerva builder, a brother/partner, or future operators.

Authorization controls what a user may open, read, or execute. Initially, unavailable modules may remain visible with a lock state so users understand the Minerva ecosystem. A future setting may change restricted modules from `locked` to `hidden` without changing the architecture.

Conceptual behavior:

```text
ENTRY       ✓ or 🔒
Seshat      ✓ or 🔒
Brother App ✓ or 🔒
Brain       ✓ or 🔒
```

A locked state is a UX treatment only. Real authorization must also be enforced server-side. Knowing or manually entering a protected route must not grant access.

## Product-module model

Every product connected to Console should be represented as a module with clear ownership.

Conceptual module ownership:

```text
ENTRY
owns ENTRY UI + ENTRY product operations

Seshat
owns Seshat UI + Seshat product operations

Connected Product
owns its own source data + its integration contract

Brain
owns Brain UI + Brain knowledge/workspace data

Console Core
owns navigation + permissions + dashboard composition + shared UI
```

This boundary is also the collaboration boundary for builders and AI agents. A builder may work on shared Console infrastructure or their assigned product module without modifying unrelated modules unless a mission explicitly grants that scope.

## Native vs connected products

### Native module

A Minerva product whose web/admin experience lives directly inside Minerva Console.

Examples:

- ENTRY — already native.
- Seshat — future web version should live natively inside Minerva Console.

Native modules may use Console authentication, shared components, role-aware access, and product-specific backend integrations.

### Connected product

A product whose primary application/runtime remains separate but can appear in Control Center through a lightweight integration.

Initial integration levels:

1. **Link only** — name, icon, status/config metadata, external admin URL.
2. **Overview API** — one safe read-only endpoint for minimal live metrics.
3. **Full integration** — future only; additional endpoints/actions must be justified by a real use case.

V1 should favor Link only or Overview API.

## Connected-product data rule

Console must not become a replicated database of connected products.

For V1, prefer aggregate overview data such as:

```json
{
  "status": "operational",
  "users": 247,
  "activeUsers": 183,
  "alerts": 0,
  "lastActivity": "2026-09-01T21:40:00Z"
}
```

Do not ingest customer lists, user identities, raw operational records, or product databases merely to populate Control Center.

Connected products remain the source of truth for their own data and business logic.

## Neutral Console Monitor boundary

Connected-product status belongs to a neutral **Console monitoring / summary layer**, not to Brain.

Conceptual flow:

```text
Connected product
       │
       ▼
Console Monitor / Overview
       │
       ▼
Minerva Control Center
```

The monitor should remain basic and visual: status, small aggregate metrics, activity labels, optional health information, and simple warnings supplied by the product itself.

It is not an AI system and should not attempt to interpret connected-product data.

## Brain boundary

Brain remains an internal Minerva knowledge and work-continuity system.

Brain must **not** automatically ingest information from another builder's connected software or from external product connectors.

Brain may understand Minerva's work about a product — missions, architecture decisions, implementation status, documentation, bugs, pending QA — without ingesting that product's customer/operational data.

Examples of acceptable Brain knowledge:

- “ENTRY Unit Management implementation is awaiting QA.”
- “The Control Center architecture was approved.”
- “A production build failed.”

Examples that do not belong in Brain merely because Console can display them:

- named users from a connected product;
- customer records;
- raw user activity;
- private operational records from a builder's product.

The first simple Brain value propositions for future UI are:

1. **Needs Attention** — work items that should not be forgotten.
2. **Reminders** — simple manual reminders tied to Minerva work.
3. **Continue Working / Where We Left Off** — fast recovery of current project context.

These features live inside Brain. They are not required to become an automation engine in this foundation.

## Seshat direction

Seshat should have its own native Minerva Console module.

The future Seshat web/admin experience should preferably live inside Console rather than becoming a separate standalone admin site.

Seshat is shared by multiple Minerva members. The same Seshat module should support role-based capabilities so different Minerva users can see or perform only the parts appropriate to them without creating separate Seshat versions.

This foundation should reserve the module/route/navigation space for Seshat, but must not implement the future Seshat product surface unless separately scoped.

## Builder collaboration boundary

Minerva builders may share the same Console repository and improve the same platform.

AI/agent instructions should clearly declare protected areas. Example operating rule:

```text
You may modify shared Minerva Console infrastructure and your assigned module.
Do not modify ENTRY or Brain unless the mission explicitly grants permission.
```

Repository-level review and CODEOWNERS/protected-branch rules may later reinforce this boundary. AI instructions are workflow guardrails, not a security boundary by themselves.

Longer term, Brain data/workspaces may be isolated from shared Brain shell/components so builders can contribute to the Brain product UI without receiving access to another workspace's private knowledge.

## Add Product experience

Control Center should expose a clear `Add Product` path.

V1 behavior is **manual and guided**, not automatic. The product is created/configured intentionally by the user; Console provides instructions but does not auto-discover applications or modify their repositories.

Conceptual fields:

```text
Name
Slug
Description
Icon
Type: Native | External
Status
Environment
Admin URL
Overview endpoint (optional)
Owner
Connection mode: Link only | Overview API | Native module | Future full integration
```

The flow should conceptually be:

```text
Add Product
→ enter metadata
→ choose type / connection mode
→ generate/view/copy integration instructions
→ implement required contract manually (human or AI agent)
→ return to Console
→ enter/edit actual connection values manually
→ Test connection
→ activate product
```

Manual configuration fields may include Admin/module URL, Overview endpoint, optional connector credential, environment, and connection label according to the selected connection mode.

V1 should not invent a universal plugin platform. A small registry/configuration model is enough.

A new product should be able to appear in Control Center without hand-coding a new dashboard card every time.

ENTRY is the first product used to validate this full setup pattern. Because ENTRY is already native, do not fabricate an external dependency only to simulate an external connector; validate the shared registry, setup instructions, manual values, test flow, card rendering, and navigation using the smallest real seam that fits ENTRY.

## Integration Kit

New Product Setup should make Minerva Console self-documenting for builders and AI implementation agents.

The preferred long-term model is a separate clean repository, conceptually:

```text
minerva-console-integration-kit/
├── README.md
├── MINERVA_CONNECTOR.md
├── AGENTS.md
├── schemas/
├── examples/
└── templates/
```

It contains no private ENTRY code and no private Brain knowledge.

Console should expose actions conceptually like:

- `View setup instructions`
- `Download Integration Kit`
- `Copy AI Instructions`
- `Test connection`

The generated/downloaded AI-friendly instructions should be Markdown-first and may prefill product-specific information such as product name, slug, mode, allowed endpoint, expected route, protected modules, and Console expectations.

The integration instructions should document:

- module/connector contract;
- allowed data;
- authentication expectations;
- read-only V1 rule;
- zero-added-cost rule;
- protected modules not to touch;
- endpoint examples;
- manual values the user must return to Console and enter;
- verification checklist.

Creating and publishing the separate integration-kit repository may be split into a follow-up implementation if doing it here would enlarge the foundation unnecessarily.

## Test connection rule

`Test connection` is an explicit user action, not a background monitor.

For Overview API connections it should safely validate the configured endpoint and expected response shape, explain failures in human-readable terms, and never write to the connected product or forward its response to Brain.

A successful manual test may be required before an Overview API product enters the `connected` state. Link-only and native modules may use an appropriate simpler validation path.

Do not add autonomous retries, cron jobs, high-frequency polling, or paid observability to support this feature.

## Zero-added-cost rule

The Control Center foundation must not introduce a new recurring infrastructure or AI bill merely to show this dashboard.

Do not add, unless separately approved:

- paid observability platforms;
- OpenAI/LLM API calls;
- background AI analysis;
- a new always-on service;
- high-frequency polling infrastructure;
- event-stream infrastructure;
- replicated analytics databases;
- automatic connector provisioning services.

For connected products, live overview data may be fetched when the dashboard is opened, refreshed, or when a user deliberately runs `Test connection`. A tiny read-only HTTP request is preferable to a new monitoring system.

If a feature starts requiring cron jobs, AI inference, a new paid service, or broad data replication, it is probably outside V1.

## Control Center first-screen information architecture

Authenticated users should land on `/dashboard`, but `/dashboard` should become **Minerva Control Center**, not ENTRY Operations.

Recommended first-screen hierarchy:

### Header

- `Minerva Control Center`
- supporting copy such as `The web home for Minerva products, operations and intelligence.`
- restrained actions: `Add Product`, `Download Integration Kit`, `Open Brain` where authorized.

### Summary row

Four compact metrics:

- Products connected
- Operational
- Needs attention
- Events today

These may begin from simple/static/current-source data. Do not create new infrastructure only to make every metric live.

### Products panel

Cards for:

- ENTRY — native module and first integration pilot
- Seshat — native module / in development
- connected product example
- Add Product

Each product card may show a few product-specific aggregate metrics and an `Open module` / `Open console` action.

### Brain Overview panel

Compact private summary for authorized users only, using Brain's own data. Initial conceptual cards:

- Needs Attention
- Reminders
- Continue Working

Do not feed connected-product overview data into Brain to populate this area.

### Recent Activity

A simple cross-Console visual feed where data already exists or can be safely derived. Avoid claiming universal event coverage until integrations actually provide it.

### New Product Setup

Compact setup/help panel pointing builders toward the Minerva Connector / Integration Kit contract and the manual setup/test flow.

## Navigation direction

Target navigation concept:

```text
MINERVA CONSOLE

Control Center

PRODUCTS
  ENTRY
  Seshat
  Connected Product

BRAIN
  Overview
  Missions
  Reminders   (future/simple)

SYSTEM
  Activity
  Integrations
  Settings
```

Existing deeper ENTRY navigation remains available when ENTRY is opened. Do not destroy current ENTRY Operations, Communities, Users, Messages, Tickets, Settings, or community/unit routes.

The goal is to add a level above ENTRY, not to rebuild ENTRY.

## Visual direction

Use the approved Control Center mock as directional reference, but preserve the current Console's practical, squared operational character.

Primary visual reference language: **Neon-style dark infrastructure console**, adapted to Minerva branding.

### Base palette

- near-black page background;
- black/charcoal sidebar;
- dark gray raised surfaces;
- subtle gray separators/borders;
- white primary type;
- muted gray secondary type.

### Minerva red

Minerva branding is red + black, but the red must be **extremely restrained** in the operational dashboard.

Use red only as a micro-accent, for example:

- a thin active navigation rail;
- tiny status/brand dots;
- selected/focus edge;
- occasional Minerva icon detail;
- subtle interactive emphasis.

Do not use large red panels, bright red card backgrounds, broad gradients, or repeated glowing red controls.

The login page may remain more explicitly Minerva-red; the operational Console should be calmer.

### Shape language

- compact and structured;
- mostly squared / modest radii;
- avoid oversized rounded SaaS cards;
- avoid excessive decorative glow;
- strong information hierarchy over decoration;
- dense enough for desktop operations while retaining breathing room.

### Color discipline

The dashboard should feel black/gray/white first. Minerva red should be noticed only after looking at the interface, not dominate the first impression.

Semantic colors such as warning amber or success green may be used sparingly when they communicate actual state; they should remain subordinate to the neutral Minerva shell.

## Foundation implementation scope

The first implementation pass should focus on architecture and the landing experience rather than completing every future integration.

Expected foundation work:

1. Replace current ENTRY-centric `/dashboard` content with Minerva Control Center.
2. Preserve existing ENTRY routes and behavior.
3. Update shared navigation to express Control Center / Products / Brain / System hierarchy.
4. Introduce a small typed product/module registry or equivalent configuration seam.
5. Represent native, connected, development, operational, draft/setup, error, and locked/restricted module states.
6. Add Control Center product cards and compact summary areas.
7. Add the Brain overview region without modifying Brain data boundaries.
8. Add New Product Setup / Integration Kit affordances and a manual guided Add Product flow.
9. Make ENTRY the first real integration/setup pilot and validate the reusable pattern with it.
10. Allow supported connection/configuration values to be entered/edited manually.
11. Provide an explicit read-only `Test connection` behavior where applicable.
12. Keep Seshat as a reserved native-module direction, not a full product implementation.
13. Keep connected product data read-only and minimal; mock/config data is acceptable until a real external connector is separately approved.

## Recommended files / areas to inspect

The implementer should verify current paths before editing. Likely foundation surfaces include:

- `app/(console)/dashboard/page.tsx`
- `app/(console)/layout.tsx`
- `app/page.tsx` only if redirect behavior requires adjustment (currently `/dashboard` is already the authenticated root)
- `components/layout/AppSidebar.tsx`
- `components/layout/Shell.tsx`
- `components/layout/Topbar.tsx`
- `components/cards/**`
- new Control Center-specific components under a clearly owned feature/module path
- shared UI tokens in `app/globals.css` only when necessary

Do not modify `features/entry/**` merely to build the Control Center shell. Existing ENTRY product logic is outside this foundation unless a compile/runtime integration requires a narrow documented change.

Do not modify Brain content-loading rules or ingest connected-product data into `features/brain/**`.

## Explicit non-goals

Do not include in the foundation unless separately approved:

- rewriting ENTRY operations;
- implementing the future Seshat web product;
- importing another product's user/customer records;
- universal API gateway;
- microservice/event-bus architecture;
- paid monitoring stack;
- AI analysis of connected product data;
- automatic repository modification from Add Product;
- automatic product discovery/provisioning;
- cron-based continuous health checks;
- replicated external-product database;
- full SSO across independent products;
- advanced billing;
- drag-and-drop dashboard builder;
- autonomous agent engine;
- making Brain a cross-product analytics collector;
- changing ENTRY mobile;
- unnecessary schema migrations.

## Security / access requirements

- Authorization must remain server-enforced.
- Locked UI must not be the only access control.
- Product/module access should evolve toward explicit permissions/roles rather than hard-coded user names.
- Seshat should be designed to support role-aware views/actions when its native web module is built.
- Connected product credentials, if later added, must be server-only and narrowly scoped.
- External integrations should default to read-only.
- Brain access remains independent from product connector access.
- Manual configuration must not display stored secrets back in plaintext.

## Acceptance criteria — foundation

The foundation is successful when:

1. Signing into Minerva Console lands on a Minerva-level Control Center instead of ENTRY Operations.
2. ENTRY is clearly presented as one product module and all existing ENTRY operations remain reachable.
3. ENTRY is the first product used to prove the guided/manual product integration pattern.
4. `Add Product` gives the operator understandable setup instructions instead of pretending integration is automatic.
5. The setup experience can produce product-specific AI-friendly implementation guidance.
6. Supported connection/configuration values can be entered and edited manually.
7. An explicit `Test connection` path safely validates supported read-only integrations without background monitoring infrastructure.
8. The screen establishes product cards for ENTRY, Seshat, connected products, and Add Product without pretending unfinished integrations are complete.
9. Navigation communicates one shared Console with modular Products, Brain, and System areas.
10. Restricted modules can be represented as locked without relying on the lock icon for real authorization.
11. Brain remains isolated from connected-product operational data, including connection-test payloads.
12. Seshat has an explicit future native-module home in Console.
13. New Product Setup exposes the integration-kit / AI-instructions concept without creating paid infrastructure.
14. The design uses a Neon-inspired black/charcoal/gray system with only extremely subtle Minerva-red identity details.
15. No new recurring infrastructure or AI cost is introduced by the foundation.
16. TypeScript, lint, build, existing tests, and relevant Brain guardrails remain green.
17. The implementation ships through the normal branch → PR → review → explicit `MERGE APPROVED` workflow.

## Suggested implementation sequence

### Phase 1 — Shell and landing

- Control Center dashboard.
- Updated navigation hierarchy.
- Static/typed module registry foundation.
- Approved visual language.
- Preserve ENTRY.

### Phase 2 — ENTRY-first manual integration pilot

- Add Product guided workflow.
- Product-specific setup instructions.
- Manual connection/configuration values.
- On-demand Test connection where applicable.
- ENTRY as the first reference implementation.
- Validate product-card state/navigation and no ENTRY regressions.

### Phase 3 — Permissions and module states

- Formalize module-access checks beyond the current superadmin-only model.
- Locked/restricted representation.
- Prepare eventual `locked → hidden` behavior without a second Console implementation.

### Phase 4 — Integration Kit extraction

- Create the clean shareable `minerva-console-integration-kit` repository if still justified.
- Move/duplicate the generic connector contract, schemas, examples, and AI handoff template there without private product/Brain content.

### Future — only when justified

- Additional connected product overview endpoints.
- richer System Activity;
- Seshat native web module;
- per-role Seshat experiences;
- customizable widgets;
- stronger repository/code ownership boundaries;
- richer Brain reminders/Needs Attention/Continue Working.

## Implementation-agent handoff

Before changing code, read this specification, `DEC-0008`, and `MINERVA-CONSOLE-ENTRY-PILOT-001` in full and inspect the current Console implementation.

Primary objective:

> Create the Minerva-level Control Center foundation and prove the manual/guided product integration pattern with ENTRY as the first real product, without rebuilding ENTRY, connecting Brain to product operational data, or introducing recurring infrastructure/AI cost.

Important boundaries:

- Preserve ENTRY runtime and routes.
- Do not implement Seshat's future product surface yet.
- Do not route connector/connection-test payloads into Brain.
- Do not add automatic product discovery, autonomous repository modification, background polling, paid monitoring, or AI API use.
- Prefer typed configuration and existing shared components over a premature plugin framework.
- Make the setup flow usable by a human who will hand the generated instructions to Codex/Claude/another implementation agent and then return to enter the resulting values manually.
- Use the approved Neon-inspired neutral dark visual direction with extremely restrained Minerva red.
- Stop and report if real authorization changes, persistent connector secrets, or schema changes are required beyond the approved scope rather than inventing them silently.

The implementation should remain reviewable as a normal Minerva Console mission and must not merge without explicit owner approval.
