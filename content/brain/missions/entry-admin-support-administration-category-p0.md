# ENTRY — Admin Support + Administración Ticket Category

**Status:** Captured / pending implementation  
**Priority:** P0 / Pre-launch mobile polish  
**Date:** 2026-09-05  
**Product:** ENTRY  
**Area:** Admin Mobile / Support Tickets / Operations

## Mission objective

Give community administrators an obvious native support path for operational/administrative requests that are not necessarily self-service actions inside ENTRY.

Examples:

- "Necesito crear una unidad."
- "Necesito agregar/cambiar un administrador."
- "Necesito ayuda con una configuración de la comunidad."
- Other administrative requests that should reach Minerva support with clear context.

## Current state

ENTRY already has native support tickets for residents. The current resident mobile category picker contains:

- Cuenta
- Accesos
- Pases
- Notificaciones
- Reservas
- Otro

There is no `Administración` category.

The current Admin Mobile home does not expose an equivalent Support entry point. The original native-ticket implementation explicitly scoped the mobile support UI to residents, while the backend ticket infrastructure itself is generic enough to accept authenticated community members and stores category as validated text rather than a fixed enum.

Therefore, **adding the category only to the resident picker would not satisfy the product goal**. Administrators must also have a clear way to enter the native support flow.

## Product decision

1. Add a visible ticket category named **`Administración`**.
2. Expose a clear **Soporte / Solicitar soporte** entry in Admin Mobile.
3. Reuse the existing native ENTRY ticket infrastructure, ticket history, ticket detail/conversation, status model and metadata conventions rather than creating a second support system.
4. Administrative tickets should retain community and requester-role context so Minerva can distinguish and analyze administrative demand separately from resident support.
5. Keep existing categories and `Otro`; do not force administrative requests into `Cuenta` or `Otro`.

## Data value

Separating `Administración` is intentional product/operations telemetry. It should allow Minerva to measure recurring requests such as unit creation, administrator changes and community configuration, helping identify what should later become self-service product features.

## UX direction

This flow is for community administrators, not technical operators. It must feel obvious that requests such as "crear una unidad" or "necesito otro admin" belong here.

Suggested admin-facing language:

- Entry point: **Soporte**
- Category: **Administración**
- Short helper: "Unidades, administradores y configuración de la comunidad."

Avoid technical terminology and avoid requiring the administrator to guess that these requests belong under `Otro`.

## Backend / schema direction

The existing support ticket backend accepts category as non-empty validated text and does not enforce a fixed category enum, so this product change should not require a new category enum migration unless implementation review finds another constraint elsewhere.

Do not weaken existing RLS/RPC authorization. Continue attaching authenticated requester, community and role context.

## Minimum acceptance direction

1. Community admin can open native ENTRY support from Admin Mobile.
2. `Administración` is available and clearly described.
3. Admin can create a ticket, see it in history, open detail and reply using the existing ticket flow.
4. Ticket arrives to the existing Minerva support/admin processing surface with category `Administración`.
5. Community and requester-role metadata remain attached.
6. Existing resident support flow is not regressed.
7. No WhatsApp dependency is reintroduced.

## Build batching rule

This is a mobile UI change and should be grouped with the remaining Admin Mobile / pre-launch mobile fixes before requesting another Android preview/production build whenever practical.

This mission should be completed before ENTRY's first real operational launch.