# ENTRY — Manual Access Evidence-First Redesign — Closeout

**Status:** ✅ COMPLETED / MERGED / PRODUCTION-VALIDATED  
**Priority:** P0 / Pre-launch — CLOSED  
**Date:** 2026-09-04  
**Product:** ENTRY  
**Area:** Guard / Manual Access / Admin Web / Minerva Console / Supabase

## Outcome

The Manual Access Evidence-First redesign is complete and has been validated through the real operational path.

The new manual-access flow no longer depends on typing visitor name/company. Guards select an operational destination, reason, and vehicle/pedestrian state, then capture required evidence. Vehicle entries reuse ENTRY's existing automatic plate OCR.

Community destinations are managed in Minerva Console and are exposed to the guard selector for the same community.

## Production architecture delivered

- Configurable `community_destinations` catalog per community.
- Required destination selector with fixed `Otro` fallback and no text input.
- Touch-first reason selection.
- Vehicle / pedestrian selection.
- Mandatory person evidence for all manual entries.
- Mandatory vehicle evidence for vehicle entries.
- Existing plate OCR reused; no manual plate entry and no duplicate OCR implementation.
- Destination snapshot persisted for historical compatibility.
- Manual checkout redesigned around destination, reason, time, plate/pedestrian state.
- Admin history/detail updated to represent manual accesses as `Acceso manual`, destination, reason, plate and evidence.
- Minerva Console destination CRUD supports create, rename, reorder, deactivate and reactivate.
- Inactive destinations remain in administration/history but disappear from new guard selections.

## Merged pull requests

- Mobile + Supabase: `rodchakk/node-bridge-foundation#17` — merged, merge commit `724e3ba6a41f4c7b7e685819e9fbb8a547705840`.
- ENTRY Admin Web: `rodchakk/entry-platform#5` — merged, merge commit `238642ae5997f8c3b2a015abe0ad6754c610614d`.
- Minerva Console: `rodchakk/minerva-console#131` — merged, merge commit `4e7ab0862fa6369d16e93ce05d29ea3cf736c969`.

## Validation completed

- Supabase migrations applied and reconciled for the manual destination model.
- Android real-device manual-access tests passed.
- Vehicle and pedestrian flows tested.
- `Otro` flow tested without keyboard.
- Required evidence behavior tested.
- Real OCR result observed and propagated into admin history.
- Manual checkout tested.
- Admin web runtime/visual QA passed for destination, reason, manual identity, evidence and plate fallback.
- Minerva Console visual QA passed after production polish and design unification.
- After merge/deploy, operator confirmed destination CRUD works in the published Console and configured destinations appear correctly to the guard.

## Important environment note

Vercel Preview intentionally blocks ENTRY write operations through a read-only guard. A Preview error while creating a destination was confirmed to be expected environment behavior, not a destination-manager defect. Final CRUD validation was therefore performed after production deployment.

## Product decision retained

This destination catalog is an operational guard-routing concept and is not the same thing as the residential unit model.

## Closeout

**Mission closed.** No remaining blocker from Manual Access Evidence-First is part of the ENTRY pre-launch gate.

Remaining pre-launch work is tracked in `entry-prelaunch-p0-board.md`.
