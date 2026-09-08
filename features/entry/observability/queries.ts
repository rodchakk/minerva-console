import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";

export const ENTRY_OBSERVABILITY_TIME_RANGES = ["24h", "7d", "30d"] as const;

export type EntryObservabilityTimeRange =
  (typeof ENTRY_OBSERVABILITY_TIME_RANGES)[number];

export type EntryObservabilityCommunity = {
  id: string;
  name: string;
};

export type EntryObservabilityStatus =
  | "healthy"
  | "degraded"
  | "down"
  | "unknown";

export type EntryObservabilityFlow = {
  evidenceCount: number;
  failureCount: number;
  key: string;
  label: string;
  lastSeenAt: string | null;
  lastSuccessAt: string | null;
  p95LatencyMs: number | null;
  status: EntryObservabilityStatus;
  successCount: number;
};

export type EntryObservabilityIncident = {
  affectedCommunityCount: number;
  communities: Array<{
    communityId: string | null;
    communityName: string;
    occurrenceCount: number;
  }>;
  errorCode: string | null;
  eventType: string;
  explanation: string;
  fingerprint: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  source: string;
};

export type EntryObservabilityUsageProvider = {
  estimatedCost: number | null;
  imageCount: number;
  inputTokens: number;
  operation: string;
  outputTokens: number;
  provider: string;
  quantity: number;
  recordCount: number;
  serviceModel: string;
  unknownCostCount: number;
};

export type EntryObservabilityUsageCommunity = {
  communityId: string | null;
  communityName: string;
  estimatedCost: number | null;
  imageCount: number;
  inputTokens: number;
  outputTokens: number;
  recordCount: number;
  unknownCostCount: number;
};

export type EntryObservabilityUsageDaily = {
  date: string;
  estimatedCost: number | null;
  imageCount: number;
  recordCount: number;
};

export type EntryObservabilityAuditItem = {
  action: string;
  actor: string;
  communityId: string | null;
  communityName: string;
  eventId: string;
  occurredAt: string;
  source: string;
  target: string;
};

export type EntryObservabilityOcrQueue = {
  attemptCount: number;
  completedCount: number;
  exhaustedCount: number;
  failedCount: number;
  lastCompletedAt: string | null;
  oldestOpenScheduledAt: string | null;
  pendingCount: number;
  processingCount: number;
  providerInstrumented: boolean;
  providerUsageStatus: string;
  totalJobs: number;
};

export type EntryObservabilityData = {
  auditActivity: EntryObservabilityAuditItem[];
  communities: EntryObservabilityCommunity[];
  criticalFlows: EntryObservabilityFlow[];
  generatedAt: string;
  incidents: EntryObservabilityIncident[];
  ocrQueue: EntryObservabilityOcrQueue;
  range: {
    communityId: string | null;
    endsAt: string;
    key: EntryObservabilityTimeRange;
    startsAt: string;
  };
  summary: {
    errorRate: number | null;
    estimatedCost: number | null;
    failedOperations: number;
    imagesProcessed: number;
    knownOutcomeOperations: number;
    lastObservedAt: string | null;
    p95LatencyMs: number | null;
    successfulOperations: number;
    systemStatus: EntryObservabilityStatus;
    trackedOperations: number;
    unclassifiedOperations: number;
    unknownCostCount: number;
    usageRecords: number;
  };
  usage: {
    byCommunity: EntryObservabilityUsageCommunity[];
    byProvider: EntryObservabilityUsageProvider[];
    daily: EntryObservabilityUsageDaily[];
    summary: {
      estimatedCost: number | null;
      failedCount: number;
      imageCount: number;
      inputTokens: number;
      outputTokens: number;
      quantity: number;
      recordCount: number;
      successCount: number;
      unknownCostCount: number;
    };
  };
};

export type EntryNotificationObservabilityStatus =
  | "degraded"
  | "down"
  | "observed"
  | "unknown";

export type EntryNotificationObservabilityEventStatus =
  | "success"
  | "failed"
  | "skipped"
  | "unknown";

export type EntryNotificationObservabilityEvent = {
  attempts: number | null;
  audienceLabel: string | null;
  audienceType: "community" | "unknown" | "user";
  channel: "onboarding_email" | "push" | "system";
  claimedAt: string | null;
  communityId: string | null;
  communityName: string | null;
  completedAt: string | null;
  correlationId: string | null;
  createdAt: string | null;
  durationMs: number | null;
  enqueueSource: string | null;
  errorCode: string | null;
  errorSummary: string | null;
  id: string;
  impactSummary: string;
  layer: string;
  messageId: string | null;
  messageLabel: string | null;
  occurredAt: string;
  operation: string;
  providerReached: boolean;
  queueId: string | null;
  recoveredAt: string | null;
  recoverySummary: string | null;
  retryMode: string;
  retrySummary: string;
  severity: EntryObservabilityIncident["severity"];
  source: string;
  sourceType: string | null;
  status: EntryNotificationObservabilityEventStatus;
};

export type EntryNotificationObservabilityData = {
  communities: EntryObservabilityCommunity[];
  events: EntryNotificationObservabilityEvent[];
  generatedAt: string;
  limit: number;
  range: {
    communityId: string | null;
    endsAt: string;
    key: EntryObservabilityTimeRange;
    startsAt: string;
  };
  summary: {
    eventCount: number;
    failedCount: number;
    lastFailureAt: string | null;
    lastObservedAt: string | null;
    skippedCount: number;
    status: EntryNotificationObservabilityStatus;
    successCount: number;
  };
};

export type EntryObservabilityResult =
  | {
      data: EntryObservabilityData;
      state: "ready";
    }
  | {
      error: string;
      state: "unavailable";
    };

export type EntryNotificationObservabilityResult =
  | {
      data: EntryNotificationObservabilityData;
      state: "ready";
    }
  | {
      error: string;
      state: "unavailable";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  const text = asString(value).trim();
  return text ? text : null;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return fallback;
}

function normalizeStatus(value: unknown): EntryObservabilityStatus {
  if (
    value === "healthy" ||
    value === "degraded" ||
    value === "down" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function normalizeNotificationStatus(
  value: unknown,
): EntryNotificationObservabilityStatus {
  if (
    value === "degraded" ||
    value === "down" ||
    value === "observed" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function normalizeNotificationEventStatus(
  value: unknown,
): EntryNotificationObservabilityEventStatus {
  if (
    value === "success" ||
    value === "failed" ||
    value === "skipped" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function normalizeAudienceType(
  value: unknown,
): EntryNotificationObservabilityEvent["audienceType"] {
  if (value === "community" || value === "user" || value === "unknown") {
    return value;
  }

  return "unknown";
}

function normalizeNotificationChannel(
  value: unknown,
): EntryNotificationObservabilityEvent["channel"] {
  if (value === "push" || value === "onboarding_email" || value === "system") {
    return value;
  }

  return "system";
}

function normalizeSeverity(
  value: unknown,
): EntryObservabilityIncident["severity"] {
  if (value === "CRITICAL" || value === "ERROR" || value === "WARNING") {
    return value;
  }

  return "INFO";
}

export function normalizeEntryObservabilityRange(
  value?: string | string[] | null,
): EntryObservabilityTimeRange {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === "7d" || raw === "30d") {
    return raw;
  }

  return "24h";
}

function startsAtForRange(range: EntryObservabilityTimeRange) {
  const hours = range === "30d" ? 24 * 30 : range === "7d" ? 24 * 7 : 24;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function mapCommunities(value: unknown): EntryObservabilityCommunity[] {
  return toArray(value)
    .map((item) => {
      const record = isRecord(item) ? item : {};
      const id = asString(record.id);
      const name = asString(record.name, "Untitled community");

      return id ? { id, name } : null;
    })
    .filter((item): item is EntryObservabilityCommunity => item !== null);
}

function mapFlows(value: unknown): EntryObservabilityFlow[] {
  return toArray(value)
    .map((item) => {
      const record = isRecord(item) ? item : {};
      const key = asString(record.key);
      const label = asString(record.label, key);

      if (!key || !label) {
        return null;
      }

      return {
        evidenceCount: asNumber(record.evidence_count),
        failureCount: asNumber(record.failure_count),
        key,
        label,
        lastSeenAt: asNullableString(record.last_seen_at),
        lastSuccessAt: asNullableString(record.last_success_at),
        p95LatencyMs: asNullableNumber(record.p95_latency_ms),
        status: normalizeStatus(record.status),
        successCount: asNumber(record.success_count),
      };
    })
    .filter((item): item is EntryObservabilityFlow => item !== null);
}

function mapIncidents(value: unknown): EntryObservabilityIncident[] {
  return toArray(value)
    .map((item) => {
      const record = isRecord(item) ? item : {};
      const fingerprint = asString(record.fingerprint);
      const firstSeenAt = asString(record.first_seen_at);
      const lastSeenAt = asString(record.last_seen_at);

      if (!fingerprint || !firstSeenAt || !lastSeenAt) {
        return null;
      }

      return {
        affectedCommunityCount: asNumber(record.affected_community_count),
        communities: toArray(record.communities)
          .map((community) => {
            const communityRecord = isRecord(community) ? community : {};
            return {
              communityId: asNullableString(communityRecord.community_id),
              communityName: asString(
                communityRecord.community_name,
                "ENTRY system",
              ),
              occurrenceCount: asNumber(communityRecord.occurrence_count),
            };
          })
          .filter((community) => community.occurrenceCount > 0),
        errorCode: asNullableString(record.error_code),
        eventType: asString(record.event_type, "operational_failure"),
        explanation: asString(record.explanation, "Recurring failure detected"),
        fingerprint,
        firstSeenAt,
        lastSeenAt,
        occurrenceCount: asNumber(record.occurrence_count),
        severity: normalizeSeverity(record.severity),
        source: asString(record.source, "system"),
      };
    })
    .filter((item): item is EntryObservabilityIncident => item !== null);
}

function mapProviderUsage(value: unknown): EntryObservabilityUsageProvider[] {
  return toArray(value).map((item) => {
    const record = isRecord(item) ? item : {};

    return {
      estimatedCost: asNullableNumber(record.estimated_cost),
      imageCount: asNumber(record.image_count),
      inputTokens: asNumber(record.input_tokens),
      operation: asString(record.operation, "unknown"),
      outputTokens: asNumber(record.output_tokens),
      provider: asString(record.provider, "unknown"),
      quantity: asNumber(record.quantity),
      recordCount: asNumber(record.record_count),
      serviceModel: asString(record.service_model, "not specified"),
      unknownCostCount: asNumber(record.unknown_cost_count),
    };
  });
}

function mapCommunityUsage(value: unknown): EntryObservabilityUsageCommunity[] {
  return toArray(value).map((item) => {
    const record = isRecord(item) ? item : {};

    return {
      communityId: asNullableString(record.community_id),
      communityName: asString(record.community_name, "ENTRY system"),
      estimatedCost: asNullableNumber(record.estimated_cost),
      imageCount: asNumber(record.image_count),
      inputTokens: asNumber(record.input_tokens),
      outputTokens: asNumber(record.output_tokens),
      recordCount: asNumber(record.record_count),
      unknownCostCount: asNumber(record.unknown_cost_count),
    };
  });
}

function mapDailyUsage(value: unknown): EntryObservabilityUsageDaily[] {
  return toArray(value).map((item) => {
    const record = isRecord(item) ? item : {};

    return {
      date: asString(record.date),
      estimatedCost: asNullableNumber(record.estimated_cost),
      imageCount: asNumber(record.image_count),
      recordCount: asNumber(record.record_count),
    };
  });
}

function mapAuditActivity(value: unknown): EntryObservabilityAuditItem[] {
  return toArray(value)
    .map((item) => {
      const record = isRecord(item) ? item : {};
      const eventId = asString(record.event_id);
      const occurredAt = asString(record.occurred_at);

      if (!eventId || !occurredAt) {
        return null;
      }

      return {
        action: asString(record.action, "Operational update"),
        actor: asString(record.actor, "System"),
        communityId: asNullableString(record.community_id),
        communityName: asString(record.community_name, "ENTRY system"),
        eventId,
        occurredAt,
        source: asString(record.source, "audit"),
        target: asString(record.target, "entry"),
      };
    })
    .filter((item): item is EntryObservabilityAuditItem => item !== null);
}

function mapOcrQueue(value: unknown): EntryObservabilityOcrQueue {
  const record = isRecord(value) ? value : {};

  return {
    attemptCount: asNumber(record.attempt_count),
    completedCount: asNumber(record.completed_count),
    exhaustedCount: asNumber(record.exhausted_count),
    failedCount: asNumber(record.failed_count),
    lastCompletedAt: asNullableString(record.last_completed_at),
    oldestOpenScheduledAt: asNullableString(record.oldest_open_scheduled_at),
    pendingCount: asNumber(record.pending_count),
    processingCount: asNumber(record.processing_count),
    providerInstrumented: record.provider_instrumented === true,
    providerUsageStatus: asString(record.provider_usage_status, "not_instrumented"),
    totalJobs: asNumber(record.total_jobs),
  };
}

function mapDashboardPayload(
  payload: unknown,
  rangeKey: EntryObservabilityTimeRange,
): EntryObservabilityData {
  const root = isRecord(payload) ? payload : {};
  const summary = isRecord(root.summary) ? root.summary : {};
  const range = isRecord(root.range) ? root.range : {};
  const usage = isRecord(root.usage) ? root.usage : {};
  const usageSummary = isRecord(usage.summary) ? usage.summary : {};

  return {
    auditActivity: mapAuditActivity(root.audit_activity),
    communities: mapCommunities(root.communities),
    criticalFlows: mapFlows(root.critical_flows),
    generatedAt: asString(root.generated_at, new Date().toISOString()),
    incidents: mapIncidents(root.incidents),
    ocrQueue: mapOcrQueue(root.ocr_queue),
    range: {
      communityId: asNullableString(range.community_id),
      endsAt: asString(range.ends_at),
      key: rangeKey,
      startsAt: asString(range.starts_at),
    },
    summary: {
      errorRate: asNullableNumber(summary.error_rate),
      estimatedCost: asNullableNumber(summary.estimated_cost),
      failedOperations: asNumber(summary.failed_operations),
      imagesProcessed: asNumber(summary.images_processed),
      knownOutcomeOperations: asNumber(summary.known_outcome_operations),
      lastObservedAt: asNullableString(summary.last_observed_at),
      p95LatencyMs: asNullableNumber(summary.p95_latency_ms),
      successfulOperations: asNumber(summary.successful_operations),
      systemStatus: normalizeStatus(summary.system_status),
      trackedOperations: asNumber(summary.tracked_operations),
      unclassifiedOperations: asNumber(summary.unclassified_operations),
      unknownCostCount: asNumber(summary.unknown_cost_count),
      usageRecords: asNumber(summary.usage_records),
    },
    usage: {
      byCommunity: mapCommunityUsage(usage.by_community),
      byProvider: mapProviderUsage(usage.by_provider),
      daily: mapDailyUsage(usage.daily),
      summary: {
        estimatedCost: asNullableNumber(usageSummary.estimated_cost),
        failedCount: asNumber(usageSummary.failed_count),
        imageCount: asNumber(usageSummary.image_count),
        inputTokens: asNumber(usageSummary.input_tokens),
        outputTokens: asNumber(usageSummary.output_tokens),
        quantity: asNumber(usageSummary.quantity),
        recordCount: asNumber(usageSummary.record_count),
        successCount: asNumber(usageSummary.success_count),
        unknownCostCount: asNumber(usageSummary.unknown_cost_count),
      },
    },
  };
}

function mapNotificationEvents(
  value: unknown,
): EntryNotificationObservabilityEvent[] {
  return toArray(value)
    .map((item) => {
      const record = isRecord(item) ? item : {};
      const id = asString(record.id);
      const occurredAt = asString(record.occurred_at);

      if (!id || !occurredAt) {
        return null;
      }

      return {
        attempts: asNullableNumber(record.attempts),
        audienceLabel: asNullableString(record.audience_label),
        audienceType: normalizeAudienceType(record.audience_type),
        channel: normalizeNotificationChannel(record.channel),
        claimedAt: asNullableString(record.claimed_at),
        communityId: asNullableString(record.community_id),
        communityName: asNullableString(record.community_name),
        completedAt: asNullableString(record.completed_at),
        correlationId: asNullableString(record.correlation_id),
        createdAt: asNullableString(record.created_at),
        durationMs: asNullableNumber(record.duration_ms),
        enqueueSource: asNullableString(record.enqueue_source),
        errorCode: asNullableString(record.error_code),
        errorSummary: asNullableString(record.error_summary),
        id,
        impactSummary: asString(
          record.impact_summary,
          "Operational impact is not proven from this evidence.",
        ),
        layer: asString(record.layer, "unknown"),
        messageId: asNullableString(record.message_id),
        messageLabel: asNullableString(record.message_label),
        occurredAt,
        operation: asString(record.operation, "Notification event"),
        providerReached: asBoolean(record.provider_reached),
        queueId: asNullableString(record.queue_id),
        recoveredAt: asNullableString(record.recovered_at),
        recoverySummary: asNullableString(record.recovery_summary),
        retryMode: asString(record.retry_mode, "unknown"),
        retrySummary: asString(
          record.retry_summary,
          "No retry conclusion available from this evidence.",
        ),
        severity: normalizeSeverity(record.severity),
        source: asString(record.source, "system"),
        sourceType: asNullableString(record.source_type),
        status: normalizeNotificationEventStatus(record.status),
      };
    })
    .filter((item): item is EntryNotificationObservabilityEvent => item !== null);
}

function mapNotificationPayload(
  payload: unknown,
  rangeKey: EntryObservabilityTimeRange,
): EntryNotificationObservabilityData {
  const root = isRecord(payload) ? payload : {};
  const summary = isRecord(root.summary) ? root.summary : {};
  const range = isRecord(root.range) ? root.range : {};

  return {
    communities: mapCommunities(root.communities),
    events: mapNotificationEvents(root.events),
    generatedAt: asString(root.generated_at, new Date().toISOString()),
    limit: asNumber(root.limit, 100),
    range: {
      communityId: asNullableString(range.community_id),
      endsAt: asString(range.ends_at),
      key: rangeKey,
      startsAt: asString(range.starts_at),
    },
    summary: {
      eventCount: asNumber(summary.event_count),
      failedCount: asNumber(summary.failed_count),
      lastFailureAt: asNullableString(summary.last_failure_at),
      lastObservedAt: asNullableString(summary.last_observed_at),
      skippedCount: asNumber(summary.skipped_count),
      status: normalizeNotificationStatus(summary.status),
      successCount: asNumber(summary.success_count),
    },
  };
}

export async function getEntryObservability(input: {
  communityId?: string | null;
  range: EntryObservabilityTimeRange;
}): Promise<EntryObservabilityResult> {
  await requireSuperadmin();

  const supabase = await createClient();
  const startsAt = startsAtForRange(input.range);
  const endsAt = new Date().toISOString();
  const communityId = input.communityId?.trim() || null;

  const { data, error } = await supabase.rpc("sa_get_entry_observability_v1", {
    p_community_id: communityId,
    p_ends_at: endsAt,
    p_starts_at: startsAt,
  });

  if (error) {
    return {
      error: error.message,
      state: "unavailable",
    };
  }

  return {
    data: mapDashboardPayload(data, input.range),
    state: "ready",
  };
}

export async function getEntryNotificationObservability(input: {
  communityId?: string | null;
  limit?: number;
  range: EntryObservabilityTimeRange;
}): Promise<EntryNotificationObservabilityResult> {
  await requireSuperadmin();

  const supabase = await createClient();
  const startsAt = startsAtForRange(input.range);
  const endsAt = new Date().toISOString();
  const communityId = input.communityId?.trim() || null;
  const limit = Math.max(1, Math.min(Math.trunc(input.limit ?? 100), 200));

  const { data, error } = await supabase.rpc(
    "sa_get_entry_notification_observability_v1",
    {
      p_community_id: communityId,
      p_ends_at: endsAt,
      p_limit: limit,
      p_starts_at: startsAt,
    },
  );

  if (error) {
    return {
      error: error.message,
      state: "unavailable",
    };
  }

  return {
    data: mapNotificationPayload(data, input.range),
    state: "ready",
  };
}
