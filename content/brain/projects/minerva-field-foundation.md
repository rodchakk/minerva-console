# MINERVA-FIELD-001 — Minerva Field Foundation

## Status

**Active / approved. Foundation live in production. Current ENTRY Field operational pass closed 2026-09-03.**

## Summary

Minerva Field is the mobile-first, installable PWA surface inside Minerva Console for field operations. ENTRY is the first and only current product module.

The original foundation direction is now implemented and in production: Field is intentionally smaller than the desktop Console, reuses existing ENTRY authorization and backend contracts, and concentrates the operations that are useful from a phone while working with a community or handling support.

Minerva Field remains a Minerva-level operational surface rather than a copy of the ENTRY desktop console. Products should appear in Field only when they have a real approved field workflow. Seshat remains explicitly excluded.

## Product framing

Two complementary surfaces:

- **Minerva Console** — full administrative experience, primarily desktop-first.
- **Minerva Field** — installable mobile PWA, mobile-first, focused on field work and support.

Current shell:

```text
Minerva Field
├── Home
├── ENTRY
│   ├── Tickets
│   ├── Communities
│   ├── People
│   └── Access
└── Account
```

Future Minerva products may add a Field module only when a concrete field workflow is approved. Field must not display speculative, local-only, disconnected, or non-field products merely to advertise the Minerva portfolio.

## Core design rule

Every capability must answer:

> What does the operator need to do with this product while physically with a customer, during onboarding, or while resolving a support issue from the phone?

Do not add functionality merely because it already exists in Minerva Console.

The preferred interaction model remains:

**Read → Act → Confirm**

Each mobile screen should help the operator understand current state, take a relevant action, and immediately know whether that action succeeded.

## Current ENTRY Field capabilities

The September 2026 operational pass established the following live capabilities.

### Communities

- Mobile community/setup access using existing ENTRY contracts.
- Unit-oriented field workflows remain separated from account/access operations.

### People

- Global search across ENTRY community users, including residents, guards, admins, and unassigned users.
- Resident profile editing and resident unit actions.
- Admin profile editing for name and phone.
- Admin unit assignment/change while preserving the ADMIN role.
- Account activation/deactivation for supported ENTRY roles.
- The current Field operator account is protected from destructive status changes.
- Existing Minerva system-owner protections remain enforced by the backend.

### Access

A compact dedicated access surface avoids overloading People while avoiding a proliferation of home cards.

- Reuses the existing People search model.
- Changes roles between RESIDENT, ADMIN, and GUARD using the existing ENTRY role RPCs.
- RESIDENT ↔ ADMIN preserves the existing unit where applicable.
- RESIDENT/ADMIN → GUARD removes the unit relationship because guards are not tied to houses.
- GUARD → RESIDENT requires a unit selection before completion.
- GUARD → ADMIN does not require a unit.
- Creates guard accounts with the existing guard creation flow and no house assignment.
- Guard creation is positioned above search in the Access screen so it remains immediately reachable even when search results expand.

### Tickets

Tickets are treated as conversations rather than desktop forms.

- Reuses the existing `support_tickets` and `support_ticket_messages` backend, RLS, and RPCs.
- Mobile ticket inbox with status filtering.
- Chat-style ticket detail with requester messages on the left and Minerva staff replies on the right.
- Quick actions currently include existing ENTRY operations such as reset access, open user, and ticket status transitions.
- Device/technical context uses metadata already captured by ENTRY rather than creating a separate support-data model.
- PWA composer is designed around the mobile software keyboard and the Field bottom navigation.
- Supabase Realtime is the primary live-update path.
- Field explicitly authenticates the Realtime connection with the current session and applies incoming message inserts directly to client chat state.
- A 2-second visible-tab-only database reconciliation fallback self-heals the conversation if a mobile browser/PWA drops a Realtime event. It stops while the page is hidden and requires no cron, worker, new table, or separate service.
- Opening the keyboard hides Field navigation and ticket Quick Actions, keeps the composer above the keyboard, and preserves the conversation position instead of forcing the user away from the message being read.
- When reading older content, incoming messages expose a `New message` jump action rather than forcibly changing reading position.

## September 2026 implementation closeout

This Brain capture records the current operational pass without storing any resident/customer conversation content or PII.

| PR | Scope | Production result |
| --- | --- | --- |
| `#119` — `MINERVA-FIELD-001N` | Account status for all ENTRY roles | Merged as `407863c5022a8731ca1654d48f6e2391346ead74` |
| `#120` | Access: role changes + create guard | Merged as `cd5f53d16859db33fb2fe1b58b6d439685053c32` |
| `#121` | Admin profile + unit management | Merged as `a3ce05bf02d9d1e6bb942fda0e9ad3933d7493bf` |
| `#122` — `MINERVA-FIELD-001Q` | Mobile support ticket chat + quick actions | Merged as `89d39f017f56eb3816c75cac980a82c88c731994` |
| `#124` — `MINERVA-FIELD-001R` | First Realtime/keyboard repair | Merged as `b3fe8c0c7d04a6ac5d1acf490eff568b495ad3c7`; later found incomplete in physical PWA QA and superseded by `#125` |
| `#125` — `MINERVA-FIELD-001S` | Hardened live ticket chat + composer | Merged as `65384c04fb722fbaf693618a0b0a156805556337`; production deployment reached `READY` on `console.minervatechs.com` |

### Canonical ticket-chat state

`#125` supersedes the incomplete behavior from `#124` and is the canonical implementation for Field ticket live updates and keyboard/composer behavior.

The current pass is accepted as good enough to close for now. Further Field work should start from actual operational needs discovered during use rather than adding speculative controls.

## Future backlog — Ticket Quick Responses

**Status: idea captured; not approved for implementation yet.**

A future Field support enhancement should add a growing library of **Quick Responses** inside ticket chat for recurring support situations. The intent is to reduce repeated typing while still keeping the human operator in control of what is sent.

First useful candidates identified:

- instructions for enabling ENTRY notifications;
- instructions for enabling geolocation/location permissions;
- ability to attach/send instructional images or screenshots that visually show the user how to complete those steps.

Direction for the future implementation:

- reuse the existing ENTRY support ticket/message system rather than creating another chat or support backend;
- keep Quick Responses operator-triggered, editable where practical, and clearly visible before sending;
- grow the response library gradually as real recurring support cases are observed;
- instructional images should be managed as support assets, not copied into Brain as customer conversation data;
- do not store resident/customer messages, identities, screenshots containing customer data, or other operational PII in Brain;
- avoid adding AI, automation, or a new knowledge service merely to ship the first version of canned responses.

Possible future response examples are product guidance, not final approved wording. Exact notification/geolocation instructions and screenshots must be validated against the then-current ENTRY iOS/Android flows before implementation.

## Explicit boundaries

Minerva Field should continue to avoid:

- Minerva Brain as an operational customer-data surface;
- Seshat without a real approved field workflow;
- internal Minerva administration unrelated to field work;
- large desktop-style tables and deep analytics;
- backend/infrastructure administration;
- speculative product placeholders;
- weakening existing authorization for mobile convenience;
- duplicating ENTRY backend contracts when an existing safe RPC or query already solves the workflow.

Field support tickets and conversations remain ENTRY operational data. Brain records architecture, decisions, implementation history, and future product ideas only.

## Product inclusion rule

A Minerva product belongs in Field only when all of the following are true:

1. It has a real workflow performed while physically with a client or at an operational site.
2. Mobile access materially improves that workflow.
3. The product has a live or approved runtime that Field can safely use.
4. Its mobile capabilities can be bounded without exposing unnecessary desktop administration.

Seshat does not currently meet this rule and remains out of scope.

## Technical direction

- Remain inside the existing `rodchakk/minerva-console` application.
- Reuse existing Minerva authentication, authorization, backend connections, and shared code where appropriate.
- Keep `/field/*` as the dedicated mobile operational namespace.
- Preserve the installed PWA launch experience.
- Prefer existing ENTRY RPCs/data contracts over new persistence.
- Full offline-first operation is not required unless field use demonstrates a concrete need.
- Mobile/PWA QA must include the actual software keyboard and physical-device viewport behavior for conversation interfaces.

## Ownership and working model

- Human owner defines what field situations must and must not be solvable from the phone.
- GPT leads UX, information architecture, implementation decomposition, and product-system design.
- Scope should continue to be decided through concrete operational scenarios.
- Implementation follows normal Minerva Console branch/PR/review rules.

## Current decision

Minerva Field is now a live, approved Minerva-level field operations surface with ENTRY as the only active product module. The current People/Access/admin-management and ticket-chat pass is closed in production. Future expansion should stay deliberately narrow and be driven by actual field/support needs.

The next captured support idea is **Ticket Quick Responses**, beginning with notification setup, geolocation setup, and instructional images. It is backlog only and should not be implemented until explicitly prioritized.
