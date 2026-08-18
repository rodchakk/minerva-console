# ENTRY Community Registration Recoverable Campaign Link

## Mission

- **Mission:** `ENTRY-ONB-009`
- **Branch:** `codex/entry-onb-009-recoverable-campaign-link`
- **Status:** local/static gates passed; hosted dev permanent apply and Preview runtime gates pending.
- **Goal:** allow superadmins to copy or open the current active open-campaign registration link without rotating it.

## Security Model

Campaign access continues to validate with `token_hash`. ONB-009 adds nullable
application-layer encrypted recovery material on
`community_registration_access_tokens` for `campaign_access` rows only. The
plaintext capability is generated in the authenticated server action, hashed,
encrypted with AES-256-GCM, and sent to Supabase as `token_hash` plus
`encrypted_token_payload` in the same RPC write.

Recovery is a superadmin-gated server action. It scopes by community and
campaign, requires campaign `status = open`, requires exactly one active
`campaign_access`, rejects consumed/revoked/expired states, requires encrypted
payload material, decrypts server-side, recomputes SHA-256, and uses
timing-safe comparison against the stored hash before returning the official
`/entry/register/<slug>/access?token=...` URL.

The plaintext campaign capability is not stored in Supabase, cookies,
localStorage, sessionStorage, Brain, logs, or analytics.

## Campaign Links vs Correction Links

The general campaign registration link is intentionally reusable while a
campaign is open. Operators may need to share the same valid link repeatedly
through WhatsApp, email, patronato groups, or field support channels, so
recovery avoids unnecessary revocation.

Resident correction links remain intentionally non-recoverable. They are
household-scoped repair capabilities with one-time plaintext display and
explicit Replace correction link behavior from ONB-008. ONB-009 does not change
resident correction-link storage, encryption policy, creation, rotation,
consumption, or UI.

## Legacy Behavior

Existing `campaign_access` rows with only `token_hash` are mathematically
unrecoverable. For an open legacy campaign, the Console shows:

`Current registration link cannot be recovered. Replace the registration link once to enable future re-sharing.`

Replacing the link revokes the previous active campaign access and creates a
new ONB-009-format active access row with encrypted recovery material.

## SQL Design

Migration:

`supabase/migrations/20260818010000_entry_onb_009_recoverable_campaign_links.sql`

Design:

- Adds nullable `encrypted_token_payload text`.
- Constrains any non-null payload to `campaign_access` rows scoped at campaign level.
- Keeps legacy null rows valid.
- Adds `launch_community_registration_campaign_v2(...)`.
- Adds `rotate_community_registration_campaign_access_v2(...)`.
- Retains v1 RPCs for compatibility.
- Revokes public, anon, and authenticated execution; grants only `service_role`.
- Keeps replacement transactional and preserves the one-active-campaign-access invariant.

## Runtime Contract

Required server-only variable:

`ENTRY_CR_CAMPAIGN_LINK_ENCRYPTION_KEY`

Generate with:

`openssl rand -base64 32`

The decoded key must be exactly 32 bytes. Preview and Production need the same
stable value, otherwise a link encrypted in one runtime may not be recoverable
in another. No Production secrets were changed by this mission.

## Validation Evidence

Local focused validator:

`node scripts/entry-onb-009-validate-recoverable-campaign-link.mjs`

Current result: passed.

Covered:

- encrypt/decrypt round trip;
- different ciphertext for repeated plaintext encryption;
- tamper failure;
- invalid/missing key failure;
- no plaintext persistence/logging patterns;
- atomic SQL hash plus encrypted-payload insertion for launch and replacement;
- exactly-one active campaign access check;
- legacy null payload support;
- service-role-only grants;
- Copy/Open recover without rotation;
- review/closed campaign hiding of re-share controls;
- correction-link behavior untouched.

Pending external gates:

- PostgreSQL 17 functional validation on `gate-project-dev`;
- permanent dev apply only if explicitly authorized;
- Preview and Production env variable configuration;
- Preview runtime walkthrough after deployment.

Additional validation run during implementation:

- `git diff --check`: passed.
- Targeted ESLint for ONB-009 admin files: passed.
- Production build: passed with
  `node --use-system-ca node_modules\next\dist\bin\next build --webpack`; the
  build TypeScript phase passed.
- Full lint: failed only on known unrelated React hook rule debt in
  `app/activate/page.tsx`, `app/reset-password/page.tsx`,
  `features/entry/communities/CommunityUnitQuickActions.tsx`, and
  `features/entry/users/CommunityUsersClient.tsx`.
- Brain relation/guardrails: failed only on the pre-existing broken relation
  `DEC-0007 -> ENTRY-ONB-000` after loop state was refreshed.
- Hosted dev read-only inspection confirmed ONB-009 is not applied on
  `gate-project-dev`: no `encrypted_token_payload` column and no v2 campaign
  link RPCs.
- Hosted dev rollback gate applied the ONB-009 migration inside `BEGIN` /
  `ROLLBACK` and confirmed the v2 functions were visible in-transaction. A
  follow-up read-only proof showed both the encrypted column and v2 functions
  absent after rollback.

Not completed:

- Permanent Supabase dev apply was not performed because explicit authorization
  for persistent remote mutation was not present.
- Preview/Production environment variables were not changed.
