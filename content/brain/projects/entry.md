# ENTRY

Residential and community access control system, and the initial ENTRY Knowledge Pack for Minerva Core Brain. This is approved, read-only knowledge and strategy. It is not ENTRY runtime, and Brain does not connect to ENTRY's database.

## What ENTRY is

ENTRY is a product that manages residential communities, units, staff, and user access. It manages communities, units, staff, and user access, with onboarding workflows and activity logging. It has its own Supabase project and dedicated data layer.

## Status within Minerva

- **Status:** Approved, active development.
- ENTRY runtime lives under `features/entry/**` in this repo and is operated independently of Brain.
- **Infrastructure:** its own dedicated Supabase project.
- Minerva Console is the admin surface for ENTRY (community onboarding, activation, staffing, messaging, and backend feature controls).

## Relationship to Minerva Console

- Minerva Console hosts both the ENTRY admin UI (`features/entry/**`, routes under `products/entry/**`) and Minerva Core Brain (`features/brain/**`, `content/brain/**`).
- Brain and ENTRY share the repo and the Console shell, but are isolated: Brain may reference ENTRY decisions and architecture as knowledge, but must not read ENTRY operational data or import ENTRY code.

## Voice MVP

- A voice-based MVP for access control is part of the ENTRY direction.
- Detailed status (scope, readiness, integration) is not verified here — see **Unknown / Needs verification**.

## Commercial strategy — residentials

- Target market is residential communities ("residenciales" / colonias) that currently manage visitor access manually (phone calls to a guard) or with an incumbent system.
- The wedge is replacing call-based gate control and weak incumbent tooling with ENTRY.
- Sales motion is per-community: reach the community board ("patronato") or security lead, who decides adoption.

## Observed competitors

- **Access** — incumbent access-control system seen in several residentials.
- **ISSY** — observed competitor.
- **SSA** — observed competitor.

> Competitive detail beyond names (features, pricing, contracts) is not verified — see **Unknown / Needs verification**.

## Known colonias / leads

- **Residencial Girona** — uses Access. No administrative contact yet.
- **Residencial La Fuente** — no access to the board ("patronato") yet.
- **Vías Monserrat** — approximately 30 houses. Access controlled by phone calls.
- **Villas Angelina** — approximately 20–30 houses. Access controlled by phone calls.
- **Vías Paraíso** — uses Access. Security lead indicated a Sunday board ("patronato") meeting.
- **Residencial Santa Elena Demco** — residential under construction. Investigation pending.

## Known bug (pending)

- **"Forgot my password" ("Olvidé mi contraseña") does not work** and must be fixed. Reproduction details and root cause are not verified here.

## Principles

- Brain must not touch `features/entry/**`.
- ENTRY keeps its own Supabase project.
- Brain does not connect to the ENTRY database yet.
- Brain documents ENTRY knowledge and strategy; it does not execute ENTRY runtime.
- Brain may reference ENTRY decisions and architecture, but must not read ENTRY operational data.

## Unknown / Needs verification

Recorded as gaps, not facts. Do not treat any of these as verified.

- Voice MVP status: scope, readiness, and how it integrates with the gate flow.
- ENTRY database schema, tables, and RPCs — intentionally not documented here; not to be inferred.
- Competitor specifics for Access / ISSY / SSA (features, pricing, lock-in).
- Exact house counts and current decision-maker contacts per colonia.
- Root cause and reproduction steps for the "Forgot my password" bug.
- Santa Elena Demco timeline and contact.

## Open questions

- Which leads have a reachable board ("patronato") contact, and when do they meet?
- What is the minimum ENTRY feature set needed to displace Access in a call-controlled colonia?
- Is the Voice MVP a near-term differentiator or a later phase?

## Next recommended ENTRY missions

- Fix the "Forgot my password" flow (ENTRY runtime mission — outside Brain).
- Verify and document Voice MVP status into an approved Brain decision once confirmed.
- Build a per-colonia lead tracker (knowledge only) with verified contacts and stage.
- Verify competitor specifics before recording them as approved knowledge.

## Key features

- Community management
- Unit management
- Staff and user access control
- Onboarding workflows
- Activity logging
