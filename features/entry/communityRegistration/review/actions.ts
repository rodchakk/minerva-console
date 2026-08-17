"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { hashCorrectionToken } from "@/features/entry/communityRegistration/public/correctionAccessState";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";

const CORRECTION_LINK_LIFETIME_HOURS = 72;

export type CommunityRegistrationReviewActionResult =
  | {
      success: true;
      data: {
        correctionUrl?: string;
        expiresAt?: string;
        kind:
          | "start_review"
          | "mark_reviewed"
          | "request_correction"
          | "create_correction_link"
          | "replace_correction_link";
        revokedPreviousCount?: number;
        status: string;
        unitLabel?: string;
      };
    }
  | {
      success: false;
      code:
        | "invalid_input"
        | "invalid_state"
        | "not_ready"
        | "unauthorized"
        | "unknown";
      error: string;
    };

function getFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function revalidateReviewPaths(communityId: string) {
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/registration`);
}

function mapReviewError(error: {
  code?: string | null;
  message?: string | null;
}): CommunityRegistrationReviewActionResult {
  const message = error.message ?? "";

  if (error.code === "42501" || /ENTRY_CR_UNAUTHORIZED|unauthorized/i.test(message)) {
    return {
      code: "unauthorized",
      error: "Access denied. Superadmin permission required.",
      success: false,
    };
  }

  if (/ENTRY_CR_REVIEW_NOT_READY/.test(message)) {
    return {
      code: "not_ready",
      error: "This unit is not ready for that review action.",
      success: false,
    };
  }

  if (
    error.code === "P0409" ||
    /ENTRY_CR_(INVALID_REVIEW_STATE|INVALID_STATE|CAMPAIGN_UNAVAILABLE|CORRECTION_REQUIRED|ALREADY_CONFIRMED)/.test(
      message,
    )
  ) {
    return {
      code: "invalid_state",
      error: "The registration state changed. Refresh and review the current status before continuing.",
      success: false,
    };
  }

  return {
    code: "unknown",
    error: "The review action could not be completed. Please try again.",
    success: false,
  };
}

async function getRegistrationBaseUrl() {
  const publicConsoleUrl =
    process.env.NEXT_PUBLIC_MINERVA_CONSOLE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (publicConsoleUrl) return publicConsoleUrl.replace(/\/$/, "");

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");

  return host ? `${protocol}://${host}` : "";
}

function makeCorrectionToken() {
  return randomBytes(32).toString("base64url");
}

function correctionExpiry() {
  return new Date(Date.now() + CORRECTION_LINK_LIFETIME_HOURS * 60 * 60 * 1000).toISOString();
}

export async function startCommunityRegistrationReview(
  _previousState: CommunityRegistrationReviewActionResult | null,
  formData: FormData,
): Promise<CommunityRegistrationReviewActionResult> {
  const auth = await requireSuperadmin();
  const campaignId = getFormString(formData, "campaign_id");
  const communityId = getFormString(formData, "community_id");

  if (!campaignId || !communityId) {
    return {
      code: "invalid_input",
      error: "Campaign information is missing.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("start_community_registration_review_v1", {
    p_actor_user_id: auth.user.id,
    p_campaign_id: campaignId,
  });

  if (error) return mapReviewError(error);
  revalidateReviewPaths(communityId);

  const result = (data ?? {}) as Record<string, unknown>;
  return {
    data: {
      kind: "start_review",
      status: coerceString(result.campaign_status).trim() || "review",
    },
    success: true,
  };
}

export async function markCommunityRegistrationUnitReviewed(
  _previousState: CommunityRegistrationReviewActionResult | null,
  formData: FormData,
): Promise<CommunityRegistrationReviewActionResult> {
  const auth = await requireSuperadmin();
  const campaignUnitId = getFormString(formData, "campaign_unit_id");
  const communityId = getFormString(formData, "community_id");

  if (!campaignUnitId || !communityId) {
    return {
      code: "invalid_input",
      error: "Unit information is missing.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "mark_community_registration_unit_reviewed_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_id: campaignUnitId,
    },
  );

  if (error) return mapReviewError(error);
  revalidateReviewPaths(communityId);

  const result = (data ?? {}) as Record<string, unknown>;
  return {
    data: {
      kind: "mark_reviewed",
      status: coerceString(result.status).trim() || "reviewed",
      unitLabel: coerceString(result.unit_label).trim() || undefined,
    },
    success: true,
  };
}

export async function requestCommunityRegistrationCorrection(
  _previousState: CommunityRegistrationReviewActionResult | null,
  formData: FormData,
): Promise<CommunityRegistrationReviewActionResult> {
  const auth = await requireSuperadmin();
  const campaignId = getFormString(formData, "campaign_id");
  const campaignUnitId = getFormString(formData, "campaign_unit_id");
  const communityId = getFormString(formData, "community_id");
  const observation = getFormString(formData, "observation").replace(/\s+/g, " ");

  if (
    !campaignId ||
    !campaignUnitId ||
    !communityId ||
    !observation ||
    observation.length > 1000
  ) {
    return {
      code: "invalid_input",
      error: "Write a correction note between 1 and 1000 characters.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "request_community_registration_correction_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_id: campaignId,
      p_campaign_unit_id: campaignUnitId,
      p_observation: observation,
      p_patronato_token_hash: null,
    },
  );

  if (error) return mapReviewError(error);
  revalidateReviewPaths(communityId);

  const result = (data ?? {}) as Record<string, unknown>;
  return {
    data: {
      kind: "request_correction",
      status: coerceString(result.status).trim() || "needs_correction",
      unitLabel: coerceString(result.unit_label).trim() || undefined,
    },
    success: true,
  };
}

export async function createOrReplaceCommunityRegistrationCorrectionLink(
  _previousState: CommunityRegistrationReviewActionResult | null,
  formData: FormData,
): Promise<CommunityRegistrationReviewActionResult> {
  const auth = await requireSuperadmin();
  const campaignUnitId = getFormString(formData, "campaign_unit_id");
  const communityId = getFormString(formData, "community_id");
  const mode = getFormString(formData, "mode") === "replace" ? "replace" : "create";

  if (!campaignUnitId || !communityId) {
    return {
      code: "invalid_input",
      error: "Unit information is missing.",
      success: false,
    };
  }

  const plaintextToken = makeCorrectionToken();
  const editTokenHash = hashCorrectionToken(plaintextToken);
  const expiresAt = correctionExpiry();
  const supabase = createAdminClient();

  const response =
    mode === "replace"
      ? await supabase.rpc("rotate_community_registration_edit_access_v1", {
          p_actor_user_id: auth.user.id,
          p_campaign_unit_id: campaignUnitId,
          p_edit_token_hash: editTokenHash,
          p_expires_at: expiresAt,
          p_reason: "review_ui_replacement",
        })
      : await supabase.rpc("enable_community_registration_edit_v1", {
          p_actor_user_id: auth.user.id,
          p_campaign_unit_id: campaignUnitId,
          p_edit_token_hash: editTokenHash,
          p_expires_at: expiresAt,
          p_reason: "review_ui_correction",
        });

  if (response.error) return mapReviewError(response.error);

  const result = (response.data ?? {}) as Record<string, unknown>;
  const publicSlug = coerceString(result.public_slug).trim();
  const returnedExpiresAt = coerceString(result.expires_at).trim() || expiresAt;

  if (!publicSlug) {
    return {
      code: "unknown",
      error: "Correction access was created, but the public slug was not returned.",
      success: false,
    };
  }

  revalidateReviewPaths(communityId);
  const baseUrl = await getRegistrationBaseUrl();
  const path = `/entry/register/${encodeURIComponent(
    publicSlug,
  )}/correct/access?token=${encodeURIComponent(plaintextToken)}`;

  return {
    data: {
      correctionUrl: `${baseUrl}${path}`,
      expiresAt: returnedExpiresAt,
      kind:
        mode === "replace"
          ? "replace_correction_link"
          : "create_correction_link",
      revokedPreviousCount: Number(result.revoked_previous_count ?? 0),
      status: "edit_enabled",
    },
    success: true,
  };
}
