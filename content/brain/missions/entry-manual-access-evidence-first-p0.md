# ENTRY — Manual Access Evidence-First Redesign

**Status:** Prompt sent; awaiting implementation review  
**Priority:** P0 / Pre-deployment  
**Date:** 2026-09-04  
**Product:** ENTRY  
**Area:** Guard / Manual Access / Admin Configuration  

## Mission objective

Redesign Guard > **Registrar acceso manual** so the workflow stops depending on typing a visitor name/company and instead becomes a fast, touch-first flow based on **destination + reason + evidence + automatic plate recognition**.

This is considered a **pre-deployment requirement** before installing ENTRY in a real community. The current flow works technically, but it asks guards to type too much in a gatehouse context where phones may be small, damaged, slow, or inconvenient to use.

The target interaction principle is:

> **The guard observes → selects → captures evidence → confirms.**

Normal operation should require no keyboard.

## Product decisions already approved

### 1. Remove required name and company from manual access

The current manual-entry screen requires:

- Visitor name
- Company / reference
- Reason

For the redesigned flow:

- **Visitor name is no longer required.**
- **Company/reference is no longer required.**
- These fields should not block or define the operational identity of a manual entry.
- Historical records must remain compatible; existing `manual_entry_name` and `manual_entry_company` data must not be destroyed.

The manual access session continues to have a technical identifier such as `manual_entry_id`.

### 2. Destination becomes required and is selected from a dropdown

**Destination must be a dropdown / selector, not a grid of cards.**

Example collapsed control:

`Destino  [ Taller El Trancazo ▾ ]`

On open, the guard should see a large touch-friendly list such as:

- Taller El Trancazo
- Pulpería Don Juan
- Administración
- Apartamentos María
- Otro

Selecting an option should close the selector immediately.

`Otro` must always exist as a fallback and **must not open a text field**. It should simply register the destination label as `Otro`.

### 3. Community destination catalog

ENTRY needs a configurable catalog of internal destinations per community. These are operational points of reference that guards can select quickly.

Examples:

- Taller El Trancazo
- Pulpería Don Juan
- Administración
- Oficina del patronato
- Cancha
- Apartamentos María

These should be managed from **Minerva Console → ENTRY → Community** during onboarding and later maintenance.

Expected administration capabilities:

- Create destination
- Rename destination
- Activate/deactivate destination
- Order destinations reasonably
- Associate each destination with exactly one community

Suggested table:

`community_destinations`

Suggested fields:

- `id uuid primary key`
- `community_id uuid not null`
- `name text not null`
- `is_active boolean not null default true`
- `sort_order integer not null default 0`
- `category text null` (optional)
- `created_at timestamptz`
- `updated_at timestamptz`

Security expectations:

- Active GUARD can only read active destinations for their own community.
- Authorized administration can manage only the appropriate community's destinations.
- No cross-community reads/writes.
- Use appropriate RLS / RPC hardening and safe `SECURITY DEFINER` search paths if RPCs are used.

Do **not** treat this catalog as the same concept as residential units/houses. Units may be flexible, but this destination catalog exists specifically to support fast operational routing for guard manual entries.

### 4. Reason remains touch-first

Keep reason as large tap targets:

- Entrega
- Servicio
- Venta
- Mantenimiento
- Otro

`Otro` should not require keyboard input.

### 5. Entry type

The guard selects:

- Vehículo
- Peatón

This is also touch-first.

### 6. Person evidence is mandatory for manual access

For `access_source = MANUAL`:

- A person/ID evidence photo is **mandatory**.
- There is **no camera-damaged exception**.
- There is no bypass to complete the manual entry without person evidence.

The current implementation must be reviewed because manual mode has allowed submit without mandatory evidence in the existing flow.

### 7. Vehicle evidence and pedestrian behavior

If `Vehículo`:

- Vehicle/plate photo is mandatory.

If `Peatón`:

- Vehicle photo is not requested.

### 8. Reuse existing plate OCR

ENTRY already has an active automatic plate-recognition pipeline. Do **not** build another OCR system and do not ask the guard to type the plate.

Current production infrastructure includes:

- `entry_logs.vehicle_photo_path`
- `entry_logs.vehicle_plate_text`
- `trg_plate_ocr_on_checkin`
- `trigger_plate_ocr_on_checkin()`
- `plate_ocr_queue`
- Edge Function `extract-plate-text`
- Gemini 2.5 Flash plate OCR
- admin history consuming `vehicle_plate_text`

The existing trigger fires after an `entry_logs` insert, queues OCR for a check-in that has a vehicle photo, and writes the recognized plate back to `entry_logs.vehicle_plate_text`.

The manual flow already creates an `entry_logs` CHECK_IN with `vehicle_photo_path`, so the redesigned flow should continue through the same OCR pipeline.

OCR failure or delay must **not** fail the check-in. The operational UI should tolerate a null plate while OCR is pending.

## Target manual-entry screen

### Header

**Registrar acceso manual**  
Entrada general sin credencial

### Inputs

1. **Destino** — required dropdown / selector
2. **Motivo** — touch chips/buttons
3. **Tipo de ingreso** — Vehículo / Peatón

### CTA

**Continuar a evidencia**

The CTA is enabled only when:

- Destination selected
- Reason selected
- Entry type selected

The screen must **not** show:

- Visitor name input
- Company input
- Plate input
- Any normal-flow text keyboard requirement

If React Native needs a custom selector, prefer a robust large modal/bottom-sheet list over a tiny native select.

## Evidence screen changes

Review the current guard check-in flow for MANUAL.

For manual access:

- Person evidence photo is mandatory.
- Vehicle photo is mandatory when `Vehículo`.
- Vehicle photo is omitted when `Peatón`.
- Existing image optimization/compression should be reused.
- Do not change PASS, FREQUENT, GROUP, EVENT or other working access flows.

## Manual-entry data model direction

The operational identity of a new manual entry should no longer depend on `manual_entry_name` or `manual_entry_company`.

Minimum useful attributes for a new manual entry:

- `community_id`
- `guard_id`
- destination
- reason
- `is_pedestrian`
- `photo_path`
- `vehicle_photo_path`
- `checked_in_at`
- status
- `manual_entry_id`

Recommended destination persistence:

- `destination_id uuid nullable` → `community_destinations.id`
- `destination_label text`

`destination_label` acts as a historical snapshot so that an old access still shows the original destination even if the catalog entry is renamed or deactivated later.

For `Otro`:

- `destination_id = null`
- `destination_label = 'Otro'`

Do not perform destructive migrations. Legacy manual records must remain readable. Existing name/company columns may remain nullable/deprecated.

## Manual checkout redesign

Current manual checkout behavior relies heavily on name/company and text search. The redesigned list should instead identify active manual entries by operational context:

**Primary:** destination  
**Secondary:** reason + entry time  
**Reference:** recognized plate when available, otherwise vehicle/pedestrian status

Examples:

### Vehicle

**Taller El Trancazo**  
Entrega · Entró 4:07 PM  
Placa: HAA 1234

`Registrar salida`

### Pedestrian

**Pulpería Don Juan**  
Servicio · Entró 3:42 PM  
Peatón

`Registrar salida`

Rules:

- Do **not** show the person's evidence photo in the guard's routine checkout list.
- Evidence remains available to admins/audit where appropriate.
- Sort most recent first.
- If OCR has not completed yet, show neutral `Vehículo` rather than an aggressive `N/A`.
- Refresh/focus may pick up the plate once OCR completes.
- Name/company search must not be required for normal operation.

## Admin history / audit expectations

The administrator web experience must continue to expose evidence and audit information without regression.

For a manual entry, admin history should be able to represent:

- Type: Manual / Entrada general
- Destination
- Reason
- Plate when recognized
- Guard
- Entry/exit time
- Person evidence
- Vehicle evidence

Existing admin support for `vehicle_plate_text`, person photo and vehicle photo must not be broken.

Guard operational UI and admin audit UI intentionally have different needs: evidence may be visible to admins without being used as the guard's everyday visual identifier.

## Onboarding implication

During community onboarding, Minerva should explicitly ask:

> **¿Qué negocios, talleres, pulperías, oficinas o puntos de referencia hay dentro?**

Those destinations can then be preloaded in Minerva Console so guards can select them without typing.

## Compatibility requirements

- Preserve all historical manual entries.
- Legacy records with name/company remain viewable.
- If an older manual record has no destination, use an appropriate fallback such as `General`.
- Deactivating a destination prevents new selection but does not alter historical records.
- No destructive migration.

## Required OCR validation path

Before considering the implementation complete, validate this full path specifically for MANUAL:

`Manual check-in`
→ `vehicle_photo_path`
→ `entry_logs CHECK_IN`
→ `trg_plate_ocr_on_checkin`
→ `plate_ocr_queue / extract-plate-text`
→ `vehicle_plate_text`
→ manual checkout UI
→ admin access history

Do not modify the OCR model/prompt unless a directly related bug is discovered.

## Minimum QA scenarios

1. **Vehicle / normal destination**  
   Destination: Taller El Trancazo  
   Reason: Entrega  
   Person photo succeeds  
   Vehicle photo succeeds  
   Check-in succeeds  
   OCR is triggered  
   Active manual checkout appears  
   Checkout succeeds

2. **Pedestrian**  
   Destination: Pulpería Don Juan  
   Reason: Servicio  
   Person photo succeeds  
   No vehicle photo requested  
   Check-in and checkout succeed

3. **Destination = Otro**  
   Reason = Otro  
   No keyboard opens  
   Check-in succeeds

4. No destination → cannot continue.

5. Manual entry without person evidence → cannot submit.

6. Vehicle manual entry without vehicle evidence → cannot submit.

7. Historical manual entry remains visible.

8. GUARD in community A cannot read community B destinations.

9. Deactivated destination disappears from new-entry selector while historical label remains intact.

10. OCR delay/failure does not block check-in; checkout shows `Vehículo` until plate becomes available.

## Validation expectations

Run applicable checks:

- TypeScript
- Lint
- Build
- Existing tests
- Supabase migration sanity
- RLS/security validation
- Cross-community access review
- `SECURITY DEFINER` search-path review where relevant
- Backward compatibility review
- OCR race/delay review

## Implementation areas likely involved

Mobile guard app:

- `app/(tabs)/guard/manual-entry.tsx`
- `app/(tabs)/guard/checkin.tsx`
- `app/(tabs)/guard/manual-checkouts.tsx`
- `GuardFlowProvider` / manual target types as needed

Backend / Supabase:

- `manual_entries`
- `entry_logs`
- new `community_destinations`
- manual check-in / checkout RPCs
- RLS / indexes / migration(s)
- existing OCR pipeline validation

Minerva Console / ENTRY module:

- destination management UI for a selected community

Admin web:

- manual-access history/detail mapping for destination while preserving evidence/plate behavior

## Agent handoff status

A full implementation prompt containing the above product and technical specifications has **already been sent to the implementation agent**.

Current status:

**PROMPT SENT — AWAITING IMPLEMENTATION / REVIEW.**

The requested agent delivery includes:

1. Executive summary
2. Final architecture
3. Changed files
4. Migrations
5. Screenshots if possible
6. QA results
7. Risks/decisions
8. Commit SHA
9. Branch
10. Pull Request

The agent was explicitly instructed:

- Work on a new branch
- Do not merge
- Reuse existing OCR infrastructure
- Preserve all other working access flows
- Do not declare success without testing the real MANUAL flow

## Next review

When the implementation report/PR arrives, review against this mission before merge. Tomorrow's focus should ideally be **UX polish and real-device testing**, not re-designing the underlying architecture.
