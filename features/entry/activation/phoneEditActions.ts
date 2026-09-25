"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";

export type UpdateActivationPhoneData = {
  activation_method: string;
  activation_reset: boolean;
  campaign_messages_updated: number;
  changed: boolean;
  legacy_codes_invalidated: number;
  phone: string;
  pins_invalidated: number;
  previous_status?: string;
  queue_id: string;
  status: string;
};

export type UpdateActivationPhoneResult =
  | { success: true; data: UpdateActivationPhoneData }
  | { success: false; error: string };

type UpdateActivationPhoneRpcResult = Partial<UpdateActivationPhoneData> & {
  error?: string;
  success?: boolean;
};

function getFriendlyError(code: string) {
  switch (code) {
    case "invalid_phone":
      return "Enter a valid phone number.";
    case "queue_row_not_found":
      return "This activation queue record could not be found.";
    case "queue_row_terminal":
      return "Activated or skipped residents cannot be edited from the Activation Queue.";
    case "phone_send_in_progress":
      return "A phone-based onboarding message is currently being sent to this resident. Wait for that send to finish, then try again.";
    default:
      return "Could not update the activation phone. Please try again.";
  }
}

export async function updateActivationPhone(input: {
  communityId: string;
  queueId: string;
  phone: string;
}): Promise<UpdateActivationPhoneResult> {
  await requireSuperadmin();

  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    return { success: false, error: previewReadOnlyError };
  }

  const communityId = input.communityId.trim();
  const queueId = input.queueId.trim();
  const phone = input.phone.trim();

  if (!communityId || !queueId) {
    return { success: false, error: "Community and resident are required." };
  }

  if (!phone) {
    return { success: false, error: "Enter a valid phone number." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "update_resident_activation_phone_v1",
      {
        p_community_id: communityId,
        p_queue_id: queueId,
        p_phone: phone,
      },
    );

    if (error) {
      if (error.code === "42501") {
        return {
          success: false,
          error: "Access denied. Superadmin permission required.",
        };
      }

      return {
        success: false,
        error: getFriendlyError(error.message ?? ""),
      };
    }

    const result = (data ?? {}) as UpdateActivationPhoneRpcResult;

    if (!result.success) {
      return {
        success: false,
        error: getFriendlyError(result.error ?? ""),
      };
    }

    revalidatePath("/products/entry/activation");
    revalidatePath(`/products/entry/communities/${communityId}`);

    return {
      success: true,
      data: {
        activation_method: result.activation_method?.trim() ?? "",
        activation_reset: Boolean(result.activation_reset),
        campaign_messages_updated: Number(result.campaign_messages_updated ?? 0),
        changed: Boolean(result.changed),
        legacy_codes_invalidated: Number(result.legacy_codes_invalidated ?? 0),
        phone: result.phone?.trim() ?? phone,
        pins_invalidated: Number(result.pins_invalidated ?? 0),
        previous_status: result.previous_status?.trim() || undefined,
        queue_id: result.queue_id?.trim() ?? queueId,
        status: result.status?.trim() ?? "pending",
      },
    };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
