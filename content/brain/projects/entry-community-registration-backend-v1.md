# ENTRY Community Registration Backend v1

**Mission:** `ENTRY-ONB-002`
**Date:** 2026-08-05
**Branch/worktree:** `codex/entry-onb-002-backend-core` at `.worktrees/entry-onb-002`
**Base:** `ff1ccd67dcc11e32f9b5fc753419e8e3307ff1d1` (`ff1ccd6`)
**Migration:** `supabase/migrations/20260806233000_create_entry_community_registration_backend_v1.sql`
**Status:** applied to hosted dev; runtime validated under `ENTRY-ONB-005`.

## 1. Summary

`ENTRY-ONB-002` adds the transactional backend core for the initial Community Registration household cycle. The implementation is database-only: no UI, no route handlers, no seed data, no ENTRY mobile change, and no conversion to `resident_activation_queue`.

Transport closeout reconciled the migration filename to the hosted-dev canonical timestamp `20260806233000` after successful individual apply. SQL content was preserved byte-for-byte. Runtime validation passed under `ENTRY-ONB-005`.

The backend keeps public registration access behind future server-side callers. All RPCs are `SECURITY DEFINER`, set `search_path`, assert `auth.role() = 'service_role'`, revoke execution from `PUBLIC`, `anon`, and `authenticated`, and grant only to `service_role`.

`ENTRY-ONB-002-QA` hardened the first backend cut by aligning mutating lock order, validating internal actor IDs when supplied, tightening resident JSON parsing, checking campaign availability before edit operations, preventing reset of processed/inconsistent units, removing unnecessary internal IDs from future public responses, and bounding internal state history.

## 2. Baseline

- Official base branch: `codex/entry-onb-001-schema`.
- Official base commit: `ff1ccd67dcc11e32f9b5fc753419e8e3307ff1d1`.
- Worktree used: `D:\Dev\minerva-console\.worktrees\entry-onb-002`.
- Initial working tree: clean in the isolated worktree.
- Preflight: Node/npm were available. `psql`, Supabase CLI, Docker, PGlite, and SQL parser packages were not found.

## 3. Operations Implemented

- `create_community_registration_campaign_v1`
- `add_community_registration_units_v1`
- `resolve_community_registration_campaign_v1`
- `lookup_community_registration_unit_v1`
- `submit_community_registration_household_v1`
- `enable_community_registration_edit_v1`
- `resolve_community_registration_edit_v1`
- `resubmit_community_registration_household_v1`
- `reset_community_registration_unit_v1`
- `get_community_registration_unit_state_v1`

Private helpers normalize slugs, unit labels, names, email, and phone, validate resident payloads, validate internal audit actors, enforce service-role execution, and raise stable contract codes.

## 4. Signatures

```sql
create_community_registration_campaign_v1(uuid, text, text, text, text, integer, timestamptz, timestamptz, text, uuid)
add_community_registration_units_v1(uuid, uuid[], jsonb, uuid)
resolve_community_registration_campaign_v1(text, text)
lookup_community_registration_unit_v1(text, text, text)
submit_community_registration_household_v1(text, text, text, jsonb, jsonb)
enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text)
resolve_community_registration_edit_v1(text)
resubmit_community_registration_household_v1(text, jsonb)
reset_community_registration_unit_v1(uuid, uuid, text)
get_community_registration_unit_state_v1(uuid)
```

## 5. Inputs And Outputs

Campaign creation receives tenant, internal/public names, public slug, default resident limit, optional dates, optional campaign access token hash, and internal actor. It returns IDs and non-sensitive campaign configuration.

Unit association receives a campaign, existing house IDs, optional per-house resident-limit overrides keyed by house ID, and actor. It returns per-row `inserted`, `existing`, or `updated` results.

Public-flow backend calls receive only slug/hash/label or edit-token hash plus resident JSON. Public campaign, unit, submit, resubmit, and edit-resolution responses avoid unnecessary internal IDs. Edit resolution returns PII only for the token-authorized household version.

Internal state returns unit status, current submission, version history, current residents, active token metadata without hashes, and recent events.

## 6. State Machine

Initial resident cycle:

```text
unregistered -> submitted -> edit_enabled -> submitted
```

Reset cycle:

```text
submitted -> registration_reset event -> unregistered
```

`registration_reset` is an event, not a persistent unit status. Resubmission creates a new submission version and marks the previous active version `superseded`.

## 7. Lock Strategy

Mutating RPCs use row locks inside the implicit transaction of each PostgreSQL function.

Recommended lock order:

```text
campaign -> campaign unit -> current submission -> token
```

Functions that receive only `campaign_unit_id` first read the campaign scope without a row lock, then acquire locks in canonical order. Resident resubmission first identifies the edit token without locking, then locks campaign, unit, prior submission, and token in that order, and revalidates the token while locked. This preserves single-token consumption while avoiding a reset/resubmit deadlock pattern.

## 8. Limit Validation

The effective resident limit is:

```text
coalesce(unit.resident_limit_override, campaign.default_resident_limit)
```

The resident validator requires a positive effective limit, at least one resident, and rejects payloads above the limit. It also rejects unexpected resident fields, non-object array entries, duplicate positions, out-of-range positions, overlong names/emails/phones, malformed email/phone values, invalid relationships, incoherent owner references, and exact duplicate resident entries.

## 9. Normalization

- Slugs are lowercased, trimmed, hyphen-normalized, and constrained to a non-empty URL-safe shape.
- Unit labels are lowercased and reduced to alphanumeric characters for exact matching.
- Names are trimmed and whitespace-collapsed.
- Email is lowercased and trimmed with a simple validity check.
- Phone keeps flexible local/international characters while requiring at least seven digits when provided.

## 10. Token Handling

The SQL never generates token values. Future server-side code generates the value, hashes it, and passes only the hash. Campaign access and resident edit RPCs compare hashes against `community_registration_access_tokens`.

Edit tokens are scoped to campaign, unit, and submission. Enabling edit revokes prior active edit tokens for the unit before creating a new one. Resubmission consumes the token while locked.

## 11. Neutral Public Responses

Public unit lookup returns the same neutral response for missing, already submitted, blocked, or unavailable units:

```text
No fue posible iniciar el registro para esa vivienda. Verifica el numero o comunicate con la administracion.
```

Campaign and submission availability failures return stable codes without PII. Rate limiting remains deferred to the future web layer.

## 12. Audit

State-changing RPCs write `community_registration_events` with minimal metadata:

- `campaign_created`
- `units_added`
- `household_submitted`
- `resident_edit_enabled`
- `resident_edit_token_revoked`
- `household_resubmitted`
- `registration_reset`

Metadata includes counts, versions, IDs, status transitions, actor, and reason where relevant. It does not copy resident lists or token hashes.

## 13. Grants

Every new RPC and helper revokes execution from `PUBLIC`, `anon`, and `authenticated`. The ten public/internal RPCs grant execution only to `service_role`. Direct table grants remain unchanged from the v1 deny-by-default posture.

## 14. Security

Each RPC validates tenant scope through campaign/community/unit/submission relationships. Unit association rejects cross-community houses. Public lookup does exact normalized matching and does not reveal why a unit cannot start. Internal state omits token hashes.

## 15. Contract Errors

Stable codes used by exceptions or JSON responses:

- `ENTRY_CR_UNAUTHORIZED`
- `ENTRY_CR_INVALID_ACTOR`
- `ENTRY_CR_INVALID_TENANT`
- `ENTRY_CR_INVALID_CAMPAIGN`
- `ENTRY_CR_CAMPAIGN_UNAVAILABLE`
- `ENTRY_CR_UNIT_UNAVAILABLE`
- `ENTRY_CR_INVALID_UNIT`
- `ENTRY_CR_INVALID_TOKEN`
- `ENTRY_CR_TOKEN_EXPIRED`
- `ENTRY_CR_INVALID_LIMIT`
- `ENTRY_CR_LIMIT_EXCEEDED`
- `ENTRY_CR_INVALID_RESIDENT`
- `ENTRY_CR_INVALID_METADATA`
- `ENTRY_CR_CONFLICT`
- `ENTRY_CR_INVALID_STATE`

Future UI can map public-facing errors to neutral resident messages and internal errors to operator guidance.

## 16. Tests

Executed locally:

- `node scripts/entry-onb-001-validate-schema.mjs`
- `node scripts/entry-onb-002-validate-backend.mjs`
- `git diff --check`
- Static grep checks embedded in the validators
- `ENTRY-ONB-002-QA` structural validator hardening checks for exact function inventory, grants, helper revocations, schema-v1 immutability, no active-table writes, no legacy references, no token-hash output, required events/errors, mutating locks, version preservation, token consumption, reset invalidation, public response minimization, and bounded internal history.

Not executed: PostgreSQL application, catalog inspection, role-policy runtime checks, or concurrency tests, because no disposable PostgreSQL/Supabase engine is available in this environment.

## 17. Limitations

- Hosted-dev migration apply and runtime validation are complete under `ENTRY-ONB-005`.
- No production rows, seed rows, or live Supabase changes were created.
- Public route rate limiting, CAPTCHA, QR, email/WhatsApp delivery, patronato review, internal review, conversion, and activation remain out of scope.
- Phone normalization is intentionally permissive for Honduran data and may need country-specific refinement later.

## 18. Pre-Apply Gate

Runtime approval is complete under `ENTRY-ONB-005`; the hosted harness covered
catalog-dependent behavior, service-role execution, invalid token/tenant paths,
limits, duplicate/resubmission behavior, reset/edit behavior, and closed-state
behavior as part of the full flow.

## 19. Deferred Decisions

- Exact public route and middleware allowlist.
- Token hash algorithm and storage format chosen by server-side code.
- Whether campaign creation should support a draft-only mode later.
- Patronato identity model.
- Conversion idempotency ledger shape for `resident_activation_queue`.

## 20. Next Mission Criteria

The next mission may begin after review confirms the RPC contract, static validator coverage, and no scope drift. UI or conversion work should wait until the PostgreSQL pre-apply gate has passed or is explicitly accepted as a separate risk.
