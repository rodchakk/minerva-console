# ENTRY — Current Work

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

## Production-readiness update — 2026-09-07

**Operator-provided / verified during Minerva Console release work.**

- Minerva Console PR **#149** (`Clean ENTRY setup queue and Minerva Console link branding`) is **already merged** into `master` at merge commit `a412e2c474fec39e7e48878dd5d0ca483de16a1e`.
- The PR removes completed communities from `Setup priorities across ENTRY`, removes the old default Vercel favicon, and adds explicit Minerva/ENTRY social-preview metadata for both **ENTRY Outrider** public links and **ENTRY Campaign Registration** links used by residents to register in their units.
- The remaining blocker is **not another merge**. The production Vercel deployment for the merge commit was rejected by Vercel with `build-rate-limit` / **"Deployment rate limited — retry in 24 hours."** The code is in `master`, but production has not yet received this branding change.
- **Do not close this readiness item until production deploy succeeds.** After deployment, generate two fresh URLs (to avoid WhatsApp preview cache):
  1. a new ENTRY Outrider link;
  2. a new ENTRY Campaign Registration link.
- Send both fresh URLs through WhatsApp and verify that the preview uses **Minerva/ENTRY branding** rather than the Vercel triangle/icon.
- Existing previously-shared URLs/messages may continue to show cached Vercel previews and are not sufficient validation of the fix.

### Pending release task

**Retry/confirm Vercel production deployment of `master` after the build-rate-limit window clears, then complete the two fresh-link WhatsApp preview checks above.**
