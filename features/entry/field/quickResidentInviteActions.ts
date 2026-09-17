"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { sendActivationEmails } from "@/features/entry/activation/emailActions";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";

export type FieldResidentInviteResult = {
  success: boolean;
  error?: string;
  queueId?: string;
  emailSent?: boolean;
  email?: string;
  residentName?: string;
  unitLabel?: string;
  warning?: string;
};

export async function inviteFieldQuickResident(input: {
  communityId: string;
  unitId: string;
  fullName: string;
  email: string;
  phone: string;
}): Promise<FieldResidentInviteResult> {
  await requireSuperadmin();
  const previewError = getEntryPreviewReadOnlyError();
  if (previewError) return { success: false, error: previewError };

  const communityId = input.communityId.trim();
  const unitId = input.unitId.trim();
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (!communityId || !unitId || !fullName || !email) {
    return { success: false, error: "Name, email, and unit are required." };
  }
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { success: false, error: "Enter a valid resident email address." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "prepare_resident_activation_invite_v1",
    {
      p_community_id: communityId,
      p_house_id: unitId,
      p_resident_name: fullName,
      p_email: email,
      p_phone: input.phone.trim() || null,
    },
  );
  if (error || !data?.success || !data.queue_id) {
    const code = error?.message || data?.error;
    const messages: Record<string, string> = {
      email_already_registered:
        "That email already belongs to an ENTRY account. Find the existing person instead of creating another identity.",
      resident_activation_conflict:
        "This resident or email has activation state in another context. Review the existing resident and Activation Queue.",
      house_not_in_community: "Selected unit was not found in this community.",
      house_inactive:
        "Residents cannot be invited to an inactive unit from Field.",
      invalid_resident_invite: "Check the resident name, email, and phone.",
    };
    return {
      success: false,
      error:
        messages[code] ||
        "Could not prepare resident activation. Review Activation Queue before retrying.",
    };
  }

  let emailSent = false;
  let warning: string | undefined;
  if (data.created) {
    try {
      const delivery = await sendActivationEmails({
        communityId,
        communityName: data.community_name,
        queueIds: [data.queue_id],
      });
      const item = delivery.data?.items.find(
        (candidate) => candidate.queue_id === data.queue_id,
      );
      emailSent = delivery.success && item?.status === "sent";
      warning = emailSent
        ? delivery.data?.warning || item?.message
        : "Resident prepared for activation, but the email could not be sent. Retry from Activation Queue.";
    } catch {
      warning =
        "Resident prepared for activation, but email delivery could not be confirmed. Review Activation Queue before resending.";
    }
  } else {
    warning =
      data.status === "invited"
        ? "An invitation was previously sent. Review Activation Queue before explicitly resending."
        : "This resident is already prepared for activation. Send or retry the invitation from Activation Queue.";
  }

  for (const path of [
    "/products/entry/activation",
    "/products/entry/communities",
    `/products/entry/communities/${communityId}`,
    `/products/entry/communities/${communityId}/users`,
    "/field/entry/people",
    `/field/entry/communities/${communityId}`,
    `/field/entry/communities/${communityId}/people`,
    `/field/entry/communities/${communityId}/people/units/${unitId}`,
    `/field/entry/communities/${communityId}/people/activation`,
    `/field/entry/communities/${communityId}/people/activation/${data.queue_id}`,
  ])
    revalidatePath(path);

  return {
    success: true,
    queueId: data.queue_id,
    emailSent,
    email: data.email,
    residentName: data.resident_name,
    unitLabel: data.unit_label,
    warning,
  };
}
