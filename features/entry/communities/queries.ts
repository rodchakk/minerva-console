import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
} from "@/lib/supabase/utils";

export type OnboardingTaskSummary = {
  done: boolean;
  key: string;
  label: string;
  required: boolean;
  summary: Record<string, unknown>;
};

export type CommunityOnboardingDetail = {
  activationPendingCount: number | null;
  activationQueueReviewedAt: string;
  blockers: string[];
  completedAt: string;
  completedTasks: number;
  metrics: Record<string, unknown>;
  nextStepKey: string;
  onboardingStatus: string;
  tasks: OnboardingTaskSummary[];
  totalTasks: number;
};

export type CommunityListItem = {
  activationPendingCount: number;
  allowFrequentAccess: boolean;
  allowMessages: boolean;
  allowReservations: boolean;
  city: string;
  completedTasks: number;
  id: string;
  isActive: boolean;
  name: string;
  nextStepKey: string;
  onboardingStatus: string;
  totalMembers: number;
  totalTasks: number;
  totalUnits: number;
  unitLabel: string;
};

export type CommunityWithProgressItem = CommunityListItem;

type CommunityProgressMeta = {
  activationPendingCount: number | null;
  completedTasks: number;
  nextStepKey: string;
  onboardingStatus: string;
  totalTasks: number;
};

type CommunityActiveState = {
  city?: string;
  isActive: boolean;
  name?: string;
};

function mapCommunityRecord(item: unknown): CommunityWithProgressItem | null {
  const record = item as Record<string, unknown>;
  const communityId =
    coerceString(record.community_id) || coerceString(record.id);

  if (!communityId) {
    return null;
  }

  return {
    activationPendingCount:
      coerceNumber(record.pending_activation_count) ||
      coerceNumber(record.activation_queue_pending_count) ||
      coerceNumber(record.pending_queue_count),
    allowFrequentAccess: coerceBoolean(record.allow_frequent_access),
    allowMessages: coerceBoolean(record.allow_messages),
    allowReservations: coerceBoolean(record.allow_reservations),
    city: coerceString(record.city, "Not set"),
    completedTasks:
      coerceNumber(record.completed_tasks) ||
      coerceNumber(record.completed_steps),
    id: communityId,
    isActive: coerceBoolean(record.is_active),
    name: coerceString(record.name, "Untitled community"),
    nextStepKey:
      coerceString(record.next_step_key) ||
      coerceString(record.next_step) ||
      "units",
    onboardingStatus:
      coerceString(record.onboarding_status) ||
      coerceString(record.status) ||
      "pending_setup",
    totalMembers: coerceNumber(record.total_members),
    totalTasks:
      coerceNumber(record.total_tasks) ||
      coerceNumber(record.total_steps),
    totalUnits: coerceNumber(record.total_units),
    unitLabel: coerceString(record.unit_label, "Casas"),
  };
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

function extractAuthoritativeActivationPendingCount(
  record: Record<string, unknown>,
): number | null {
  const metrics = normalizeJsonObject(record.metrics);
  const candidates = [
    record.activation_queue_pending,
    record.activation_queue_pending_count,
    record.pending_activation_count,
    record.pending_activations,
    metrics.activation_queue_pending,
    metrics.activation_queue_pending_count,
    metrics.pending_activation_count,
    metrics.pending_activations,
  ];

  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      return coerceNumber(candidate);
    }
  }

  if (Array.isArray(record.tasks)) {
    const activationQueueTask = record.tasks
      .map(normalizeJsonObject)
      .find((task) =>
        ["activation_queue", "review_activation_queue"].includes(
          coerceString(task.key),
        ),
      );
    const summary = normalizeJsonObject(activationQueueTask?.summary);
    const summaryCandidates = [
      summary.pending_activations,
      summary.pending_count,
      summary.pending,
      summary.activation_queue_pending,
      summary.activation_queue_pending_count,
    ];

    for (const candidate of summaryCandidates) {
      if (candidate !== undefined && candidate !== null && candidate !== "") {
        return coerceNumber(candidate);
      }
    }
  }

  return null;
}

function normalizeTask(value: unknown): OnboardingTaskSummary | null {
  const record = normalizeJsonObject(value);
  const key = coerceString(record.key);

  if (!key) {
    return null;
  }

  return {
    done: coerceBoolean(record.done),
    key,
    label: coerceString(record.label, key),
    required: record.required === undefined ? true : coerceBoolean(record.required),
    summary: normalizeJsonObject(record.summary),
  };
}

function normalizeBlockers(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => coerceString(item)).filter(Boolean);
}

function mapProgressRecord(value: unknown): CommunityProgressMeta | null {
  const record = extractFirstRecord(value);

  if (Object.keys(record).length === 0) {
    return null;
  }

  return {
    activationPendingCount: extractAuthoritativeActivationPendingCount(record),
    completedTasks:
      coerceNumber(record.completed_tasks) ||
      coerceNumber(record.completed_steps),
    nextStepKey:
      coerceString(record.next_step_key) || coerceString(record.next_step) || "units",
    onboardingStatus:
      coerceString(record.onboarding_status) ||
      coerceString(record.status) ||
      "pending_setup",
    totalTasks: coerceNumber(record.total_tasks) || coerceNumber(record.total_steps),
  };
}

function mapOnboardingDetail(value: unknown): CommunityOnboardingDetail | null {
  const record = extractFirstRecord(value);

  if (Object.keys(record).length === 0) {
    return null;
  }

  const tasks = Array.isArray(record.tasks)
    ? record.tasks
        .map(normalizeTask)
        .filter((task): task is OnboardingTaskSummary => task !== null)
    : [];

  return {
    activationPendingCount: extractAuthoritativeActivationPendingCount(record),
    activationQueueReviewedAt: coerceString(record.activation_queue_reviewed_at),
    blockers: normalizeBlockers(record.blockers),
    completedAt: coerceString(record.completed_at),
    completedTasks:
      coerceNumber(record.completed_tasks) || coerceNumber(record.completed_steps),
    metrics: normalizeJsonObject(record.metrics),
    nextStepKey:
      coerceString(record.next_step_key) || coerceString(record.next_step) || "units",
    onboardingStatus:
      coerceString(record.onboarding_status) ||
      coerceString(record.status) ||
      "pending_setup",
    tasks,
    totalTasks: coerceNumber(record.total_tasks) || coerceNumber(record.total_steps),
  };
}

function mapActiveState(item: unknown): [string, CommunityActiveState] | null {
  const record = item as Record<string, unknown>;
  const id = coerceString(record.id);

  if (!id) {
    return null;
  }

  return [
    id,
    {
      city: coerceString(record.city),
      isActive: coerceBoolean(record.is_active),
      name: coerceString(record.name),
    },
  ];
}

function applyActiveState(
  community: CommunityWithProgressItem,
  activeStateById: Map<string, CommunityActiveState>,
): CommunityWithProgressItem {
  const activeState = activeStateById.get(community.id);

  if (!activeState) {
    return community;
  }

  return {
    ...community,
    city: activeState.city || community.city,
    isActive: activeState.isActive,
    name: activeState.name || community.name,
  };
}

function deriveFallbackProgress(
  community: CommunityWithProgressItem,
): CommunityProgressMeta {
  const totalTasks = community.allowReservations ? 4 : 3;

  if (community.isActive) {
    return {
      activationPendingCount: null,
      completedTasks: totalTasks,
      nextStepKey: "complete",
      onboardingStatus: "complete_active",
      totalTasks,
    };
  }

  if (community.totalUnits <= 0) {
    return {
      activationPendingCount: null,
      completedTasks: 1,
      nextStepKey: "units",
      onboardingStatus: "pending_setup",
      totalTasks,
    };
  }

  if (community.totalMembers <= 0 && community.activationPendingCount <= 0) {
    return {
      activationPendingCount: null,
      completedTasks: 2,
      nextStepKey: "residents",
      onboardingStatus: "pending_setup",
      totalTasks,
    };
  }

  if (community.activationPendingCount > 0) {
    return {
      activationPendingCount: community.activationPendingCount,
      completedTasks: Math.min(totalTasks, 3),
      nextStepKey: "review_activation_queue",
      onboardingStatus: "pending_setup",
      totalTasks,
    };
  }

  if (community.allowReservations) {
    return {
      activationPendingCount: null,
      completedTasks: Math.min(totalTasks, 3),
      nextStepKey: "facilities",
      onboardingStatus: "pending_setup",
      totalTasks,
    };
  }

  return {
    activationPendingCount: null,
    completedTasks: totalTasks,
    nextStepKey: "complete",
    onboardingStatus: "complete_active",
    totalTasks,
  };
}

function mergeCommunityProgress(
  community: CommunityWithProgressItem,
  progress: CommunityProgressMeta | null,
  progressFromList?: CommunityWithProgressItem,
) {
  const fallback = deriveFallbackProgress({
    ...community,
    activationPendingCount:
      progress?.activationPendingCount ??
      progressFromList?.activationPendingCount ??
      community.activationPendingCount,
  });

  const merged = {
    ...community,
    activationPendingCount:
      progress?.activationPendingCount ??
      progressFromList?.activationPendingCount ??
      community.activationPendingCount,
    completedTasks:
      progress?.completedTasks ||
      progressFromList?.completedTasks ||
      fallback.completedTasks,
    nextStepKey: (() => {
      const rawNextStepKey =
        progress?.nextStepKey || progressFromList?.nextStepKey || fallback.nextStepKey;

      if (
        rawNextStepKey === "residents" &&
        (progress?.activationPendingCount ??
          progressFromList?.activationPendingCount ??
          community.activationPendingCount) > 0
      ) {
        return "review_activation_queue";
      }

      return rawNextStepKey;
    })(),
    onboardingStatus:
      progress?.onboardingStatus ||
      progressFromList?.onboardingStatus ||
      fallback.onboardingStatus,
    totalTasks:
      progress?.totalTasks || progressFromList?.totalTasks || fallback.totalTasks,
  };

  if (merged.totalUnits <= 0) {
    return {
      ...merged,
      completedTasks: Math.min(1, Math.max(0, merged.completedTasks)),
      nextStepKey: "units",
      onboardingStatus: "pending_setup",
      totalTasks: Math.max(merged.totalTasks, fallback.totalTasks, 3),
    };
  }

  if (merged.nextStepKey === "units") {
    return {
      ...merged,
      completedTasks: Math.min(
        merged.completedTasks,
        Math.max(0, merged.totalTasks - 1),
      ),
      onboardingStatus: "pending_setup",
    };
  }

  if (merged.onboardingStatus === "complete_active" && merged.totalUnits <= 0) {
    return {
      ...merged,
      completedTasks: Math.min(1, Math.max(0, merged.completedTasks)),
      nextStepKey: "units",
      onboardingStatus: "pending_setup",
    };
  }

  return merged;
}

export async function listCommunitiesWithProgress(): Promise<CommunityWithProgressItem[]> {
  await requireSuperadmin();

  const supabase = await createClient();
  const [
    { data: progressListData, error: progressListError },
    { data: communityListData, error: communityListError },
    { data: activeStateData },
  ] = await Promise.all([
    supabase.rpc("list_superadmin_communities_with_progress_v1"),
    supabase.rpc("list_superadmin_communities_v1"),
    supabase.from("communities").select("id,name,city,is_active"),
  ]);

  const activeStateById = new Map(
    Array.isArray(activeStateData)
      ? activeStateData
          .map(mapActiveState)
          .filter((item): item is [string, CommunityActiveState] => item !== null)
      : [],
  );

  const communitiesFromProgress =
    !progressListError && Array.isArray(progressListData)
      ? progressListData
          .map(mapCommunityRecord)
          .filter(
            (community): community is CommunityWithProgressItem => community !== null,
          )
          .map((community) => applyActiveState(community, activeStateById))
      : [];

  if (communityListError || !Array.isArray(communityListData)) {
    return communitiesFromProgress;
  }

  const baseCommunities = communityListData
    .map(mapCommunityRecord)
    .filter(
      (community): community is CommunityWithProgressItem => community !== null,
    )
    .map((community) => applyActiveState(community, activeStateById));

  if (baseCommunities.length === 0) {
    return communitiesFromProgress;
  }

  const progressById = new Map(
    communitiesFromProgress.map((community) => [community.id, community]),
  );

  const progressResults = await Promise.all(
    baseCommunities.map(async (community) => {
      const { data, error } = await supabase.rpc(
        "get_community_onboarding_progress_v1",
        {
          p_community_id: community.id,
        },
      );

      return {
        communityId: community.id,
        progress: error ? null : mapProgressRecord(data),
      };
    }),
  );

  const progressDetailById = new Map(
    progressResults.map((item) => [item.communityId, item.progress]),
  );

  return baseCommunities.map((community) =>
    mergeCommunityProgress(
      community,
      progressDetailById.get(community.id) ?? null,
      progressById.get(community.id),
    ),
  );
}

export async function getCommunityOnboardingDetail(
  communityId: string,
): Promise<CommunityOnboardingDetail | null> {
  await requireSuperadmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_community_onboarding_progress_v1",
    {
      p_community_id: communityId,
    },
  );

  if (error) {
    return null;
  }

  return mapOnboardingDetail(data);
}

export async function getCommunityWithProgress(communityId: string) {
  const [communities, detail] = await Promise.all([
    listCommunitiesWithProgress(),
    getCommunityOnboardingDetail(communityId),
  ]);

  const community = communities.find((item) => item.id === communityId) ?? null;

  if (!community || !detail) {
    return community;
  }

  return {
    ...community,
    activationPendingCount:
      detail.activationPendingCount ?? community.activationPendingCount,
    completedTasks: detail.completedTasks || community.completedTasks,
    nextStepKey: detail.nextStepKey || community.nextStepKey,
    onboardingStatus: detail.onboardingStatus || community.onboardingStatus,
    totalTasks: detail.totalTasks || community.totalTasks,
  };
}
