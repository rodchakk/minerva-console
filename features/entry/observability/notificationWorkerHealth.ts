import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";

export type EntryNotificationWorkerHealth = {
  consecutiveFailures: number;
  isStale: boolean;
  lastClaimed: number | null;
  lastCycleAt: string | null;
  lastErrorCode: string | null;
  lastErrorSummary: string | null;
  lastFailureAt: string | null;
  lastProcessed: number | null;
  lastSuccessAt: string | null;
  recovered: boolean;
  recoveredAt: string | null;
  recoverySummary: string;
  status: "degraded" | "healthy" | "unknown";
  workerName: string;
};

export type EntryNotificationWorkerHealthResult =
  | { data: EntryNotificationWorkerHealth; state: "ready" }
  | { error: string; state: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function status(value: unknown): EntryNotificationWorkerHealth["status"] {
  if (value === "healthy" || value === "degraded" || value === "unknown") {
    return value;
  }
  return "unknown";
}

function mapPayload(value: unknown): EntryNotificationWorkerHealth {
  const record = isRecord(value) ? value : {};
  return {
    consecutiveFailures: Math.max(0, nullableNumber(record.consecutive_failures) ?? 0),
    isStale: record.is_stale === true,
    lastClaimed: nullableNumber(record.last_claimed),
    lastCycleAt: nullableString(record.last_cycle_at),
    lastErrorCode: nullableString(record.last_error_code),
    lastErrorSummary: nullableString(record.last_error_summary),
    lastFailureAt: nullableString(record.last_failure_at),
    lastProcessed: nullableNumber(record.last_processed),
    lastSuccessAt: nullableString(record.last_success_at),
    recovered: record.recovered === true,
    recoveredAt: nullableString(record.recovered_at),
    recoverySummary:
      nullableString(record.recovery_summary) ??
      "No worker recovery conclusion is available yet.",
    status: status(record.status),
    workerName: nullableString(record.worker_name) ?? "community_message_push",
  };
}

export async function getEntryNotificationWorkerHealth(): Promise<EntryNotificationWorkerHealthResult> {
  await requireSuperadmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "sa_get_entry_notification_worker_health_v1",
  );

  if (error) {
    return { error: error.message, state: "unavailable" };
  }

  return { data: mapPayload(data), state: "ready" };
}
