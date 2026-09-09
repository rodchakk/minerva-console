import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const migration = read(
  "supabase/migrations/20260909003000_entry_notification_worker_recovery.sql",
);
const smartService = read("supabase/functions/smart-service/index.ts");
const page = read(
  "app/(console)/products/entry/observability/notifications/page.tsx",
);
const query = read(
  "features/entry/observability/notificationWorkerHealth.ts",
);
const panel = read(
  "features/entry/observability/NotificationWorkerHealthPanel.tsx",
);

test("worker health model is durable, single-row, and service-write-only", () => {
  assert.match(migration, /create table if not exists public\.entry_notification_worker_health/);
  assert.match(migration, /worker_name text primary key/);
  assert.match(migration, /alter table public\.entry_notification_worker_health enable row level security/);
  assert.match(migration, /revoke all on table public\.entry_notification_worker_health from public, anon, authenticated/);
  assert.match(migration, /record_entry_notification_worker_cycle_v1/);
  assert.match(migration, /grant execute on function public\.record_entry_notification_worker_cycle_v1[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.record_entry_notification_worker_cycle_v1[\s\S]*to authenticated/);
});

test("existing claim failure is backfilled so the motivating incident can later prove recovery", () => {
  assert.match(migration, /with latest_claim_failure as/);
  assert.match(migration, /s\.event_type = 'PUSH_CLAIM_RPC_ERROR'/);
  assert.match(migration, /coalesce\(s\.source, ''\) = 'smart-service'/);
  assert.match(migration, /'PUSH_CLAIM_RPC_ERROR'/);
  assert.match(migration, /on conflict \(worker_name\) do nothing/);
});

test("worker success and failure cycles preserve recovery semantics", () => {
  assert.match(migration, /last_success_at = case[\s\S]*when p_success then excluded\.last_cycle_at/);
  assert.match(migration, /last_failure_at = case[\s\S]*when p_success then public\.entry_notification_worker_health\.last_failure_at/);
  assert.match(migration, /consecutive_failures = case[\s\S]*when p_success then 0/);
  assert.match(migration, /v_recovered := v_previous_failure is not null[\s\S]*v_previous_failure > coalesce\(v_previous_success/);
  assert.match(migration, /PUSH_WORKER_RECOVERED/);
});

test("worker health read model is superadmin-only and detects stale heartbeats", () => {
  assert.match(migration, /create or replace function public\.sa_get_entry_notification_worker_health_v1/);
  assert.match(migration, /if not public\.is_superadmin\(\)/);
  assert.match(migration, /interval '6 minutes'/);
  assert.match(migration, /when v_is_stale then 'degraded'/);
  assert.match(migration, /when v_row\.last_status = 'success' then 'healthy'/);
});

test("smart-service source is repository-controlled and records every successful claim loop", () => {
  assert.match(smartService, /recordWorkerCycle/);
  assert.match(smartService, /record_entry_notification_worker_cycle_v1/);
  assert.match(smartService, /if \(!rows\.length\) \{[\s\S]*success: true/);
  assert.match(smartService, /success: true,[\s\S]*claimed: rows\.length,[\s\S]*processed: summary\.length/);
  assert.match(smartService, /PUSH_CLAIM_RPC_ERROR[\s\S]*success: false/);
  assert.match(smartService, /PUSH_WORKER_FATAL_ERROR/);
});

test("worker telemetry remains fail-open and does not redefine delivery success", () => {
  assert.match(smartService, /observability must never block notification processing/);
  assert.match(panel, /Worker-cycle health is tracked separately from notification delivery outcomes/);
  assert.match(panel, /without pretending a notification was delivered/);
  assert.doesNotMatch(smartService, /PUSH_WORKER_CYCLE_OK/);
});

test("malformed claim-row logging no longer exposes the raw queue row", () => {
  assert.match(smartService, /PUSH_CLAIM_ROW_MISSING_ID/);
  assert.doesNotMatch(smartService, /PUSH_CLAIM_ROW_MISSING_ID[\s\S]{0,220}\{ raw \}/);
  assert.match(smartService, /has_message_id: Boolean\(raw\.message_id\)/);
  assert.match(smartService, /has_community_id: Boolean\(raw\.community_id\)/);
});

test("console fetches and renders worker recovery separately from notification event counts", () => {
  assert.match(query, /sa_get_entry_notification_worker_health_v1/);
  assert.match(page, /getEntryNotificationWorkerHealth/);
  assert.match(page, /NotificationWorkerHealthPanel result=\{workerHealth\}/);
  assert.match(panel, /Last successful cycle/);
  assert.match(panel, /Last failure/);
  assert.match(panel, /Consecutive failures/);
  assert.match(panel, /Recovery/);
  assert.match(panel, /Recovered/);
});
