"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";

export type UpdateActivationEmailData = {
  campaign_messages_updated: number;
  changed: boolean;
  email: string;
  legacy_codes_invalidated: number;
  pins_invalidated: number;
  previous_status?: string;
  queue_id: string;
  status: string;
};

export type UpdateActivationEmailResult =
  | { success: true; data: UpdateActivationEmailData }
  | { success: false; error: string };

type UpdateActivationEmailRpcResult = Partial<UpdateActivationEmailData> & {
  error?: string;
  success?: boolean;
};

function getFriendlyError(code: string) {
  switch (code) {
    case "invalid_email":
      return "Enter a valid email address.";
    case "queue_row_not_found":
      return "This activation queue record could not be found.";
    case "queue_row_terminal":
      return "Activated or skipped residents cannot be edited from the Activation Queue.";
    case "email_already_registered":
      return "An ENTRY account already uses this email address.";
    case "email_already_reserved":
      return "Another resident activation already uses this email address.";
    case "campaign_send_in_progress":
      return "An onboarding campaign is currently sending this resident's invitation. Wait for that send to finish, then try again.";
    default:
      return "Could not update the activation email. Please try again.";
  }
}

export async function updateActivationEmail(input: {
  communityId: string;
  queueId: string;
  email: string;
}): Promise<UpdateActivationEmailResult> {
  await requireSuperadmin();

  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    return { success: false, error: previewReadOnlyError };
  }

  const communityId = input.communityId.trim();
  const queueId = input.queueId.trim();
  const email = input.email.trim();

  if (!communityId || !queueId) {
    return { success: false, error: "Community and resident are required." };
  }

  if (!email) {
    return { success: false, error: "Enter a valid email address." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "update_resident_activation_email_v1",
      {
        p_community_id: communityId,
        p_queue_id: queueId,
        p_email: email,
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

    const result = (data ?? {}) as UpdateActivationEmailRpcResult;

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
        campaign_messages_updated: Number(result.campaign_messages_updated ?? 0),
        changed: Boolean(result.changed),
        email: result.email?.trim() ?? email.toLowerCase(),
        legacy_codes_invalidated: Number(result.legacy_codes_invalidated ?? 0),
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
