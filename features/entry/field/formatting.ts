import type { CommunityWithProgressItem } from "@/features/entry/communities/queries";

const FIELD_NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

export function getFieldCommunityStatusLabel(
  community: Pick<CommunityWithProgressItem, "isActive" | "onboardingStatus">,
) {
  if (!community.isActive) {
    return "Inactive";
  }

  if (community.onboardingStatus === "complete_active") {
    return "Active";
  }

  if (community.onboardingStatus === "ready_for_final_review") {
    return "Ready";
  }

  return "Setup";
}

export function getFieldCommunitySetupLabel(
  community: Pick<
    CommunityWithProgressItem,
    "activationPendingCount" | "isActive" | "nextStepKey" | "onboardingStatus" | "totalMembers" | "totalUnits"
  >,
) {
  if (!community.isActive) {
    return "Inactive";
  }

  if (community.onboardingStatus === "complete_active") {
    return "Complete";
  }

  if (community.totalUnits <= 0 || community.nextStepKey === "units") {
    return "Needs units";
  }

  if (community.activationPendingCount > 0) {
    return "Activation review";
  }

  if (community.totalMembers <= 0) {
    return "Needs residents";
  }

  return "In setup";
}

export function getFieldStatusToneClass(statusLabel: string) {
  switch (statusLabel) {
    case "Active":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
    case "Ready":
      return "border-sky-300/30 bg-sky-300/10 text-sky-100";
    case "Inactive":
      return "border-white/12 bg-white/[0.03] text-[var(--console-text-muted)]";
    default:
      return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
}

export function formatFieldCount(value: number) {
  return FIELD_NUMBER_FORMATTER.format(value);
}
