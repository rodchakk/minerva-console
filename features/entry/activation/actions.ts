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
  rowsWithMissingHouse: number;
  skipped: number;
  submitted: number;
};

export type ActivationQueueRow = {
  createdAt: string;
  email: string;
  id: string;
  lastError: string;
  method: string;
  ownerReference: string;
  phone: string;
  resident: string;
  status: string;
  suggestedUsername: string;
  unit: string;
};

export type CommunityOnboardingProgress = {
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

  if (["1", "true", "yes", "y", "si", "owner"].includes(normalized)) {
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

  return {
    failed:
      coerceNumber(record.failed_count) ||
      coerceNumber(record.failed_rows_count) ||
      coerceNumber(record.error_count),
    inserted:
      coerceNumber(record.inserted_count) ||
      coerceNumber(record.created_count) ||
      coerceNumber(record.success_count),
    rowsWithMissingHouse:
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

  return {
    createdAt: formatCreatedAt(createdAt),
    email: coerceString(record.email, "—"),
    id:
      coerceString(record.queue_id) ||
      coerceString(record.id) ||
      crypto.randomUUID(),
    lastError: coerceString(record.last_error, "—"),
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

  return {
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
  const [{ data: queueData, error: queueError }, { data: progressData }] =
    await Promise.all([
      supabase.rpc("list_resident_activation_queue_v1", {
        p_community_id: communityId,
        p_status: status,
      }),
      supabase.rpc("get_community_onboarding_progress_v1", {
        p_community_id: communityId,
      }),
    ]);

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
