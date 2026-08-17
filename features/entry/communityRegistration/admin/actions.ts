"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  hashRegistrationToken,
  normalizePublicSlug,
} from "@/features/entry/communityRegistration/public/accessState";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";

export type LaunchCommunityRegistrationCampaignResult =
  | {
      success: true;
      data: {
        campaignId: string;
        publicSlug: string;
        registrationUrl: string;
        selectedUnitCount: number;
        status: string;
        submittedUnitCount: number;
      };
    }
  | {
      code:
        | "active_campaign_exists"
        | "add_units_failed"
        | "invalid_input"
        | "unauthorized"
        | "unknown";
      error: string;
      success: false;
    };

function getFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function getSelectedUnitIds(formData: FormData) {
  return formData
    .getAll("unit_id")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function makeCampaignToken() {
  return randomBytes(32).toString("base64url");
}

function makeCampaignSlug(communityName: string) {
  const base = normalizePublicSlug(communityName || "community-registration");
  const safeBase = base.length >= 6 ? base : `${base}-entry`.replace(/^-/, "");
  const suffix = randomBytes(6).toString("hex");
  return normalizePublicSlug(`${safeBase.slice(0, 72)}-${suffix}`);
}

async function getRegistrationBaseUrl() {
  const publicConsoleUrl =
    process.env.NEXT_PUBLIC_MINERVA_CONSOLE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (publicConsoleUrl) {
    return publicConsoleUrl.replace(/\/$/, "");
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");

  return host ? `${protocol}://${host}` : "";
}

function mapCampaignError(error: { code?: string | null; message?: string | null }) {
  const message = error.message ?? "";

  if (error.code === "P0409" || /ENTRY_CR_CONFLICT/.test(message)) {
    return {
      code: "active_campaign_exists" as const,
      error:
        "There is already an operational registration campaign for this community.",
      success: false as const,
    };
  }

  if (error.code === "42501" || /ENTRY_CR_UNAUTHORIZED|unauthorized/i.test(message)) {
    return {
      code: "unauthorized" as const,
      error: "Access denied. Superadmin permission required.",
      success: false as const,
    };
  }

  return {
    code: "unknown" as const,
    error: "Could not create the registration campaign. Please try again.",
    success: false as const,
  };
}

export async function launchCommunityRegistrationCampaign(
  _previousState: LaunchCommunityRegistrationCampaignResult | null,
  formData: FormData,
): Promise<LaunchCommunityRegistrationCampaignResult> {
  const auth = await requireSuperadmin();

  const communityId = getFormString(formData, "community_id");
  const communityName = getFormString(formData, "community_name");
  const publicTitle = getFormString(formData, "public_title");
  const publicInstructions = getFormString(formData, "public_instructions");
  const defaultResidentLimit = Math.max(
    1,
    Math.min(
      50,
      Math.floor(Number(getFormString(formData, "default_resident_limit")) || 3),
    ),
  );
  const selectedUnitIds = getSelectedUnitIds(formData);

  if (!communityId || !publicTitle || selectedUnitIds.length === 0) {
    return {
      code: "invalid_input",
      error: "Select at least one unit and provide a public title.",
      success: false,
    };
  }

  const plaintextToken = makeCampaignToken();
  const campaignTokenHash = hashRegistrationToken(plaintextToken);
  const publicSlug = makeCampaignSlug(communityName || publicTitle);
  const supabase = createAdminClient();

  const { data: campaignData, error: campaignError } = await supabase.rpc(
    "create_community_registration_campaign_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_token_hash: campaignTokenHash,
      p_closes_at: null,
      p_community_id: communityId,
      p_default_resident_limit: defaultResidentLimit,
      p_internal_name: `Resident registration - ${communityName || communityId}`,
      p_opens_at: null,
      p_public_instructions: publicInstructions || null,
      p_public_slug: publicSlug,
      p_public_title: publicTitle,
    },
  );

  if (campaignError) {
    return mapCampaignError(campaignError);
  }

  const campaign = (campaignData ?? {}) as Record<string, unknown>;
  const campaignId = coerceString(campaign.campaign_id);
  const returnedSlug = coerceString(campaign.public_slug) || publicSlug;

  if (!campaignId) {
    return {
      code: "unknown",
      error: "The campaign was created, but its ID was not returned.",
      success: false,
    };
  }

  const { error: unitsError } = await supabase.rpc(
    "add_community_registration_units_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_id: campaignId,
      p_house_ids: selectedUnitIds,
      p_unit_overrides: {},
    },
  );

  if (unitsError) {
    revalidatePath(`/products/entry/communities/${communityId}`);
    return {
      code: "add_units_failed",
      error:
        "Campaign was created, but selected units could not be attached. Do not share the link; review the campaign before continuing.",
      success: false,
    };
  }

  revalidatePath(`/products/entry/communities/${communityId}`);

  const baseUrl = await getRegistrationBaseUrl();
  const path = `/entry/register/${encodeURIComponent(
    returnedSlug,
  )}/access?token=${encodeURIComponent(plaintextToken)}`;

  return {
    data: {
      campaignId,
      publicSlug: returnedSlug,
      registrationUrl: `${baseUrl}${path}`,
      selectedUnitCount: selectedUnitIds.length,
      status: "open",
      submittedUnitCount: 0,
    },
    success: true,
  };
}
