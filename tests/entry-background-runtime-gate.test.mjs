import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const sql = readFileSync(join(root, "supabase/migrations/20261002011548_entry_background_runtime_gate.sql"), "utf8");
const recoverySql = readFileSync(join(root, "supabase/migrations/20261007185013_entry_background_recovery_stage.sql"), "utf8");

test("background runtime gate defaults to severe load shedding", () => {
  assert.match(sql, /mode in \('NORMAL', 'DEGRADED', 'SEVERE'\)/);
  assert.match(sql, /'global',\s*'SEVERE'/);
  assert.match(sql, /coalesce\(v_mode, 'SEVERE'\)/);
});

test("degraded mode allows only bounded mobile communication workers", () => {
  const degraded = sql.match(/elsif v_mode = 'DEGRADED'[\s\S]*?else\n    v_allowed := false/);
  assert.ok(degraded, "DEGRADED branch must exist");
  assert.match(degraded[0], /community-message-push-worker/);
  assert.match(degraded[0], /entry-mobile-push-receipts/);
  assert.doesNotMatch(degraded[0], /entry-plate-ocr-queue/);
  assert.doesNotMatch(degraded[0], /entry-web-push-dispatch/);
});

test("all incident high-frequency crons are routed through the gate and remain disabled", () => {
  for (const job of [
    "cleanup-edge-rate-limits",
    "community-message-push-stale-sweeper",
    "community-message-push-worker",
    "entry-mobile-push-receipts",
    "entry-observability-incident-reconcile",
    "entry-plate-ocr-queue",
    "entry-web-push-dispatch",
    "expire-stale-records",
  ]) {
    assert.match(sql, new RegExp(job));
  }

  assert.match(sql, /run_entry_background_job_v1/);
  assert.match(sql, /cron\.alter_job/);
  assert.match(sql, /active => false/);
});

test("runtime gate is not executable by browser roles", () => {
  assert.match(sql, /revoke all on function public\.run_entry_background_job_v1\(text\) from anon/);
  assert.match(sql, /revoke all on function public\.run_entry_background_job_v1\(text\) from authenticated/);
  assert.match(sql, /grant execute on function public\.run_entry_background_job_v1\(text\) to service_role/);
});

test("database-side fan-out is bounded before downstream workers run", () => {
  assert.match(sql, /jsonb_build_object\('limit',5\)/);
  assert.match(sql, /jsonb_build_object\('limit',50\)/);
  assert.match(sql, /limit 3\s+for update of q skip locked/i);
  assert.match(sql, /timeout_milliseconds => 9000/);
  assert.match(sql, /timeout_milliseconds := 15000/);
});

test("generated function definitions are terminated as SQL statements", () => {
  assert.doesNotMatch(sql, /\$function\$\s+(?=create or replace function)/i);
  assert.match(sql, /\$function\$;\s*CREATE OR REPLACE FUNCTION public\.trigger_entry_mobile_push_receipt_worker/i);
  assert.match(sql, /\$function\$;\s*CREATE OR REPLACE FUNCTION public\.process_plate_ocr_queue/i);
  assert.match(sql, /\$function\$;\s*create or replace function public\.run_entry_background_job_v1/i);
});

test("recovery mode permits database-only maintenance but still blocks provider fan-out", () => {
  assert.match(recoverySql, /mode in \('NORMAL', 'RECOVERY', 'DEGRADED', 'SEVERE'\)/);

  const recovery = recoverySql.match(/elsif v_mode = 'RECOVERY'[\s\S]*?elsif v_mode = 'DEGRADED'/);
  assert.ok(recovery, "RECOVERY branch must exist");

  for (const job of [
    "cleanup-edge-rate-limits",
    "community-message-push-stale-sweeper",
    "community-message-push-worker",
    "entry-mobile-push-receipts",
    "entry-observability-incident-reconcile",
    "expire-stale-records",
  ]) {
    assert.match(recovery[0], new RegExp(job));
  }

  assert.doesNotMatch(recovery[0], /entry-plate-ocr-queue/);
  assert.doesNotMatch(recovery[0], /entry-web-push-dispatch/);
});

test("each background job has a transaction-scoped overlap guard", () => {
  assert.match(recoverySql, /hashtextextended\('entry-background:' \|\| v_job_name, 0\)/);
  assert.match(recoverySql, /pg_try_advisory_xact_lock\(v_lock_key\)/);
  assert.match(recoverySql, /'reason', 'overlap_guard'/);
});

test("recovery migration preserves service-only execution", () => {
  assert.match(recoverySql, /revoke all on function public\.run_entry_background_job_v1\(text\) from public/);
  assert.match(recoverySql, /revoke all on function public\.run_entry_background_job_v1\(text\) from anon/);
  assert.match(recoverySql, /revoke all on function public\.run_entry_background_job_v1\(text\) from authenticated/);
  assert.match(recoverySql, /grant execute on function public\.run_entry_background_job_v1\(text\) to service_role/);
});
