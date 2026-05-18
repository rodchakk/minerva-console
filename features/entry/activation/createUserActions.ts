"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { generateActivationPins } from "@/features/entry/activation/pinActions";
import { createClient } from "@/lib/supabase/server";

type CompleteActivationRpcResult = {
  auth_type?: string;
  error?: string;
  login_email?: string | null;
  success?: boolean;
  user_id?: string;
  username?: string | null;
};

export type CreateActivatedUserItem = {
  activation_method: string | null;
  auth_type: string | null;
  email: string | null;
  login_identity: string | null;
  message: string | null;
  queue_id: string;
  resident_name: string | null;
  status: "activated" | "skipped" | "failed";
  suggested_username: string | null;
  temporary_password: string | null;
  unit_label: string | null;
  user_id: string | null;
};

export type CreateActivatedUsersResult = {
  activated_count: number;
  failed_count: number;
  items: CreateActivatedUserItem[];
  skipped_count: number;
};

export type CreateActivatedUsersActionResult =
  | { success: true; data: CreateActivatedUsersResult }
  | { success: false; error: string };

function buildTemporaryPassword() {
  return `Entry!${randomInt(100000, 999999)}`;
}

function getLoginIdentity(result: CompleteActivationRpcResult, fallbackUsername: string | null) {
  if (result.auth_type === "email") {
    return result.login_email?.trim() || null;
  }

  return result.username?.trim() || fallbackUsername?.trim() || null;
}

function normalizeRpcError(value: unknown) {
  const message =
    value instanceof Error ? value.message : typeof value === "string" ? value : "";

  switch (message) {
    case "already_activated":
      return "This resident is already activated.";
    case "missing_house_match":
      return "This resident must be linked to a unit before activation.";
    case "email_already_registered":
      return "An account with this email already exists.";
    case "pin_already_used":
      return "The activation PIN was already used.";
    case "queue_not_eligible":
      return "This queue row is not eligible for direct activation.";
    default:
      return message || "Could not create this user.";
  }
}

export async function createActivatedUsers(input: {
  communityId: string;
  queueIds: string[];
}): Promise<CreateActivatedUsersActionResult> {
  await requireSuperadmin();

  const { communityId, queueIds } = input;

  if (!communityId) {
    return { success: false, error: "No community selected." };
  }

  if (!queueIds.length) {
    return { success: false, error: "No residents selected." };
  }

  const pinResult = await generateActivationPins({ communityId, queueIds });

  if (!pinResult.success) {
    return {
      success: false,
      error: `Failed to prepare activation PINs: ${pinResult.error}`,
    };
  }

  const supabase = await createClient();
  const items: CreateActivatedUserItem[] = [];
  let activated_count = 0;
  let skipped_count = 0;
  let failed_count = 0;

  for (const item of pinResult.data.items) {
    if (item.status !== "pin_generated" || !item.pin) {
      const isFailure = item.status === "failed";

      if (isFailure) {
        failed_count++;
      } else {
        skipped_count++;
      }

      items.push({
        activation_method: item.activation_method,
        auth_type: null,
        email: item.email,
        login_identity: null,
        message: item.message,
        queue_id: item.queue_id,
        resident_name: item.resident_name,
        status: isFailure ? "failed" : "skipped",
        suggested_username: item.suggested_username,
        temporary_password: null,
        unit_label: item.unit_label,
        user_id: null,
      });
      continue;
    }

    const temporaryPassword = buildTemporaryPassword();

    try {
      const { data, error } = await supabase.rpc(
        "complete_resident_activation_pin_v1",
        {
          p_password: temporaryPassword,
          p_pin: item.pin,
          p_username: item.suggested_username,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      const rpcResult = (data ?? {}) as CompleteActivationRpcResult;

      if (!rpcResult.success) {
        throw new Error(rpcResult.error);
      }

      activated_count++;
      items.push({
        activation_method: item.activation_method,
        auth_type: rpcResult.auth_type?.trim() || null,
        email: item.email,
        login_identity: getLoginIdentity(rpcResult, item.suggested_username),
        message: null,
        queue_id: item.queue_id,
        resident_name: item.resident_name,
        status: "activated",
        suggested_username: rpcResult.username?.trim() || item.suggested_username,
        temporary_password: temporaryPassword,
        unit_label: item.unit_label,
        user_id: rpcResult.user_id?.trim() || null,
      });
    } catch (error) {
      failed_count++;
      items.push({
        activation_method: item.activation_method,
        auth_type: null,
        email: item.email,
        login_identity: null,
        message: normalizeRpcError(error),
        queue_id: item.queue_id,
        resident_name: item.resident_name,
        status: "failed",
        suggested_username: item.suggested_username,
        temporary_password: null,
        unit_label: item.unit_label,
        user_id: null,
      });
    }
  }

  revalidatePath("/products/entry/activation");
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);
  revalidatePath(`/products/entry/communities/${communityId}/staff`);

  return {
    success: true,
    data: {
      activated_count,
      failed_count,
      items,
      skipped_count,
    },
  };
}
