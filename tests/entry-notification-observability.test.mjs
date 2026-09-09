import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const migration = read(
  "supabase/migrations/20260908090000_entry_notification_observability_drilldown.sql",
);
const queries = read("features/entry/observability/queries.ts");
const page = read("app/(console)/products/entry/observability/page.tsx");
const notificationsPage = read(
  "app/(console)/products/entry/observability/notifications/page.tsx",
);
const drilldown = read(
  "features/entry/observability/NotificationObservabilityDrilldown.tsx",
);
const docs = read("docs/entry-observability.md");
const ci = read(".github/workflows/ci.yml");

function normalizeQueueStatus(row) {
  if (row.status === "sent") return "success";
  if (row.status === "failed" && row.lastError?.startsWith("no active push tokens")) {
    return "skipped";
  }
  if (row.status === "failed") return "failed";
  return "unknown";
}

function normalizeQueueProviderReached(row) {
  if (row.lastError?.startsWith("no active push tokens")) return false;
  if (row.status === "sent") return true;
  if (row.providerResponse !== null && row.providerResponse !== undefined) return true;
  return null;
}

function normalizeSystemStatus(row) {
  if (row.eventType === "NOTIFICATION_SENT") return "success";
  if (row.eventType === "NOTIFICATION_FAILED") return "failed";
  if (row.eventType === "SOS_PUSH_NO_GUARD_TOKENS") return "skipped";
  return "unknown";
}

function normalizeSystemProviderReached(row) {
  if (["PUSH_CLAIM_RPC_ERROR", "SOS_PUSH_NO_GUARD_TOKENS"].includes(row.eventType)) {
    return false;
  }
  if (row.eventType === "NOTIFICATION_SENT") return true;
  if (row.queueProviderResponse !== null && row.queueProviderResponse !== undefined) {
    return true;
  }
  if (row.providerProof !== null && row.providerProof !== undefined && row.providerProof !== "") {
    return true;
  }
  return null;
}

function normalizePushEvidence({ queueRows = [], systemRows = [] }) {
  const explicitTerminalTelemetryQueueIds = new Set(
    systemRows
      .filter((row) =>
        ["NOTIFICATION_SENT", "NOTIFICATION_FAILED"].includes(row.eventType) &&
        ["community_message_push", "community_message_push_queue"].includes(
          row.entityType,
        ),
      )
      .map((row) => row.entityId),
  );

  return [
    ...queueRows
      .filter(
        (row) =>
          !(
            ["sent", "failed"].includes(row.status) &&
            explicitTerminalTelemetryQueueIds.has(row.id)
          ),
      )
      .map((row) => ({
        id: `queue:${row.id}`,
        providerReached: normalizeQueueProviderReached(row),
        source: "community_message_push_queue",
        status: normalizeQueueStatus(row),
      })),
    ...systemRows
      .filter((row) =>
        [
          "NOTIFICATION_SENT",
          "NOTIFICATION_FAILED",
          "PUSH_CLAIM_RPC_ERROR",
          "SOS_PUSH_NO_GUARD_TOKENS",
        ].includes(row.eventType),
      )
      .map((row) => ({
        id: `system:${row.id}`,
        providerReached: normalizeSystemProviderReached(row),
        source: "system_event_log",
        status: normalizeSystemStatus(row),
      })),
  ];
}

function summarizeNotificationEvents(events) {
  return {
    failedCount: events.filter((event) => event.status === "failed").length,
    skippedCount: events.filter((event) => event.status === "skipped").length,
    successCount: events.filter((event) => event.status === "success").length,
  };
}

function flowStatus({
  evidenceCount,
  failureCount,
  lastSuccessAt,
  successCount,
}) {
  if (evidenceCount === 0) return "unknown";
  if (successCount === 0 && failureCount >= 5) return "down";
  if (successCount === 0 && failureCount > 0) return "degraded";
  if (failureCount >= 3 && failureCount / Math.max(successCount + failureCount, 1) >= 0.2) {
    return "degraded";
  }
  if (lastSuccessAt) return "healthy";
  return "unknown";
}

test("Notifications drill-down RPC is superadmin-only, bounded, and limit-clamped", () => {
  assert.match(
    migration,
    /create or replace function public\.sa_get_entry_notification_observability_v1/,
  );
  assert.match(migration, /if not public\.is_superadmin\(\)/);
  assert.match(migration, /v_end - v_start > interval '31 days'/);
  assert.match(
    migration,
    /v_limit integer := least\(greatest\(coalesce\(p_limit, 100\), 1\), 200\)/,
  );
  assert.match(migration, /returns jsonb/);
  assert.match(migration, /revoke all on function public\.sa_get_entry_notification_observability_v1/);
  assert.match(migration, /grant execute on function public\.sa_get_entry_notification_observability_v1/);
});

test("RPC aggregates existing notification evidence without exposing raw tables to the page", () => {
  assert.match(migration, /from public\.system_event_log s/);
  assert.match(migration, /from public\.community_message_push_queue q/);
  assert.match(migration, /public\.community_messages m/);
  assert.match(migration, /from public\.onboarding_campaign_messages m/);
  assert.match(queries, /supabase\.rpc\(\s*"sa_get_entry_notification_observability_v1"/);
  assert.doesNotMatch(notificationsPage, /\.from\("system_event_log"\)/);
  assert.doesNotMatch(notificationsPage, /\.from\("community_message_push_queue"\)/);
  assert.doesNotMatch(notificationsPage, /\.from\("onboarding_campaign_messages"\)/);
});

test("terminal push telemetry is canonical over correlated terminal queue fallback", () => {
  assert.match(migration, /from public\.system_event_log explicit_push/);
  assert.match(
    migration,
    /explicit_push\.entity_type in \('community_message_push', 'community_message_push_queue'\)/,
  );
  assert.match(migration, /explicit_push\.entity_id = q\.id/);
  assert.match(
    migration,
    /explicit_push\.event_type in \('NOTIFICATION_SENT', 'NOTIFICATION_FAILED'\)/,
  );

  const failedEvents = normalizePushEvidence({
    queueRows: [{ id: "push-queue-1", status: "failed" }],
    systemRows: [
      {
        entityId: "push-queue-1",
        entityType: "community_message_push_queue",
        eventType: "NOTIFICATION_FAILED",
        id: "event-1",
      },
    ],
  });
  const failedSummary = summarizeNotificationEvents(failedEvents);

  assert.equal(failedEvents.length, 1);
  assert.equal(failedEvents[0].source, "system_event_log");
  assert.equal(failedSummary.failedCount, 1);

  const sentEvents = normalizePushEvidence({
    queueRows: [{ id: "push-queue-2", status: "sent" }],
    systemRows: [
      {
        entityId: "push-queue-2",
        entityType: "community_message_push",
        eventType: "NOTIFICATION_SENT",
        id: "event-2",
      },
    ],
  });
  const sentSummary = summarizeNotificationEvents(sentEvents);

  assert.equal(sentEvents.length, 1);
  assert.equal(sentEvents[0].source, "system_event_log");
  assert.equal(sentSummary.successCount, 1);
});

test("terminal push queue rows remain fallback evidence without explicit telemetry", () => {
  const fallbackEvents = normalizePushEvidence({
    queueRows: [{ id: "legacy-push-queue-1", status: "failed" }],
    systemRows: [],
  });
  const summary = summarizeNotificationEvents(fallbackEvents);

  assert.equal(fallbackEvents.length, 1);
  assert.equal(fallbackEvents[0].source, "community_message_push_queue");
  assert.equal(summary.failedCount, 1);
});

test("provider reachability remains tri-state and evidence-based", () => {
  assert.match(
    migration,
    /when s\.event_type in \('PUSH_CLAIM_RPC_ERROR', 'SOS_PUSH_NO_GUARD_TOKENS'\) then false/,
  );
  assert.match(migration, /when lower\(coalesce\(q\.last_error, ''\)\) like 'no active push tokens%' then false/);
  assert.match(migration, /when s\.event_type = 'NOTIFICATION_SENT' then true/);
  assert.match(migration, /else null::boolean/);
  assert.doesNotMatch(migration, /q\.provider_response is not null then true\s+else false/);

  const events = normalizePushEvidence({
    queueRows: [
      {
        id: "no-token-queue",
        lastError: "no active push tokens for message",
        status: "failed",
      },
      {
        id: "historical-failed-queue",
        providerResponse: null,
        status: "failed",
      },
    ],
    systemRows: [
      {
        entityId: null,
        entityType: null,
        eventType: "PUSH_CLAIM_RPC_ERROR",
        id: "claim-error",
      },
      {
        entityId: "sent-queue",
        entityType: "community_message_push_queue",
        eventType: "NOTIFICATION_SENT",
        id: "sent-event",
      },
      {
        entityId: "failed-queue",
        entityType: "community_message_push_queue",
        eventType: "NOTIFICATION_FAILED",
        id: "failed-event",
      },
    ],
  });
  const byId = new Map(events.map((event) => [event.id, event]));

  assert.equal(byId.get("system:claim-error")?.providerReached, false);
  assert.equal(byId.get("queue:no-token-queue")?.providerReached, false);
  assert.equal(byId.get("system:sent-event")?.providerReached, true);
  assert.equal(byId.get("system:failed-event")?.providerReached, null);
  assert.equal(byId.get("queue:historical-failed-queue")?.providerReached, null);
});

test("provider reachability contract preserves null through TypeScript and UI", () => {
  assert.match(queries, /providerReached: boolean \| null/);
  assert.match(queries, /function asNullableBoolean\(value: unknown\)/);
  assert.match(queries, /providerReached: asNullableBoolean\(record\.provider_reached\)/);
  assert.doesNotMatch(queries, /providerReached: asBoolean\(record\.provider_reached\)/);
  assert.match(drilldown, /function formatProviderReached\(value: boolean \| null\)/);
  assert.match(drilldown, /return "Unknown"/);
  assert.match(drilldown, /value=\{formatProviderReached\(event\.providerReached\)\}/);
});

test("notification summary health mirrors existing critical-flow semantics", () => {
  assert.match(
    migration,
    /'status', public\._entry_observability_flow_status_v1\(/,
  );
  assert.match(
    migration,
    /coalesce\(\(select success_count \+ failed_count from summary\), 0\)/,
  );
  assert.doesNotMatch(migration, /skipped_count[\s\S]{0,160}then 'degraded'/);
  assert.doesNotMatch(migration, /else 'observed'/);
  assert.match(queries, /value === "healthy"/);
  assert.match(drilldown, /healthy: \{/);

  const cases = [
    {
      expected: "down",
      input: { failureCount: 5, lastSuccessAt: null, successCount: 0 },
      name: "0 success / 5 failure",
    },
    {
      expected: "healthy",
      input: { failureCount: 1, lastSuccessAt: "2026-09-08T00:00:00Z", successCount: 99 },
      name: "many successes / 1 failure",
    },
    {
      expected: "healthy",
      input: { failureCount: 5, lastSuccessAt: "2026-09-08T00:00:00Z", successCount: 96 },
      name: "many successes / 5 failures below degradation threshold",
    },
    {
      expected: "degraded",
      input: { failureCount: 3, lastSuccessAt: "2026-09-08T00:00:00Z", successCount: 12 },
      name: "mixed traffic crossing degradation threshold",
    },
    {
      expected: "unknown",
      input: { failureCount: 0, lastSuccessAt: null, skippedCount: 5, successCount: 0 },
      name: "skipped-only",
    },
    {
      expected: "healthy",
      input: { failureCount: 0, lastSuccessAt: "2026-09-08T00:00:00Z", skippedCount: 5, successCount: 1 },
      name: "success + skipped",
    },
    {
      expected: "unknown",
      input: { failureCount: 0, lastSuccessAt: null, successCount: 0 },
      name: "no evidence",
    },
  ];

  for (const { expected, input, name } of cases) {
    const evidenceCount = input.successCount + input.failureCount;
    assert.equal(flowStatus({ ...input, evidenceCount }), expected, name);
  }
});

test("PUSH_CLAIM_RPC_ERROR does not fabricate impact and reports scheduled retry semantics", () => {
  assert.match(migration, /s\.event_type = 'PUSH_CLAIM_RPC_ERROR' then 'worker \/ queue claim'/);
  assert.match(
    migration,
    /when s\.event_type in \('PUSH_CLAIM_RPC_ERROR', 'SOS_PUSH_NO_GUARD_TOKENS'\) then false/,
  );
  assert.match(migration, /then 'scheduled_worker_retry'/);
  assert.match(
    migration,
    /Worker failed before identifying a queue item; impact to a specific community, message, or recipient cannot be proven\./,
  );
  assert.match(
    migration,
    /Scheduled worker invocation will run again because no queue row was claimed or terminally failed\./,
  );
  assert.match(drilldown, /No specific notification had been selected/);
  assert.match(drilldown, /Provider delivery was not\s*reached/);
});

test("targeted and community push audience labels use safe display values only", () => {
  assert.match(migration, /m\.target_user_id is not null then 'user'/);
  assert.match(migration, /coalesce\(target_profile\.full_name, 'user:' \|\| left\(m\.target_user_id::text, 8\)\)/);
  assert.match(migration, /when m\.id is not null then 'community'/);
  assert.match(migration, /'Community audience'/);
  assert.doesNotMatch(migration, /p\.email/);
  assert.doesNotMatch(migration, /p\.phone/);
  assert.doesNotMatch(migration, /p\.username/);
  assert.doesNotMatch(migration, /synthetic_email/);
});

test("no-active-token conditions are skipped deliverability evidence, not provider outages", () => {
  assert.match(migration, /like 'no active push tokens%'/i);
  assert.match(migration, /'No active push tokens \/ no deliverable audience'/);
  assert.match(migration, /then 'PUSH_NO_ACTIVE_TOKENS'/);
  assert.match(migration, /then 'no_provider_retry'/);
  assert.match(drilldown, /Skipped is not a provider outage/);
  assert.match(docs, /not as an Expo outage/);
});

test("terminal failed queue rows are not described as automatically retried", () => {
  assert.match(migration, /q\.status = 'failed' then 'terminal_no_auto_reclaim'/);
  assert.match(
    migration,
    /Terminal failed queue rows are not automatically reclaimed by the current claim RPC\./,
  );
  assert.match(docs, /must not describe failed queue rows as automatically retried/);
  assert.doesNotMatch(migration, /attempts < 5[\s\S]{0,120}retry/i);
});

test("onboarding email failures normalize without recipient email exposure", () => {
  assert.match(migration, /'onboarding_email'::text as channel/);
  assert.match(migration, /when m\.status = 'failed' then 'ONBOARDING_EMAIL_FAILED'/);
  assert.match(migration, /without exposing the recipient email/);
  assert.match(notificationsPage, /onboarding-email evidence/);
  assert.doesNotMatch(migration, /m\.recipient_email/);
  assert.doesNotMatch(migration, /m\.recipient_phone/);
});

test("returned contract excludes secrets, tokens, emails, bodies, URLs, and raw provider payloads", () => {
  assert.match(migration, /_entry_notification_observability_sanitize_text_v1/);
  assert.match(migration, /\[redacted-email\]/);
  assert.match(migration, /ExponentPushToken\[redacted\]/);
  assert.match(migration, /\[redacted-jwt\]/);
  assert.doesNotMatch(migration, /push_title[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /push_body[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /provider_response[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /recipient_email[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /body[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /image_url[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /image_path[\s\S]{0,500}jsonb_build_object/);
  assert.match(drilldown, /Raw provider payloads,\s*push tokens,\s*emails, message bodies, and credentials are excluded/);
});

test("overview and drill-down UI preserve filters and avoid fake healthy empty states", () => {
  assert.match(page, /\/products\/entry\/observability\/notifications/);
  assert.match(page, /flow\.key === "notifications"/);
  assert.match(notificationsPage, /Back to observability/);
  assert.match(notificationsPage, /basePath="\/products\/entry\/observability\/notifications"/);
  assert.match(drilldown, /No events stays Unknown/);
  assert.match(drilldown, /This remains Unknown, not Healthy/);
  assert.match(drilldown, /Event detail/);
  assert.match(drilldown, /Provider reached/);
});

test("CI executes focused notification observability regressions", () => {
  assert.match(ci, /tests\/entry-notification-observability\.test\.mjs/);
});
