"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  getEntryPreviewReadOnlyError,
  getResidentFacingBaseUrl,
} from "@/features/entry/deploymentBoundary";
import {
  createPatronatoReviewToken,
  hashPatronatoReviewToken,
} from "@/features/entry/communityRegistration/patronato/token";
import { createAdminClient } from "@/lib/supabase/admin";

const PATRONATO_LINK_DAYS = 30;

export type CreatePatronatoReviewLinkResult =
  | {
      success: true;
      data: {
        expiresAt: string;
        reviewUrl: string;
        revokedPreviousCount: number;
      };
    }
  | {
      success: false;
      error: string;
    };

export async function createPatronatoReviewLink(
  _previousState: CreatePatronatoReviewLinkResult | null,
  formData: FormData,
): Promise<CreatePatronatoReviewLinkResult> {
  const auth = await requireSuperadmin();
  const previewError = getEntryPreviewReadOnlyError();

  if (previewError) {
    return { success: false, error: previewError };
  }

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const communityId = String(formData.get("community_id") ?? "").trim();

  if (!campaignId || !communityId) {
    return { success: false, error: "Campaign information is missing." };
  }

  const supabase = createAdminClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("community_registration_campaigns")
    .select("id,community_id,status")
    .eq("id", campaignId)
    .eq("community_id", communityId)
    .maybeSingle();

  if (
    campaignError ||
    !campaign ||
    !["open", "review"].includes(String(campaign.status))
  ) {
    return {
      success: false,
      error: "The registration campaign is not available for Patronato review.",
    };
  }

  const plaintextToken = createPatronatoReviewToken();
  const expiresAt = new Date(
    Date.now() + PATRONATO_LINK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase.rpc(
    "create_community_registration_patronato_access_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_id: campaignId,
      p_expires_at: expiresAt,
      p_patronato_token_hash: hashPatronatoReviewToken(plaintextToken),
    },
  );

  if (error) {
    return {
      success: false,
      error: "Could not create the Patronato review link.",
    };
  }

  const baseUrl = await getResidentFacingBaseUrl();
  const reviewUrl = `${baseUrl}/entry/patronato/${encodeURIComponent(
    plaintextToken,
  )}`;
  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  revalidatePath(`/products/entry/communities/${communityId}/registration`);

  return {
    success: true,
    data: {
      expiresAt,
      reviewUrl,
      revokedPreviousCount: Number(record.revoked_previous_count ?? 0),
    },
  };
}
