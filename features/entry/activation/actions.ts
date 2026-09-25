import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import type { CommunityWithProgressItem } from "@/features/entry/communities/queries";
import { listCommunitiesWithProgress } from "@/features/entry/communities/queries";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
} from "@/lib/supabase/utils";

export const ACTIVATION_QUEUE_STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "pending", value: "pending" },
  { label: "invited", value: "invited" },
  { label: "pin_generated", value: "pin_generated" },
  { label: "activated", value: "activated" },
  { label: "skipped", value: "skipped" },
  { label: "failed", value: "failed" },
] as const;

export type ActivationQueueImportRow = {
  email: string;
  is_owner: boolean | null;
  phone: string;
  raw_data: Record<string, unknown>;
  resident_name: string;
  unit_label: string;
};

export type ActivationQueueImportResult = {
  failed: number;
  inserted: number;
  missingUnitsCreated: number;
  missingUnitsUncreated: number;
  rowsWithMissingHouse: number;
  skipped: number;
  submitted: number;
};

export type ActivationQueueRow = {
  createdAt: string;
  email: string;
  id: string;
  inviteSentAt: string;
  lastActivationAt: string;
  lastActivationChannel: string;
  lastError: string;
  lastPinGeneratedAt: string;
  method: string;
  ownerReference: string;
  phone: string;
  resident: string;
  status: string;
  suggestedUsername: string;
  unit: string;
};

export type CommunityOnboardingProgress = {
  activationPendingCount: number;
  activationQueueReviewRequired: boolean;
  activationQueueReviewedAt: string;
  completedTasks: number;
  nextStepKey: string;
  onboardingStatus: string;
  totalTasks: number;
};

export type ActivationQueuePageData = {
  communities: CommunityWithProgressItem[];
  progress: CommunityOnboardingProgress | null;
  rows: ActivationQueueRow[];
};

function parseOwnerFlag(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (["1", "true", "yes", "y", "si", "sí", "owner", "propietario"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }

  return null;
}

function extractFirstRecord(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object"
      ? (first as Record<string, unknown>)
      : {};
  }

  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getActivationQueueTask(record: Record<string, unknown>) {
  if (!Array.isArray(record.tasks)) {
    return {};
  }

  return (
    record.tasks
      .map(normalizeJsonObject)
      .find((task) =>
        ["activation_queue", "review_activation_queue"].includes(
          coerceString(task.key),
        ),
      ) ?? {}
  );
}

function getActivationPendingCount(record: Record<string, unknown>) {
  const metrics = normalizeJsonObject(record.metrics);
  const task = getActivationQueueTask(record);
  const summary = normalizeJsonObject(task.summary);
  const candidates = [
    record.activation_queue_pending,
    record.activation_queue_pending_count,
    record.pending_activation_count,
    record.pending_activations,
    metrics.activation_queue_pending,
    metrics.activation_queue_pending_count,
    metrics.pending_activation_count,
    metrics.pending_activations,
    summary.pending_activations,
    summary.pending_count,
    summary.pending,
    summary.activation_queue_pending,
    summary.activation_queue_pending_count,
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      return coerceNumber(candidate);
    }
  }

  return 0;
}

function formatOwnerReference(record: Record<string, unknown>) {
  if (coerceBoolean(record.is_owner)) {
    return "Owner";
  }

  if (
    record.is_owner === false ||
    record.is_owner === "false" ||
    record.is_owner === 0 ||
    record.is_owner === "0"
  ) {
    return "Resident";
  }

  return "Not specified";
}

function formatCreatedAt(value: string) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatOptionalDateTime(value: string) {
  return value ? formatCreatedAt(value) : "Never";
}

function getLatestActivationActivity(inviteSentAt: string, lastPinGeneratedAt: string) {
  const candidates = [
    { channel: "Email", raw: inviteSentAt },
    { channel: "PIN", raw: lastPinGeneratedAt },
  ]
    .filter((candidate) => candidate.raw)
    .map((candidate) => ({
      ...candidate,
      timestamp: new Date(candidate.raw).getTime(),
    }))
    .filter((candidate) => !Number.isNaN(candidate.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp);

  const latest = candidates[0];

  return latest
    ? {
        at: formatCreatedAt(latest.raw),
        channel: latest.channel,
      }
    : {
        at: "Never",
        channel: "—",
      };
}

function normalizeMethod(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "not_configured";
  }

  return normalized;
}

function normalizeStatus(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "pending";
  }

  if (normalized === "error") {
    return "failed";
  }

  if (normalized === "sent") {
    return "invited";
  }

  return normalized;
}

export function buildActivationQueueRows(
  rows: Array<{
    email: string;
    isOwner: string;
    phone: string;
    rawData: Record<string, unknown>;
    residentName: string;
    unitLabel: string;
  }>,
): ActivationQueueImportRow[] {
  return rows
    .filter((row) => row.unitLabel.trim() && row.residentName.trim())
    .map((row) => ({
      email: row.email.trim(),
      is_owner: parseOwnerFlag(row.isOwner),
      phone: row.phone.trim(),
      raw_data: row.rawData,
      resident_name: row.residentName.trim(),
      unit_label: row.unitLabel.trim(),
    }));
}

export function parseActivationQueueImportResult(
  value: unknown,
  submitted: number,
): ActivationQueueImportResult {
  const record = extractFirstRecord(value);
  const missingUnitsCreated = coerceNumber(record.missing_units_created_count);
  const missingUnitsUncreated = coerceNumber(record.missing_units_uncreated_count);

  return {
    failed:
      coerceNumber(record.failed_count) ||
      coerceNumber(record.failed_rows_count) ||
      coerceNumber(record.error_count),
    inserted:
      coerceNumber(record.inserted_count) ||
      coerceNumber(record.created_count) ||
      coerceNumber(record.success_count),
    missingUnitsCreated,
    missingUnitsUncreated,
    rowsWithMissingHouse:
      missingUnitsUncreated ||
      coerceNumber(record.rows_with_missing_house_count) ||
      coerceNumber(record.missing_house_count),
    skipped:
      coerceNumber(record.skipped_count) ||
      coerceNumber(record.skipped_duplicates_count) ||
      coerceNumber(record.duplicate_count),
    submitted,
  };
}

function mapActivationQueueRow(item: unknown): ActivationQueueRow {
  const record = item as Record<string, unknown>;
  const createdAt =
    coerceString(record.created_at) ||
    coerceString(record.inserted_at) ||
    coerceString(record.queued_at);
  const suggestedUsername =
    coerceString(record.suggested_username) ||
    coerceString(record.username_suggestion);
  const inviteSentAt = coerceString(record.invite_sent_at);
  const lastPinGeneratedAt = coerceString(record.last_pin_generated_at);
  const lastActivation = getLatestActivationActivity(
    inviteSentAt,
    lastPinGeneratedAt,
  );

  return {
    createdAt: formatCreatedAt(createdAt),
    email: coerceString(record.email, "—"),
    id:
      coerceString(record.queue_id) ||
      coerceString(record.id) ||
      crypto.randomUUID(),
    inviteSentAt: formatOptionalDateTime(inviteSentAt),
    lastActivationAt: lastActivation.at,
    lastActivationChannel: lastActivation.channel,
    lastError: coerceString(record.last_error, "—"),
    lastPinGeneratedAt: formatOptionalDateTime(lastPinGeneratedAt),
    method: normalizeMethod(
      coerceString(record.activation_method) || coerceString(record.method),
    ),
    ownerReference: formatOwnerReference(record),
    phone: coerceString(record.phone, "—"),
    resident:
      coerceString(record.resident_name) ||
      coerceString(record.full_name) ||
      "Unnamed resident",
    status: normalizeStatus(coerceString(record.status, "pending")),
    suggestedUsername: suggestedUsername || "Not generated",
    unit:
      coerceString(record.unit_label) ||
      coerceString(record.house_label) ||
      coerceString(record.house_name) ||
      "Unknown unit",
  };
}

function mapOnboardingProgress(value: unknown): CommunityOnboardingProgress | null {
  const record = extractFirstRecord(value);

  if (Object.keys(record).length === 0) {
    return null;
  }

  const nextStepKey =
    coerceString(record.next_step_key) || coerceString(record.next_step) || "";
  const activationQueueTask = getActivationQueueTask(record);
  const activationQueueReviewedAt =
    coerceString(record.activation_queue_reviewed_at) ||
    coerceString(activationQueueTask.last_reviewed_at);
  const activationQueueReviewRequired =
    Object.keys(activationQueueTask).length > 0 &&
    !coerceBoolean(activationQueueTask.done);

  return {
    activationPendingCount: getActivationPendingCount(record),
    activationQueueReviewRequired,
    activationQueueReviewedAt,
    completedTasks:
      coerceNumber(record.completed_tasks) ||
      coerceNumber(record.completed_steps),
    nextStepKey: nextStepKey || "residents",
    onboardingStatus:
      coerceString(record.onboarding_status) ||
      coerceString(record.status) ||
      "pending_setup",
    totalTasks:
      coerceNumber(record.total_tasks) ||
      coerceNumber(record.total_steps),
  };
}

export async function getActivationQueuePageData(input: {
  communityId?: string;
  status?: string;
}): Promise<ActivationQueuePageData> {
  await requireSuperadmin();

  const communities = await listCommunitiesWithProgress();
  const communityId = input.communityId?.trim() || "";
  const status = input.status?.trim() || null;

  if (!communityId) {
    return {
      communities,
      progress: null,
      rows: [],
    };
  }

  const supabase = await createClient();
  const [{ data: queueV2Data, error: queueV2Error }, { data: progressData }] =
    await Promise.all([
      supabase.rpc("list_resident_activation_queue_v2", {
        p_community_id: communityId,
        p_status: status,
      }),
      supabase.rpc("get_community_onboarding_progress_v1", {
        p_community_id: communityId,
      }),
    ]);

  let queueData = queueV2Data;
  let queueError = queueV2Error;

  // Preview deployments can be built before the accompanying migration is
  // applied. Keep the queue usable there; v1 still includes invite_sent_at,
  // while the new PIN timestamp simply renders as "Never" until v2 exists.
  if (
    queueV2Error &&
    (queueV2Error.code === "PGRST202" ||
      queueV2Error.message?.includes("list_resident_activation_queue_v2"))
  ) {
    const fallback = await supabase.rpc("list_resident_activation_queue_v1", {
      p_community_id: communityId,
      p_status: status,
    });
    queueData = fallback.data;
    queueError = fallback.error;
  }

  const rows =
    queueError || !Array.isArray(queueData)
      ? []
      : queueData.map(mapActivationQueueRow);

  const progress = mapOnboardingProgress(progressData);
  const hasPreparedResidents = rows.length > 0;

  return {
    communities,
    progress: progress
      ? {
          ...progress,
          nextStepKey:
            progress.nextStepKey === "residents" && hasPreparedResidents
              ? "review_activation_queue"
              : progress.nextStepKey,
        }
      : null,
    rows,
  };
}
