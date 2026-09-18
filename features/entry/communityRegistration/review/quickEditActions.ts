"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegistrationQuickEditActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function normalizeOptional(value: string) {
  return value.trim() || null;
}

export async function quickEditCommunityRegistrationResident(
  _previousState: RegistrationQuickEditActionResult | null,
  formData: FormData,
): Promise<RegistrationQuickEditActionResult> {
  const auth = await requireSuperadmin();
  const previewError = getEntryPreviewReadOnlyError();
  if (previewError) return { success: false, error: previewError };

  const communityId = formString(formData, "community_id");
  const campaignUnitId = formString(formData, "campaign_unit_id");
  const submissionId = formString(formData, "submission_id");
  const residentId = formString(formData, "resident_id");
  const fullName = formString(formData, "full_name").replace(/\s+/g, " ");
  const email = normalizeOptional(formString(formData, "email"));
  const phone = normalizeOptional(formString(formData, "phone"));

  if (!communityId || !campaignUnitId || !submissionId || !residentId || !fullName) {
    return { success: false, error: "Name and registration context are required." };
  }

  if (fullName.length > 160 || (email?.length ?? 0) > 254 || (phone?.length ?? 0) > 32) {
    return { success: false, error: "One or more resident fields are too long." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "quick_edit_community_registration_resident_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_id: campaignUnitId,
      p_submission_id: submissionId,
      p_resident_id: residentId,
      p_full_name: fullName,
      p_email: email,
      p_phone: phone,
    },
  );

  if (error) {
    const message = error.message ?? "";
    if (/ENTRY_CR_INVALID_REVIEW_STATE/.test(message)) {
      return {
        success: false,
        error: "This submission changed state. Refresh before editing resident details.",
      };
    }
    if (/ENTRY_CR_INVALID_RESIDENT/.test(message)) {
      return {
        success: false,
        error: "Check the name, email, and phone format and try again.",
      };
    }
    if (error.code === "42501" || /ENTRY_CR_UNAUTHORIZED/i.test(message)) {
      return { success: false, error: "Superadmin permission is required." };
    }
    return { success: false, error: "Resident details could not be updated." };
  }

  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/registration`);

  return { success: true, message: "Resident details updated." };
}


export async function quickEditCommunityRegistrationUnitLabel(
  _previousState: RegistrationQuickEditActionResult | null,
  formData: FormData,
): Promise<RegistrationQuickEditActionResult> {
  const auth = await requireSuperadmin();
  const previewError = getEntryPreviewReadOnlyError();
  if (previewError) return { success: false, error: previewError };

  const communityId = formString(formData, "community_id");
  const campaignUnitId = formString(formData, "campaign_unit_id");
  const unitLabel = formString(formData, "unit_label").replace(/\s+/g, " ");

  if (!communityId || !campaignUnitId || !unitLabel) {
    return { success: false, error: "Unit label and registration context are required." };
  }

  if (unitLabel.length > 160) {
    return { success: false, error: "Unit label must be 160 characters or fewer." };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc(
    "quick_edit_community_registration_unit_label_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_id: campaignUnitId,
      p_unit_label: unitLabel,
    },
  );

  if (error) {
    const message = error.message ?? "";
    if (/ENTRY_CR_UNIT_LABEL_CONFLICT/.test(message)) {
      return {
        success: false,
        error: "Another household in this campaign already uses that unit label.",
      };
    }
    if (/ENTRY_CR_INVALID_REVIEW_STATE/.test(message)) {
      return {
        success: false,
        error: "This household changed state. Refresh before editing the unit label.",
      };
    }
    if (/ENTRY_CR_UNIT_IDENTITY_LOCKED/.test(message)) {
      return {
        success: false,
        error: "This unit is already bound to an operational house and cannot be renamed here.",
      };
    }
    if (/ENTRY_CR_INVALID_UNIT_LABEL|ENTRY_CR_INVALID_UNIT/.test(message)) {
      return {
        success: false,
        error: "Enter a valid unit number or label and try again.",
      };
    }
    if (error.code === "42501" || /ENTRY_CR_UNAUTHORIZED/i.test(message)) {
      return { success: false, error: "Superadmin permission is required." };
    }
    return { success: false, error: "Unit label could not be updated." };
  }

  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/registration`);

  return { success: true, message: "Unit label updated." };
}
