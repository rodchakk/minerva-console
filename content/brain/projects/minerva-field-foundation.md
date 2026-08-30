# MINERVA-FIELD-001 — Minerva Field Foundation

## Status

Active. Core Field foundation and production missions 001B through 001J are live. Full new-community end-to-end acceptance QA is the next checkpoint before adding more Field scope.

## Target working session

- Initial build session: 2026-08-27 afternoon
- Next acceptance session: create a fresh test community and run the complete onboarding/field-support flow as if a real customer had said “let’s start”.
- Timezone: America/Tegucigalpa

## Summary

Create a mobile-first, installable PWA experience inside Minerva Console for field operations. ENTRY is the first active product module and the initial implementation target.

Minerva Field is a Minerva-level operational surface rather than a copy of the ENTRY desktop console, but only products with a real field workflow should appear in it. Seshat is explicitly excluded from Minerva Field because it is local software and has no approved field workflow.

The field experience should stay intentionally small and action-oriented. It exists to help an operator work while physically with a customer or at a deployment site, without duplicating the full desktop Minerva Console.

## Current production checkpoint — 2026-08-30

Current verified production/master SHA:

`4e9b907c9ab8ea17d78aae992f752527a3933d16`

Canonical production surface:

`https://console.minervatechs.com/field`

Implemented and production-merged mission sequence:

- **001B / PR #76** — Field shell, routes, PWA foundation, mobile navigation, Preview read-only banner. Merge: `eb26fec4c314fce9985f91f2e28a488aea7b333f`.
- **001C / PR #78** — safe `/field/*` login-return preservation. Merge: `a62ebe9125dfaa311e35cdcfecf9ee0c1c87d703`.
- **001D / PR #80** — ENTRY Community Finder and read-only community overview. Merge: `994aec9552b38d43de590945e7992101db401c03`.
- **001E / PR #82** — registration campaign status plus safe recover/copy/share/open of existing registration links. Merge: `c348d56637e3188a766ca1715fbf479c4232ddf4`.
- **001F / PR #84** — first true Field mutation: configure, confirm, launch and share a Community Registration campaign. Merge: `ae410863d29a925e790a4e7b5ea3a044668d1f56`.
- **001G / PR #86** — read-only per-unit registration progress with search/filter and honest unavailable states. Merge: `eb48b2caaffa9ea0efb3536d091fea93e3a68fb7`.
- **001H / PR #88** — resident and unit field operations: resident/unit search, unit rename, move/assign resident, reset access, recovery codes, activation PIN, and supported Activation Queue account creation. Merge: `b8354759d296f34a62751a90b547cf2ab62f3f4e`.
- **001I / PR #90** — task-first ENTRY information architecture and global People search. `/field/entry` now presents **Communities** and **People** instead of forcing every task through Community Finder. Merge: `495d7cec62c2ca2612a5a3241139f7360c820667`.
- **001J / PR #92** — production password-reset recovery hardening and web-to-ENTRY recovery bridge. Merge: `4e9b907c9ab8ea17d78aae992f752527a3933d16`.

### Current ENTRY Field mental model

```text
Minerva Field
│
├── Home
│
├── ENTRY
│   │
│   ├── Communities
│   │   └── Search-first community navigation
│   │       └── Community
│   │           ├── Registration status/share/launch
│   │           ├── Registration unit progress
│   │           └── Residents & units
│   │
│   └── People
│       └── Global search across authorized ENTRY communities
│           ├── Existing resident
│           │   ├── Reset access
│           │   └── Change unit
│           │
│           └── Pending activation
│               ├── Generate/share activation PIN
│               └── Create account now
│
└── Account
```

The approved operator mental model is:

- **Place → Communities**
- **Person → People**

`Activation` is intentionally not a third top-level ENTRY category. Pending activation is part of helping a person and belongs under People.

### Password-reset bug — fixed and runtime-validated

The first concrete 001H QA bug was that reset emails arrived but their link redirected to `http://localhost:3000`.

The production correction was completed in both configuration and code:

- Supabase Auth **Site URL** changed from `http://localhost:3000` to `https://console.minervatechs.com`.
- Supabase Auth Redirect URLs now include the exact production bridge: `https://console.minervatechs.com/reset-password`.
- Vercel Production `NEXT_PUBLIC_MINERVA_CONSOLE_URL` was corrected from the placeholder `https://api.example.com` to `https://console.minervatechs.com` and stored as Config.
- `NEXT_PUBLIC_ENTRY_PASSWORD_RESET_REDIRECT`, `ENTRY_PUBLIC_RESIDENT_BASE_URL`, and `NEXT_PUBLIC_SITE_URL` were confirmed absent in Production.
- 001J code rejects localhost/loopback recovery destinations in production while preserving local-development behavior.
- `/reset-password` preserves the Supabase recovery payload and hands it to `entry://reset-password`.
- A real production reset was tested after deployment and **worked successfully**. The localhost bug is closed.

### Current decision: stop adding features and perform realistic acceptance QA

Do not add another Field feature before the fresh-community walkthrough unless testing uncovers a required blocker.

The next session should create a new controlled community from zero and run the system as if onboarding a real client. The purpose is to expose product/operational gaps from real sequence and state transitions, not to invent more scope in advance.

Recommended acceptance path:

1. Create a fresh test community from Minerva Console.
2. Configure its units/houses and core community setup.
3. Launch Community Registration from Field and verify the resident-facing registration link.
4. Submit controlled resident registrations and verify per-unit progress.
5. Verify Communities search-first navigation and community operational overview.
6. Verify global People search by name, real email, and username with community/unit context.
7. Open an existing resident and move/assign the resident to a unit.
8. Rename a unit/house and verify the updated state.
9. Verify real-email **Reset access** end-to-end: email → `console.minervatechs.com/reset-password` → ENTRY → new password → successful login.
10. Verify synthetic/username recovery-code behavior where eligible.
11. Verify pending activation: generate PIN, copy/share activation message, then create account through the supported activation lifecycle.
12. Confirm the created resident can authenticate in the real ENTRY app.
13. Re-test the stale-PIN safety rule: if Create Account replaces/consumes a prior Field PIN, the old PIN must not remain displayed/copyable.
14. Review the full flow on a 360–430px phone for clarity, one-handed usability, wrapping, and no horizontal overflow.
15. Record every bug or confusing state discovered; that list becomes the next closeout/repair scope.

The success criterion for this acceptance session is simple: if a customer says “let’s start”, the operator should be able to create the community, get residents into the system, activate accounts, support access problems, and perform the key onsite tasks from the approved Console + Field surfaces without ambiguity.

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

The original planning candidates were:

- Community overview and current onboarding/operational state.
- Fast search for communities, units, residents, and guards.
- Community Registration controls useful in the field.
- Share registration links and QR codes directly from the phone.
- Small creation/edit actions such as adding a unit when explicitly approved as safe.
- Operational Activity for validating that ENTRY is actively working on site.
- Field notes and client/contact context if a persistence model is later approved.
- Fast support actions that are safe and appropriate for mobile use.

The production checkpoint above supersedes this list for what is currently implemented. Candidates that are not explicitly listed as live remain unapproved future scope and should not be added merely because they appeared during planning.

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

The current production Field resident/unit actions also intentionally exclude destructive or broad-admin workflows such as deletes, arbitrary raw Auth-user creation, role promotion/change, membership removal, the full desktop Activation Queue, registration review/correction/confirmation, and unrelated advanced administration.

## Product inclusion rule

A Minerva product belongs in Field only when all of the following are true:

1. It has a real workflow performed while physically with a client or at an operational site.
2. Mobile access materially improves that workflow.
3. The product has a live or approved runtime that Field can safely use.
4. Its mobile capabilities can be bounded without exposing unnecessary desktop administration.

Seshat does not meet this rule and is out of scope. No Seshat card, placeholder, route, registry entry, or future-module UI should be created as part of Minerva Field.

## Technical direction

- Remain inside the existing `rodchakk/minerva-console` application.
- Reuse existing Minerva authentication, authorization, backend connections, and shared code where appropriate.
- Build the field surface mobile-first and responsive.
- Make the field surface installable as a PWA with a dedicated launch experience.
- Use the dedicated `/field/*` route namespace rather than making the complete console mobile-first.
- PWA installation should launch into Minerva Field rather than the general desktop dashboard.
- Preserve existing security boundaries; mobile convenience must not weaken authorization.
- Full offline-first operation is not an initial requirement unless field testing demonstrates a real need.
- Search-heavy Field surfaces should remain search-first, bounded, server-side, and honest about unavailable states rather than loading entire datasets to the browser.
- Reuse canonical resident/activation detail/action implementations instead of creating parallel reset/PIN/account-creation workflows.

## First-screen direction

The installed experience should open as Minerva Field, not as the desktop dashboard.

Current hierarchy:

- Minerva / Field identity.
- ENTRY as the active field product.
- ENTRY hub with Communities and People.
- Very small mobile navigation focused on field work.
- Account/session access.

The visual mockup produced during planning remains directional reference only; it is not an approved pixel-perfect implementation contract. The prior Seshat placeholder shown in planning is no longer part of the product direction.

## Ownership and working model

- Human owner defines what field situations must and must not be solvable from the phone.
- GPT leads detailed UX, information architecture, implementation decomposition, review, QA direction, and product-system design.
- Scope should be decided through concrete field scenarios before implementation.
- Implementation follows normal Minerva Console branch/PR/review rules.
- Exact merge approval remains required per PR.

## Current acceptance criteria

The foundation is successful when:

1. Minerva Field exists as a distinct mobile-first surface inside Minerva Console. **Implemented.**
2. It is installable and launches into the field experience. **Implemented.**
3. ENTRY is the first functional field module. **Implemented.**
4. Only products with approved field workflows are exposed; Seshat is not shown. **Implemented.**
5. Only field-relevant workflows are exposed. **Implemented for the current approved scope; continue validating during fresh-community QA.**
6. Existing authentication and authorization remain intact. **Implemented and repeatedly reviewed.**
7. The experience is practical to operate one-handed from a phone during an on-site visit. **Needs final realistic new-community acceptance walkthrough.**

## Current decision

Keep Minerva Field as a Minerva-level field operations surface with ENTRY as the first and only current product module. Seshat remains explicitly excluded. The core product and technical foundation is live. The next work is not another feature mission; it is a fresh-community end-to-end acceptance session, followed only by targeted fixes or missing capabilities proven necessary by that test.
