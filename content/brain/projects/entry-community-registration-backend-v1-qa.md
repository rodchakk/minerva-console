# ENTRY Community Registration Backend v1 QA

**Mission:** `ENTRY-ONB-002-QA`
**Date:** 2026-08-05
**Worktree:** `D:\Dev\minerva-console\.worktrees\entry-onb-002`
**Branch:** `codex/entry-onb-002-backend-core`
**Base:** `ff1ccd67dcc11e32f9b5fc753419e8e3307ff1d1`
**Verdict:** `READY TO COMMIT ENTRY-ONB-002`

## 1. Verdict

`READY TO COMMIT ENTRY-ONB-002`.

The backend passed structural QA after limited hardening. The hosted-dev apply blocker is resolved; catalog, grant, RLS, runtime, and negative concurrency validation remain pending.

## 2. Files Inspected

- `content/brain/projects/entry-community-registration-index.md`
- `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`
- `content/brain/projects/entry-community-registration-foundation-contract.md`
- `content/brain/projects/entry-community-registration-schema-v1.md`
- `content/brain/projects/entry-community-registration-schema-v1-qa.md`
- `content/brain/projects/entry-community-registration-backend-v1.md`
- `supabase/migrations/20260806232141_create_entry_community_registration_schema_v1.sql`
- `supabase/migrations/20260806233000_create_entry_community_registration_backend_v1.sql`
- `scripts/entry-onb-001-validate-schema.mjs`
- `scripts/entry-onb-002-validate-backend.mjs`

## 3. Function Inventory

| Function | Type | SECURITY DEFINER | search_path | EXECUTE role | Actor expected |
| --- | --- | ---: | --- | --- | --- |
| `create_community_registration_campaign_v1(uuid, text, text, text, text, integer, timestamptz, timestamptz, text, uuid)` | internal mutating | yes | `public` | `service_role` | server-resolved ENTRY actor |
| `add_community_registration_units_v1(uuid, uuid[], jsonb, uuid)` | internal mutating | yes | `public` | `service_role` | server-resolved ENTRY actor |
| `resolve_community_registration_campaign_v1(text, text)` | public-backend read | yes | `public` | `service_role` | campaign token |
| `lookup_community_registration_unit_v1(text, text, text)` | public-backend read | yes | `public` | `service_role` | campaign token |
| `submit_community_registration_household_v1(text, text, text, jsonb, jsonb)` | public-backend mutating | yes | `public` | `service_role` | campaign token |
| `enable_community_registration_edit_v1(uuid, text, timestamptz, uuid, text)` | internal mutating | yes | `public` | `service_role` | server-resolved ENTRY actor |
| `resolve_community_registration_edit_v1(text)` | public-backend read | yes | `public` | `service_role` | resident edit token |
| `resubmit_community_registration_household_v1(text, jsonb)` | public-backend mutating | yes | `public` | `service_role` | resident edit token |
| `reset_community_registration_unit_v1(uuid, uuid, text)` | internal mutating | yes | `public` | `service_role` | server-resolved ENTRY actor |
| `get_community_registration_unit_state_v1(uuid)` | internal read | yes | `public` | `service_role` | backend-only |

All helpers are non-`SECURITY DEFINER`, fix `search_path`, and revoke execution from `PUBLIC`, `anon`, and `authenticated`.

## 4. Problems Found

| Severity | Problem | Status |
| --- | --- | --- |
| High | `enable_community_registration_edit_v1` and `reset_community_registration_unit_v1` locked unit before campaign, conflicting with the documented lock order. | Corrected. |
| High | `reset_community_registration_unit_v1` could reset `processed` or inconsistent units with no active submission. | Corrected. |
| Medium | Edit enable/resolve did not re-check campaign availability. | Corrected. |
| Medium | Future public submit/resubmit/edit responses exposed unnecessary internal IDs. | Corrected. |
| Medium | Resident JSON parsing accepted unexpected fields and lacked reasonable length/type hardening. | Corrected. |
| Medium | Unit override parsing could throw a raw cast error for malformed JSON values. | Corrected. |
| Low | Internal actor IDs were only constrained by write-time FKs, not explicitly validated before audit writes. | Corrected. |
| Low | Internal state returned unbounded submission history. | Corrected with a 25-version bound. |
| Low | Static validator coverage was too pattern-fragile. | Corrected with structural function extraction. |

## 5. Compatibility With Schema

The backend uses only schema v1 tables, columns, token types, token statuses, campaign statuses, unit statuses, and submission statuses. Backend v1 widens `cr_events_type_check` forward-only to include the mission-required event names while preserving the v1 event names for compatibility.

No schema v1 migration change was made.

## 6. SECURITY DEFINER

All ten public/internal RPCs are `SECURITY DEFINER`, set `search_path` to `public`, and call `_cr_service_role_only_v1()`. There is no dynamic SQL or identifier concatenation. Object references are schema-qualified where cross-object access matters.

Risk retained: actual function owner is determined at apply time. If owned by a highly privileged role, the blast radius depends on grants and function body safety. This migration narrows execution to `service_role`, but ownership must be inspected in the pre-apply catalog gate.

## 7. Grants

Every RPC revokes execution from `PUBLIC`, `anon`, and `authenticated`, and grants only to `service_role` with full signatures. Helpers are revoked from public roles and receive no direct service-role grant. Tables remain on the schema v1 deny-by-default path with no new public table policies.

Granting future public-flow RPCs only to `service_role` is coherent with the planned Route Handler / Server Action architecture because anonymous residents should never call the database RPCs directly.

## 8. Authorization

Authentication of the call is `service_role`. Audit actor is a separate server-resolved UUID. Internal mutating functions now validate actor existence when provided. This does not prove the actor is the correct admin; the future server-side layer must derive that identity from the authenticated operator session and must not forward any public client-supplied actor.

## 9. Multi-Tenant Isolation

Campaigns are scoped by `community_id`. Unit association rejects houses from other communities. Submission, resident, token, and event writes use campaign/unit/submission composite scope. Internal state reads by unit ID and derives campaign/community scope from that unit.

## 10. Payload JSON

Resident payloads must be arrays of objects. Empty arrays, `null` entries, unexpected fields, invalid positions, duplicate positions, over-limit arrays, invalid relationship values, incoherent owner references, overlong strings, malformed emails, malformed phones, and exact duplicate residents are rejected with `ENTRY_CR_INVALID_RESIDENT` or `ENTRY_CR_LIMIT_EXCEEDED`.

## 11. Limits

The SQL authority is `coalesce(unit.resident_limit_override, campaign.default_resident_limit)`. Schema v1 guarantees both values are positive when present. Default three rejects four residents; override four allows four.

## 12. Tokens

Tokens are hash-only. Campaign token hashes authorize campaign resolution, lookup, and first submit. Resident edit hashes authorize edit resolution and resubmit. Resubmit locks and consumes the token once. Prior active edit tokens are revoked before creating a new edit token. No response includes token hashes.

## 13. Versioning

First submit uses historical `max(version_number) + 1`, so the first version is `1` and post-reset submissions continue at the next version. Resubmit creates a new `submitted` version, links `previous_submission_id`, and marks the old version `superseded`. Previous residents remain intact.

## 14. Reset

Reset is internal only. It locks campaign then unit then current submission, invalidates the active submission, revokes active unit tokens, clears incompatible unit timestamps, and returns the unit to `unregistered`. `processed` and other unsupported states are rejected. Already-unregistered units are idempotent no-ops.

## 15. Locks

| Function | Campaign | Unit | Submission | Token |
| --- | ---: | ---: | ---: | ---: |
| `create_community_registration_campaign_v1` | inserts | n/a | n/a | inserts |
| `add_community_registration_units_v1` | `FOR UPDATE` | existing row `FOR UPDATE` | n/a | n/a |
| `submit_community_registration_household_v1` | `FOR UPDATE` | `FOR UPDATE` | inserts | `FOR UPDATE` |
| `enable_community_registration_edit_v1` | `FOR UPDATE` | `FOR UPDATE` | `FOR UPDATE` | update/insert after submission |
| `resubmit_community_registration_household_v1` | `FOR UPDATE` | `FOR UPDATE` | `FOR UPDATE` | `FOR UPDATE` |
| `reset_community_registration_unit_v1` | `FOR UPDATE` | `FOR UPDATE` | `FOR UPDATE` | update after submission |

Token-driven resubmit reads token scope first without a lock, then resumes the canonical order and revalidates the token under lock. No obvious deadlock remains in the reviewed paths.

## 16. States

Campaign creation creates `open`. Public submit/resubmit/edit require `open` and valid dates. Unit transitions are `unregistered -> submitted`, `submitted/needs_correction/reviewed -> edit_enabled`, `edit_enabled -> submitted`, and reset to `unregistered`. Submission transitions are new `submitted`, old `superseded`, and reset `invalidated`.

The backend does not create `converted` submissions or `processed` units.

## 17. Errors

Stable non-PII codes include `ENTRY_CR_UNAUTHORIZED`, `ENTRY_CR_INVALID_ACTOR`, `ENTRY_CR_INVALID_TENANT`, `ENTRY_CR_INVALID_CAMPAIGN`, `ENTRY_CR_CAMPAIGN_UNAVAILABLE`, `ENTRY_CR_UNIT_UNAVAILABLE`, `ENTRY_CR_INVALID_UNIT`, `ENTRY_CR_INVALID_TOKEN`, `ENTRY_CR_TOKEN_EXPIRED`, `ENTRY_CR_INVALID_LIMIT`, `ENTRY_CR_LIMIT_EXCEEDED`, `ENTRY_CR_INVALID_RESIDENT`, `ENTRY_CR_INVALID_METADATA`, `ENTRY_CR_CONFLICT`, and `ENTRY_CR_INVALID_STATE`.

Future UI mapping should keep public messages neutral for campaign, token, unit, and state failures.

## 18. Events

Required events are present and schema-allowed: `campaign_created`, `units_added`, `household_submitted`, `resident_edit_enabled`, `resident_edit_token_revoked`, `household_resubmitted`, and `registration_reset`. Metadata stores counts, versions, status transitions, reasons, and IDs, but no names, emails, phones, token values, token hashes, or full resident payloads.

## 19. Idempotency

Campaign creation is conflict-safe, not idempotent. Unit association is idempotent per row for existing houses and all-or-nothing for invalid batches. Submit is conflict-safe through unit lock and active-submission uniqueness. Enable edit is retry-safe but creates a new token hash per successful call. Resubmit is single-use token safe. Reset is idempotent only when already unregistered.

Strong request idempotency would require a future server-side `idempotency_key`; it was not added in this QA mission.

## 20. Tests

Executed:

- `git status --short`
- `git diff --stat`
- `git diff --check`
- `git diff --no-index -- NUL ...` for the migration, validator, and technical document
- `node --check scripts/entry-onb-002-validate-backend.mjs`
- `node scripts/entry-onb-001-validate-schema.mjs`
- `node scripts/entry-onb-002-validate-backend.mjs`
- tool availability checks for `psql`, Supabase CLI, Docker, Python, PostgreSQL binaries, and parser/PGlite packages

## 21. Limitations

SQL was later applied to hosted dev during ENTRY-ONB-005. Runtime behavior, concurrency, RLS, grants, catalog ownership, and negative data tests still require hosted-dev validation.

## 22. PostgreSQL Gate

Hosted-dev apply is resolved. Do not approve runtime until hosted-dev catalog validation and negative tests pass.

## 23. Readiness

All commit-readiness criteria are satisfied for structural QA, with the explicit pre-apply gate retained.
