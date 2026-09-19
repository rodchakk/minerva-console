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
  | "idle"
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


export type EntryObservabilityPerformanceMetric = {
  appVersion: string | null;
  eventCount: number;
  failedCount: number;
  lastSeenAt: string | null;
  metric: string;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  platform: string | null;
  surface: string;
  unit: string;
};

export type EntryObservabilityWorker = {
  lastFinishedAt: string | null;
  lastStartedAt: string | null;
  name: string;
  schedule: string;
  status: string;
};

export type EntryObservabilityQueueHealth = {
  capability: string;
  failedCount: number;
  name: string;
  oldestOpenAt: string | null;
  openCount: number;
};

export type EntryObservabilityReadinessCommunity = {
  activatedResidents: number;
  activeGuards: number;
  activeResidents: number;
  communityId: string;
  communityName: string;
  gateAccesses: number;
  messagesPublished: number;
  passesCreated: number;
  pushReadyGuards: number;
  pushReadyResidents: number;
};

export type EntryObservabilityIncidentHistoryItem = {
  capability: string;
  communityId: string | null;
  communityName: string | null;
  errorCode: string | null;
  eventType: string;
  fingerprint: string;
  firstSeenAt: string;
  id: string;
  lastSeenAt: string;
  occurrenceCount: number;
  resolvedAt: string | null;
  severity: EntryObservabilityIncident["severity"];
  status: "open" | "resolved";
};

export type EntryObservabilityMobilePushDelivery = {
  acceptedCount: number;
  deliveredCount: number;
  deliveryRate: number | null;
  failedCount: number;
  lastDeliveredAt: string | null;
  lastFailedAt: string | null;
};


export type EntryDiagnosticSnapshotMeta = {
  communityId: string | null;
  communityName: string | null;
  createdAt: string;
  diagnosticRef: string;
  endsAt: string;
  expiresAt: string;
  id: string;
  notes: string | null;
  startsAt: string;
  systemStatus: EntryObservabilityStatus | null;
  triggerIncidentId: string | null;
  triggerType: "manual" | "incident_open" | "incident_recovery";
};

export type EntryDiagnosticSnapshotsResult =
  | { data: EntryDiagnosticSnapshotMeta[]; state: "ready" }
  | { error: string; state: "unavailable" };


export type EntryObservabilityData = {
  auditActivity: EntryObservabilityAuditItem[];
  communities: EntryObservabilityCommunity[];
  criticalFlows: EntryObservabilityFlow[];
  generatedAt: string;
  incidents: EntryObservabilityIncident[];
  incidentHistory: EntryObservabilityIncidentHistoryItem[];
  infrastructure: {
    database: {
      cacheHitPercent: number | null;
      conflicts: number;
      connections: number;
      deadlocks: number;
      statsReset: string | null;
    };
    queues: EntryObservabilityQueueHealth[];
    workers: EntryObservabilityWorker[];
  };
  mobilePushDelivery: EntryObservabilityMobilePushDelivery;
  ocrQueue: EntryObservabilityOcrQueue;
  performance: {
    metrics: EntryObservabilityPerformanceMetric[];
    summary: {
      eventCount: number;
      failedCount: number;
      lastSeenAt: string | null;
      p50Ms: number | null;
      p95Ms: number | null;
      p99Ms: number | null;
    };
  };
  readiness: {
    communities: EntryObservabilityReadinessCommunity[];
  };
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
  | "healthy"
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
  providerReached: boolean | null;
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

function asNullableBoolean(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return asBoolean(value, false);
}

function normalizeStatus(value: unknown): EntryObservabilityStatus {
  if (
    value === "healthy" ||
    value === "degraded" ||
    value === "down" ||
    value === "idle" ||
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
    value === "healthy" ||
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


function mapPerformance(value: unknown): EntryObservabilityData["performance"] {
  const record = isRecord(value) ? value : {};
  const summary = isRecord(record.summary) ? record.summary : {};

  return {
    metrics: toArray(record.metrics).map((item) => {
      const metric = isRecord(item) ? item : {};
      return {
        appVersion: asNullableString(metric.app_version),
        eventCount: asNumber(metric.event_count),
        failedCount: asNumber(metric.failed_count),
        lastSeenAt: asNullableString(metric.last_seen_at),
        metric: asString(metric.metric, "unknown"),
        p50: asNullableNumber(metric.p50),
        p95: asNullableNumber(metric.p95),
        p99: asNullableNumber(metric.p99),
        platform: asNullableString(metric.platform),
        surface: asString(metric.surface, "unknown"),
        unit: asString(metric.unit, "ms"),
      };
    }),
    summary: {
      eventCount: asNumber(summary.event_count),
      failedCount: asNumber(summary.failed_count),
      lastSeenAt: asNullableString(summary.last_seen_at),
      p50Ms: asNullableNumber(summary.p50_ms),
      p95Ms: asNullableNumber(summary.p95_ms),
      p99Ms: asNullableNumber(summary.p99_ms),
    },
  };
}

function mapInfrastructure(value: unknown): EntryObservabilityData["infrastructure"] {
  const record = isRecord(value) ? value : {};
  const database = isRecord(record.database) ? record.database : {};

  return {
    database: {
      cacheHitPercent: asNullableNumber(database.cache_hit_percent),
      conflicts: asNumber(database.conflicts),
      connections: asNumber(database.connections),
      deadlocks: asNumber(database.deadlocks),
      statsReset: asNullableString(database.stats_reset),
    },
    queues: toArray(record.queues).map((item) => {
      const queue = isRecord(item) ? item : {};
      return {
        capability: asString(queue.capability, "unknown"),
        failedCount: asNumber(queue.failed_count),
        name: asString(queue.name, "Queue"),
        oldestOpenAt: asNullableString(queue.oldest_open_at),
        openCount: asNumber(queue.open_count),
      };
    }),
    workers: toArray(record.workers).map((item) => {
      const worker = isRecord(item) ? item : {};
      return {
        lastFinishedAt: asNullableString(worker.last_finished_at),
        lastStartedAt: asNullableString(worker.last_started_at),
        name: asString(worker.name, "Worker"),
        schedule: asString(worker.schedule, ""),
        status: asString(worker.status, "unknown"),
      };
    }),
  };
}

function mapReadiness(value: unknown): EntryObservabilityData["readiness"] {
  const record = isRecord(value) ? value : {};
  return {
    communities: toArray(record.communities)
      .map((item) => {
        const community = isRecord(item) ? item : {};
        const communityId = asString(community.community_id);
        if (!communityId) return null;
        return {
          activatedResidents: asNumber(community.activated_residents),
          activeGuards: asNumber(community.active_guards),
          activeResidents: asNumber(community.active_residents),
          communityId,
          communityName: asString(community.community_name, "Community"),
          gateAccesses: asNumber(community.gate_accesses),
          messagesPublished: asNumber(community.messages_published),
          passesCreated: asNumber(community.passes_created),
          pushReadyGuards: asNumber(community.push_ready_guards),
          pushReadyResidents: asNumber(community.push_ready_residents),
        };
      })
      .filter((item): item is EntryObservabilityReadinessCommunity => item !== null),
  };
}

function mapIncidentHistory(value: unknown): EntryObservabilityIncidentHistoryItem[] {
  return toArray(value)
    .map((item) => {
      const record = isRecord(item) ? item : {};
      const id = asString(record.id);
      const fingerprint = asString(record.fingerprint);
      const firstSeenAt = asString(record.first_seen_at);
      const lastSeenAt = asString(record.last_seen_at);
      if (!id || !fingerprint || !firstSeenAt || !lastSeenAt) return null;

      return {
        capability: asString(record.capability, "system"),
        communityId: asNullableString(record.community_id),
        communityName: asNullableString(record.community_name),
        errorCode: asNullableString(record.error_code),
        eventType: asString(record.event_type, "operational_failure"),
        fingerprint,
        firstSeenAt,
        id,
        lastSeenAt,
        occurrenceCount: asNumber(record.occurrence_count),
        resolvedAt: asNullableString(record.resolved_at),
        severity: normalizeSeverity(record.severity),
        status: record.status === "resolved" ? "resolved" : "open",
      };
    })
    .filter((item): item is EntryObservabilityIncidentHistoryItem => item !== null);
}

function mapMobilePushDelivery(value: unknown): EntryObservabilityMobilePushDelivery {
  const record = isRecord(value) ? value : {};
  return {
    acceptedCount: asNumber(record.accepted_count),
    deliveredCount: asNumber(record.delivered_count),
    deliveryRate: asNullableNumber(record.delivery_rate),
    failedCount: asNumber(record.failed_count),
    lastDeliveredAt: asNullableString(record.last_delivered_at),
    lastFailedAt: asNullableString(record.last_failed_at),
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
    incidentHistory: mapIncidentHistory(root.incident_history),
    infrastructure: mapInfrastructure(root.infrastructure),
    mobilePushDelivery: mapMobilePushDelivery(root.mobile_push_delivery),
    ocrQueue: mapOcrQueue(root.ocr_queue),
    performance: mapPerformance(root.performance),
    readiness: mapReadiness(root.readiness),
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
      const operation = asString(record.operation, "Communication event");
      const isDirectActivationEmail = operation.startsWith("ACTIVATION_EMAIL_");

      if (!id || !occurredAt) {
        return null;
      }

      return {
        attempts: asNullableNumber(record.attempts),
        audienceLabel: asNullableString(record.audience_label),
        audienceType: normalizeAudienceType(record.audience_type),
        channel: isDirectActivationEmail
          ? "onboarding_email"
          : normalizeNotificationChannel(record.channel),
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
        layer: isDirectActivationEmail ? "provider" : asString(record.layer, "unknown"),
        messageId: asNullableString(record.message_id),
        messageLabel: asNullableString(record.message_label),
        occurredAt,
        operation,
        providerReached: asNullableBoolean(record.provider_reached),
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

  const { data, error } = await supabase.rpc("sa_get_entry_observability_v4", {
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


export async function getEntryDiagnosticSnapshots(input?: {
  communityId?: string | null;
  limit?: number;
}): Promise<EntryDiagnosticSnapshotsResult> {
  await requireSuperadmin();

  const supabase = await createClient();
  const communityId = input?.communityId?.trim() || null;
  const limit = Math.max(1, Math.min(Math.trunc(input?.limit ?? 12), 100));

  const { data, error } = await supabase.rpc("sa_list_entry_diagnostic_snapshots_v1", {
    p_community_id: communityId,
    p_limit: limit,
  });

  if (error) {
    return { error: error.message, state: "unavailable" };
  }

  const snapshots = toArray(data)
    .map((item) => {
      const record = isRecord(item) ? item : {};
      const id = asString(record.id);
      const diagnosticRef = asString(record.diagnostic_ref);
      const createdAt = asString(record.created_at);
      const startsAt = asString(record.starts_at);
      const endsAt = asString(record.ends_at);
      const expiresAt = asString(record.expires_at);
      const triggerRaw = asString(record.trigger_type);

      if (!id || !diagnosticRef || !createdAt || !startsAt || !endsAt || !expiresAt) {
        return null;
      }

      const triggerType =
        triggerRaw === "incident_open" || triggerRaw === "incident_recovery"
          ? triggerRaw
          : "manual";

      const statusRaw = asNullableString(record.system_status);
      const systemStatus =
        statusRaw === "healthy" ||
        statusRaw === "degraded" ||
        statusRaw === "down" ||
        statusRaw === "idle" ||
        statusRaw === "unknown"
          ? statusRaw
          : null;

      return {
        communityId: asNullableString(record.community_id),
        communityName: asNullableString(record.community_name),
        createdAt,
        diagnosticRef,
        endsAt,
        expiresAt,
        id,
        notes: asNullableString(record.notes),
        startsAt,
        systemStatus,
        triggerIncidentId: asNullableString(record.trigger_incident_id),
        triggerType,
      } satisfies EntryDiagnosticSnapshotMeta;
    })
    .filter((item): item is EntryDiagnosticSnapshotMeta => item !== null);

  return { data: snapshots, state: "ready" };
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
    "sa_get_entry_notification_observability_v2",
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
