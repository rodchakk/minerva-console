# ENTRY — Manual Access Evidence-First Redesign

> **Status override — 2026-09-04:** ✅ **COMPLETED / MERGED / PRODUCTION-VALIDATED.**  
> The detailed implementation specification below is retained as historical design context. Current closeout is documented in [entry-manual-access-evidence-first-closeout-2026-09-04.md](entry-manual-access-evidence-first-closeout-2026-09-04.md).

**Status:** Closed  
**Priority:** P0 / Pre-deployment — CLOSED  
**Date:** 2026-09-04  
**Product:** ENTRY  
**Area:** Guard / Manual Access / Admin Configuration

## Mission objective

Redesign Guard > **Registrar acceso manual** so the workflow stops depending on typing a visitor name/company and instead becomes a fast, touch-first flow based on **destination + reason + evidence + automatic plate recognition**.

The target interaction principle is:

> **The guard observes → selects → captures evidence → confirms.**

Normal operation should require no keyboard.

## Approved product decisions

- Visitor name and company/reference are not required for new manual access.
- Destination is required and selected from a dropdown / large touch-friendly selector.
- `Otro` always exists and does not open a text field.
- Reason remains touch-first: Entrega / Servicio / Venta / Mantenimiento / Otro.
- Guard selects Vehículo / Peatón.
- Person evidence is mandatory for MANUAL; no camera-damaged exception/bypass.
- Vehicle evidence is mandatory for Vehículo and omitted for Peatón.
- Existing ENTRY plate OCR is reused; guards never type the plate.
- Community destinations are configurable from Minerva Console and are operational guard-routing references, not residential units.
- Historical manual entries remain compatible through destination snapshots / fallbacks.
- Manual checkout identifies active records by destination + reason + time + plate/pedestrian state.
- Evidence remains available to admins/audit but is not used as routine checkout-list identity for guards.
- OCR delay/failure must not block check-in.

## Delivered architecture

### Community destinations

`community_destinations` supports community-scoped operational destinations with create, rename, reorder, activate/deactivate behavior.

Operational rules:

- Active guards only receive active destinations for their own community.
- Inactive destinations disappear from new guard selections.
- Historical destination snapshots remain readable after rename/deactivation.
- `Otro` remains a virtual fallback with no keyboard requirement.

### Manual entry

New manual entry flow captures:

- community
- manual entry id
- destination id / immutable destination label snapshot
- reason
- pedestrian/vehicle state
- person evidence
- vehicle evidence when applicable
- check-in timestamp/status

Legacy name/company data remains readable but no longer defines the operational identity of new manual access.

### OCR

The existing path was retained:

`vehicle_photo_path` → CHECK_IN `entry_logs` → OCR trigger/queue → `extract-plate-text` → `vehicle_plate_text`.

No duplicate OCR system and no manual plate input were introduced.

### Manual checkout

Active manual entries are represented primarily by:

- destination
- reason
- entry time / elapsed time
- recognized plate, or Peatón / Vehículo fallback

Person evidence is not shown in the guard's routine checkout list.

### Admin web

Manual access history/detail represents:

- `Acceso manual`
- destination
- reason
- plate/pedestrian state
- guard and timestamps
- person/vehicle evidence

CHECK_OUT display can reuse the known CHECK_IN plate for the same `manual_entry_id` without mutating stored data or rerunning OCR.

### Minerva Console

Community detail includes a production-polished Manual Access Destinations manager supporting:

- create
- rename
- reorder
- deactivate
- reactivate

The final UI was simplified to avoid redundant community metrics and visually unified with the surrounding Console page.

## Validation completed

- Backend migration applied and migration history reconciled.
- RLS/grants hardened for destination catalog.
- Real Android device manual vehicle/pedestrian tests passed.
- Mandatory evidence behavior passed.
- `Otro` no-keyboard path passed.
- Real OCR result observed and propagated to admin history.
- Manual checkout passed.
- Admin web runtime/visual QA passed.
- Minerva Console preview visual QA passed.
- Vercel Preview write failure was confirmed to be intentional read-only environment behavior.
- After production deployment, destination CRUD was confirmed working and configured destinations were confirmed visible to guards.

## Merged implementation

- `rodchakk/node-bridge-foundation#17` — mobile + Supabase — merged.
- `rodchakk/entry-platform#5` — admin web — merged.
- `rodchakk/minerva-console#131` — destination management — merged.

## Closeout

**Mission closed on 2026-09-04.**

See [entry-manual-access-evidence-first-closeout-2026-09-04.md](entry-manual-access-evidence-first-closeout-2026-09-04.md) for the production closeout record.

Remaining pre-launch priorities are tracked in [entry-prelaunch-p0-board.md](../projects/entry-prelaunch-p0-board.md).
