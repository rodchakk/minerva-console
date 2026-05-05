import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
} from "@/lib/supabase/utils";

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
  completedTasks: number;
  nextStepKey: string;
  onboardingStatus: string;
  totalTasks: number;
};

function mapCommunityRecord(item: unknown): CommunityWithProgressItem {
  const record = item as Record<string, unknown>;

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
    id:
      coerceString(record.community_id) ||
      coerceString(record.id) ||
      crypto.randomUUID(),
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

function mapProgressRecord(value: unknown): CommunityProgressMeta | null {
  const record = extractFirstRecord(value);

  if (Object.keys(record).length === 0) {
    return null;
  }

  return {
    completedTasks:
      coerceNumber(record.completed_tasks) ||
      coerceNumber(record.completed_steps),
    nextStepKey:
      coerceString(record.next_step_key) ||
      coerceString(record.next_step) ||
      "units",
    onboardingStatus:
      coerceString(record.onboarding_status) ||
      coerceString(record.status) ||
      "pending_setup",
    totalTasks:
      coerceNumber(record.total_tasks) ||
      coerceNumber(record.total_steps),
  };
}

function deriveFallbackProgress(
  community: CommunityWithProgressItem,
): CommunityProgressMeta {
  const totalTasks = community.allowReservations ? 4 : 3;

  if (community.isActive) {
    return {
      completedTasks: totalTasks,
      nextStepKey: "complete",
      onboardingStatus: "complete_active",
      totalTasks,
    };
  }

  if (community.totalUnits <= 0) {
    return {
      completedTasks: 1,
      nextStepKey: "units",
      onboardingStatus: "pending_setup",
      totalTasks,
    };
  }

  if (community.totalMembers <= 0 && community.activationPendingCount <= 0) {
    return {
      completedTasks: 2,
      nextStepKey: "residents",
      onboardingStatus: "pending_setup",
      totalTasks,
    };
  }

  if (community.activationPendingCount > 0) {
    return {
      completedTasks: Math.min(totalTasks, 3),
      nextStepKey: "review_activation_queue",
      onboardingStatus: "pending_setup",
      totalTasks,
    };
  }

  if (community.allowReservations) {
    return {
      completedTasks: Math.min(totalTasks, 3),
      nextStepKey: "facilities",
      onboardingStatus: "pending_setup",
      totalTasks,
    };
  }

  return {
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
      progressFromList?.activationPendingCount ?? community.activationPendingCount,
  });

  return {
    ...community,
    activationPendingCount:
      progressFromList?.activationPendingCount ?? community.activationPendingCount,
    completedTasks:
      progress?.completedTasks ||
      progressFromList?.completedTasks ||
      fallback.completedTasks,
    nextStepKey:
      (() => {
        const rawNextStepKey =
          progress?.nextStepKey ||
          progressFromList?.nextStepKey ||
          fallback.nextStepKey;

        if (
          rawNextStepKey === "residents" &&
          (progressFromList?.activationPendingCount ?? community.activationPendingCount) >
            0
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
}

export async function listCommunitiesWithProgress(): Promise<CommunityWithProgressItem[]> {
  await requireSuperadmin();

  const supabase = await createClient();
  const [
    { data: progressListData, error: progressListError },
    { data: communityListData, error: communityListError },
  ] = await Promise.all([
    supabase.rpc("list_superadmin_communities_with_progress_v1"),
    supabase.rpc("list_superadmin_communities_v1"),
  ]);

  const communitiesFromProgress =
    !progressListError && Array.isArray(progressListData)
      ? progressListData.map(mapCommunityRecord)
      : [];

  if (communityListError || !Array.isArray(communityListData)) {
    return communitiesFromProgress;
  }

  const baseCommunities = communityListData.map(mapCommunityRecord);

  if (baseCommunities.length === 0) {
    return communitiesFromProgress;
  }

  const progressById = new Map(
    communitiesFromProgress.map((community) => [community.id, community]),
  );

  const missingProgressIds = baseCommunities
    .filter((community) => !progressById.has(community.id))
    .map((community) => community.id);

  const missingProgressResults = await Promise.all(
    missingProgressIds.map(async (communityId) => {
      const { data, error } = await supabase.rpc(
        "get_community_onboarding_progress_v1",
        {
          p_community_id: communityId,
        },
      );

      return {
        communityId,
        progress: error ? null : mapProgressRecord(data),
      };
    }),
  );

  const missingProgressById = new Map(
    missingProgressResults.map((item) => [item.communityId, item.progress]),
  );

  return baseCommunities.map((community) =>
    mergeCommunityProgress(
      community,
      missingProgressById.get(community.id) ?? null,
      progressById.get(community.id),
    ),
  );
}

export async function getCommunityWithProgress(communityId: string) {
  const communities = await listCommunitiesWithProgress();
  return communities.find((community) => community.id === communityId) ?? null;
}
