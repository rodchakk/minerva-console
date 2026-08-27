import type { CommunityRegistrationAdminCampaign } from "@/features/entry/communityRegistration/admin/queries";

export type FieldRegistrationStateKind =
  | "no_campaign"
  | "non_open_campaign"
  | "open_unrecoverable"
  | "open_recoverable";

export function getFieldRegistrationStateKind(
  campaign: CommunityRegistrationAdminCampaign | null,
): FieldRegistrationStateKind {
  if (!campaign) {
    return "no_campaign";
  }

  const isCampaignOpen = campaign.status.trim().toLowerCase() === "open";
  if (!isCampaignOpen) {
    return "non_open_campaign";
  }

  if (!campaign.activeCampaignAccessRecoverable) {
    return "open_unrecoverable";
  }

  return "open_recoverable";
}
