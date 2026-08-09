# ENTRY Community Registration Schema v1 QA

**Mission:** `ENTRY-ONB-001-QA`  
**Date:** 2026-08-05  
**Worktree:** `.worktrees/entry-onb-001`  
**Branch:** `codex/entry-onb-001-schema`  
**Verdict:** `CHANGES REQUIRED`

## 1. Verdict

`CHANGES REQUIRED`.

The schema is materially stronger after QA hardening, and no remaining structural contradiction was found in the reviewed design. The original QA pass did not execute or parse the migration by a PostgreSQL engine because that environment had no `psql`, Supabase CLI, Docker, Python, PGlite, or SQL parser package available. The migration has since been applied to hosted dev and runtime validated during `ENTRY-ONB-005`.

No live Supabase DDL or DML was executed.

## 2. Files Inspected

Mandatory context read:

- `content/brain/harness/ENTRY_COMMUNITY_ONBOARDING_ANALYSIS.md`
- `content/brain/projects/entry-community-onboarding-phase-0-reconciliation.md`
- `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`
- `content/brain/projects/entry-community-registration-foundation-contract.md`
- `content/brain/projects/entry-community-registration-schema-v1.md`
- `supabase/migrations/20260806232141_create_entry_community_registration_schema_v1.sql`
- `scripts/entry-onb-001-validate-schema.mjs`

Diff commands requested were executed. Because the three `ENTRY-ONB-001` artifacts are untracked in the isolated worktree, `git diff --stat` and `git diff --check` report no tracked diff. The new-file content was inspected directly and with `git diff --no-index`.

## 3. Problems Found

| Severity | Problem | Status |
| --- | --- | --- |
| High | Campaigns stored `access_token_hash` while token table also stored secrets, creating two sources of truth. | Corrected. |
| High | `community_registration_units.current_submission_id` created a circular pointer to submissions. | Corrected by derivation. |
| High | `superseded_by_submission_id` was a redundant reverse pointer that could desynchronize. | Corrected by removal. |
| High | Version-chain FK could point to another unit. | Corrected with composite same-unit FK. |
| High | Token scopes did not fully constrain valid reference combinations. | Corrected. |
| High | Several `ON DELETE CASCADE` paths could destroy submissions, residents, tokens, or events. | Corrected to `RESTRICT` where history matters. |
| Medium | Events could associate campaign, unit, submission, or token from inconsistent scopes. | Corrected with composite FKs. |
| Medium | Multiple operational campaigns per community were not blocked. | Corrected with partial unique index. |
| Medium | Public lookup by normalized label could be ambiguous inside one campaign. | Corrected with unique normalized-label index. |
| Medium | Token lifecycle timestamps were underconstrained. | Corrected for consumed, revoked, expired and creation/expiry order. |
| Low | Static validator did not cover the QA invariants. | Corrected. |

## 4. Corrections Applied

- Removed `community_registration_campaigns.access_token_hash`.
- Removed `community_registration_units.current_submission_id`.
- Removed submission `draft_token_hash`.
- Removed `superseded_by_submission_id`.
- Added same-unit FK for `previous_submission_id`.
- Added active campaign uniqueness per community for `open`, `paused`, `review`, `confirmed`.
- Added unique `(campaign_id, normalized_unit_label)`.
- Added token scope, lifecycle and active-token uniqueness constraints.
- Added composite event FKs for campaign/unit/submission/token scope integrity.
- Replaced destructive cascades with `RESTRICT` except nullable activation queue traceability, which remains `ON DELETE SET NULL (activation_queue_id)`.
- Updated design documentation and schema validator.
- Added this QA report.

## 5. Decisions Maintained

- DEC-0007 remains binding.
- Minerva Console owns Community Registration v1.
- ENTRY mobile is unchanged.
- Public capture stays in `community_registration_*` tables.
- No public submission inserts into `resident_activation_queue`.
- Future conversion ends at `resident_activation_queue`.
- No dependency was added to `resident_invites`, `account_activation_codes`, `activate-account-by-code`, or `claim-resident-invite`.
- RLS remains deny-by-default with no public policies.

## 6. Decisions Modified

- Secret source of truth changed to `community_registration_access_tokens` only.
- Current submission is derived from active submission status and `campaign_unit_id`; units no longer store a pointer.
- Version chain keeps only `previous_submission_id`, constrained to the same unit.
- Operational campaign concurrency is constrained to one active campaign per community.
- Hard deletes are restricted for registration history.

## 7. Foreign Key Validation

| Source | Target | Target key | Delete action | Update action | Reason |
| --- | --- | --- | --- | --- | --- |
| campaigns.`community_id` | communities.`id` | Live PK `communities(id)` documented in Phase 0/contract. | `RESTRICT` | default `NO ACTION` | Do not delete community history accidentally. |
| units.`(campaign_id, community_id)` | campaigns.`(id, community_id)` | Migration unique `cr_campaigns_id_community_unique`. | `RESTRICT` | default `NO ACTION` | Tenant-safe campaign membership. |
| units.`(house_id, community_id)` | houses.`(id, community_id)` | Migration adds unique support index `idx_cr_houses_id_community_id`; `houses.id` is live PK and `community_id` is live FK. | `RESTRICT` | default `NO ACTION` | Prevent cross-community house association. |
| submissions.`(campaign_unit_id, campaign_id, community_id, house_id)` | units.`(id, campaign_id, community_id, house_id)` | Migration unique `cr_units_identity_unique`. | `RESTRICT` | default `NO ACTION` | Tenant and house scope integrity. |
| submissions.`(campaign_unit_id, previous_submission_id)` | submissions.`(campaign_unit_id, id)` | Migration unique `cr_submissions_unit_id_unique`. | `SET NULL (previous_submission_id)` | default `NO ACTION` | Version chain cannot cross unit. |
| residents.`(submission_id, campaign_id, community_id, campaign_unit_id, house_id)` | submissions identity | Migration unique `cr_submissions_identity_unique`. | `RESTRICT` | default `NO ACTION` | Preserve resident evidence. |
| residents.`(activation_queue_id, community_id)` | resident_activation_queue.`(id, community_id)` | Migration adds unique support index `idx_cr_raq_id_community_id`; RAQ `id` is live PK. | `SET NULL (activation_queue_id)` | default `NO ACTION` | Trace RAQ output while preserving registration row if queue row is removed. |
| tokens.`(campaign_unit_id, campaign_id)` | units.`(id, campaign_id)` | Migration unique `cr_units_id_campaign_unique`. | `RESTRICT` | default `NO ACTION` | Token scope cannot cross campaign. |
| tokens.`(submission_id, campaign_unit_id, campaign_id)` | submissions.`(id, campaign_unit_id, campaign_id)` | Migration unique `cr_submissions_id_unit_campaign_unique`. | `RESTRICT` | default `NO ACTION` | Edit token must belong to exact submission/unit/campaign. |
| events scope FKs | campaigns, units, submissions, tokens | Migration/live keys above. | `RESTRICT` | default `NO ACTION` | Audit rows cannot silently point across tenants or lose scope. |

The support indexes were local migration changes during QA. They have since been applied to hosted dev during ENTRY-ONB-005.

## 8. State Validation

Unit status remains the operational source for dashboard state. Submission status remains the version lifecycle. The current submission is derived by querying active submission statuses:

`draft`, `submitted`, `edit_enabled`, `reviewed`, `confirmed`.

Historical or terminal statuses:

`superseded`, `invalidated`, `converted`.

The schema prevents duplicate active submissions per unit with `idx_cr_submissions_one_active_per_unit`. State-transition legality remains a future RPC responsibility.

## 9. Token Validation

`community_registration_access_tokens` is the only secret/authorization table.

- `token_hash` is required, globally unique, and length-checked.
- `campaign_access` and `patronato_review` scope only to campaign.
- `resident_edit` scopes to campaign, unit and submission.
- Active equivalents are unique per purpose/scope.
- `consumed_at` and `revoked_at` correspond to consumed/revoked status.
- Expired tokens require `expires_at`, but runtime expiry against `now()` must be enforced by future backend logic.
- Token plaintext generation and validation were not implemented.

## 10. RLS And Grants

All six new tables enable RLS:

- `community_registration_campaigns`
- `community_registration_units`
- `community_registration_submissions`
- `community_registration_residents`
- `community_registration_access_tokens`
- `community_registration_events`

All six explicitly revoke table access from `public`, `anon`, and `authenticated`. No permissive policies were added.

RLS is not forced. The initial posture is deny-by-default for Data API roles while preserving future privileged backend/RPC/service execution paths. Future RPC migrations must grant function execution narrowly and validate tenant, actor, token and state.

## 11. Tests Executed

- `git status --short`
- `git diff --stat`
- `git diff --check`
- `git diff --no-index --stat NUL <new-file>` for each new artifact
- `git diff --no-index --check NUL supabase/migrations/20260806232141_create_entry_community_registration_schema_v1.sql`
- `rg` checks for forbidden legacy lane references and DML/DDL danger patterns
- `node scripts/entry-onb-001-validate-schema.mjs`
- Tool availability checks for `psql`, `supabase`, Docker, Python and SQL parser packages

Static validator coverage includes the 20 required QA themes where they are enforceable by schema or explicitly documents deferral to future RPCs.

## 12. Test Limitations

- The migration was not applied to any database during the original QA pass.
- PostgreSQL syntax was not engine-validated during the original QA pass.
- No negative insert/update tests were run because no disposable database engine is available.
- No live Supabase DDL/DML was executed.
- No TypeScript types were regenerated because no approved schema application occurred.

## 13. Remaining Risks

- Engine syntax validation could still uncover PostgreSQL-specific issues that static checks miss.
- Future RPCs must enforce state transitions, resident count limits, token expiry against current time, lock ordering, rate limiting and duplicate checks.
- The unique normalized label rule may be too strict for communities with repeated labels across buildings; if so, `ENTRY-ONB-002` must add an explicit disambiguator before relaxing it.
- Conversion retry history may outgrow counters plus events; a conversion-attempt table remains a possible later addition.

## 14. Criteria For ENTRY-ONB-002

Before backend transactional work proceeds:

- Run the migration in a disposable PostgreSQL/Supabase database or with a trusted PostgreSQL parser.
- Run negative constraint tests for duplicate active submissions, invalid token scopes, cross-unit version chains and cross-scope events.
- Confirm support indexes on `houses(id, community_id)` and `resident_activation_queue(id, community_id)` are acceptable in the production migration.
- Keep future operations in controlled RPCs/Server Actions; do not add direct anon/authenticated table policies.
- Keep conversion bounded to `resident_activation_queue`; no Auth user creation and no legacy lane dependency.

## Project Direction Disposition

- **Disposition:** `APPROVED FOR COMMIT`
- The schema and its structural decisions are approved for versioning.
- The absence of validation with a real PostgreSQL engine is reclassified as a **mandatory pre-apply gate**, not as a blocker to begin `ENTRY-ONB-002`.
- `ENTRY-ONB-002` may design and implement the backend against this contract.
- The migration must not be applied in shared local, staging, or live Supabase until it passes:
  1. Complete execution in a disposable PostgreSQL/Supabase environment.
  2. Inspection of the resulting catalog.
  3. Negative constraint tests.
  4. RLS and grants verification.
  5. Rollback or safe destruction of the test environment.
- If real validation discovers structural errors, they must be corrected through review before any application.
