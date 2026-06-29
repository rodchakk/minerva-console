# ENTRY — Voice MVP

Status and contract of ENTRY Voice (resident-side voice access creation). Part of the ENTRY Knowledge Pack; see [entry.md](entry.md). Sourced from `.minerva-harness/VOICE_MVP_HANDOFF.md`, `04_PRODUCT_DIRECTION.md`, `06_DECISIONS.md`, and code.

## Verified from code

- **Status:** ENTRY-I001 implemented the MVP, **client-only**, code-complete and typechecking (2026-06-23). **Not production-ready** until native device QA (ENTRY-I001-QA) runs — the native speech module has never been exercised on a real device.
- **Goal:** a resident says e.g. "Pedidos Ya" and ENTRY creates a **normal standard entry** (a `visit_passes` row) via the existing `create_pass_v2` path — not a separate access system. Voice is an *additional* creation method; QR and manual creation remain.
- **Library:** `expo-speech-recognition@56.0.1` (free native on-device engine, Expo config plugin; SDK 54 / New Arch / dev-client compatible). `app.json` has the plugin + Spanish mic/speech permission copy + `android.permission.RECORD_AUDIO`.
- **New files:** `lib/voice/useVoiceRecognition.ts` (isolated speech hook — availability/permission/listening/transcript/normalized error; all native calls live here), `app/(tabs)/resident/create-voice.tsx` (voice screen + editable confirmation that doubles as the manual fallback + VISIT/DELIVERY selector), `components/resident/VoiceTriggerButton.tsx` (relocatable "Voz" trigger). Updated `app/(tabs)/resident/index.tsx` (1 import + 1 JSX line; **provisional** placement above the dashboard footer, Q-V7).
- **Backend contract (exact):** `supabase.rpc("create_pass_v2", { p_community_id, p_pass_type /* default VISIT, DELIVERY if selected */, p_visitor_name: finalName, p_delivery_company: type==='DELIVERY' ? finalName : null, p_delivery_category: null, p_vehicle_plate: null, p_note: "[Voz] " + finalName, p_expiration_mode: "12H", p_expires_at: null })`. Result read as `data[0]`; id = `pass.pass_id ?? pass.id`. Navigates to existing `visit-created` / `delivery-created` success screens (PIN/QR + share).
- **No backend / schema / guard / RLS change.** No audio stored. Handles the `55000` rate-limit error (20 passes/hour/resident) explicitly in Spanish with manual fallback; 60s identical-submit guard; disabled while in flight.

## Verified from repo decisions (`06_DECISIONS.md`)

- D-001 Voice creates standard entries; D-002 default validity 12h; D-003 zero variable-cost; D-004 no paid speech APIs (native on-device only); D-005 no audio storage; D-006 manual fallback required; D-009/D-011/D-014 transcript (if stored) goes in `note` as `[Voz] <final confirmed text>`, no new column; D-015 default type VISIT; D-016 client-only; D-017 pinned `expo-speech-recognition@56.0.1`; D-018 provisional locale `es-MX` + OS recognizer (`requiresOnDeviceRecognition:false`); D-019 provisional relocatable trigger placement.

## Privacy / cost guarantees (Verified from code, one flagged assumption)

- No audio storage (hook surfaces text only; no FileSystem/Storage writes, no audio in logs).
- No paid APIs (device's free native recognizer); no backend speech proxy.
- Only `note = "[Voz] " + finalConfirmedText` persisted; no raw transcript, no `voice_transcript` column.
- "Zero variable-cost" is confirmed by design; **validate no hidden cloud round-trip during device QA** (harness flags this as an assumption, Q-V3).

## Operator-provided

- ENTRY Voice is a near-term product bet to differentiate ENTRY (per overall ENTRY direction).

## Inferred

- Because the guard is pull-based and Voice reuses `create_pass_v2`, a voice pass is indistinguishable at the gate from a button-created pass — so QA can focus on the resident flow + permissions, not guard changes.

## Unknown / Needs verification (open questions)

- **Q-V8** Device QA not run (full speak→create flow, permission prompts, no-audio-written verification on real iOS + Android).
- **Q-V2** Locale provisional `es-MX`; confirm `es-HN`/`es-419`/device default + offline-language-pack behavior on device.
- **Q-V3** On-device vs OS recognizer provisional; decide if on-device-only is required.
- **Q-V7** Final visual placement of the Voice trigger.
- **Q-V4** Whether to ship VISIT-only first (pending product OK).

## Risks

- A native module that has never run on a device may behave differently than in code review (permissions, recognizer availability, OTA insufficiency — a new native build is REQUIRED; Expo Go/OTA will report voice unavailable → manual fallback).
- Locale/recognizer choices could affect recognition quality in Honduras Spanish.

## Next actions

- Run **ENTRY-I001-QA** on a native dev/EAS build using the harness QA checklist (`VOICE_MVP_HANDOFF.md` §7); resolve Q-V2/Q-V3, then finalize Q-V7. Clean rollback is documented (handoff §9; no DB rollback needed). Only after Voice QA passes, resume ENTRY-D002 (Facility Destinations). See [entry-next-missions.md](entry-next-missions.md).
