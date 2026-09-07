import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const edgePath = "supabase/functions/extract-plate-text/index.ts";
const migrationPath =
  "supabase/migrations/20260907182000_entry_ocr_production_hardening.sql";

const [edge, migration] = await Promise.all([
  readFile(edgePath, "utf8"),
  readFile(migrationPath, "utf8"),
]);

test("OCR source is recovered without the legacy hardcoded shared secret", () => {
  assert.match(edge, /GEMINI_API_KEY/);
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(edge, /INTERNAL_OCR_SECRET/);
  assert.doesNotMatch(migration, /INTERNAL_OCR_SECRET/);
  assert.match(migration, /vault\.decrypted_secrets/);
  assert.match(migration, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(migration, /'Bearer '\s*\|\|\s*v_service_role_key/);
});

test("OCR Edge endpoint is internal service-role only", () => {
  assert.match(edge, /bearerToken !== SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge, /Internal service role required/);
  assert.doesNotMatch(edge, /SUPABASE_ANON_KEY/);
  assert.doesNotMatch(edge, /community_members/);
  assert.doesNotMatch(edge, /\.in\("role"/);
});

test("Gemini API key is sent as a header, never embedded in the request URL", () => {
  assert.match(edge, /"x-goog-api-key": GEMINI_API_KEY/);
  assert.doesNotMatch(edge, /GEMINI_ENDPOINT\}\?key=/);
  assert.doesNotMatch(edge, /encodeURIComponent\(GEMINI_API_KEY\)/);
});

test("OCR requests are bound to the real entry log and its exact image", () => {
  assert.match(edge, /entry_log_id required/);
  assert.match(edge, /OCR image does not match entry log/);
  assert.match(edge, /\.eq\("id", entryLogId\)/);
  assert.match(edge, /entryLog\.vehicle_photo_path !== imagePath/);
  assert.match(edge, /requestedBucket !== OCR_BUCKET/);
});

test("provider calls record measured Gemini usage and historical pricing assumptions", () => {
  assert.match(edge, /usageMetadata/);
  assert.match(edge, /promptTokenCount/);
  assert.match(edge, /candidatesTokenCount/);
  assert.match(edge, /thoughtsTokenCount/);
  assert.match(edge, /p_operation: "image_ocr"/);
  assert.match(edge, /p_provider: "google_gemini"/);
  assert.match(edge, /p_service_model: GEMINI_MODEL/);
  assert.match(edge, /p_image_count: 1/);
  assert.match(edge, /p_pricing_version: PRICING_VERSION/);
  assert.match(edge, /INPUT_USD_PER_MILLION_TOKENS = 0\.3/);
  assert.match(edge, /OUTPUT_USD_PER_MILLION_TOKENS = 2\.5/);
  assert.match(edge, /pricing_basis: "standard_paid_list"/);
});

test("provider failures are accounted without leaking raw OCR or provider payloads", () => {
  assert.match(edge, /GEMINI_NETWORK_ERROR/);
  assert.match(edge, /GEMINI_HTTP_/);
  assert.match(edge, /GEMINI_INVALID_RESPONSE/);
  assert.doesNotMatch(edge, /raw:\s*rawText/);
  assert.doesNotMatch(edge, /errBody\.substring/);
  assert.doesNotMatch(edge, /console\.log\([^\n]*plateText/);
});

test("successful provider completion closes the queue even when no plate is readable", () => {
  assert.match(edge, /resultKind: plateText \? "plate" : "no_plate"/);
  assert.match(edge, /status: "DONE"/);
  assert.match(edge, /completed_at: new Date\(\)\.toISOString\(\)/);
});

test("successful result persistence atomically closes queue work and DONE cannot reopen", () => {
  assert.match(migration, /_entry_ocr_complete_queue_on_result_v1/);
  assert.match(migration, /after update of vehicle_plate_text on public\.entry_logs/i);
  assert.match(
    migration,
    /update public\.plate_ocr_queue[\s\S]*status = 'DONE'[\s\S]*entry_log_id = NEW\.id/,
  );
  assert.match(migration, /_entry_ocr_preserve_done_queue_v1/);
  assert.match(migration, /if OLD\.status = 'DONE' then[\s\S]*NEW\.status := 'DONE'/);
  assert.match(migration, /NO_PLATE/);
});

test("OCR queue is durable, unique, retryable and concurrency safe", () => {
  assert.match(migration, /idx_plate_ocr_queue_entry_log_unique/);
  assert.match(migration, /on conflict \(entry_log_id\)/i);
  assert.match(migration, /now\(\) \+ interval '2 minutes'/);
  assert.match(migration, /for update of q skip locked/i);
  assert.match(migration, /attempts = attempts \+ 1/);
  assert.match(migration, /attempts >= max_attempts/);
  assert.match(migration, /OCR_DISPATCH_FAILED/);
});

test("legacy successful rows are reconciled before retry dispatch", () => {
  const reconcileIndex = migration.indexOf("Reconcile successful legacy/partial writes");
  const dispatchLoopIndex = migration.indexOf("for v_item in");
  assert.ok(reconcileIndex >= 0);
  assert.ok(dispatchLoopIndex >= 0);
  assert.ok(reconcileIndex < dispatchLoopIndex);
});

test("OCR retry worker is scheduled autonomously", () => {
  assert.match(migration, /entry-plate-ocr-queue/);
  assert.match(migration, /'\* \* \* \* \*'/);
  assert.match(migration, /select public\.process_plate_ocr_queue\(\);/);
});

test("gate check-in remains available when OCR dispatch fails", () => {
  assert.match(migration, /exception\s+when others then[\s\S]*return NEW;/i);
});
