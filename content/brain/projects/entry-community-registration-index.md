# ENTRY Community Registration Index

## Identidad

- **Nombre del proyecto:** ENTRY Community Registration / Pre-Onboarding
- **Estado actual:** `ENTRY-ONB-009 - RECOVERABLE CAMPAIGN LINK IMPLEMENTATION IN PROGRESS`.
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
33. Migracion recoverable campaign link: `supabase/migrations/20260818010000_entry_onb_009_recoverable_campaign_links.sql`
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
- `ENTRY-ONB-007`: CLOSED; PR #39 squash-merged to `master` as
  `f3c95a784f5356427fba1797ea851a095897b88d`; production Minerva Console
  deployment reached `READY`. Code review, `gate-project-dev` PostgreSQL 17
  engine validation, PR Preview runtime walkthrough, link rotation, real Casa 1
  submission, and `1 / 5` progress refresh all passed.
- `ENTRY-ONB-008`: implementation in review on branch
  `codex/entry-onb-008-internal-review-ui`, PR #41. Internal campaign review,
  household inspection, reviewed/correction actions, recoverable resident
  correction links, and authorized correction-observation display are
  implemented. PostgreSQL engine validation passed on `gate-project-dev`; the
  exact migration is applied there as version `20260817040516`. Preview runtime
  walkthrough is the next gate.
- `ENTRY-ONB-009`: local/static gates passed on branch
  `codex/entry-onb-009-recoverable-campaign-link`. Adds recoverable open
  campaign registration links using application-layer AES-256-GCM encrypted
  campaign-token payloads while keeping resident correction links hash-only and
  non-recoverable. Permanent hosted dev apply and Preview runtime gates remain
  pending.

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
- ONB-007 engine tests covered successful atomic launch; complete campaign, units, and single active `campaign_access`; cross-community unit failure rollback; successful campaign-access replacement; old-link invalidation; replacement-token public resolve; failed replacement rollback preserving previous active access; non-open campaign replacement rejection with `P0409`; authenticated caller rejection with `42501`; service-role-only execution grants; and `campaign_access_replaced` event compatibility.
- ONB-007 runtime walkthrough passed on PR #39 Preview using `gate-project-dev` and test community `Residencial Prueba CR`.
- ONB-007 submission interoperability was verified with Casa 1 transitioning to `submitted` with `submission_count = 1` and `resident_count = 2`; Casa 2 through Casa 5 remained `unregistered`.
- Preview runtime variables were broadened from the obsolete ONB-006 branch scope to all Preview branches without changing values/secrets or Production variables. After redeploy, public access returned `303` and campaign page `200`.
- PR #39 was squash-merged to `master` as `f3c95a784f5356427fba1797ea851a095897b88d`; Vercel production reached `READY`.
- Production Minerva Console wiring was verified against Supabase `gate-project-dev`; `seshat` remains a separate project and was not modified.
- ONB-008 initial PR #41 code gate: TypeScript passed, production Build passed, Brain/layout lint passed, and Vercel Preview passed. Full lint remained informationally red only on known unrelated React-hook debt. Brain guardrails remained red on the pre-existing broken relation `DEC-0007 -> ENTRY-ONB-000`.
- ONB-008 read-only schema inspection confirmed the live dev token indexes, event actor constraints and service-role execution contract match the proposed hardening design.
- ONB-008 PostgreSQL engine validation passed transactionally on `gate-project-dev` / PostgreSQL 17 using the dedicated `Residencial Prueba CR` Casa 1 submission. The test exercised `open -> review`, `submitted -> reviewed -> needs_correction -> edit_enabled`, correction-observation resolution, edit-link rotation, old-link rejection, failed replacement rollback, `42501` unauthorized rejection and replacement audit compatibility.
- The pre-apply transaction ended in `ROLLBACK`. Proof confirmed campaign restored `open`, Casa 1 restored `submitted`, submission restored `submitted`, no test review remained, no test edit token remained, and temporary DDL was absent.
- The exact ONB-008 hardening migration was then permanently applied to `gate-project-dev` only. Supabase recorded version `20260817040516_create_entry_community_registration_review_ui_hardening_v1`.
- Post-DDL verification confirmed the rotation RPC exists; execute is granted to `service_role` and blocked for `authenticated`/`anon`; `resident_edit_access_replaced` is accepted by the event constraint; the test campaign stayed `open`; Casa 1 stayed `submitted`; and no edit token was created by migration application.
- A second transactional functional test was run against the installed migration. Correction observation, two-resident payload, rotation, old-token invalidation, duplicate-hash rollback preservation, unauthorized caller rejection and audit event behavior all passed. Final rollback again left zero test reviews/tokens and restored campaign/unit/submission state.
- Repository migration filename was reconciled to canonical hosted-dev version `20260817040516`; SQL content is unchanged.
- ONB-008 did not touch production, `seshat`, ENTRY mobile, Vercel env, Upstash, rate-limit policy or secrets.
- ONB-009 local focused validator passed:
  `node scripts/entry-onb-009-validate-recoverable-campaign-link.mjs`.
- ONB-009 production build passed with
  `node --use-system-ca node_modules\next\dist\bin\next build --webpack`; the
  build TypeScript phase passed.
- ONB-009 hosted dev read-only inspection confirmed no pre-existing ONB-009
  column/functions. Transactional migration application inside `BEGIN` /
  `ROLLBACK` succeeded, and rollback proof confirmed the column/functions were
  absent afterward.
- ONB-009 requires server-only `ENTRY_CR_CAMPAIGN_LINK_ENCRYPTION_KEY`, generated
  as a 32-byte key such as `openssl rand -base64 32`. Preview and Production
  need the same stable key for recoverability. No secrets were changed in repo.
- ONB-009 external gates pending: PostgreSQL 17 functional validation on
  `gate-project-dev`, explicit authorization for permanent dev apply, Preview
  env configuration and runtime walkthrough. Production and `seshat` remain
  untouched.
- Estado vigente: `ENTRY-ONB-009 - LOCAL IMPLEMENTATION / EXTERNAL GATES PENDING`.
