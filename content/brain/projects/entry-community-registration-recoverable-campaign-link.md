# ENTRY Community Registration Recoverable Campaign Link

## Mission

- **Mission:** `ENTRY-ONB-009`
- **Branch:** `codex/entry-onb-009-recoverable-campaign-link`
- **Status:** implementation, PostgreSQL 17 gate, hosted-dev apply and Preview runtime walkthrough passed; final CI/merge gate pending.
- **Goal:** allow superadmins to copy or open the current active open-campaign registration link repeatedly without rotating it.

## Security Model

Campaign access continues to validate with `token_hash`. ONB-009 adds nullable application-layer encrypted recovery material on `community_registration_access_tokens` for `campaign_access` rows only. The plaintext capability is generated in the authenticated server action, hashed, encrypted with AES-256-GCM, and sent to Supabase as `token_hash` plus `encrypted_token_payload` in the same RPC write.

Recovery is superadmin-gated. It scopes by community and campaign, requires campaign `status = open`, requires exactly one active `campaign_access`, rejects consumed/revoked/expired states, decrypts only server-side, recomputes SHA-256, and timing-safe compares it with the stored hash before returning the official registration URL.

Plaintext campaign capabilities are not stored in Supabase, cookies, localStorage, sessionStorage, Brain, logs, or analytics.

## Campaign Links vs Correction Links

General campaign registration links are intentionally reusable while the campaign is open because operators may need to share the same valid link repeatedly through WhatsApp, email, patronato groups, or field support.

Resident correction links remain intentionally non-recoverable household-scoped capabilities. ONB-009 does not change their storage, creation, rotation, consumption, or UI.

## Legacy Behavior

Existing `campaign_access` rows with only `token_hash` are unrecoverable. An open legacy campaign shows an honest replace-to-upgrade state. Replacing once revokes the legacy active access and creates a new ONB-009-format active access row with encrypted recovery material.

## SQL Design

Canonical hosted-dev migration:

`supabase/migrations/20260818034216_entry_onb_009_recoverable_campaign_links.sql`

Supabase recorded:

`20260818034216_entry_onb_009_recoverable_campaign_links`

Design:

- nullable `encrypted_token_payload text` scoped to campaign-level `campaign_access` rows;
- legacy NULL rows remain valid;
- `launch_community_registration_campaign_v2(...)` writes hash + encrypted payload atomically;
- `rotate_community_registration_campaign_access_v2(...)` revokes prior active access and inserts the replacement atomically;
- v1 RPCs remain for compatibility;
- public, anon and authenticated execution revoked; `service_role` only.

## Runtime Contract

Required server-only variable:

`ENTRY_CR_CAMPAIGN_LINK_ENCRYPTION_KEY`

The decoded key must be exactly 32 bytes. Preview and Production are configured with the same stable value. The secret itself is not recorded in Brain or the repository and must not be rotated casually because existing recoverable campaign links depend on it.

## Validation Evidence

Focused validator:

`node scripts/entry-onb-009-validate-recoverable-campaign-link.mjs`

Local/static gates passed:

- crypto round trip;
- random IV / distinct ciphertext;
- tamper failure;
- missing/invalid key fail-closed;
- no plaintext persistence/logging patterns;
- atomic launch/replacement SQL assertions;
- service-role-only grants;
- Copy/Open do not call rotation;
- legacy replace-to-upgrade behavior;
- review/closed campaign hides sharing controls;
- resident correction-link behavior untouched;
- targeted ESLint, TypeScript/build and `git diff --check` passed.

Known unrelated CI debt remains limited to the existing full-lint React hook failures and Brain relation `DEC-0007 -> ENTRY-ONB-000`.

## PostgreSQL 17 Hosted-Dev Gate

Target: `gate-project-dev` (`ytzvislhvrcdtkbtpbmu`). `seshat` was not touched.

The exact migration was first applied inside `BEGIN` / `ROLLBACK`. Tests covered v2 launch, atomic encrypted payload persistence, v2 rotation, exactly one active campaign token after rotation, authenticated caller rejection and grants. Rollback proof confirmed temporary DDL/data disappeared.

The migration was then permanently applied to `gate-project-dev` only. A second transactional functional test against the installed migration passed and rolled back its test data while leaving the migration installed.

## Preview Runtime Walkthrough

Preview deployment for PR #43 was redeployed after configuring the encryption key and reached READY.

A dedicated open campaign was launched on the existing test community `Cimuty monopy` with one participating test unit. Runtime evidence:

1. Launch created exactly one active `campaign_access` with a 64-character hash and an encrypted `v1` payload.
2. After closing the immediate-success modal and fully reloading Console, `Copy registration link`, `Open registration`, and `Replace registration link` remained available.
3. `Copy registration link` returned `Copied`; database state remained exactly one active token, zero revoked tokens and zero replacement events.
4. `Open registration` opened the public registration flow successfully and still did not rotate or consume campaign access.
5. `Replace registration link` created a distinct token hash, revoked the previous token, left exactly one active token and emitted exactly one `campaign_access_replaced` event.
6. Direct resolver verification proved the old token returns unavailable while the new token returns available.

The browser can make two tabs appear to share the same clean campaign URL because the access route strips the token from the URL and stores a campaign-scoped signed cookie. Tabs in the same browser share that cookie. This does not mean both capability tokens remain active; database and resolver verification confirmed the old capability is revoked.

No plaintext capability or encryption key is recorded here.

## Non-Scope / Safety

- ENTRY mobile untouched.
- Resident correction-link policy untouched.
- Patronato confirmation UI untouched.
- Conversion and `resident_activation_queue` untouched.
- Upstash/rate-limit policy untouched.
- `seshat` untouched.

## Final Gate

ONB-009 runtime behavior is passed. Remaining work is repository closeout, final head CI/Vercel verification, then squash merge when authorized.
