"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegistrationDuplicateActionResult =
  | {
      success: true;
      data: {
        canonicalUnitId?: string;
        kind: "dismissed" | "merged" | "resolved_duplicate";
        message: string;
        mergedResidentCount?: number;
      };
    }
  | {
      success: false;
      error: string;
    };

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseResidentMergePlan(value: string): Record<string, unknown> | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function revalidateRegistration(communityId: string) {
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/registration`);
  revalidatePath("/products/entry/activation");
}

function previewReadOnlyResult(): RegistrationDuplicateActionResult | null {
  const error = getEntryPreviewReadOnlyError();
  return error ? { success: false, error } : null;
}

function mapDuplicateError(error: { code?: string | null; message?: string | null }) {
  const message = error.message ?? "";

  if (/ENTRY_CR_DUPLICATE_ALREADY_ACTIVATED/.test(message)) {
    return "These records already reached Activation Queue. Resolve the active identity before merging registration records.";
  }
  if (/ENTRY_CR_DUPLICATE_MANUAL_IDENTITY_REVIEW_REQUIRED/.test(message)) {
    return "Both registrations already have operational identity. This pair requires manual identity review.";
  }
  if (/ENTRY_CR_DUPLICATE_UNIQUE_DATA_REVIEW_REQUIRED/.test(message)) {
    return "The duplicate contains unique information. Review and acknowledge it before archiving the registration.";
  }
  if (/ENTRY_CR_DUPLICATE_INVALID_STATE/.test(message)) {
    return "The selected duplicate operation is not safe for the current registration lifecycle.";
  }
  if (/ENTRY_CR_DUPLICATE_DIFFERENT_CAMPAIGN|ENTRY_CR_DUPLICATE_INVALID_PAIR/.test(message)) {
    return "These units cannot be merged because they do not belong to the same active registration campaign.";
  }
  if (/ENTRY_CR_DUPLICATE_NOT_RESIDENT_PROVIDED/.test(message)) {
    return "Unit merging is only available for resident-provided registration campaigns.";
  }
  if (/ENTRY_CR_DUPLICATE_RESIDENT_LIMIT/.test(message)) {
    return "The combined household is larger than the safe resident limit. Review the residents before merging.";
  }
  if (/ENTRY_CR_DUPLICATE_RESIDENT_UNRESOLVED/.test(message)) {
    return "Resolve every resident match before merging these units.";
  }
  if (/ENTRY_CR_DUPLICATE_RESIDENT_FIELD_CONFLICT_UNRESOLVED/.test(message)) {
    return "Choose which source email or phone should be kept before merging this resident.";
  }
  if (/ENTRY_CR_DUPLICATE_RESIDENT_CONFLICT/.test(message)) {
    return "Resolve conflicting resident contact data before merging these units.";
  }
  if (/ENTRY_CR_DUPLICATE_RESIDENT_PLAN_REQUIRED/.test(message)) {
    return "Resident merge decisions are incomplete. Review the resident matches again.";
  }
  if (/ENTRY_CR_UNAUTHORIZED/i.test(message) || error.code === "42501") {
    return "Superadmin permission is required.";
  }
  if (/does not exist|PGRST205|42883/i.test(message)) {
    return "Duplicate resolution is not available in this environment until the reviewed database migration is deployed.";
  }

  return "The duplicate action could not be completed. Refresh and try again.";
}

export async function dismissCommunityRegistrationDuplicate(
  _previousState: RegistrationDuplicateActionResult | null,
  formData: FormData,
): Promise<RegistrationDuplicateActionResult> {
  const auth = await requireSuperadmin();
  const previewResult = previewReadOnlyResult();
  if (previewResult) return previewResult;

  const campaignId = formString(formData, "campaign_id");
  const communityId = formString(formData, "community_id");
  const leftUnitId = formString(formData, "left_unit_id");
  const rightUnitId = formString(formData, "right_unit_id");

  if (!campaignId || !communityId || !leftUnitId || !rightUnitId || leftUnitId === rightUnitId) {
    return { success: false, error: "Duplicate comparison information is incomplete." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "resolve_community_registration_duplicate_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_id: campaignId,
      p_left_unit_id: leftUnitId,
      p_right_unit_id: rightUnitId,
      p_resolution: "dismissed",
    },
  );

  if (error) return { success: false, error: mapDuplicateError(error) };

  revalidateRegistration(communityId);
  return {
    success: true,
    data: {
      kind: "dismissed",
      message: "The pair was marked as not duplicate.",
    },
  };
}

export async function mergeCommunityRegistrationDuplicateUnits(
  _previousState: RegistrationDuplicateActionResult | null,
  formData: FormData,
): Promise<RegistrationDuplicateActionResult> {
  const auth = await requireSuperadmin();
  const previewResult = previewReadOnlyResult();
  if (previewResult) return previewResult;

  const campaignId = formString(formData, "campaign_id");
  const communityId = formString(formData, "community_id");
  const canonicalUnitId = formString(formData, "canonical_unit_id");
  const duplicateUnitId = formString(formData, "duplicate_unit_id");
  const residentMergePlan = parseResidentMergePlan(
    formString(formData, "resident_merge_plan"),
  );

  if (
    !campaignId ||
    !communityId ||
    !canonicalUnitId ||
    !duplicateUnitId ||
    canonicalUnitId === duplicateUnitId
  ) {
    return { success: false, error: "Choose two different units and select which one should remain." };
  }

  if (!residentMergePlan || !Array.isArray(residentMergePlan.decisions)) {
    return { success: false, error: "Resident merge decisions are incomplete. Review the resident matches again." };
  }

  if (residentMergePlan.hasUnresolved === true) {
    return { success: false, error: "Resolve every resident match before merging these units." };
  }

  if (Number(residentMergePlan.conflicts ?? 0) > 0) {
    return { success: false, error: "Resolve conflicting resident contact data before merging these units." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "merge_community_registration_units_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_id: campaignId,
      p_canonical_unit_id: canonicalUnitId,
      p_duplicate_unit_id: duplicateUnitId,
      p_resident_plan: residentMergePlan,
    },
  );

  if (error) return { success: false, error: mapDuplicateError(error) };

  const result =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  revalidateRegistration(communityId);
  return {
    success: true,
    data: {
      canonicalUnitId,
      kind: "merged",
      mergedResidentCount: Number(result.merged_resident_count ?? 0),
      message: "The household records were merged into one canonical unit.",
    },
  };
}


export async function archiveCommunityRegistrationDuplicate(
  _previousState: RegistrationDuplicateActionResult | null,
  formData: FormData,
): Promise<RegistrationDuplicateActionResult> {
  const auth = await requireSuperadmin();
  const previewResult = previewReadOnlyResult();
  if (previewResult) return previewResult;

  const campaignId = formString(formData, "campaign_id");
  const communityId = formString(formData, "community_id");
  const canonicalUnitId = formString(formData, "canonical_unit_id");
  const duplicateUnitId = formString(formData, "duplicate_unit_id");
  const uniqueDataAcknowledged =
    formString(formData, "unique_data_acknowledged") === "true";

  if (
    !campaignId ||
    !communityId ||
    !canonicalUnitId ||
    !duplicateUnitId ||
    canonicalUnitId === duplicateUnitId
  ) {
    return {
      success: false,
      error: "Choose two different units and select the advanced record to keep.",
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "resolve_community_registration_archived_duplicate_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_id: campaignId,
      p_canonical_unit_id: canonicalUnitId,
      p_duplicate_unit_id: duplicateUnitId,
      p_unique_data_acknowledged: uniqueDataAcknowledged,
    },
  );

  if (error) return { success: false, error: mapDuplicateError(error) };

  const result =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  revalidateRegistration(communityId);
  return {
    success: true,
    data: {
      canonicalUnitId,
      kind: "resolved_duplicate",
      message:
        "The lower-stage registration was archived as a resolved duplicate. The operational household was not changed.",
      mergedResidentCount: Number(result.unique_data_count ?? 0),
    },
  };
}
