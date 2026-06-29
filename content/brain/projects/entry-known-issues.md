# ENTRY — Known Issues

Bugs, baselines, and technical debt. Part of the ENTRY Knowledge Pack; see [entry.md](entry.md). No fixes were applied — this is knowledge capture only.

## Operator-provided

### BUG — "Olvidé mi contraseña" (Forgot my password) does not work
Reported by the operator as broken and needing a fix. This is the priority bug.

- **What exists in code (Verified from code):** the flow is implemented. `app/(auth)/forgot-password.tsx` collects an email and calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`, where `redirectTo` is `entry://reset-password` on native or `${window.location.origin}/reset-password` on web. `app/reset-password.tsx` handles the recovery link: it reads a `code` param, validates the recovery link (`recoveryCheckReady` / `recoveryReady` from `AuthProvider`, a `RECOVERY_LINK_GRACE_MS = 2500` grace window, and a `LINK_INVALID_MESSAGE`), then lets the user set a new password (min length 8).
- So the screens are present and call the right Supabase APIs — the failure is **not** "the button does nothing in code."

### Other operator-known bug (from repo `BUGFIXES.md`)
- 2026-04-21: Guard SOS acknowledge ("Voy en camino") from `app/(tabs)/guard/index.tsx` failed because it queried `profiles.expo_push_token`. **Status (repo note):** fixed in working tree by routing the resident acknowledgement push through the current `user_push_tokens` delivery path. (Verify it is committed/merged.)

## Inferred (candidate root causes for the password bug — NOT verified)

Static code is implemented, so the likely failure is in configuration or deep-link delivery, not the screen logic. Candidates to test, in rough priority:

1. **Deep link / redirect handling** — `entry://reset-password` may not be registered/handled so the recovery email link never reopens the app at `reset-password` (or the `code` param is not delivered to `useLocalSearchParams`).
2. **Supabase redirect allowlist** — `redirectTo` URLs must be in the Supabase Auth "Redirect URLs" allowlist; if `entry://reset-password` / the web origin is not allowed, Supabase drops the redirect.
3. **Email template / SMTP** — recovery emails may not be sent (default Supabase SMTP limits) or the template link may not carry the expected `code`/token format the screen reads.
4. **Synthetic `@entry.local` accounts** — residents onboarded with synthetic emails / username login have no real inbox, so email-based reset cannot work for them by design; they may need the admin recovery-code path (`admin-generate-recovery-code` / `recovery-access`) instead.

## Verified from repo (baseline / debt)

- **Pre-existing TypeScript baseline error (harness Q-B5):** `components/ExternalLink.tsx(13,7): TS2578: Unused '@ts-expect-error' directive`. Trivial (delete the directive); left unfixed to keep missions in scope. Any *new* tsc error is from new work, not this.
- **No lint/test tooling** (no eslint/jest/config; no `lint`/`test`/`typecheck`/`build` npm scripts) — only `tsc --noEmit` and EAS builds gate quality (Q-B3/Q-B7).
- **Install quirk (D-012 / Q-B6):** `npm install` requires `NODE_OPTIONS=--use-system-ca` due to a TLS-intercepting proxy; do **not** use `strict-ssl=false`.
- **Un-mirrored RPCs (Q-B1):** several RPC bodies exist only in the live DB, not in `supabase/migrations/` — a debt/risk for safe schema change.

## Unknown / Needs verification

- The actual reproduction and root cause of the "Forgot password" failure (which candidate above, if any).
- Whether the SOS acknowledge fix from `BUGFIXES.md` is committed and merged to `main`.
- Whether password reset is expected to work for synthetic-email residents at all (product decision).

## Risks

- Password reset is a core trust path; if broken for real-email users it blocks account recovery and erodes confidence.
- Fixing it may touch deep-link config and Supabase Auth settings (outside the app code), which need careful, reversible changes.

## Next actions

- Open an ENTRY mission to reproduce and fix "Forgot my password": verify deep-link registration, Supabase redirect allowlist, and email delivery; confirm behavior for synthetic-email accounts. See [entry-next-missions.md](entry-next-missions.md).
