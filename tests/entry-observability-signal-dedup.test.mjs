import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20260907194500_entry_observability_signal_dedup.sql"),
  "utf8",
);

test("Validate QR uses canonical resolver telemetry instead of double-counting entry logs", () => {
  assert.match(migration, /p_flow_key = 'validate_qr'/);
  assert.match(migration, /'QR_VALIDATED'/);
  assert.match(migration, /'QR_VALIDATION_FAILED'/);
  assert.doesNotMatch(migration, /a\.source = 'entry_access'/);
  assert.doesNotMatch(migration, /access_method = 'QR'/);
});

test("Image OCR health uses queue outcomes while provider usage stays economic telemetry", () => {
  assert.match(migration, /p_flow_key = 'image_ocr'/);
  assert.match(migration, /from public\.plate_ocr_queue q/);
  assert.match(migration, /q\.status = 'DONE' then 'success'/);
  assert.doesNotMatch(migration, /from public\.entry_usage_ledger/);
});

test("OCR flow latency is end-to-end queue duration, not mixed provider and queue duration", () => {
  assert.match(
    migration,
    /extract\(epoch from \(q\.completed_at - q\.created_at\)\) \* 1000/,
  );
  assert.match(migration, /percentile_cont\(0\.95\)/);
});

test("public read model replaces only the duplicated flows and recomputes global status", () => {
  assert.match(migration, /when 'validate_qr' then v_qr/);
  assert.match(migration, /when 'image_ocr' then v_ocr/);
  assert.match(migration, /\{critical_flows\}/);
  assert.match(migration, /\{summary,system_status\}/);
  assert.match(migration, /where f->>'status' = 'unknown'/);
});

test("OCR provider capability remains instrumented after the read-model correction", () => {
  assert.match(migration, /\{ocr_queue,provider_instrumented\}/);
  assert.match(migration, /\{ocr_queue,provider_usage_status\}/);
  assert.match(migration, /instrumented/);
});
