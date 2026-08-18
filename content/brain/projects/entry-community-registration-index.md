# ENTRY Community Registration Index

## Identidad

- **Nombre del proyecto:** ENTRY Community Registration / Pre-Onboarding
- **Estado actual:** `ENTRY-ONB-009 - PREVIEW RUNTIME PASSED / FINAL MERGE GATE`.
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
24. Campaign launch UI: `content/brain/projects/entry-community-registration-campaign-launch-ui.md`
25. Migracion hardening launch UI: `supabase/migrations/20260817014957_create_entry_community_registration_launch_ui_hardening_v1.sql`
26. Validador launch UI: `scripts/entry-onb-007-validate-campaign-launch-ui.mjs`
27. Validador launch hardening: `scripts/entry-onb-007-validate-launch-hardening.mjs`
28. ONB-007 post-merge closeout: `content/brain/projects/entry-community-registration-onb-007-post-merge-closeout.md`
29. Internal review UI: `content/brain/projects/entry-community-registration-internal-review-ui.md`
30. Migracion review UI hardening: `supabase/migrations/20260817040516_create_entry_community_registration_review_ui_hardening_v1.sql`
31. Validador review UI: `scripts/entry-onb-008-validate-review-ui.mjs`
32. Recoverable campaign link: `content/brain/projects/entry-community-registration-recoverable-campaign-link.md`
33. Migracion recoverable campaign link: `supabase/migrations/20260818034216_entry_onb_009_recoverable_campaign_links.sql`
34. Validador recoverable campaign link: `scripts/entry-onb-009-validate-recoverable-campaign-link.mjs`

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
- `ENTRY-ONB-006`: completed; production runtime blocker cleared.
- `ENTRY-ONB-007`: CLOSED; PR #39 squash-merged to `master` as `f3c95a784f5356427fba1797ea851a095897b88d`; production Minerva Console deployment reached `READY`. Code review, `gate-project-dev` PostgreSQL 17 engine validation, PR Preview runtime walkthrough, link rotation, real Casa 1 submission, and `1 / 5` progress refresh all passed.
- `ENTRY-ONB-008`: CLOSED; PR #41 squash-merged to `master` as `cf23b4b4885c1c4ab7f297d581df8de6fde500d2`. Internal review, correction observation, correction-link replacement, old-link rejection, Version 2 resubmission, pending-correction hotfix and final Version 2 review all passed; Production deployment reached READY.
- `ENTRY-ONB-009`: implementation complete on branch `codex/entry-onb-009-recoverable-campaign-link`, PR #43. PostgreSQL 17 validation passed, canonical migration `20260818034216` is applied to `gate-project-dev`, Preview/Production share the stable server-only encryption key, and Preview runtime launch/reload/Copy/Open/Replace/old-link invalidation all passed. Final head CI/Vercel and merge are the remaining gates.

## Gates

- Docker gate descartado por decision del usuario.
- Hosted dev gate iniciado en `gate-project-dev`.
- Migracion `001` aplicada por Supabase MCP, verificada y reconciliada localmente como `20260806232141`.
- Migraciones `002`, `003` y `004` aplicadas individualmente a hosted dev y reconciliadas localmente como `20260806233000`, `20260806234000` y `20260806235000`.
- Hotfix `005` corrigio `min(uuid)` en `_cr_classify_unit_conversion_v1`.
- Hotfix `006` corrigio el literal enum lowercase `resident` como `RESIDENT`.
- Hosted runtime validation paso con 75 assertions, RAQ delta temporal `+2`, cero deltas en tablas protegidas y rollback verificado.
- Backend de conversion implementado, auditado y commiteado en baseline `ac25878`.
- Public flow PR #35 merged in commit `5b86d2e`.
- PR #37 diagnostic observability is merged and intentionally retained.
- Production Redis authentication issue resolved after credential correction.
- Production rate limiting verified from one stable shell/network identity: campaign access allowed requests 1-10 for the 10/10 minute policy and returned `429` on request 11; correction access allowed requests 1-6 for the 6/10 minute policy and returned `429` on request 7.
- `Retry-After` was present on both quota responses.
- Production runtime logs showed zero `entry_cr_rate_limit_failure=` occurrences after credential correction.
- Production verification created no Supabase writes, no resident records, no household records, and left `resident_activation_queue` untouched. Only Redis rate-limit counters were created.
- ONB-007 SQL engine validation passed on `gate-project-dev` (`ytzvislhvrcdtkbtpbmu`) / PostgreSQL 17. Validation was first performed transactionally and rolled back cleanly, then the exact approved migration was permanently applied to `gate-project-dev` only as `20260817014957`.
- ONB-007 runtime walkthrough passed on PR #39 Preview using `gate-project-dev` and test community `Residencial Prueba CR`; launch, replacement, revoked-link rejection, new-link access and real Casa 1 submission passed.
- PR #39 was squash-merged to `master` as `f3c95a784f5356427fba1797ea851a095897b88d`; Vercel production reached `READY`.
- Production Minerva Console wiring was verified against Supabase `gate-project-dev`; `seshat` remains a separate project and was not modified.
- ONB-008 PostgreSQL engine validation, Preview walkthrough and correction/resubmission hotfix passed. Canonical migrations `20260817040516` and `20260817043002` are applied to `gate-project-dev`.
- PR #41 was squash-merged to `master` as `cf23b4b4885c1c4ab7f297d581df8de6fde500d2`; Vercel Production reached READY.
- ONB-009 focused validator, targeted lint, TypeScript/build and static security checks passed. Full lint remains informationally red only on known unrelated React-hook debt; Brain guardrails remain red only on the pre-existing `DEC-0007 -> ENTRY-ONB-000` relation.
- ONB-009 migration passed exact `BEGIN` / `ROLLBACK` validation on PostgreSQL 17, including v2 launch, atomic hash + encrypted payload, v2 rotation, exactly one active token after replacement, unauthorized caller rejection and grants. Rollback cleanup passed.
- The exact ONB-009 migration was then applied permanently to `gate-project-dev`; Supabase recorded `20260818034216_entry_onb_009_recoverable_campaign_links`. A second transactional functional test against the installed migration passed and rolled back test data cleanly.
- `ENTRY_CR_CAMPAIGN_LINK_ENCRYPTION_KEY` is configured as a sensitive server-only Vercel variable for Preview and Production with the same stable value; no secret value is stored in Brain or the repo.
- PR #43 Preview runtime launched a one-unit test campaign on `Cimuty monopy`. Reload retained recoverable controls. Copy and Open did not rotate or consume access. Replace produced a distinct active token, revoked the old token and emitted one replacement event. Direct resolver verification returned unavailable for the old capability and available for the new capability.
- Resident correction links remain hash-only/non-recoverable and ENTRY mobile, Patronato confirmation UI, conversion, activation queue, Upstash/rate-limit policy and `seshat` remain outside ONB-009 scope.
- Estado vigente: `ENTRY-ONB-009 - PREVIEW RUNTIME PASSED / FINAL MERGE GATE`.
