# MINERVA-FIELD-001 — Minerva Field Foundation

## Status

Planned.

## Target working session

- 2026-08-27 afternoon
- Timezone: America/Tegucigalpa

## Summary

Create a mobile-first, installable PWA experience inside Minerva Console for field operations. ENTRY is the first active product module and the initial implementation target.

Minerva Field is a Minerva-level operational surface rather than a copy of the ENTRY desktop console, but only products with a real field workflow should appear in it. Seshat is explicitly excluded from Minerva Field because it is local software and has no approved field workflow.

The field experience should stay intentionally small and action-oriented. It exists to help an operator work while physically with a customer or at a deployment site, without duplicating the full desktop Minerva Console.

## Product framing

Two complementary surfaces:

- **Minerva Console** — full administrative experience, primarily desktop-first.
- **Minerva Field** — installable mobile PWA, mobile-first, focused on field work.

Minerva Field should feel like a Minerva operational tool, while exposing only active field-capable products.

Initial product shell:

```text
Minerva Field
├── Home
├── ENTRY
└── Account
```

Future Minerva products may add a Field module only when a concrete field workflow is approved. Minerva Field must not display speculative, local-only, disconnected, or non-field products merely to advertise the broader Minerva portfolio.

## Core design rule

Every capability must answer:

> What does the operator need to do with this product while physically with a customer or in the field?

Do not add functionality merely because it already exists in Minerva Console.

The preferred interaction model is:

**Read → Act → Confirm**

Each mobile screen should help the operator understand the current state, take a relevant action, and immediately know whether that action succeeded.

## Initial ENTRY field capability candidates

The final MVP scope will be confirmed before implementation. Current candidates are:

- Community overview and current onboarding/operational state.
- Fast search for communities, units, residents, and guards.
- Community Registration controls useful in the field.
- Share registration links and QR codes directly from the phone.
- Small creation/edit actions such as adding a unit when explicitly approved as safe.
- Operational Activity for validating that ENTRY is actively working on site.
- Field notes and client/contact context if a persistence model is later approved.
- Fast support actions that are safe and appropriate for mobile use.

## Explicit non-goals for the initial field experience

Do not duplicate the full Minerva Console. Initial exclusions include:

- Minerva Brain.
- Seshat.
- Internal Minerva administration.
- Advanced configuration.
- Large desktop-style data tables.
- Deep analytics and complex reports.
- Advanced permission management.
- Backend or infrastructure administration.
- High-risk destructive operations better performed from desktop.
- A separate React Native application for Minerva administrators.
- Speculative placeholders for products without an approved field workflow.

## Product inclusion rule

A Minerva product belongs in Field only when all of the following are true:

1. It has a real workflow performed while physically with a client or at an operational site.
2. Mobile access materially improves that workflow.
3. The product has a live or approved runtime that Field can safely use.
4. Its mobile capabilities can be bounded without exposing unnecessary desktop administration.

Seshat does not meet this rule and is out of scope. No Seshat card, placeholder, route, registry entry, or future-module UI should be created as part of Minerva Field.

## Technical direction to validate during implementation

- Remain inside the existing `rodchakk/minerva-console` application.
- Reuse existing Minerva authentication, authorization, backend connections, and shared code where appropriate.
- Build the field surface mobile-first and responsive.
- Make the field surface installable as a PWA with a dedicated launch experience.
- Prefer a dedicated field route namespace, conceptually `/field/*`, rather than making the complete console mobile-first.
- PWA installation should launch into Minerva Field rather than the general desktop dashboard.
- Preserve existing security boundaries; mobile convenience must not weaken authorization.
- Full offline-first operation is not an initial requirement unless field testing demonstrates a real need.

Exact PWA manifest, scope, service-worker strategy, route structure, and caching behavior must be verified against the current Next.js implementation before coding.

## First-screen direction

The installed experience should open as Minerva Field, not as the desktop dashboard.

Conceptual hierarchy:

- Minerva / Field identity.
- ENTRY as the active field product.
- Recent or quick-access ENTRY destinations where useful.
- Very small mobile navigation focused on field work.
- Account/session access.

The visual mockup produced during planning is directional reference only; it is not an approved pixel-perfect implementation contract. The prior Seshat placeholder shown in planning is no longer part of the product direction.

## Ownership and working model

- Human owner defines what field situations must and must not be solvable from the phone.
- GPT leads detailed UX, information architecture, implementation decomposition, and product-system design.
- Scope should be decided through concrete field scenarios before implementation.
- Implementation should follow normal Minerva Console branch/PR/review rules.

## Initial acceptance criteria

The foundation is successful when:

1. Minerva Field exists as a distinct mobile-first surface inside Minerva Console.
2. It is installable and launches into the field experience.
3. ENTRY is the first functional field module.
4. Only products with approved field workflows are exposed; Seshat is not shown.
5. Only field-relevant workflows are exposed.
6. Existing authentication and authorization remain intact.
7. The experience is practical to operate one-handed from a phone during an on-site visit.

## Open scope questions for the working session

Before coding, define the exact ENTRY MVP by answering concrete field scenarios, including:

- What must be possible during a sales visit?
- What must be possible during community setup/onboarding?
- What must be possible during go-live validation?
- What support problems should be solvable without opening a laptop?
- Which actions are too risky or too complex for Minerva Field?

## Current decision

Proceed with Minerva Field as a Minerva-level field operations surface with ENTRY as the first and only current product module. Seshat is explicitly excluded. Future products are added only after a concrete field workflow is approved. Keep the MVP deliberately narrow and field-oriented.
