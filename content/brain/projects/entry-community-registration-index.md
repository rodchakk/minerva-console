# ENTRY Community Registration Index

## Identidad

- **Nombre del proyecto:** ENTRY Community Registration / Pre-Onboarding
- **Estado actual:** `ENTRY-ONB-007 - RUNTIME VALIDATED / READY FOR FINAL PR REVIEW`.
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
- `ENTRY-ONB-007`: runtime validated and ready for final PR review; internal campaign
  launch UI added to the community detail page with atomic launch and
  replacement-link recovery; code review, `gate-project-dev` PostgreSQL 17
  engine validation, and PR #39 Preview runtime walkthrough passed.

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
- Public flow PR #35 merged in commit `5b86d2e`.
- Current production code state includes master
  `6687e7e792f667f2f49e52c688279528cfdba14d`.
- PR #37 diagnostic observability is merged and intentionally retained.
- Production Redis authentication issue resolved after credential correction.
- Production rate limiting verified from one stable shell/network identity:
  campaign access allowed requests 1-10 for the 10/10 minute policy and
  returned `429` on request 11; correction access allowed requests 1-6 for the
  6/10 minute policy and returned `429` on request 7.
- `Retry-After` was present on both quota responses.
- Production runtime logs showed zero
  `entry_cr_rate_limit_failure=` occurrences after credential correction.
- Production verification created no Supabase writes, no resident records, no
  household records, and left `resident_activation_queue` untouched. Only
  Redis rate-limit counters were created.
- Estado vigente: `ENTRY-ONB-006 - PRODUCTION RUNTIME VERIFIED`; runtime
  blocker cleared.
- Estado vigente: `ENTRY-ONB-007 - RUNTIME VALIDATED / READY FOR FINAL PR REVIEW`.
- ONB-007 SQL engine validation passed on `gate-project-dev`
  (`ytzvislhvrcdtkbtpbmu`) / PostgreSQL 17. Validation was first performed
  transactionally and rolled back cleanly, then the exact approved migration was
  permanently applied to `gate-project-dev` only. Supabase recorded version
  `20260817014957`; post-DDL verification confirmed both RPCs exist with the
  intended grants.
- ONB-007 engine tests covered successful atomic launch; complete campaign,
  units, and single active `campaign_access`; cross-community unit failure
  rollback; successful campaign-access replacement; old-link invalidation;
  replacement-token public resolve; failed replacement rollback preserving
  previous active access; non-open campaign replacement rejection with `P0409`;
  authenticated caller rejection with `42501`; service-role-only execution
  grants; and `campaign_access_replaced` event/constraint compatibility.
- No SQL-engine test campaigns remained. Supabase security/performance
  advisors were reviewed; existing project-level advisor debt remains, but no
  new ONB-007-specific blocker was identified.
- Production/seshat was not touched. ENTRY mobile, Vercel env, Upstash, rate
  limits, and secrets were not changed.
- ONB-007 runtime walkthrough passed on PR #39 Preview for commit `c68043a`
  using `gate-project-dev` and test community `Residencial Prueba CR`.
  Internal launch rendered correctly, launch created one open campaign with
  five participating units and one active `campaign_access`, reload did not
  redisplay plaintext, replacement-link recovery revoked the old access and
  produced one new active access, and public lookup for Casa 1 rendered the
  resident form with the configured limit.
- ONB-007 submission interoperability was verified after the initial zero-data
  state. Casa 1 through Casa 5 were first confirmed `unregistered` with zero
  submissions and zero residents. The operator then completed one end-to-end
  public submission through the newly generated registration capability. Casa 1
  transitioned to `submitted` with `submission_count = 1` and
  `resident_count = 2`; Casa 2 through Casa 5 remained `unregistered` with
  zero submissions and zero residents.
- Runtime finding: the first Preview public-access attempt returned `503`
  because Preview runtime variables were still branch-scoped to the obsolete
  ONB-006 branch. Existing Preview variable branch scope was broadened to all
  Preview branches; values/secrets and Production variables were not changed.
  The same PR commit was redeployed, after which `/access` returned `303` and
  the public campaign page returned `200`.
- Runtime safety closeout: Production/seshat was not touched; ENTRY mobile was
  not touched; no production migration was applied; no Upstash credential value,
  `ENTRY_CR_RATE_LIMIT_SECRET`, rate-limit policy, or rate-limit code was
  changed.
