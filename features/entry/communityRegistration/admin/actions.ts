"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  getEntryPreviewReadOnlyError,
  getResidentFacingBaseUrl,
} from "@/features/entry/deploymentBoundary";
import {
  decryptCampaignRegistrationToken,
  encryptCampaignRegistrationToken,
  timingSafeHashEqual,
} from "@/features/entry/communityRegistration/admin/campaignLinkEncryption";
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
        mode: "launch";
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
        | "invalid_input"
        | "unauthorized"
        | "unknown";
      error: string;
      success: false;
    };

export type ReplaceCommunityRegistrationLinkResult =
  | {
      success: true;
      data: {
        campaignId: string;
        mode: "replace";
        publicSlug: string;
        registrationUrl: string;
        revokedPreviousCount: number;
      };
    }
  | {
      code:
        | "invalid_input"
        | "invalid_state"
        | "unauthorized"
        | "unknown";
      error: string;
      success: false;
    };

export type RecoverCommunityRegistrationLinkResult =
  | {
      success: true;
      data: {
        mode: "recover";
        registrationUrl: string;
      };
    }
  | {
      code:
        | "invalid_input"
        | "invalid_state"
        | "legacy_unrecoverable"
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

function mapReplacementError(error: {
  code?: string | null;
  message?: string | null;
}): ReplaceCommunityRegistrationLinkResult {
  const message = error.message ?? "";

  if (error.code === "42501" || /ENTRY_CR_UNAUTHORIZED|unauthorized/i.test(message)) {
    return {
      code: "unauthorized",
      error: "Access denied. Superadmin permission required.",
      success: false,
    };
  }

  if (
    error.code === "P0409" ||
    /ENTRY_CR_INVALID_STATE|ENTRY_CR_CAMPAIGN_UNAVAILABLE/.test(message)
  ) {
    return {
      code: "invalid_state",
      error: "This registration campaign cannot replace its link right now.",
      success: false,
    };
  }

  return {
    code: "unknown",
    error: "Could not replace the registration link. Please try again.",
    success: false,
  };
}

function mapRecoverError(): RecoverCommunityRegistrationLinkResult {
  return {
    code: "unknown",
    error: "Could not recover the registration link. Please replace it if needed.",
    success: false,
  };
}

export async function launchCommunityRegistrationCampaign(
  _previousState: LaunchCommunityRegistrationCampaignResult | null,
  formData: FormData,
): Promise<LaunchCommunityRegistrationCampaignResult> {
  const auth = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return {
      code: "unknown",
      error: previewReadOnlyError,
      success: false,
    };
  }

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
  let encryptedTokenPayload: string;
  try {
    encryptedTokenPayload = encryptCampaignRegistrationToken(plaintextToken);
  } catch {
    return {
      code: "unknown",
      error: "Campaign link recovery encryption is not configured.",
      success: false,
    };
  }
  const publicSlug = makeCampaignSlug(communityName || publicTitle);
  const supabase = createAdminClient();

  const { data: campaignData, error: campaignError } = await supabase.rpc(
    "launch_community_registration_campaign_v2",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_token_hash: campaignTokenHash,
      p_closes_at: null,
      p_community_id: communityId,
      p_default_resident_limit: defaultResidentLimit,
      p_encrypted_token_payload: encryptedTokenPayload,
      p_internal_name: `Resident registration - ${communityName || communityId}`,
      p_opens_at: null,
      p_public_instructions: publicInstructions || null,
      p_public_slug: publicSlug,
      p_public_title: publicTitle,
      p_house_ids: selectedUnitIds,
      p_unit_overrides: {},
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

  revalidatePath(`/products/entry/communities/${communityId}`);

  const baseUrl = await getResidentFacingBaseUrl();
  const path = `/entry/register/${encodeURIComponent(
    returnedSlug,
  )}/access?token=${encodeURIComponent(plaintextToken)}`;

  return {
    data: {
      campaignId,
      mode: "launch",
      publicSlug: returnedSlug,
      registrationUrl: `${baseUrl}${path}`,
      selectedUnitCount: selectedUnitIds.length,
      status: "open",
      submittedUnitCount: 0,
    },
    success: true,
  };
}

export async function replaceCommunityRegistrationLink(
  _previousState: ReplaceCommunityRegistrationLinkResult | null,
  formData: FormData,
): Promise<ReplaceCommunityRegistrationLinkResult> {
  const auth = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return {
      code: "unknown",
      error: previewReadOnlyError,
      success: false,
    };
  }

  const campaignId = getFormString(formData, "campaign_id");
  const communityId = getFormString(formData, "community_id");

  if (!campaignId || !communityId) {
    return {
      code: "invalid_input",
      error: "Campaign information is missing.",
      success: false,
    };
  }

  const plaintextToken = makeCampaignToken();
  const campaignTokenHash = hashRegistrationToken(plaintextToken);
  let encryptedTokenPayload: string;
  try {
    encryptedTokenPayload = encryptCampaignRegistrationToken(plaintextToken);
  } catch {
    return {
      code: "unknown",
      error: "Campaign link recovery encryption is not configured.",
      success: false,
    };
  }
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc(
    "rotate_community_registration_campaign_access_v2",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_id: campaignId,
      p_campaign_token_hash: campaignTokenHash,
      p_encrypted_token_payload: encryptedTokenPayload,
    },
  );

  if (error) {
    return mapReplacementError(error);
  }

  const result = (data ?? {}) as Record<string, unknown>;
  const returnedCampaignId = coerceString(result.campaign_id) || campaignId;
  const returnedSlug = coerceString(result.public_slug);

  if (!returnedSlug) {
    return {
      code: "unknown",
      error: "The link was replaced, but the campaign slug was not returned.",
      success: false,
    };
  }

  revalidatePath(`/products/entry/communities/${communityId}`);

  const baseUrl = await getResidentFacingBaseUrl();
  const path = `/entry/register/${encodeURIComponent(
    returnedSlug,
  )}/access?token=${encodeURIComponent(plaintextToken)}`;

  return {
    data: {
      campaignId: returnedCampaignId,
      mode: "replace",
      publicSlug: returnedSlug,
      registrationUrl: `${baseUrl}${path}`,
      revokedPreviousCount: Number(result.revoked_previous_count ?? 0),
    },
    success: true,
  };
}

export async function recoverCommunityRegistrationLink(input: {
  campaignId: string;
  communityId: string;
}): Promise<RecoverCommunityRegistrationLinkResult> {
  await requireSuperadmin();

  const campaignId = input.campaignId.trim();
  const communityId = input.communityId.trim();

  if (!campaignId || !communityId) {
    return {
      code: "invalid_input",
      error: "Campaign information is missing.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data: campaignData, error: campaignError } = await supabase
    .from("community_registration_campaigns")
    .select("id,community_id,public_slug,status")
    .eq("id", campaignId)
    .eq("community_id", communityId)
    .maybeSingle();

  if (campaignError) {
    return mapRecoverError();
  }

  const campaign = (campaignData ?? {}) as Record<string, unknown>;
  const publicSlug = coerceString(campaign.public_slug);

  if (
    coerceString(campaign.id) !== campaignId ||
    coerceString(campaign.community_id) !== communityId ||
    coerceString(campaign.status).trim().toLowerCase() !== "open" ||
    !publicSlug
  ) {
    return {
      code: "invalid_state",
      error: "This campaign does not have an active registration link to share.",
      success: false,
    };
  }

  const { data: tokenData, error: tokenError } = await supabase
    .from("community_registration_access_tokens")
    .select(
      "id,token_hash,token_type,status,expires_at,consumed_at,revoked_at,encrypted_token_payload",
    )
    .eq("campaign_id", campaignId)
    .eq("token_type", "campaign_access")
    .eq("status", "active");

  if (tokenError || !Array.isArray(tokenData) || tokenData.length !== 1) {
    return {
      code: "invalid_state",
      error: "This campaign does not have exactly one active registration link.",
      success: false,
    };
  }

  const token = tokenData[0] as Record<string, unknown>;
  const encryptedPayload = coerceString(token.encrypted_token_payload);
  const storedHash = coerceString(token.token_hash);
  const expiresAt = coerceString(token.expires_at);

  if (
    coerceString(token.token_type) !== "campaign_access" ||
    coerceString(token.status) !== "active" ||
    coerceString(token.revoked_at) ||
    coerceString(token.consumed_at) ||
    (expiresAt && Date.parse(expiresAt) <= Date.now())
  ) {
    return {
      code: "invalid_state",
      error: "This campaign registration link is not active.",
      success: false,
    };
  }

  if (!encryptedPayload) {
    return {
      code: "legacy_unrecoverable",
      error:
        "Current registration link cannot be recovered. Replace the registration link once to enable future re-sharing.",
      success: false,
    };
  }

  try {
    const plaintextToken = decryptCampaignRegistrationToken(encryptedPayload);
    const recoveredHash = hashRegistrationToken(plaintextToken);

    if (!timingSafeHashEqual(recoveredHash, storedHash)) {
      return mapRecoverError();
    }

    const baseUrl = await getResidentFacingBaseUrl();
    const path = `/entry/register/${encodeURIComponent(
      publicSlug,
    )}/access?token=${encodeURIComponent(plaintextToken)}`;

    return {
      data: {
        mode: "recover",
        registrationUrl: `${baseUrl}${path}`,
      },
      success: true,
    };
  } catch {
    return mapRecoverError();
  }
}
