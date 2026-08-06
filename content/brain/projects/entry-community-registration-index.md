# ENTRY Community Registration Index

## Identidad

- **Nombre del proyecto:** ENTRY Community Registration / Pre-Onboarding
- **Estado actual:** ENTRY-ONB-005 recovery reconciled ENTRY-ONB-001 timestamp; `BLOCKED — SAFE HOSTED MIGRATION TRANSPORT UNAVAILABLE`.
- **Decision fundacional vigente:** `DEC-0007` - `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`
- **Repositorio principal:** `D:\Dev\minerva-console`
- **Carril de activacion:** `community_registration_*` approved residents -> `resident_activation_queue` -> existing PIN / activation flow
- **Baseline de esquema:** commit `b81c3e85c2e36fb3003da76db7177d799089411e`
- **Baseline documental:** commit `00d31f1`

## Documentos en orden

1. Analisis inicial: `content/brain/harness/ENTRY_COMMUNITY_ONBOARDING_ANALYSIS.md`
2. Phase 0 reconciliation: `content/brain/projects/entry-community-onboarding-phase-0-reconciliation.md`
3. Foundation decision: `content/brain/decisions/dec-0007-entry-community-registration-foundation.md`
4. Foundation contract: `content/brain/projects/entry-community-registration-foundation-contract.md`
5. Schema v1: `content/brain/projects/entry-community-registration-schema-v1.md`
6. Schema v1 QA: `content/brain/projects/entry-community-registration-schema-v1-qa.md`
7. Migracion: `supabase/migrations/20260806232141_create_entry_community_registration_schema_v1.sql`
8. Validador: `scripts/entry-onb-001-validate-schema.mjs`
9. Activation queue live contract: `content/brain/projects/entry-resident-activation-queue-live-contract.md`
10. Conversion v1: `content/brain/projects/entry-community-registration-conversion-v1.md`
11. Conversion v1 QA inicial: `content/brain/projects/entry-community-registration-conversion-v1-qa.md`
12. Migracion conversion v1: `supabase/migrations/20260806000100_create_entry_community_registration_conversion_v1.sql`
13. Validador conversion v1: `scripts/entry-onb-004-validate-conversion.mjs`
14. Hosted dev validation v1: `content/brain/projects/entry-community-registration-hosted-dev-validation-v1.md`

## Estado de misiones

- `ENTRY-ONB-000`: completed.
- `ENTRY-ONB-001`: committed.
- `ENTRY-ONB-001-QA`: completed.
- `ENTRY-ONB-001-CLOSEOUT`: current.
- `ENTRY-ONB-002`: next, not started.
- `ENTRY-ONB-004-UNBLOCK`: completed.
- `ENTRY-ONB-004`: completed; baseline `ac25878`.
- `ENTRY-ONB-005`: hosted dev apply/runtime validation; `BLOCKED — SAFE HOSTED MIGRATION TRANSPORT UNAVAILABLE`.

## Gates

- Docker gate descartado por decision del usuario.
- Hosted dev gate iniciado en `gate-project-dev`.
- Migracion `001` aplicada por Supabase MCP, verificada y reconciliada localmente como `20260806232141`.
- Migraciones `002`, `003` y `004` no aplicadas.
- PostgreSQL runtime validation bloqueada porque la herramienta oficial disponible acepta SQL inline, no archivo local, y no existe CLI local para aplicar `002-004` byte-identical.
- Sin push/PR/deployment.
- Backend de conversion implementado, auditado y commiteado en baseline `ac25878`.
- Estado vigente: `BLOCKED — SAFE HOSTED MIGRATION TRANSPORT UNAVAILABLE`.
