"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { hashCorrectionToken } from "@/features/entry/communityRegistration/public/correctionAccessState";
import {
  getEntryPreviewReadOnlyError,
  getResidentFacingBaseUrl,
} from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceNumber, coerceString } from "@/lib/supabase/utils";

const CORRECTION_LINK_LIFETIME_HOURS = 72;

export type CommunityRegistrationReviewActionResult =
  | {
      success: true;
      data: {
        activationQueueUrl?: string;
        alreadyActiveCount?: number;
        alreadyComplete?: boolean;
        alreadyQueuedCount?: number;
        blockingCount?: number;
        convertedCount?: number;
        correctionUrl?: string;
        diagnosticCode?: string;
        expiresAt?: string;
        kind:
          | "start_review"
          | "mark_reviewed"
          | "request_correction"
          | "create_correction_link"
          | "replace_correction_link"
          | "confirm_prepare_activation";
        message?: string;
        preparedResidentCount?: number;
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
  revalidatePath(`/products/entry/activation`);
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
    /ENTRY_CR_(INVALID_REVIEW_STATE|INVALID_STATE|CAMPAIGN_UNAVAILABLE|CORRECTION_REQUIRED|ALREADY_CONFIRMED|CAMPAIGN_INCOMPLETE|CONVERSION_NOT_READY|CONFIRMATION_STALE|CONVERSION_INCOMPLETE|TRACEABILITY_CONFLICT|QUEUE_CONFLICT|IDENTITY_AMBIGUOUS|RESIDENT_CONFLICT)/.test(
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

function isAlreadyConfirmed(error: { code?: string | null; message?: string | null }) {
  return error.code === "P0409" && /ENTRY_CR_ALREADY_CONFIRMED/.test(error.message ?? "");
}

function summarizeConversionResult(value: unknown) {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const residents = Array.isArray(record.residents) ? record.residents : [];
  const preparedResidentCount = residents.filter((resident) => {
    if (!resident || typeof resident !== "object") return false;
    const item = resident as Record<string, unknown>;
    return Boolean(coerceString(item.activation_queue_id).trim());
  }).length;

  return {
    alreadyActiveCount:
      coerceNumber(record.already_active_count) ||
      residents.filter((resident) => {
        if (!resident || typeof resident !== "object") return false;
        return coerceString((resident as Record<string, unknown>).conversion_status) === "already_active";
      }).length,
    alreadyComplete: record.already_complete === true,
    alreadyQueuedCount:
      coerceNumber(record.already_queued_count) ||
      residents.filter((resident) => {
        if (!resident || typeof resident !== "object") return false;
        return coerceString((resident as Record<string, unknown>).conversion_status) === "already_queued";
      }).length,
    blockingCount: coerceNumber(record.blocking_count),
    convertedCount: coerceNumber(record.converted_count),
    preparedResidentCount:
      preparedResidentCount ||
      coerceNumber(record.converted_count) + coerceNumber(record.already_queued_count),
    status:
      coerceString(record.status).trim() ||
      coerceString(record.unit_status).trim() ||
      "processed",
    unitLabel: coerceString(record.unit_label).trim() || undefined,
  };
}

function makeCorrectionToken() {
  return randomBytes(32).toString("base64url");
}

function correctionExpiry() {
  return new Date(Date.now() + CORRECTION_LINK_LIFETIME_HOURS * 60 * 60 * 1000).toISOString();
}

function previewReadOnlyResult(): CommunityRegistrationReviewActionResult | null {
  const error = getEntryPreviewReadOnlyError();

  return error
    ? {
        code: "unknown",
        error,
        success: false,
      }
    : null;
}

export async function startCommunityRegistrationReview(
  _previousState: CommunityRegistrationReviewActionResult | null,
  formData: FormData,
): Promise<CommunityRegistrationReviewActionResult> {
  const auth = await requireSuperadmin();
  const previewResult = previewReadOnlyResult();

  if (previewResult) return previewResult;

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
  const previewResult = previewReadOnlyResult();

  if (previewResult) return previewResult;

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
  const previewResult = previewReadOnlyResult();

  if (previewResult) return previewResult;

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
  const previewResult = previewReadOnlyResult();

  if (previewResult) return previewResult;

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
  const baseUrl = await getResidentFacingBaseUrl();
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

export async function confirmAndPrepareCommunityRegistrationActivation(
  _previousState: CommunityRegistrationReviewActionResult | null,
  formData: FormData,
): Promise<CommunityRegistrationReviewActionResult> {
  const auth = await requireSuperadmin();
  const previewResult = previewReadOnlyResult();

  if (previewResult) return previewResult;

  const campaignId = getFormString(formData, "campaign_id");
  const campaignUnitId = getFormString(formData, "campaign_unit_id");
  const communityId = getFormString(formData, "community_id");
  const unitLabel = getFormString(formData, "unit_label");

  if (!campaignId || !campaignUnitId || !communityId) {
    return {
      code: "invalid_input",
      error: "Campaign and unit information is missing.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const activationQueueUrl = `/products/entry/activation?community_id=${encodeURIComponent(
    communityId,
  )}`;

  const existingResult = await supabase.rpc(
    "get_community_registration_conversion_result_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_id: campaignUnitId,
    },
  );

  if (!existingResult.error) {
    const existing = summarizeConversionResult(existingResult.data);
    if (existing.status === "processed") {
      revalidateReviewPaths(communityId);
      return {
        data: {
          activationQueueUrl,
          alreadyActiveCount: existing.alreadyActiveCount,
          alreadyComplete: true,
          alreadyQueuedCount: existing.alreadyQueuedCount,
          convertedCount: existing.convertedCount,
          kind: "confirm_prepare_activation",
          message: "This unit was already prepared for Activation Queue.",
          preparedResidentCount: existing.preparedResidentCount,
          status: "processed",
          unitLabel: existing.unitLabel ?? unitLabel,
        },
        success: true,
      };
    }
  }

  const approval = await supabase.rpc(
    "record_community_registration_unit_external_approval_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_id: campaignUnitId,
      p_reason: "ENTRY ONB-012 external Patronato approval",
    },
  );

  if (approval.error && !isAlreadyConfirmed(approval.error)) {
    return mapReviewError(approval.error);
  }

  const conversion = await supabase.rpc(
    "convert_community_registration_unit_to_activation_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_id: campaignUnitId,
      p_reason: "ENTRY ONB-012 external Patronato handoff",
    },
  );

  if (conversion.error) {
    const diagnosticCode = "ENTRY_ONB_012_CONVERSION_RPC_FAILED";
    console.error(diagnosticCode, {
      dbCode: conversion.error.code ?? "unknown",
      rpc: "convert_community_registration_unit_to_activation_v1",
    });
    revalidateReviewPaths(communityId);
    return {
      data: {
        activationQueueUrl,
        diagnosticCode,
        kind: "confirm_prepare_activation",
        message:
          "External Patronato approval is recorded for this unit, but Activation Queue preparation did not complete. Refresh and retry after reviewing the conversion status. Reference code: ENTRY_ONB_012_CONVERSION_RPC_FAILED.",
        status: "confirmed",
        unitLabel,
      },
      success: true,
    };
  }

  const converted = summarizeConversionResult(conversion.data);

  revalidateReviewPaths(communityId);
  return {
    data: {
      activationQueueUrl,
      alreadyActiveCount: converted.alreadyActiveCount,
      alreadyComplete: converted.alreadyComplete,
      alreadyQueuedCount: converted.alreadyQueuedCount,
      blockingCount: converted.blockingCount,
      convertedCount: converted.convertedCount,
      kind: "confirm_prepare_activation",
      message:
        converted.status === "blocked"
          ? "Activation Queue preparation found residents that need manual review before activation."
          : "Residents are prepared in Activation Queue. No users or PINs were created.",
      preparedResidentCount: converted.preparedResidentCount,
      status: converted.status,
      unitLabel: converted.unitLabel ?? unitLabel,
    },
    success: true,
  };
}
