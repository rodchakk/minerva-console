# ENTRY — Current Work

## Current priority override — 2026-09-04

> This section supersedes the older ENTRY-BRAIN-001 snapshot below when determining current priority/status.

### P0 before first real installation

**ENTRY — Manual Access Evidence-First Redesign** is the current pre-deployment P0 for the Guard manual-entry flow.

Full specification: [entry-manual-access-evidence-first-p0.md](../missions/entry-manual-access-evidence-first-p0.md)

**Current status:** **PROMPT SENT — AWAITING IMPLEMENTATION / REVIEW.**

The implementation agent has already received the complete mission prompt. No merge has been approved. When the implementation report/PR arrives, review it against the mission specification before merge.

Approved core decisions:

- Remove visitor name and company/reference as required manual-entry fields.
- Normal guard operation should require **no keyboard**.
- Destination is mandatory and must be a **dropdown/selector**, not a grid of destination cards.
- Destinations are configurable per community from **Minerva Console → ENTRY**.
- `Otro` always exists and does not open a text field.
- Reason remains touch-first: Entrega / Servicio / Venta / Mantenimiento / Otro.
- Guard selects Vehículo / Peatón.
- Person evidence photo is mandatory for MANUAL; **no camera-damaged exception or bypass**.
- Vehicle photo is mandatory for vehicle entries and omitted for pedestrian entries.
- Reuse ENTRY's existing automatic plate OCR (`vehicle_photo_path` → OCR trigger/queue → `vehicle_plate_text`); do not create another OCR and do not ask the guard to type a plate.
- Manual checkout should identify active entries primarily by **destination + reason + entry time + recognized plate / pedestrian state**, without showing person evidence photos to the guard.
- Evidence remains available to admins/audit where appropriate.
- Historical manual entries must remain compatible; no destructive migration.
- Deactivated destinations disappear from new-entry selection but historical destination labels remain intact.
- OCR delay/failure must not block check-in.

Tomorrow's intended focus after implementation arrives: **UX polish + real-device QA**, not redesigning the underlying architecture.

---

## Historical snapshot — ENTRY-BRAIN-001

The remainder of this document is retained as historical context from the earlier ENTRY Knowledge Pack capture and may contain stale statuses.

Active implementation state, current branch, and the ENTRY mission board. Captured read-only as of ENTRY-BRAIN-001. Part of the ENTRY Knowledge Pack; see [entry.md](entry.md).

## Verified from code (git state at capture time)

- **Current branch:** `feature/entry-voice-mvp`.
- **Working tree:** clean (no uncommitted changes) at capture.
- **Latest commit:** `ba27ac5 ENTRY-I001 voice MVP implementation and harness`.
- **Other local/remote branches:** `main` (default), `remotes/origin/main`, `remotes/origin/feature/sentry-mobile-observability`, `remotes/origin/security-gate-supabase-hardening`.
- **Recent commit themes:** voice MVP, ignore Claude local settings, version auth edge functions / remove activation diagnostics, harden Supabase activation rate limits, shared edge rate-limit helper, security gate remediation, persistent edge rate-limit primitive, pg_net service-role detection for reservation pushes, harden `send-push-event` internal auth.

### Work in progress (detected)
- **ENTRY Voice MVP (ENTRY-I001)** is implemented client-only on `feature/entry-voice-mvp` and is the active line of work. New files: `lib/voice/useVoiceRecognition.ts`, `app/(tabs)/resident/create-voice.tsx`, `components/resident/VoiceTriggerButton.tsx`; updated `app/(tabs)/resident/index.tsx`, `app.json`, `package.json`/lock (`expo-speech-recognition@56.0.1`). Detail in [entry-voice-mvp.md](entry-voice-mvp.md).
- Branch names suggest two other in-flight or recent tracks: **Sentry mobile observability** and **security-gate Supabase hardening** (the latter aligns with recent rate-limit/edge-auth commits).

## Verified from repo (harness mission board — `.minerva-harness/05_MISSIONS.md`)

| ID | Title | Type | Status |
| -- | ----- | ---- | ------ |
| ENTRY-M001 | Harness + repo reconnaissance | Recon | ✅ Done |
| ENTRY-M002 | Hygiene + agent pointer + backend snapshot | Hygiene | ✅ Done |
| ENTRY-D001 | ENTRY Voice — technical design | Design | ✅ Done |
| ENTRY-I001 | ENTRY Voice — MVP implementation | Impl | ✅ Implemented — pending native device QA |
| ENTRY-I001-CLOSEOUT | Voice MVP documentation closeout | Docs | ✅ Done |
| ENTRY-I001-QA | Voice MVP native device QA | QA | 🔜 Next |
| ENTRY-D002 | Facility Destinations — technical design | Design | ⏸️ Deferred (after Voice QA) |
| ENTRY-I002 | Facility Destinations — MVP implementation | Impl | ⏸️ Deferred (needs D002) |

Approved sequencing: Voice (reuses existing infra, near-zero backend change) ships before Facility Destinations (needs schema + access-resolver changes).

## Operator-provided

- Focus is to keep advancing ENTRY; the "Forgot my password" bug is a priority to fix (see [entry-known-issues.md](entry-known-issues.md)).

## Inferred

- The current dev cycle is "finish Voice MVP → QA on device → then Facility Destinations design." Observability (Sentry) and security hardening appear to run alongside as separate tracks.

## Unknown / Needs verification

- Whether `feature/entry-voice-mvp` has an open PR to `main`, and CI/build status there.
- Current state of the Sentry and security-gate branches (merged? abandoned? active?).
- Whether device QA (ENTRY-I001-QA) has started since this capture.

## Risks

- Voice MVP is "implemented" but unverified on a device — declaring it done before QA would be premature (a native module never exercised on-device).
- Multiple parallel branches risk divergence from `main` if not merged/rebased.

## Next actions

- Confirm PR/branch status of `feature/entry-voice-mvp` and the two other branches.
- Proceed to ENTRY-I001-QA (see [entry-next-missions.md](entry-next-missions.md)).
