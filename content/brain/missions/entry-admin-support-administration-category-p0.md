# ENTRY — `Administración` Ticket Category

**Status:** Captured / pending implementation  
**Priority:** P0 / Pre-launch mobile polish  
**Date:** 2026-09-05  
**Product:** ENTRY  
**Area:** Support Tickets / Admin Operations

## Mission objective

Add a dedicated ticket category **`Administración`** to the existing native ENTRY support flow so community administrators can classify operational/administrative requests clearly.

Examples:

- "Necesito crear una unidad."
- "Necesito agregar/cambiar un administrador."
- "Necesito ayuda con una configuración de la comunidad."

## Current code — verified 2026-09-05

This mission does **not** require a new Admin Mobile support screen.

Current ENTRY navigation already gives ADMIN users access to the existing resident support flow:

- `AuthProvider.ROLE_HOME` sends `ADMIN` users to `/resident`.
- `ResidentDrawer` includes **Soporte Técnico** → `/resident/support` for the shared resident/admin surface.
- The same drawer shows **Panel de Administrador** when the current role is `ADMIN`.

Therefore, an ADMIN already has the support path. The actual gap is only the missing **`Administración`** category in the existing support category picker.

Current categories in `app/(tabs)/resident/support.tsx`:

- Cuenta
- Accesos
- Pases
- Notificaciones
- Reservas
- Otro

## Product decision

1. Add **`Administración`** to the existing support category picker.
2. Reuse the existing native ENTRY ticket history, detail/conversation, status model and metadata.
3. Do **not** create a duplicate Admin-only support system or route unless a future product decision explicitly requires it.
4. Keep existing categories and `Otro`.
5. Preserve requester role/community metadata so Minerva can distinguish administrative demand from resident support.

## Data value

Separating `Administración` is intentional product/operations telemetry. It should allow Minerva to measure recurring requests such as unit creation, administrator changes and community configuration, helping identify what should later become self-service product features.

## UX direction

Suggested category label:

**Administración**

Suggested helper if the picker supports secondary copy:

"Unidades, administradores y configuración de la comunidad."

The administrator should not have to guess that these requests belong under `Cuenta` or `Otro`.

## Backend / schema direction

The existing support ticket backend accepts category as validated text and does not enforce a fixed category enum, so adding this category should not require a category migration unless implementation review finds another constraint elsewhere.

Do not weaken existing RLS/RPC authorization.

## Minimum acceptance direction

1. An ADMIN using the existing `/resident/support` flow can select `Administración`.
2. Ticket creation succeeds through the existing `support_create_ticket` RPC.
3. Ticket appears in existing ticket history/detail and Minerva support processing with category `Administración`.
4. Community/requester role metadata remains attached.
5. Existing resident support categories and flows are unchanged.
6. No duplicate support route and no WhatsApp dependency are introduced.

## Build batching rule

This is a small JS/TS mobile change and should be grouped with the remaining pre-launch mobile fixes before requesting another preview/production build whenever practical.

This mission should be completed before ENTRY's first real operational launch.