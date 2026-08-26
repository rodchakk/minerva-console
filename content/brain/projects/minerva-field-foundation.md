# MINERVA-FIELD-001 — Minerva Field Foundation

## Status

Planned.

## Target working session

- 2026-08-27 afternoon
- Timezone: America/Tegucigalpa

## Summary

Create a mobile-first, installable PWA experience inside Minerva Console for field operations across Minerva products. This is not an ENTRY-only mobile console. ENTRY is the first active product module; Seshat must be represented in the information architecture as a future module even while it remains disconnected.

The field experience should stay intentionally small and action-oriented. It exists to help an operator work while physically with a customer or at a deployment site, without duplicating the full desktop Minerva Console.

## Product framing

Two complementary surfaces:

- **Minerva Console** — full administrative experience, primarily desktop-first.
- **Minerva Field** — installable mobile PWA, mobile-first, focused on field work.

Minerva Field should feel like entering Minerva first, then selecting a product module.

Initial product shell:

```text
Minerva Field
├── Home
├── ENTRY
├── Seshat (future / disconnected)
└── Account
```

Future Minerva products should be able to add their own field module without creating a separate mobile app or PWA per product.

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
- Small creation/edit actions such as adding a unit, resident admin, or guard.
- Operational Activity for validating that ENTRY is actively working on site.
- Field notes and client/contact context.
- Fast support actions that are safe and appropriate for mobile use.

## Explicit non-goals for the initial field experience

Do not duplicate the full Minerva Console. Initial exclusions include:

- Minerva Brain.
- Internal Minerva administration.
- Advanced configuration.
- Large desktop-style data tables.
- Deep analytics and complex reports.
- Advanced permission management.
- Backend or infrastructure administration.
- High-risk destructive operations better performed from desktop.
- A separate React Native application for Minerva administrators.
- A separate PWA for every Minerva product.

## Seshat direction

Seshat is currently disconnected, but Minerva Field must not be architected as ENTRY-specific. The product shell should support a future Seshat field module with its own field workflows without requiring the field platform to be redesigned.

No Seshat operational implementation is required in the first mission beyond preserving this product-level architecture.

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

The installed experience should open as a Minerva-level field console, not directly inside ENTRY.

Conceptual hierarchy:

- Minerva / Field Console identity.
- Product cards or modules.
- ENTRY active and accessible.
- Seshat visibly future/disconnected.
- Recent or quick-access field destinations where useful.
- Very small mobile navigation focused on field work.

The visual mockup produced during planning is directional reference only; it is not an approved pixel-perfect implementation contract.

## Ownership and working model

- Human owner defines what field situations must and must not be solvable from the phone.
- GPT leads detailed UX, information architecture, implementation decomposition, and product-system design.
- Scope should be decided through concrete field scenarios before implementation.
- Implementation should follow normal Minerva Console branch/PR/review rules.

## Initial acceptance criteria

The foundation is successful when:

1. Minerva Field exists as a distinct mobile-first surface inside Minerva Console.
2. It is installable and launches into the field experience.
3. The home experience is product-level rather than ENTRY-only.
4. ENTRY is the first functional field module.
5. Seshat can be represented without coupling the architecture to ENTRY.
6. Only field-relevant workflows are exposed.
7. Existing authentication and authorization remain intact.
8. The experience is practical to operate one-handed from a phone during an on-site visit.

## Open scope questions for the working session

Before coding, define the exact ENTRY MVP by answering concrete field scenarios, including:

- What must be possible during a sales visit?
- What must be possible during community setup/onboarding?
- What must be possible during go-live validation?
- What support problems should be solvable without opening a laptop?
- Which actions are too risky or too complex for Minerva Field?

## Current decision

Proceed with Minerva Field as a Minerva-level platform surface, with ENTRY first and Seshat/future products supported by the architecture. Keep the MVP deliberately narrow and field-oriented.
