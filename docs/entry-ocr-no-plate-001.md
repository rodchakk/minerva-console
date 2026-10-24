# OCR-NO-PLATE-001: explicit no-plate results

Status: development only. **Merge requires `MERGE APPROVED`; deploying the Edge Function independently requires `DEPLOY APPROVED`.** Neither approval implies the other. No historical job is retried by this change.

## Problem and behavior

A legitimate vehicle reference photograph may contain no recognizable plate. v38 accepts `NO_PLATE` but rejects `NOPLATE` and `NO PLATE` as terminal `OCR_INVALID_OUTPUT`. The October 24 incident returned seven characters; its original text was not retained, so `NOPLATE` remains an unconfirmed hypothesis.

The handler recognizes exactly those three sentinels after trimming, uppercasing and collapsing whitespace. It persists `vehicle_plate_text = null`, checks the returned row/value and confirms the queue is `DONE`. An empty response, unknown sentinel, prose, malformed candidate, provider error or network failure is never converted to no-plate success. The existing real-plate regex, whitespace normalization and optional hyphen removal are unchanged. The prompt now explicitly covers reference photos and vehicles without plates, and prohibits inventing a plate from unrelated text or examples.

Persistence is restricted to the same entry/image with a null existing plate. Zero updated rows, a mismatched returned value, transport errors and database errors take the existing `OCR_PERSIST_FAILED` path. A late no-plate result cannot erase a non-null plate. The existing SQL trigger atomically completes pending/processing jobs on the entry update, including null → null; no migration is included.

Queue checks before provider dispatch and before persistence skip already terminal `DONE`/`FAILED` jobs. The explicit completion update is also limited to `PENDING`/`PROCESSING`. The final read verifies completion; a concurrent `FAILED` is returned as skipped, and an unconfirmed completion returns 503 without reopening a completed job. Actual Gemini usage is still recorded even when its response arrived too late to apply.

## Validation

Run from the repository root:

```sh
node --test tests/entry-ocr-hardening.test.mjs tests/entry-ocr-retry-policy.test.mjs tests/entry-ocr-no-plate.test.mjs
npx eslint supabase/functions/extract-plate-text/index.ts tests/entry-ocr-no-plate.test.mjs tests/helpers/ocr-handler.mjs tests/entry-ocr-retry-policy.test.mjs
deno check --no-lock supabase/functions/extract-plate-text/index.ts
```

The 57 OCR tests include the 15 investigation fixtures, valid/invalid plates, empty/prose/unknown sentinels, malformed candidates, thoughts, network timeout, HTTP 408/429/5xx versus terminal 4xx, bounded attempts, persistence error/throw/zero-row outcomes, all four queue states, late responses, lost commit acknowledgement, queue lookup failure, authorization, image binding, usage and privacy assertions. CI's existing OCR job now runs the new suite.

The harness executes the actual TypeScript handler using Node's type stripping and an isolated VM; only SDK/network/runtime boundaries are substituted. It models the unchanged completion trigger. These are executable handler regressions, **not a live PostgreSQL integration test, gateway signature test or Gemini image-quality evaluation**. No production images, credentials or records are used. Existing source tests still check the SQL trigger contract. Local Edge type checking used Deno 2.9.6. CI uses the repository's Node 24.22.1; the local machine uses Node 24.16.0.

## Risks and operational impact

- Correct sentinel aliases stop generating unnecessary terminal OCR alerts. `DONE` means OCR processing completed, not that a plate exists or that access was authorized.
- Three additional indexed queue reads on successful invocations add latency and database traffic. Failed/missing queue reads fail closed. No schema, SQL, cron, RLS, infrastructure, mobile, Field or Admin Web changes are included.
- Queue reads are not a transactional claim. The existing database trigger remains the atomic success boundary; this patch does not promise exactly-once billing for two simultaneously active invocations. A `FAILED` race between the pre-write read and persistence can leave a persisted result with the queue still `FAILED`; it is reported as skipped and never promoted or automatically retried. Eliminating that window would require a separately approved transactional SQL design.
- Gemini can still misread an image. Recognition rules remain strict, and no sensitive response text is added to telemetry. The historical failed event is not changed or reclassified.

## Automation audit and approval gates

The repository's default/production source branch is **`master`**, not `main`. The development branch is `codex/ocr-no-plate-001`.

The inspected repository workflows run tests/builds, with no Supabase function deploy command or database migration step. The main CI workflow runs on pull requests; its push filter names `main`, so do not assume it runs again on a push to `master`. This patch does not change that unrelated configuration.

Vercel is connected: GitHub deployment history shows `vercel[bot]` Production for baseline `18153607d2ca6ee2dc9e7896bea16fda2bccb39c` on `master`, and Preview deployments for development commits. Treat a branch push/PR as potentially creating a **Console Preview**, and a merge into `master` as potentially triggering a **Console production build/deployment**. Neither publishes the Supabase Edge Function. No function deployment automation was found in the inspected workflows/hooks. External integration settings must be rechecked before merge; if a merge would deploy this Edge Function automatically, stop because `MERGE APPROVED` alone does not authorize it. Do not change deployment settings as part of this mission.

## Deployment plan — only after separate approval

1. Obtain `MERGE APPROVED`, recheck automation and merge only the reviewed commit. Do not deploy the Edge Function at this stage.
2. Obtain **`DEPLOY APPROVED`** for `extract-plate-text` in project `ytzvislhvrcdtkbtpbmu`. Recheck the live baseline and capture its exact files/metadata immediately before release; stop if there is unexpected drift.
3. Publish only `index.ts` and the unchanged `retry-policy.mjs` from the approved commit, explicitly with **`verify_jwt=true`**. Keep the service-role authorization check. No SQL, cron or infrastructure action is required.
4. Verify `ACTIVE`, deployed version, exact files and JWT flag. Use approved isolated fixtures outside Andalucía to verify real-plate and all three no-plate results, persistence, queue transitions, provider failures and rejection of non-service roles. If no isolated integration environment exists, report that limitation rather than creating fake production entries.
5. Observe legitimate operational traffic and provider/queue telemetry after release. Verify no-plate jobs complete without `OCR_INVALID_OUTPUT`, real plates continue to pass, and true provider/persistence failures remain visible. Do not fetch photographs, fabricate resident records or automatically reprocess historical failures.

## Rollback to v38 behavior — only with rollback deployment authorization

The read-only pre-development snapshot was **v38, ACTIVE, `verify_jwt=true`**, bundle SHA-256 `4fdd19698fc74948335c75ea1ec467a4f19f4ce6fb764ac9b9d504973e33d4ab`. Its two source files match baseline commit `18153607d2ca6ee2dc9e7896bea16fda2bccb39c`. A local copy was retained outside the repository in the investigation's `evidence/ocr-rollback-v38/` directory.

After authorization, redeploy both exact v38 files with `verify_jwt=true`, retaining existing secrets and service-role-only access. Supabase creates a new deployment version number; rollback means restoring **v38 code and behavior**, not forcing the version counter to 38. Verify ACTIVE, file contents, auth configuration, legitimate plate processing and error telemetry. No data restoration, SQL rollback, photo changes, queue reset or cron change is necessary. Restoring v38 also restores rejection of `NOPLATE`/`NO PLATE`; completed historical results are not undone.

API behavior reference: [Supabase update and returning rows](https://supabase.com/docs/reference/javascript/update). Test-scope reference: [Supabase Edge Function testing](https://supabase.com/docs/guides/functions/unit-test).
