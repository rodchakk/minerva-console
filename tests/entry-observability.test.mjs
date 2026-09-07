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
const ocrStatusMigration = read(
  "supabase/migrations/20260907182500_entry_ocr_observability_status.sql",
);
const page = read("app/(console)/products/entry/observability/page.tsx");
const loading = read("app/(console)/products/entry/observability/loading.tsx");
const filters = read("features/entry/observability/ObservabilityFilters.tsx");
const queries = read("features/entry/observability/queries.ts");
const sidebar = read("components/layout/AppSidebar.tsx");
const worker = read("supabase/functions/send-onboarding-email-batch/index.ts");
const ocrSource = read("supabase/functions/extract-plate-text/index.ts");
const docs = read("docs/entry-observability.md");
const ocrDocs = read("docs/entry-ocr-production-hardening.md");
const ci = read(".github/workflows/ci.yml");

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
  if (statuses.includes("unknown")) return "unknown";
  return "healthy";
}

function flowKeyForAttempt({ accessMethod, eventType, source }) {
  if (
    [
      "PASS_CREATE",
      "PASS_CREATED",
      "PASS_CREATE_FAILED",
      "CREATE_PASS",
      "CREATE_PASS_FAILED",
      "ACCESS_PASS_CREATED",
      "ACCESS_PASS_CREATE_FAILED",
    ].includes(eventType)
  ) {
    return "create_pass";
  }

  if (
    (source === "entry_access" && accessMethod === "QR") ||
    [
      "QR_VALIDATED",
      "QR_VALIDATION_FAILED",
      "ACCESS_QR_VALIDATED",
      "ACCESS_QR_REJECTED",
    ].includes(eventType)
  ) {
    return "validate_qr";
  }

  if (source === "community_registration") return "registration";
  if (source === "plate_ocr_queue" || eventType === "image_ocr") return "image_ocr";
  return null;
}

function classifyRegistrationEvent(eventType) {
  if (
    [
      "household_submitted",
      "household_resubmitted",
      "unit_reviewed",
      "unit_confirmed",
      "unit_conversion_completed",
    ].includes(eventType)
  ) {
    return "success";
  }

  if (["resident_conversion_blocked", "conversion_failed"].includes(eventType)) {
    return "failed";
  }

  return "unknown";
}

function errorRate({ failedOperations, successfulOperations }) {
  const knownOutcomeOperations = failedOperations + successfulOperations;
  return knownOutcomeOperations === 0
    ? null
    : failedOperations / knownOutcomeOperations;
}

function classifyOcrQueueJob({ attempts, maxAttempts, scheduledMinutesAgo, status }) {
  if (status === "DONE") return "success";
  if (status === "FAILED") return "failed";
  if (maxAttempts > 0 && attempts >= maxAttempts) return "failed";
  if (status === "PROCESSING" && scheduledMinutesAgo > 15) return "failed";
  if (status === "PENDING" && scheduledMinutesAgo > 30) return "failed";
  return "unknown";
}

function includesOcrQueueJob({
  completedMinutesAgo,
  createdMinutesAgo,
  rangeMinutes,
  scheduledMinutesAgo,
  status,
}) {
  if (status === "PENDING" || status === "PROCESSING") return true;

  const terminalMinutesAgo =
    completedMinutesAgo ?? scheduledMinutesAgo ?? createdMinutesAgo;
  return terminalMinutesAgo >= 0 && terminalMinutesAgo < rangeMinutes;
}

function openOcrObservedMinutesAgo({ createdMinutesAgo }) {
  return Math.max(createdMinutesAgo, 0);
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

test("Validate QR health only uses QR access or explicit QR validation events", () => {
  assert.match(migration, /el\.method::text as access_method/);
  assert.match(migration, /a\.source = 'entry_access' and a\.access_method = 'QR'/);
  assert.doesNotMatch(migration, /when a\.source = 'entry_access' or a\.event_type/);

  assert.equal(
    flowKeyForAttempt({
      accessMethod: "MANUAL",
      eventType: "CHECK_IN",
      source: "entry_access",
    }),
    null,
  );
  assert.equal(
    flowKeyForAttempt({
      accessMethod: "PIN",
      eventType: "CHECK_IN",
      source: "entry_access",
    }),
    null,
  );
  assert.equal(
    flowKeyForAttempt({
      accessMethod: "QR",
      eventType: "CHECK_IN",
      source: "entry_access",
    }),
    "validate_qr",
  );
});

test("registration health uses an explicit operational evidence allowlist", () => {
  assert.match(migration, /'household_submitted'[\s\S]*then 'success'/);
  assert.match(migration, /'resident_conversion_blocked', 'conversion_failed'\) then 'failed'/);
  assert.match(migration, /else 'unknown'/);

  assert.equal(classifyRegistrationEvent("campaign_created"), "unknown");
  assert.equal(classifyRegistrationEvent("units_added"), "unknown");
  assert.equal(classifyRegistrationEvent("household_submitted"), "success");
  assert.equal(classifyRegistrationEvent("unit_conversion_completed"), "success");
  assert.equal(classifyRegistrationEvent("conversion_failed"), "failed");
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

test("global health stays Unknown when critical flow coverage is partial", () => {
  assert.match(migration, /where public\._entry_observability_flow_status_v1[\s\S]*= 'unknown'[\s\S]*then 'unknown'/);
  assert.equal(
    globalStatus({
      flows: [
        {
          evidenceCount: 0,
          failureCount: 0,
          lastSuccessAt: null,
          successCount: 0,
        },
        {
          evidenceCount: 1,
          failureCount: 0,
          lastSuccessAt: "2026-09-07T12:00:00Z",
          successCount: 1,
        },
        {
          evidenceCount: 0,
          failureCount: 0,
          lastSuccessAt: null,
          successCount: 0,
        },
        {
          evidenceCount: 0,
          failureCount: 0,
          lastSuccessAt: null,
          successCount: 0,
        },
        {
          evidenceCount: 0,
          failureCount: 0,
          lastSuccessAt: null,
          successCount: 0,
        },
        {
          evidenceCount: 0,
          failureCount: 0,
          lastSuccessAt: null,
          successCount: 0,
        },
      ],
      hasCriticalOrErrorIncident: false,
      trackedOperations: 1,
    }),
    "unknown",
  );
});

test("error rate ignores unknown operations instead of diluting known failures", () => {
  assert.match(migration, /known_outcome_operations/);
  assert.match(migration, /unclassified_operations/);
  assert.match(migration, /failed_operations[\s\S]*greatest\(\(select known_outcome_operations from summary\), 1\)/);
  assert.equal(errorRate({ failedOperations: 1, successfulOperations: 0 }), 1);
  assert.equal(errorRate({ failedOperations: 0, successfulOperations: 0 }), null);
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

test("OCR queue visibility uses queue state and the hardening release flips provider capability", () => {
  assert.match(migration, /from public\.plate_ocr_queue q/);
  assert.match(migration, /join public\.entry_logs el on el\.id = q\.entry_log_id/);
  assert.match(migration, /when q\.status in \('PENDING', 'PROCESSING'\) then least\(q\.created_at, now\(\)\)/);
  assert.match(migration, /q\.status in \('PENDING', 'PROCESSING'\)[\s\S]*q\.status in \('DONE', 'FAILED'\)[\s\S]*coalesce\(q\.completed_at, q\.scheduled_at, q\.created_at\) >= v_start[\s\S]*coalesce\(q\.completed_at, q\.scheduled_at, q\.created_at\) < v_end/);
  assert.match(migration, /provider_usage_status', 'not_instrumented'/);
  assert.match(ocrStatusMigration, /provider_instrumented\}'[\s\S]*'true'::jsonb/);
  assert.match(ocrStatusMigration, /provider_usage_status\}'[\s\S]*'instrumented'/);
  assert.match(page, /OCR queue/);
  assert.match(page, /Instrumented/);
  assert.match(docs, /fresh PENDING row is not degradation/);
  assert.match(docs, /exhausted attempts can degrade Image OCR health/);
  assert.equal(
    classifyOcrQueueJob({
      attempts: 0,
      maxAttempts: 3,
      scheduledMinutesAgo: 2,
      status: "PENDING",
    }),
    "unknown",
  );
  assert.equal(
    classifyOcrQueueJob({
      attempts: 3,
      maxAttempts: 3,
      scheduledMinutesAgo: 2,
      status: "PENDING",
    }),
    "failed",
  );
  assert.equal(
    classifyOcrQueueJob({
      attempts: 0,
      maxAttempts: 3,
      scheduledMinutesAgo: 45,
      status: "PENDING",
    }),
    "failed",
  );
  assert.equal(
    includesOcrQueueJob({
      createdMinutesAgo: 1,
      rangeMinutes: 24 * 60,
      scheduledMinutesAgo: -2,
      status: "PENDING",
    }),
    true,
  );
  assert.equal(
    includesOcrQueueJob({
      createdMinutesAgo: 3,
      rangeMinutes: 24 * 60,
      scheduledMinutesAgo: 2,
      status: "PROCESSING",
    }),
    true,
  );
  assert.equal(
    includesOcrQueueJob({
      completedMinutesAgo: null,
      createdMinutesAgo: 60 * 24 * 60,
      rangeMinutes: 24 * 60,
      scheduledMinutesAgo: 60 * 24 * 60,
      status: "FAILED",
    }),
    false,
  );
  assert.equal(
    includesOcrQueueJob({
      completedMinutesAgo: null,
      createdMinutesAgo: 10,
      rangeMinutes: 24 * 60,
      scheduledMinutesAgo: 10,
      status: "FAILED",
    }),
    true,
  );
  assert.equal(
    includesOcrQueueJob({
      completedMinutesAgo: 10,
      createdMinutesAgo: 20,
      rangeMinutes: 24 * 60,
      scheduledMinutesAgo: 15,
      status: "DONE",
    }),
    true,
  );
  assert.equal(
    includesOcrQueueJob({
      completedMinutesAgo: 60 * 24 * 60,
      createdMinutesAgo: 60 * 24 * 60,
      rangeMinutes: 24 * 60,
      scheduledMinutesAgo: 60 * 24 * 60,
      status: "DONE",
    }),
    false,
  );
  assert.equal(openOcrObservedMinutesAgo({ createdMinutesAgo: 5 }), 5);
  assert.equal(openOcrObservedMinutesAgo({ createdMinutesAgo: -1 }), 0);
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

test("CI executes focused ENTRY Observability regressions", () => {
  assert.match(ci, /ENTRY Observability regressions/);
  assert.match(ci, /node --test tests\/entry-observability\.test\.mjs/);
});

test("usage and cost UI avoids fabricated metrics", () => {
  assert.match(page, /Tracked operations/);
  assert.match(page, /Not available/);
  assert.match(page, /No data/);
  assert.match(page, /unknownCostCount/);
  assert.match(page, /known outcomes/);
  assert.doesNotMatch(page, /1,284|0\.16%|184 ms|\$2\.71/);
});

test("onboarding email worker records actual Resend provider calls best-effort without secrets", () => {
  assert.match(worker, /recordEntryUsage/);
  assert.match(worker, /record_entry_usage_v1/);
  assert.match(worker, /const \{ error \} = await supabase\.rpc\("record_entry_usage_v1"/);
  assert.match(worker, /if \(error\)/);
  assert.match(worker, /providerUsageRecorded/);
  assert.match(worker, /RESEND_SEND_THROWN/);
  assert.match(worker, /p_provider: "resend"/);
  assert.match(worker, /p_operation: "onboarding_email"/);
  assert.match(worker, /Date\.now\(\) - providerStartedAt/);
  assert.match(worker, /p_estimated_cost: null/);
  assert.match(worker, /p_quantity: 1/);
  assert.doesNotMatch(worker, /p_metadata:[\s\S]{0,500}recipient_email/);
  assert.doesNotMatch(worker, /p_metadata:[\s\S]{0,500}pin/);
});

test("OCR economics are repository-controlled and measured at the provider boundary", () => {
  assert.match(ocrSource, /record_entry_usage_v1/);
  assert.match(ocrSource, /usageMetadata/);
  assert.match(ocrSource, /p_provider: "google_gemini"/);
  assert.match(ocrSource, /p_operation: "image_ocr"/);
  assert.match(ocrSource, /p_image_count: 1/);
  assert.match(ocrSource, /p_pricing_version: PRICING_VERSION/);
  assert.match(ocrDocs, /pricing snapshot/i);
  assert.match(ocrDocs, /one usage-ledger row/i);
  assert.match(docs, /Do not infer token usage from image count/);
  assert.match(docs, /ENTRY-OCR-001/);
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
