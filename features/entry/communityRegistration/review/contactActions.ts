"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import {
  buildResidentContactIssues,
  buildResidentContactIssueSignature,
  normalizeWhatsAppNumber,
} from "@/features/entry/communityRegistration/review/residentContact";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";

export type RecordWhatsAppContactResult =
  | {
      success: true;
      data: {
        contactedAt: string;
        issueSignature: string;
        recipientName: string;
        recipientPhone: string;
      };
    }
  | {
      success: false;
      error: string;
    };

const CURRENT_SUBMISSION_STATUSES = [
  "submitted",
  "edit_enabled",
  "reviewed",
  "confirmed",
  "converted",
] as const;

export async function recordCommunityRegistrationWhatsAppContact(input: {
  communityId: string;
  recipientPosition: number;
  unitId: string;
}): Promise<RecordWhatsAppContactResult> {
  const auth = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { success: false, error: previewReadOnlyError };
  }

  const communityId = input.communityId.trim();
  const unitId = input.unitId.trim();
  const recipientPosition = Number(input.recipientPosition);

  if (!communityId || !unitId || !Number.isInteger(recipientPosition) || recipientPosition <= 0) {
    return { success: false, error: "Resident contact information is incomplete." };
  }

  const supabase = createAdminClient();
  const { data: unit, error: unitError } = await supabase
    .from("community_registration_units")
    .select(
      "id,campaign_id,community_id,status,unit_label_snapshot,unit_reference_snapshot",
    )
    .eq("id", unitId)
    .eq("community_id", communityId)
    .maybeSingle();

  if (
    unitError ||
    !unit ||
    ["unregistered", "merged"].includes(coerceString(unit.status).trim().toLowerCase())
  ) {
    return {
      success: false,
      error: "This household is no longer available for resident follow-up. Refresh and try again.",
    };
  }

  const { data: submission, error: submissionError } = await supabase
    .from("community_registration_submissions")
    .select("id,status,version_number")
    .eq("campaign_unit_id", unitId)
    .eq("campaign_id", coerceString(unit.campaign_id).trim())
    .in("status", [...CURRENT_SUBMISSION_STATUSES])
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (submissionError || !submission) {
    return {
      success: false,
      error: "The current household submission could not be found. Refresh and try again.",
    };
  }

  const { data: residents, error: residentsError } = await supabase
    .from("community_registration_residents")
    .select("id,position,full_name,email,phone")
    .eq("submission_id", submission.id)
    .eq("campaign_unit_id", unitId)
    .order("position", { ascending: true });

  if (residentsError || !Array.isArray(residents) || residents.length === 0) {
    return {
      success: false,
      error: "Current resident information could not be loaded. Refresh and try again.",
    };
  }

  const normalizedResidents = residents
    .map((resident) => ({
      email: coerceString(resident.email).trim() || null,
      fullName: coerceString(resident.full_name).trim(),
      phone: coerceString(resident.phone).trim() || null,
      position: Number(resident.position ?? 0),
    }))
    .filter((resident) => resident.position > 0 && resident.fullName);

  const issues = buildResidentContactIssues({
    reference: coerceString(unit.unit_reference_snapshot).trim() || null,
    residents: normalizedResidents,
    unitLabel: coerceString(unit.unit_label_snapshot).trim(),
  });

  if (issues.length === 0) {
    return {
      success: false,
      error: "This household no longer has resident follow-up issues.",
    };
  }

  const recipient = normalizedResidents.find(
    (resident) => resident.position === recipientPosition,
  );

  if (!recipient || !normalizeWhatsAppNumber(recipient.phone)) {
    return {
      success: false,
      error: "The selected resident does not have a usable WhatsApp number.",
    };
  }

  const issueSignature = buildResidentContactIssueSignature(issues);
  const { data, error } = await supabase.rpc(
    "record_community_registration_whatsapp_contact_v1",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_id: unitId,
      p_issue_signature: issueSignature,
      p_issue_snapshot: issues,
      p_recipient_position: recipientPosition,
    },
  );

  if (error) {
    const message = error.message ?? "";
    if (/ENTRY_CR_(INVALID_CONTACT_EVENT|INVALID_RESIDENT)/.test(message)) {
      return {
        success: false,
        error: "The contact details changed. Refresh the household before marking it contacted.",
      };
    }

    return {
      success: false,
      error: "Could not record the WhatsApp contact. Please try again.",
    };
  }

  const result =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  revalidatePath(`/products/entry/communities/${communityId}/registration`);

  return {
    success: true,
    data: {
      contactedAt: coerceString(result.contacted_at).trim() || new Date().toISOString(),
      issueSignature:
        coerceString(result.issue_signature).trim() || issueSignature,
      recipientName:
        coerceString(result.recipient_name).trim() || recipient.fullName,
      recipientPhone:
        coerceString(result.recipient_phone).trim() ||
        normalizeWhatsAppNumber(recipient.phone) ||
        recipient.phone ||
        "",
    },
  };
}
