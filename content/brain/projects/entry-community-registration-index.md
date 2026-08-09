# ENTRY Community Registration Index

## Identidad

- **Nombre del proyecto:** ENTRY Community Registration / Pre-Onboarding
- **Estado actual:** `ENTRY-ONB-005 - HOSTED RUNTIME PASS`.
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
10. Backend v1: `content/brain/projects/entry-community-registration-backend-v1.md`
11. Migracion backend v1: `supabase/migrations/20260806233000_create_entry_community_registration_backend_v1.sql`
12. Validador backend v1: `scripts/entry-onb-002-validate-backend.mjs`
13. Review v1: `content/brain/projects/entry-community-registration-review-v1.md`
14. Migracion review v1: `supabase/migrations/20260806234000_create_entry_community_registration_review_v1.sql`
15. Validador review v1: `scripts/entry-onb-003-validate-review.mjs`
16. Conversion v1: `content/brain/projects/entry-community-registration-conversion-v1.md`
17. Conversion v1 QA inicial: `content/brain/projects/entry-community-registration-conversion-v1-qa.md`
18. Migracion conversion v1: `supabase/migrations/20260806235000_create_entry_community_registration_conversion_v1.sql`
19. Validador conversion v1: `scripts/entry-onb-004-validate-conversion.mjs`
20. Hosted dev validation v1: `content/brain/projects/entry-community-registration-hosted-dev-validation-v1.md`
21. Runtime harness plan/result: `content/brain/projects/entry-community-registration-runtime-test-plan-v1.md`
22. Hotfix 005: `supabase/migrations/20260806235500_hotfix_cr_unit_conversion_queue_uuid_aggregate.sql`
23. Hotfix 006: `supabase/migrations/20260806235600_hotfix_cr_unit_conversion_user_role_enum_literal.sql`

## Estado de misiones

- `ENTRY-ONB-000`: completed.
- `ENTRY-ONB-001`: committed.
- `ENTRY-ONB-001-QA`: completed.
- `ENTRY-ONB-001-CLOSEOUT`: current.
- `ENTRY-ONB-002`: applied to hosted dev; runtime validated under `ENTRY-ONB-005`.
- `ENTRY-ONB-003`: applied to hosted dev; runtime validated under `ENTRY-ONB-005`.
- `ENTRY-ONB-004-UNBLOCK`: completed.
- `ENTRY-ONB-004`: completed; baseline `ac25878`.
- `ENTRY-ONB-005`: hosted runtime pass; UI work unblocked.

## Gates

- Docker gate descartado por decision del usuario.
- Hosted dev gate iniciado en `gate-project-dev`.
- Migracion `001` aplicada por Supabase MCP, verificada y reconciliada localmente como `20260806232141`.
- Migraciones `002`, `003` y `004` aplicadas individualmente a hosted dev y reconciliadas localmente como `20260806233000`, `20260806234000` y `20260806235000`.
- Hotfix `005` corrigio `min(uuid)` en `_cr_classify_unit_conversion_v1`.
- Hotfix `006` corrigio el literal enum lowercase `resident` como `RESIDENT`.
- Hosted runtime validation paso con 75 assertions, RAQ delta temporal `+2`, cero deltas en tablas protegidas y rollback verificado.
- Sin push/PR/deployment.
- Backend de conversion implementado, auditado y commiteado en baseline `ac25878`.
- Estado vigente: `ENTRY-ONB-005 - HOSTED RUNTIME PASS`; UI work unblocked.
