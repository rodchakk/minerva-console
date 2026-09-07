import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

const severityRank = new Map([
  ["INFO", 1],
  ["WARNING", 2],
  ["WARN", 2],
  ["ERROR", 3],
  ["CRITICAL", 4],
]);

function normalizeSeverity(value) {
  const rank = severityRank.get(String(value ?? "INFO").toUpperCase()) ?? 1;
  return rank === 4
    ? "CRITICAL"
    : rank === 3
      ? "ERROR"
      : rank === 2
        ? "WARNING"
        : "INFO";
}

function highestSeverity(values) {
  return values
    .map(normalizeSeverity)
    .sort(
      (left, right) =>
        (severityRank.get(right) ?? 1) - (severityRank.get(left) ?? 1),
    )[0];
}

function flowStatus({ evidenceCount, failureCount, lastSuccessAt, successCount }) {
  if (evidenceCount === 0) return "unknown";
  if (successCount === 0 && failureCount >= 5) return "down";
  if (successCount === 0 && failureCount > 0) return "degraded";
  if (failureCount >= 3 && failureCount / Math.max(successCount + failureCount, 1) >= 0.2) {
    return "degraded";
  }
  return lastSuccessAt ? "healthy" : "unknown";
}

function globalStatus({ flows, hasCriticalOrErrorIncident, trackedOperations }) {
  const statuses = flows.map(flowStatus);
  if (statuses.includes("down")) return "down";
  if (hasCriticalOrErrorIncident) return "degraded";
  if (statuses.includes("degraded")) return "degraded";
  if (trackedOperations === 0) return "unknown";
  if (!statuses.some((status) => ["healthy", "degraded", "down"].includes(status))) {
    return "unknown";
  }
  return "healthy";
}

function shouldSurfaceIncident({ occurrenceCount, severity }) {
  return occurrenceCount >= 2 || normalizeSeverity(severity) === "CRITICAL";
}

function includesCommunityScopedRow(rowCommunityId, selectedCommunityId) {
  if (selectedCommunityId) return rowCommunityId === selectedCommunityId;
  return true;
}

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

test("system event reads use only the deployed schema and derive optional telemetry from details", () => {
  for (const missingColumn of [
    "s.status",
    "s.duration_ms",
    "s.error_code",
    "s.error_fingerprint",
  ]) {
    assert.doesNotMatch(migration, new RegExp(missingColumn.replace(".", "\\.")));
  }
  assert.match(migration, /s\.details->>'status'/);
  assert.match(migration, /_entry_observability_jsonb_integer_v1\(s\.details, 'duration_ms'\)/);
  assert.match(migration, /s\.details->>'error_code'/);
  assert.equal(normalizeSeverity("WARN"), "WARNING");
});

test("entry_logs action enum is converted to text before union fallback", () => {
  assert.match(migration, /coalesce\(el\.action::text, 'ENTRY_ACCESS'\)/);
  assert.doesNotMatch(migration, /coalesce\(el\.action, 'ENTRY_ACCESS'\)/);
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
  assert.equal(
    flowStatus({
      evidenceCount: 0,
      failureCount: 0,
      lastSuccessAt: null,
      successCount: 0,
    }),
    "unknown",
  );
  assert.equal(
    flowStatus({
      evidenceCount: 5,
      failureCount: 5,
      lastSuccessAt: null,
      successCount: 0,
    }),
    "down",
  );
});

test("incidents are grouped from recurring failures with community impact", () => {
  assert.match(migration, /error_fingerprint/);
  assert.match(migration, /_entry_observability_normalize_fingerprint_v1/);
  assert.match(migration, /having count\(\*\) >= 2/);
  assert.match(migration, /max\(public\._entry_observability_severity_rank_v1\(a\.severity\)\) = 4/);
  assert.match(migration, /affected_community_count/);
  assert.match(migration, /incident_communities/);
  assert.match(page, /communities affected/);
  assert.equal(highestSeverity(["ERROR", "WARNING"]), "ERROR");
  assert.equal(shouldSurfaceIncident({ occurrenceCount: 1, severity: "CRITICAL" }), true);
  assert.equal(shouldSurfaceIncident({ occurrenceCount: 1, severity: "ERROR" }), false);
  assert.equal(shouldSurfaceIncident({ occurrenceCount: 2, severity: "WARNING" }), true);
});

test("global health evaluates DOWN before degraded incidents", () => {
  assert.match(migration, /where public\._entry_observability_flow_status_v1[\s\S]*= 'down'[\s\S]*then 'down'[\s\S]*severity in \('CRITICAL', 'ERROR'\)[\s\S]*then 'degraded'/);
  assert.equal(
    globalStatus({
      flows: [
        {
          evidenceCount: 5,
          failureCount: 5,
          lastSuccessAt: null,
          successCount: 0,
        },
      ],
      hasCriticalOrErrorIncident: true,
      trackedOperations: 5,
    }),
    "down",
  );
});

test("selected-community scope excludes unrelated global operational rows", () => {
  assert.match(migration, /\(v_selected_community is null and s\.community_id is null\)/);
  assert.match(migration, /\(v_selected_community is null and u\.community_id is null\)/);
  assert.match(migration, /\(v_selected_community is null and c\.id is null\)/);
  assert.equal(includesCommunityScopedRow(null, "community-a"), false);
  assert.equal(includesCommunityScopedRow("community-b", "community-a"), false);
  assert.equal(includesCommunityScopedRow("community-a", "community-a"), true);
  assert.equal(includesCommunityScopedRow(null, null), true);
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
  assert.match(worker, /const \{ error \} = await supabase\.rpc\("record_entry_usage_v1"/);
  assert.match(worker, /if \(error\)/);
  assert.match(worker, /p_provider: "resend"/);
  assert.match(worker, /p_operation: "onboarding_email"/);
  assert.match(worker, /Date\.now\(\) - providerStartedAt/);
  assert.match(worker, /p_estimated_cost: null/);
  assert.match(worker, /p_quantity: 1/);
  assert.doesNotMatch(worker, /p_metadata:[\s\S]{0,500}recipient_email/);
  assert.doesNotMatch(worker, /p_metadata:[\s\S]{0,500}pin/);
});

test("OCR economics are foundation-ready but not claimed as instrumented without source", () => {
  assert.equal(
    existsSync(join(root, "supabase/functions/extract-plate-text/index.ts")),
    false,
  );
  assert.match(migration, /'image_ocr'/);
  assert.match(docs, /foundation-ready but not yet instrumented/);
  assert.match(docs, /extract-plate-text/);
  assert.match(docs, /Do not infer token usage from image count/);
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
