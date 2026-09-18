import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";

export type FieldQuickQrRegistrationOption = {
  campaignId: string;
  communityId: string;
  communityName: string;
  publicTitle: string;
};

type CommunityRow = {
  id: string;
  isActive: boolean;
  name: string;
};

type CampaignRow = {
  communityId: string;
  id: string;
  publicTitle: string;
};

function normalizeCommunity(value: unknown): CommunityRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = coerceString(record.id);
  const name = coerceString(record.name).trim();

  if (!id || !name) return null;

  return {
    id,
    isActive: record.is_active === true,
    name,
  };
}

function normalizeCampaign(value: unknown): CampaignRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = coerceString(record.id);
  const communityId = coerceString(record.community_id);

  if (!id || !communityId) return null;

  return {
    communityId,
    id,
    publicTitle:
      coerceString(record.public_title).trim() || "Registro de residentes",
  };
}

function tokenIsShareable(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const expiresAt = coerceString(record.expires_at);

  if (
    coerceString(record.token_type) !== "campaign_access" ||
    coerceString(record.status) !== "active" ||
    coerceString(record.revoked_at) ||
    coerceString(record.consumed_at) ||
    !coerceString(record.encrypted_token_payload)
  ) {
    return false;
  }

  return !expiresAt || Date.parse(expiresAt) > Date.now();
}

export async function getFieldQuickQrRegistrationOptions(): Promise<
  FieldQuickQrRegistrationOption[]
> {
  await requireSuperadmin();

  const supabase = createAdminClient();
  const { data: communitiesData, error: communitiesError } = await supabase
    .from("communities")
    .select("id,name,is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (communitiesError || !Array.isArray(communitiesData)) {
    return [];
  }

  const communities = communitiesData
    .map(normalizeCommunity)
    .filter(
      (community): community is CommunityRow =>
        community !== null && community.isActive,
    );

  if (communities.length === 0) {
    return [];
  }

  const communityIds = communities.map((community) => community.id);
  const { data: campaignsData, error: campaignsError } = await supabase
    .from("community_registration_campaigns")
    .select("id,community_id,public_title,status,created_at")
    .in("community_id", communityIds)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (campaignsError || !Array.isArray(campaignsData)) {
    return [];
  }

  const latestCampaignByCommunity = new Map<string, CampaignRow>();
  for (const value of campaignsData) {
    const campaign = normalizeCampaign(value);
    if (campaign && !latestCampaignByCommunity.has(campaign.communityId)) {
      latestCampaignByCommunity.set(campaign.communityId, campaign);
    }
  }

  const campaigns = Array.from(latestCampaignByCommunity.values());
  if (campaigns.length === 0) {
    return [];
  }

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const { data: tokensData, error: tokensError } = await supabase
    .from("community_registration_access_tokens")
    .select(
      "campaign_id,token_type,status,expires_at,consumed_at,revoked_at,encrypted_token_payload",
    )
    .in("campaign_id", campaignIds)
    .eq("token_type", "campaign_access")
    .eq("status", "active");

  if (tokensError || !Array.isArray(tokensData)) {
    return [];
  }

  const shareableTokenCountByCampaign = new Map<string, number>();
  for (const token of tokensData) {
    if (!tokenIsShareable(token)) continue;
    const campaignId = coerceString(
      (token as Record<string, unknown>).campaign_id,
    );
    if (!campaignId) continue;
    shareableTokenCountByCampaign.set(
      campaignId,
      (shareableTokenCountByCampaign.get(campaignId) ?? 0) + 1,
    );
  }

  return communities.flatMap((community) => {
    const campaign = latestCampaignByCommunity.get(community.id);
    if (!campaign || shareableTokenCountByCampaign.get(campaign.id) !== 1) {
      return [];
    }

    return [
      {
        campaignId: campaign.id,
        communityId: community.id,
        communityName: community.name,
        publicTitle: campaign.publicTitle,
      },
    ];
  });
}
