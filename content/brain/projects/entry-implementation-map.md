# ENTRY — Implementation Map

Current technical map of ENTRY, verified from the repo and the in-repo backend snapshot. Part of the ENTRY Knowledge Pack; see [entry.md](entry.md).

## Verified from code

### Stack
- Mobile: Expo SDK `~54.0.33`, React Native `0.81.5`, React `19.1.0`, expo-router `~6` (file-based routing, `typedRoutes` experiment), New Architecture enabled, `expo-dev-client` (custom native build via EAS, not Expo Go). TypeScript `~5.9` strict; path alias `@/*`. (`package.json`, `app.json`, `tsconfig.json`.)
- Backend: Supabase — Postgres 17, RLS on all tables, business logic in `SECURITY DEFINER` RPCs, Deno Edge Functions, Realtime channels, Storage bucket `entry-photos`.
- Package manager: npm (`package-lock.json`). No eslint/jest/prettier/metro/babel config at root; no `lint`/`test`/`typecheck`/`build` npm scripts (relies on Expo defaults; EAS for builds).

### Auth / session model
- Supabase Auth; session persisted via `expo-secure-store` (native) / `localStorage` (web) in `lib/supabase.ts` (`autoRefreshToken`, `persistSession`, `detectSessionInUrl:false`).
- `providers/AuthProvider.tsx` hydrates session, calls RPC `resolve_my_app_access` → `access_state` (`ACTIVE | DISABLED | NO_MEMBERSHIP | BLOCKED`); protected screens render only when `ACTIVE`. Derives `role` + `roleHome`; runs a realtime "access hardening" channel that revalidates on profile/membership/house changes.
- Synthetic `@entry.local` emails + username login exist (edge functions) for residents onboarded without a real email.
- Client uses only `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY`; anon key is a publishable `sb_publishable_...` key (public by design). No service-role key or private secret committed; env injected via `eas.json` / EAS dashboard.

### Edge Functions (Deno) — `supabase/functions/`
`activate-account-by-code`, `admin-generate-recovery-code`, `claim-resident-invite`, `confirm-email-link`, `create-username-resident`, `login-with-username`, `regenerate-username-activation-code`, `request-email-link`, `send-push-event`, `validate-activation-code`, plus `_shared/edgeRateLimit.ts`. (11 functions + shared.)

### Access creation (resident) — the "standard entry"
A standard entry is a row in `visit_passes` (or `visit_groups` for multi-visitor, `authorized_frequent_visitors` for recurring staff). Resident screens (`app/(tabs)/resident/`):
- `create-visit.tsx` → RPC `create_pass_v2` (type `VISIT`); multiple → `create_visit_group_v2`.
- `create-delivery.tsx` → `create_pass_v2` (type `DELIVERY`).
- `create-event.tsx` → group/event pass.
- `create-frequent-access.tsx` → `authorized_frequent_visitors`.
- self access → `create_self_access_pass`.
- `create-voice.tsx` → `create_pass_v2` with `p_expiration_mode:"12H"`, `p_note:"[Voz] …"` (see [entry-voice-mvp.md](entry-voice-mvp.md)).

### Guard validation (gate) — pull model
Guard dashboard has no pushed list of authorized entries. Guard scans a QR (`guard-scanner.tsx`) or types a PIN, calls RPC `resolve_access_credential_v2(p_code, p_method)` → `allowed_action` (`CHECK_IN | CHECK_OUT | EVENT_ACCESS | SELF_ACCESS_ACTION | NONE`), captures evidence photos (Storage `entry-photos`), then a check-in RPC (`check_in_pass`, `check_in_frequent_access`, `check_in_visit_group_member_with_evidence`, `check_in_manual_entry`). `entry_logs` is an immutable audit log. Manual entries → `manual_entries`. (RPC bodies in `rpc_resolve_access_credential_v2.sql`, `supabase/migrations/`.)

## Verified from repo backend snapshot (`.minerva-harness/backend-snapshot/`, originally `[db]`)

### Core access tables
`communities`, `houses`, `house_residents`, `community_members` (user↔community↔role↔is_active — the access-control table), `profiles`, `visit_passes` (the standard single entry), `visit_groups`/`visit_group_members`, `authorized_frequent_visitors`, `manual_entries`, `entry_logs` (immutable), `resident_favorites`, `community_facilities` (reservable amenities), `facility_reservations`, `community_settings`, `security_event_log`, `emergency_alerts`.

### Key structural facts
- `visit_passes.house_id` is **NOT NULL** — every standard entry is tied to a house (structural blocker for "facility as destination").
- `visit_passes.expires_at` is **NOT NULL**; `status` default `ACTIVE`; `pass_type` is an enum.
- No `created_method` / `voice_transcript` / `created_via` column anywhere; `visit_passes` has no metadata/JSON column (so Voice transcript goes in `note` with a `[Voz]` prefix).
- `create_pass_v2`: server-side rate limit **20 passes/hour/resident** (`check_rpc_rate_limit`, errcode `55000`), plus `assert_no_pin_pending()`; default `p_expiration_mode='12H'`; derives `house_id` from the resident's primary house.
- `community_facilities` + `facility_reservations` are an **amenity reservation** system (slots, pricing, approval), fully decoupled from `visit_passes` — there is no link between them today.
- `entry_logs` has a `metadata jsonb` column; `visit_passes` does not.

### Migrations
`supabase/migrations/` exists with 7 migration files; `supabase/functions/`, `supabase/tests/` present. Many RPC bodies (e.g. `create_pass_v2`, facility RPCs) exist only in the live DB and are NOT mirrored as in-repo migrations (harness Q-B1).

## Operator-provided

- ENTRY maintains its own Supabase project, separate from Brain (consistent with the verified `gate-project-dev` ref).

## Inferred

- Because guard is pull-based and access/facilities are decoupled, voice-created passes need no guard or backend change, but "facility as destination" is a cross-subsystem schema change (not a config tweak). (Harness `03`/`04`.)

## Unknown / Needs verification

- Authoritative source of truth for un-mirrored RPCs (out-of-band migration history vs. manual DB management) — harness Q-B1.
- `community_access_policies` table exists with 0 rows; intended purpose unconfirmed — harness Q-B2.
- Exact bodies of RPCs not present in-repo (only `resolve_access_credential_v2` and a `get_resident_live_activity` patch are in root SQL files).

## Risks

- Schema changes are risky while RPC/migration history is partly out-of-band (Q-B1) — any destination/voice-column work must reconcile this first.
- No automated lint/test in the repo; only `tsc --noEmit` (one known pre-existing error, harness Q-B5) and EAS builds gate quality.

## Next actions

- Resolve Q-B1 (migration source of truth) before any schema mission.
- Consider adding a minimal `typecheck` script + eslint baseline (harness Q-B3/Q-B7) — ENTRY-side mission, not Brain.
