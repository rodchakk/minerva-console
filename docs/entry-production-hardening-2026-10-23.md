# ENTRY Production Hardening — OCR invalid output / cron burst

**Investigation date:** 2026-10-23 (Honduras) / 2026-10-24 UTC
**Repository:** rodchakk/minerva-console
**Target:** master, via isolated review branch only
**Release status:** READY FOR REVIEW — no merge, DB DDL, Edge deployment, Vercel production release or mobile OTA was performed.

## 1. Executive conclusion

One OCR image received six `OCR_INVALID_OUTPUT` Gemini responses. The immediately
dispatched check-in request was not counted toward the queue retry budget; five
queue attempts subsequently exhausted `max_attempts=5`. The root cause of
the *response content* cannot be established because raw provider text is
intentionally not retained. The root cause of the six-call loop **is confirmed**:
all provider and parse failures called the same two-minute retry handler.

A separate short burst caused 54 `pg_cron` startup timeouts on nine different
jobs between 08:55–09:11 UTC on 2026-10-23. PostgREST Warp thread timeouts
started earlier, around 08:46 UTC, and Postgres logs contain connection resets,
EOF and SQL statement timeouts. Evidence favors shared database connectivity/
resource pressure, but does not prove provider responsibility versus pressure
from concurrent clients or platform activity. Cron returned to normal without
schedule changes. All sampled runs over the latest two hours succeeded (apart
from an in-progress incident reconciler at the point of inspection).

In Andalucía, activation follow-up includes five `pin_generated` records that
the infrastructure queue excludes. The 43 vs 38 count difference is real,
expected, and previously mislabeled.

## 2. Root causes / evidence

### OCR

- Deployed `extract-plate-text`: active version **37**, `verify_jwt=true`.
- First–last failed ledger call: 2026-10-24 03:15:10–03:30:05 UTC.
- Six failed ledger records: one `correlation_id`, all `OCR_INVALID_OUTPUT`.
- Exactly one queue row in `FAILED`, `attempts=5`, `max_attempts=5`.
- Inspecting `markQueueFailure()` proves it schedules a retry regardless
  of the error class unless the queue counter is exhausted.
- `master` Edge source lags v37: deployed strict plate regex, thought-part
  rejection and `thinkingBudget: 0` were missing in the repository. The
  proposed Edge source is based on the **deployed** version to preserve these
  safeguards.
- Production `process_plate_ocr_queue` differs from its historical migration
  in dispatch limit/timeout (`3/15000ms` live vs `10/25000ms` old source).
  No DB SQL is changed in this patch.

### Cron

- `cron.job_run_details`: 54 startup failures from 08:55–09:11 UTC,
  shared across nine jobs, including OCR, web push, mobile receipts,
  message workers and manual-entry expiry.
- PostgREST Warp errors precede failures, with SQL timeouts, SSL resets and
  EOF around the same time. This is inconsistent with one isolated worker bug.
- Schedules are already staggered. The shared ENTRY wrapper uses transaction
  advisory locks and honors global runtime mode `RECOVERY`.
- Current pg_cron scheduler process exists and jobs subsequently succeeded.
  **No cron frequency, lock, database timeout, or worker changes recommended.**
- Remaining uncertainty: unavailable low-level resource graphs, provider
  maintenance events and exact connection saturation during the incident.

### Observability

- Diagnostic DB function already exposes current `system_status` separately
  from selected `window_status`; the export text now labels current health
  explicitly without altering the SQL health classifier.
- Live Andalucía activation states: `invited=38`, `pin_generated=5`,
  `activated=230`. Follow-up `open_count=43`, infrastructure `open_count=38`.
  The API previously spread follow-up fields over infrastructure fields.
  It now preserves both counts and timestamps under distinct keys.
- `web.dashboard_ready` (9 samples, mean 256341ms) and
  `web.access_history_ready` (6 samples, mean 164517ms) contrast sharply
  with `web.app_ready` (6 samples, mean 1114ms).
  This is a potential event-lifecycle instrumentation issue and is **out of
  scope** for this OCR/cron fix. Continue in the separate telemetry mission.

## 3. Changes implemented (branch only)

1. `supabase/functions/extract-plate-text/index.ts` — sync deployed v37,
   move failure classification before request validation, terminate contract,
   deterministic provider and permanent storage errors, restrict queue writes
   to `PENDING/PROCESSING`. Bounded retries remain for transient failures.
2. `supabase/functions/extract-plate-text/retry-policy.mjs` — pure testable
   classification for HTTP 408/429/5xx, network, invalid output and storage.
3. `tests/entry-ocr-retry-policy.test.mjs` — retry classification, terminal
   invalid output, `NO_PLATE` and valid result, DONE and gate isolation.
4. `app/api/entry/observability/diagnostic/route.ts` — don't overwrite the
   canonical infrastructure activation `open_count` or oldest time.
5. `features/entry/observability/DiagnosticBundleControl.tsx` — explicit
   current health, infrastructure queue and human follow-up labels.
6. `tests/entry-diagnostic-counts.test.mjs` — counting rules and summary.
7. `docs/entry-ocr-production-hardening.md` — error policy, rejected
   alternatives and deployment compatibility.

**No SQL migrations or RPC changes.**

## 4. Production impact (after a separately approved release)

- One malformed Gemini output creates one failed usage ledger event and
  a terminal `FAILED` queue item. It is never reclassified as `NO_PLATE`.
- Valid plates and `NO_PLATE` still commit `DONE`. Network and 429/5xx
  still retry under the existing two-minute backoff/five-attempt limit.
- Gate check-in remains independent of OCR and does not wait for provider
  success. Existing `SKIP LOCKED`, unique-entry queue index, `DONE`
  trigger and rate/cost accounting are preserved.
- The diagnostic count labels become explicit; no activation status changes.
- None of these effects are live until an approved deployment.

## 5. Verification

- Production read-only: inspected deployed Edge v37, PostgreSQL trigger
  definitions, runtime dispatcher, queue rows, usage ledger, cron schedules
  and run history, Postgres/PostgREST logs, activation state aggregates.
- Source-level regression tests added for retry class and diagnostics.
- Before merge/release: run `node --test tests/entry-ocr-hardening.test.mjs
  tests/entry-ocr-retry-policy.test.mjs tests/entry-diagnostic-counts.test.mjs`,
  full `npm test`, `npx tsc --noEmit`, `npm run build`, and inspect the
  Vercel Preview if one is generated by the PR.
- Do not claim that mocked cases prove billable Gemini behavior in production.
  Post-release verification must compare Edge version, queue/ledger deltas
  and no raw payload telemetry; use controlled test fixtures only.

## 6. Remaining risks

- Provider behavior cannot be reconstructed for the historical OCR image,
  because raw Gemini responses were intentionally not stored.
- An occasional valid plate might be lost to a terminal malformed provider
  response; operationally preferable to repeated identical billable calls,
  and visible through `FAILED` and ledger.
- The existing foreground plus worker dispatch architecture can overlap
  in rare delays; this patch does not introduce a new transaction-level
  provider-call idempotency mechanism.
- Some production-only SQL/Edge drift exists; future releases must not
  overwrite the current SQL dispatcher from an old migration.

## 7. Rollback

- Before deployment: close/revert the PR; production is unaffected.
- If Edge is deployed later: restore the **exact captured v37 deployed source**
  (not `master` before this patch) and retain `verify_jwt=true`.
  New `retry-policy.mjs` import is not needed by v37. Validate the deployed
  function and test the gate pathway after rollback.
- If Console is deployed later: revert only the two diagnostic presentation
  changes and redeploy their previous Vercel production commit.
- No migration rollback or queue cleanup is needed. Do not reset existing
  `FAILED` or `DONE` OCR rows as part of rollback.

## 8. Release status

**READY FOR REVIEW**, subject to code review, CI, optional Preview and
explicit **MERGE APPROVED**. A separate production release approval must
precede any Edge/Vercel deploy. No mobile release.
