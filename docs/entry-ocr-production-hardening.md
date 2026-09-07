# ENTRY OCR production hardening

Status: release candidate for `ENTRY-OCR-001`.

## Why this exists

The deployed plate OCR path predated repository ownership and used a legacy shared bearer credential between Postgres and the `extract-plate-text` Edge Function. The retry function also existed without an active scheduler, so failed immediate attempts could remain pending indefinitely.

This mission makes OCR a repository-owned, observable production subsystem without making gate check-in depend on OCR availability.

## Runtime flow

1. A `CHECK_IN` row with a vehicle photo is inserted into `entry_logs`.
2. `trigger_plate_ocr_on_checkin()` creates one durable `plate_ocr_queue` row and makes a best-effort immediate call.
3. Internal Postgres -> Edge authentication uses the existing Supabase Vault `SUPABASE_SERVICE_ROLE_KEY`; no fixed bearer credential is stored in SQL or Edge source.
4. `extract-plate-text` is an internal-only endpoint. Supabase verifies the JWT at the gateway and the function additionally requires the bearer token to be the service-role credential. Resident, guard, admin, anon, and ordinary authenticated JWTs are rejected.
5. The Edge Function refuses arbitrary storage access: `entry_log_id` is mandatory, the bucket is fixed to `entry-photos`, and `image_path` must exactly match the entry log's `vehicle_photo_path`.
6. Gemini 2.5 Flash performs the OCR request.
7. Every actual or potentially billable Gemini invocation records one best-effort `entry_usage_ledger` row with community, model, image count, measured tokens when returned, duration, outcome, request/correlation IDs, pricing version, and an estimated standard-list cost when token counts are available.
8. A successful provider response persists the OCR result to `entry_logs`. A database trigger closes the matching queue row as `DONE` in that same database transaction, including a valid `NO_PLATE`/null result.
9. `DONE` is terminal for the autonomous worker. A late transport error or failure in the Edge Function's redundant queue update cannot reopen completed work and accidentally bill a duplicate Gemini retry.
10. Failed calls remain retryable until `max_attempts`. `process_plate_ocr_queue()` is scheduled once per minute, while `scheduled_at` provides a two-minute per-row backoff. Legacy rows with an already persisted plate are reconciled before retry dispatch.

## Cost semantics

Pricing snapshot for `gemini-2.5-flash` standard paid-list pricing reviewed on 2026-09-07:

- input text/image/video: USD 0.30 / 1M tokens
- output including thinking tokens: USD 2.50 / 1M tokens

Source: Google AI Gemini API pricing documentation.

The ledger value is an operational estimate at the stored pricing snapshot, not a provider invoice. The current billing account may have free-tier credits or other commercial terms. Historical rows must not be silently recomputed with newer pricing.

Token accounting uses `usageMetadata.promptTokenCount` for input and candidates + thinking tokens for output when available. Raw Gemini payloads, full OCR output, vehicle images, PINs, JWTs, provider keys, and recipient/user secrets are not stored in the usage ledger.

Usage accounting is best-effort by design. A ledger transport failure must not convert a successful provider response into a product retry. Conversely, a provider call is still billable even if later result persistence fails, so provider success/failure and persistence success/failure remain separate operational concepts.

## Security properties

- Edge deployment must use `verify_jwt=true`.
- The OCR endpoint is service-role only; it is not a public or client-side OCR API.
- No legacy OCR shared secret is present in repository code.
- Internal Postgres calls use service-role JWT material from Supabase Vault at runtime.
- No service-role value is copied into migrations, source code, logs, or documentation.
- The caller cannot select an arbitrary storage object: the requested image must belong to the supplied entry log.
- The Gemini API key is sent in the `x-goog-api-key` request header, not in the request URL.
- OCR remains auxiliary: trigger exceptions never fail a real gate check-in.
- Queue completion is monotonic: once OCR work is `DONE`, autonomous error/retry paths cannot reopen it.

## Release order

The old DB dispatcher and the hardened Edge Function use different internal authentication. A brief mismatch during rollout is acceptable because the queue is durable and OCR never blocks check-in.

Release in this order:

1. Deploy the repository-owned `extract-plate-text` with `verify_jwt=true`.
2. Immediately apply `20260907182000_entry_ocr_production_hardening.sql` so DB dispatch switches to the Vault service-role JWT, atomic queue completion becomes active, and the retry scheduler starts.
3. Apply `20260907182500_entry_ocr_observability_status.sql` so the existing Observability screen reports the repository-controlled provider capability as instrumented.
4. Confirm the live Edge Function reports `verify_jwt=true` and the OCR cron job is active.
5. Confirm no queue rows were exhausted during the short rollout window; any temporary pending row should be retried by the scheduler.
6. Run one controlled Paradis check-in with a vehicle image and verify queue completion + one usage-ledger row.

Do not reintroduce a custom shared bearer credential to create a compatibility deployment.

## Production smoke acceptance

A controlled test is accepted only when all of the following are true:

- check-in completes independently of OCR latency;
- one queue row exists for the entry log;
- successful OCR becomes `DONE` and does not remain pending;
- a no-readable-plate result can still become `DONE`;
- completed queue work does not reopen on a later retry/error update;
- a real Gemini invocation creates exactly one provider usage record;
- the usage row is attributed to the correct community;
- input/output tokens are populated when Google returns `usageMetadata`;
- estimated cost is populated only from the stored pricing snapshot;
- Observability reports provider usage as instrumented and shows Image OCR evidence from the new run;
- no raw image, raw OCR response, bearer token, API key, or service-role key is written to operational telemetry.
