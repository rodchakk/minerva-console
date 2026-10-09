export type CommunityLifecycleInput = {
  activationPendingCount: number;
  completedTasks: number;
  isActive: boolean;
  nextStepKey: string;
  onboardingStatus: string;
  totalMembers: number;
  totalTasks: number;
  totalUnits: number;
};

export type CommunityLifecycleState =
  | "fully_active"
  | "pending_setup"
  | "needs_attention"
  | "inactive";

export function isCommunityFullyActive(community: CommunityLifecycleInput) {
  return community.isActive && community.onboardingStatus === "complete_active";
}

export function isCommunityPendingSetup(community: CommunityLifecycleInput) {
  return community.isActive && community.onboardingStatus !== "complete_active";
}

export function communityNeedsSetupAttention(
  community: CommunityLifecycleInput,
) {
  if (!isCommunityPendingSetup(community)) {
    return false;
  }

  return (
    community.totalUnits <= 0 ||
    community.nextStepKey === "units" ||
    (community.totalMembers <= 0 && community.activationPendingCount <= 0)
  );
}

export function getCommunityLifecycleState(
  community: CommunityLifecycleInput,
): CommunityLifecycleState {
  if (!community.isActive) {
    return "inactive";
  }

  if (isCommunityFullyActive(community)) {
    return "fully_active";
  }

  if (communityNeedsSetupAttention(community)) {
    return "needs_attention";
  }

  return "pending_setup";
}

export function getCommunityLifecycleLabel(state: CommunityLifecycleState) {
  switch (state) {
    case "fully_active":
      return "Fully active";
    case "pending_setup":
      return "Pending setup";
    case "needs_attention":
      return "Needs attention";
    case "inactive":
    default:
      return "Inactive";
  }
}

export function getCommunitySetupLabel(community: CommunityLifecycleInput) {
  if (community.onboardingStatus === "complete_active") {
    return "Complete";
  }

  if (communityNeedsSetupAttention(community)) {
    return "Needs attention";
  }

  return "In progress";
}

export function getCommunityProgressValue(community: CommunityLifecycleInput) {
  if (community.totalTasks <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.round((community.completedTasks / community.totalTasks) * 100),
  );
}
