# ENTRY-ONB-005 - Hosted Dev Migration Apply and Runtime Validation

## Decision

Docker/Supabase local validation was cancelled for this gate. The user authorized hosted development validation against `gate-project-dev` only.

The initial `BLOCKED` report was accepted as a correct preventive stop. Recovery then authorized adopting Supabase MCP generated timestamps as canonical local migration filenames, without reverting `001`, without manually editing `supabase_migrations.schema_migrations`, and without weakening SQL content integrity.

## Authorization

Authorized target:

```text
TARGET=gate-project-dev
PROJECT_REF=ytzvislhvrcdtkbtpbmu
ENVIRONMENT=HOSTED_DEVELOPMENT
REAL_CLIENTS=NONE
COMMERCIAL_PRODUCTION=false
```

No production, pilot, push, PR, deployment, commit, or UI work was authorized.

## Baseline

- Repository: `D:\Dev\minerva-console`
- Worktree: `D:\Dev\minerva-console\.worktrees\entry-onb-005`
- Branch: `codex/entry-onb-005-hosted-dev-validation`
- Baseline before transport closeout: `b7fd93285bd8d066ea83df15551f4ae3daf5c4e5`
- Previous recovery baseline: `ac25878099c5be4936aae54dbc153b6ad06aec57`

## Project Identity

- Project name: `gate-project-dev`
- Project ref: `ytzvislhvrcdtkbtpbmu`
- Organization: `tftqtmhahtwbfcaufeal`
- Region: `us-east-1`
- Status: `ACTIVE_HEALTHY`
- PostgreSQL: `17.6.1.063`

## Previous State

- Initial state: `BLOCKED FOR APPLY`
- Previous target migration history:
  - `20260805000100`: absent
  - `20260805000200`: absent
  - `20260805000300`: absent
  - `20260806000100`: absent
- Previous Community Registration tables: none
- Previous Community Registration functions: none

## Previous Snapshot Without PII

- RAQ row count: `194`
- RAQ non-sensitive hash: `228c96cae1f334316cbd57b060670736`
- RAQ by status:
  - `activated`: `15`
  - `invited`: `29`
  - `pending`: `132`
  - `pin_generated`: `18`
- RAQ by source:
  - `excel_import`: `20`
  - `excel_import_v2`: `174`
- Active table counts:
  - `auth.users`: `313`
  - `profiles`: `304`
  - `community_members`: `303`
  - `house_residents`: `332`
  - `resident_activation_pins`: `63`

## Migration 001

- Original local file: `20260805000100_create_entry_community_registration_schema_v1.sql`
- Remote generated version: `20260806232141`
- Remote name: `create_entry_community_registration_schema_v1`
- Canonical local file after recovery: `20260806232141_create_entry_community_registration_schema_v1.sql`
- Tool used: Supabase MCP `apply_migration`
- Apply result: success
- Local validator: `node scripts/entry-onb-001-validate-schema.mjs` passed.
- Catalog verification:
  - Six Community Registration tables exist.
  - RLS is enabled on all six tables.
  - No policies exist, preserving deny-by-default.
  - No grants to `public`, `anon`, or `authenticated` exist on the new tables.
  - Primary keys, foreign keys, unique constraints, checks, and indexes exist.

## Reconciliation 001

SHA-256 before rename:

```text
03466FE6E546CD6E6D096AAD3B17B0D6384EE774940578EE6C732FED072AE251
```

SHA-256 after rename:

```text
03466FE6E546CD6E6D096AAD3B17B0D6384EE774940578EE6C732FED072AE251
```

Only the filename changed. No second copy of the schema migration exists. The local timestamp now matches the remote generated version `20260806232141`.

## Blocking Finding During Recovery

The available official Supabase MCP application tool was `apply_migration(name, query)`. It did not accept a local file path or workspace file reference. At that time no Supabase CLI binary was available in the worktree or PATH.

Migrations `002`, `003`, and `004` are large SQL files. Applying them by manually transcribing chunked SQL into the MCP `query` parameter would not provide a defensible byte-identical path and would risk violating the recovery rule:

> No cambies ni un byte del contenido SQL.

Therefore recovery stopped before applying `002`.

Status: resolved during transport closeout. Supabase CLI `2.111.0` was used, `migration fetch` synchronized the remote history into a temporary migration-history folder, and each of `002`, `003`, and `004` received an individual approved dry run before successful individual application.

The only warning observed after apply was a non-blocking Docker warning during the CLI cache step. It did not block the migrations.

## Migrations Applied After Resolution

- `ENTRY-ONB-002`: applied as `20260806233000_create_entry_community_registration_backend_v1`.
- `ENTRY-ONB-003`: applied as `20260806234000_create_entry_community_registration_review_v1`.
- `ENTRY-ONB-004`: applied as `20260806235000_create_entry_community_registration_conversion_v1`.

## Mapping

| Mission | Logical name | Original timestamp | Remote canonical timestamp | SHA-256 preserved |
| ------- | ------------ | -----------------: | -------------------------: | ----------------- |
| ONB-001 | schema v1 | `20260805000100` | `20260806232141` | Yes |
| ONB-002 | backend v1 | `20260805000200` | `20260806233000` | Yes |
| ONB-003 | review v1 | `20260805000300` | `20260806234000` | Yes |
| ONB-004 | conversion v1 | `20260806000100` | `20260806235000` | Yes |

## Current Local Migration Hashes

| File | SHA-256 |
| ---- | ------- |
| `20260806232141_create_entry_community_registration_schema_v1.sql` | `03466FE6E546CD6E6D096AAD3B17B0D6384EE774940578EE6C732FED072AE251` |
| `20260806233000_create_entry_community_registration_backend_v1.sql` | `317405516B35BAFFFD5D982C924DF17E5C135F900D57E2C5F5B1E45F98153107` |
| `20260806234000_create_entry_community_registration_review_v1.sql` | `B88036B139D51B6916B4A326856A8221CAC80B7C0935EE758D69E88FF75E303E` |
| `20260806235000_create_entry_community_registration_conversion_v1.sql` | `B2CDEC4EC2FDA4B4F7FB7C618EE8ACB8A8A6C80C6E00ED92B3D4FA0E27ED1918` |

## Final Migration History

Remote hosted-dev migration history:

```text
20260806232141 | create_entry_community_registration_schema_v1
20260806233000 | create_entry_community_registration_backend_v1
20260806234000 | create_entry_community_registration_review_v1
20260806235000 | create_entry_community_registration_conversion_v1
```

Local migration filenames now match the remote canonical timestamps.

## Post-004 Snapshot Without PII

- RAQ row count: `194`
- RAQ non-sensitive hash: `228c96cae1f334316cbd57b060670736`
- RAQ by status unchanged:
  - `activated`: `15`
  - `invited`: `29`
  - `pending`: `132`
  - `pin_generated`: `18`
- RAQ by source unchanged:
  - `excel_import`: `20`
  - `excel_import_v2`: `174`
- RAQ legacy rows remain preserved:
  - `194` rows
  - all legacy rows have `community_registration_resident_id IS NULL`
- RAQ traceability column:
  - type `uuid`
  - nullable
  - no default
  - FK `raq_community_registration_resident_fk`
  - `ON DELETE RESTRICT`
  - partial unique index `ux_raq_community_registration_resident` where source ID is not null
- Active table counts unchanged:
  - `auth.users`: `313`
  - `profiles`: `304`
  - `community_members`: `303`
  - `house_residents`: `332`
  - `resident_activation_pins`: `63`

## Functional Suite

Not executed. The migration chain is applied to hosted dev, but runtime tests are still pending.

## Negative Cases

Not executed. Runtime negative cases are still pending.

## Synthetic Data

No synthetic runtime data was created.

## Cleanup / Rollback

No cleanup was required. No synthetic rows were persisted. No destructive operation, reset, migration repair, or manual migration history change was performed.

## Warnings

- Hosted dev has `ENTRY-ONB-001` through `ENTRY-ONB-004` applied.
- Runtime validation has not yet been executed.

## Residual Risks

- Runtime integration cannot start until hosted-dev runtime tests validate the applied surface.
- Manual SQL transcription remains explicitly rejected as too risky for byte-identical migration application.

## Final State

`ENTRY-ONB-005 — MIGRATIONS APPLIED TO HOSTED DEV; RUNTIME TESTS PENDING`

## Verdict

`READY FOR ENTRY-ONB-005-RUNTIME`

No clients or commercial production data were involved according to the authorized target statement. No push, PR, deployment, commit, stage, ENTRY mobile change, UI work, migration repair, manual history edit, or application to another project occurred. Runtime tests remain pending.
