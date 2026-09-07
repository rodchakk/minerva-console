import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const migration = read(
  "supabase/migrations/20260907090000_entry_observability_v1.sql",
);
const page = read("app/(console)/products/entry/observability/page.tsx");
const loading = read("app/(console)/products/entry/observability/loading.tsx");
const filters = read("features/entry/observability/ObservabilityFilters.tsx");
const queries = read("features/entry/observability/queries.ts");
const sidebar = read("components/layout/AppSidebar.tsx");
const worker = read("supabase/functions/send-onboarding-email-batch/index.ts");
const docs = read("docs/entry-observability.md");

test("ENTRY Observability adds a focused usage ledger without weakening direct table access", () => {
  assert.match(migration, /create table if not exists public\.entry_usage_ledger/);
  assert.match(migration, /alter table public\.entry_usage_ledger enable row level security/);
  assert.match(
    migration,
    /revoke all on table public\.entry_usage_ledger from public, anon, authenticated/,
  );
  assert.match(migration, /grant select, insert on table public\.entry_usage_ledger to service_role/);
  assert.match(migration, /constraint entry_usage_ledger_metadata_object/);
  assert.match(migration, /estimated_cost\s+numeric\(18, 8\)/);
  assert.match(migration, /pricing_version\s+text/);
  assert.match(migration, /request_id\s+text/);
  assert.match(migration, /correlation_id\s+text/);
});

test("usage writes are service-role only and preserve unknown cost honestly", () => {
  assert.match(migration, /create or replace function public\.record_entry_usage_v1/);
  assert.match(migration, /auth\.role\(\)[\s\S]*'service_role'/);
  assert.match(migration, /p_estimated_cost numeric default null/);
  assert.match(migration, /Provider prices must not be invented|estimated_cost.*NULL/i);
  assert.match(docs, /Provider prices must not be invented/);
  assert.match(docs, /Retries are counted as separate ledger rows/);
});

test("read model is superadmin-only, bounded, and server-side aggregated", () => {
  assert.match(migration, /create or replace function public\.sa_get_entry_observability_v1/);
  assert.match(migration, /if not public\.is_superadmin\(\)/);
  assert.match(migration, /v_end - v_start > interval '31 days'/);
  assert.match(migration, /returns jsonb/);
  assert.match(migration, /jsonb_build_object\(\s*'summary'/);
  assert.match(queries, /supabase\.rpc\("sa_get_entry_observability_v1"/);
  assert.doesNotMatch(page, /\.from\("system_event_log"\)/);
  assert.doesNotMatch(page, /\.from\("entry_usage_ledger"\)/);
});

test("critical flow health keeps missing telemetry unknown instead of fake green", () => {
  assert.match(migration, /_entry_observability_flow_status_v1/);
  assert.match(migration, /p_evidence_count[\s\S]*then 'unknown'/);
  for (const flow of [
    "create_pass",
    "validate_qr",
    "resident_login",
    "registration",
    "image_ocr",
    "notifications",
  ]) {
    assert.match(migration, new RegExp(`'${flow}'`));
  }
  assert.match(docs, /No telemetry must stay Unknown/);
  assert.match(page, /No telemetry is Unknown/);
});

test("incidents are grouped from recurring failures with community impact", () => {
  assert.match(migration, /error_fingerprint/);
  assert.match(migration, /_entry_observability_normalize_fingerprint_v1/);
  assert.match(migration, /having count\(\*\) >= 2/);
  assert.match(migration, /affected_community_count/);
  assert.match(migration, /incident_communities/);
  assert.match(page, /communities affected/);
});

test("dashboard route, filters, loading state, and sidebar entry are wired", () => {
  assert.match(sidebar, /Observability/);
  assert.match(sidebar, /\/products\/entry\/observability/);
  assert.match(page, /ENTRY observability/);
  assert.match(page, /ObservabilityFilters/);
  assert.match(filters, /All communities/);
  assert.match(filters, /Last 24 hours/);
  assert.match(filters, /Last 7 days/);
  assert.match(filters, /Last 30 days/);
  assert.match(loading, /EntryObservabilityLoading/);
});

test("usage and cost UI avoids fabricated metrics", () => {
  assert.match(page, /Tracked operations/);
  assert.match(page, /Not available/);
  assert.match(page, /No data/);
  assert.match(page, /unknownCostCount/);
  assert.doesNotMatch(page, /1,284|0\.16%|184 ms|\$2\.71/);
});

test("onboarding email worker records actual Resend provider calls best-effort without secrets", () => {
  assert.match(worker, /recordEntryUsage/);
  assert.match(worker, /record_entry_usage_v1/);
  assert.match(worker, /p_provider: "resend"/);
  assert.match(worker, /p_operation: "onboarding_email"/);
  assert.match(worker, /Date\.now\(\) - providerStartedAt/);
  assert.match(worker, /p_estimated_cost: null/);
  assert.match(worker, /p_quantity: 1/);
  assert.doesNotMatch(worker, /p_metadata:[\s\S]{0,500}recipient_email/);
  assert.doesNotMatch(worker, /p_metadata:[\s\S]{0,500}pin/);
});

test("observability docs define ownership, privacy, and future instrumentation rules", () => {
  assert.match(docs, /Operational telemetry/);
  assert.match(docs, /Incidents/);
  assert.match(docs, /Audit/);
  assert.match(docs, /Security/);
  assert.match(docs, /Usage and cost/);
  assert.match(docs, /Never log/);
  assert.match(docs, /record_entry_usage_v1/);
});
