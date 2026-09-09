import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getCommunitiesWithProgressResult } from "@/features/entry/communities/queries";
import { createClient } from "@/lib/supabase/server";
import { coerceString } from "@/lib/supabase/utils";
import {
  FIELD_WORK_PRODUCT_KEY,
  buildFieldWorkMonthlySummary,
  getCompletedDurationSeconds,
  getMonthRange,
  isFieldWorkActivityCategory,
  isFieldWorkMode,
  isFieldWorkTargetScope,
  type FieldWorkCommunityOption,
  type FieldWorkMonthlySummary,
  type FieldWorkSession,
  type FieldWorkStatus,
} from "@/features/entry/field/workTimerModel";

export type FieldWorkTimerPageData = {
  activeSession: FieldWorkSession | null;
  communities: FieldWorkCommunityOption[];
  communityLoadState: "ready" | "unavailable";
  monthKey: string;
  recentSessions: FieldWorkSession[];
  summary: FieldWorkMonthlySummary;
};

type FieldWorkSessionRow = {
  activity_category?: unknown;
  community_id?: unknown;
  community_name_snapshot?: unknown;
  created_at?: unknown;
  ended_at?: unknown;
  id?: unknown;
  note?: unknown;
  product_key?: unknown;
  started_at?: unknown;
  status?: unknown;
  target_scope?: unknown;
  updated_at?: unknown;
  user_id?: unknown;
  work_mode?: unknown;
};

const SESSION_COLUMNS = [
  "id",
  "user_id",
  "product_key",
  "target_scope",
  "community_id",
  "community_name_snapshot",
  "activity_category",
  "work_mode",
  "started_at",
  "ended_at",
  "status",
  "note",
  "created_at",
  "updated_at",
].join(",");

function mapStatus(value: string): FieldWorkStatus {
  if (value === "COMPLETED" || value === "CANCELLED") return value;
  return "ACTIVE";
}

export function mapFieldWorkSession(
  value: FieldWorkSessionRow,
): FieldWorkSession | null {
  const id = coerceString(value.id);
  const userId = coerceString(value.user_id);
  const startedAt = coerceString(value.started_at);
  const activityCategory = coerceString(value.activity_category);
  const targetScope = coerceString(value.target_scope);
  const workMode = coerceString(value.work_mode);

  if (
    !id ||
    !userId ||
    !startedAt ||
    !isFieldWorkActivityCategory(activityCategory) ||
    !isFieldWorkTargetScope(targetScope) ||
    !isFieldWorkMode(workMode)
  ) {
    return null;
  }

  const endedAt = coerceString(value.ended_at) || null;
  const status = mapStatus(coerceString(value.status));

  return {
    activityCategory,
    communityId: coerceString(value.community_id) || null,
    communityNameSnapshot: coerceString(value.community_name_snapshot) || null,
    createdAt: coerceString(value.created_at),
    durationSeconds: getCompletedDurationSeconds(startedAt, endedAt),
    endedAt,
    id,
    note: coerceString(value.note) || null,
    productKey: FIELD_WORK_PRODUCT_KEY,
    startedAt,
    status,
    targetScope,
    updatedAt: coerceString(value.updated_at),
    userId,
    workMode,
  };
}

async function getAuthenticatedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function getActiveFieldWorkSession() {
  await requireSuperadmin();

  const userId = await getAuthenticatedUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("field_work_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .order("started_at", { ascending: false })
    .limit(1);

  if (error || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  return mapFieldWorkSession(data[0] as FieldWorkSessionRow);
}

export async function getFieldWorkTimerPageData(
  monthKey?: string,
): Promise<FieldWorkTimerPageData> {
  await requireSuperadmin();

  const userId = await getAuthenticatedUserId();
  const month = getMonthRange(monthKey);

  if (!userId) {
    return {
      activeSession: null,
      communities: [],
      communityLoadState: "unavailable",
      monthKey: month.key,
      recentSessions: [],
      summary: buildFieldWorkMonthlySummary([], month.key),
    };
  }

  const supabase = await createClient();
  const [activeResult, recentResult, monthResult, communitiesResult] =
    await Promise.all([
      supabase
        .from("field_work_sessions")
        .select(SESSION_COLUMNS)
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .order("started_at", { ascending: false })
        .limit(1),
      supabase
        .from("field_work_sessions")
        .select(SESSION_COLUMNS)
        .eq("user_id", userId)
        .eq("status", "COMPLETED")
        .order("ended_at", { ascending: false })
        .limit(12),
      supabase
        .from("field_work_sessions")
        .select(SESSION_COLUMNS)
        .eq("user_id", userId)
        .eq("status", "COMPLETED")
        .gte("ended_at", month.startIso)
        .lt("ended_at", month.endIso)
        .order("ended_at", { ascending: true }),
      getCommunitiesWithProgressResult(),
    ]);

  const activeSession =
    Array.isArray(activeResult.data) && activeResult.data[0]
      ? mapFieldWorkSession(activeResult.data[0] as FieldWorkSessionRow)
      : null;
  const recentSessions = Array.isArray(recentResult.data)
    ? recentResult.data
        .map((item) => mapFieldWorkSession(item as FieldWorkSessionRow))
        .filter((item): item is FieldWorkSession => item !== null)
    : [];
  const monthSessions = Array.isArray(monthResult.data)
    ? monthResult.data
        .map((item) => mapFieldWorkSession(item as FieldWorkSessionRow))
        .filter((item): item is FieldWorkSession => item !== null)
    : [];
  const communities =
    communitiesResult.state === "ready"
      ? communitiesResult.items.map((community) => ({
          city: community.city,
          id: community.id,
          isActive: community.isActive,
          name: community.name,
        }))
      : [];

  return {
    activeSession,
    communities,
    communityLoadState: communitiesResult.state,
    monthKey: month.key,
    recentSessions,
    summary: buildFieldWorkMonthlySummary(monthSessions, month.key),
  };
}
