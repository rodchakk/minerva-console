"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { sendActivationEmails } from "@/features/entry/activation/emailActions";
import { generateActivationPins } from "@/features/entry/activation/pinActions";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";

export type PrepareConsoleResidentAccessResult = {
  success: boolean;
  error?: string;
  mode?: "email" | "pin";
  queueId?: string;
  residentName?: string;
  unitLabel?: string;
  email?: string;
  emailSent?: boolean;
  pin?: string;
  warning?: string;
};

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function revalidateConsoleResidentPaths(communityId: string, unitId: string) {
  revalidatePath("/products/entry/activation");
  revalidatePath("/products/entry/users");
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);
  revalidatePath(`/products/entry/communities/${communityId}/units`);
  revalidatePath(`/products/entry/communities/${communityId}/units/${unitId}`);
}

function getPreparationError(code: string) {
  const messages: Record<string, string> = {
    email_already_registered:
      "That email already belongs to an ENTRY account. Find the existing person instead of creating another identity.",
    resident_activation_conflict:
      "This resident or identity already has activation state in another context. Review Activation Queue before retrying.",
    house_not_in_community: "Selected unit was not found in this community.",
    house_inactive: "Activate this unit before preparing the resident.",
    invalid_resident_invite: "Check the resident name, email, and phone.",
    activation_preparation_failed:
      "ENTRY could not prepare this resident for activation. Review Activation Queue and try again.",
  };

  return messages[code] ?? "Could not prepare resident activation.";
}

async function resolvePreparedQueueId(input: {
  communityId: string;
  unitId: string;
  fullName: string;
  phone: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("resident_activation_queue")
    .select("id,status")
    .eq("community_id", input.communityId)
    .eq("house_id", input.unitId)
    .eq("resident_name", input.fullName)
    .in("status", ["pending", "invited", "pin_generated", "failed"])
    .order("created_at", { ascending: false })
    .limit(2);

  if (input.phone) {
    query = query.eq("phone", input.phone);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data) || data.length !== 1) {
    return null;
  }

  return getString((data[0] as Record<string, unknown>).id) || null;
}

export async function prepareConsoleResidentAccess(input: {
  communityId: string;
  unitId: string;
  fullName: string;
  email?: string;
  phone?: string;
  mode: "email" | "pin";
}): Promise<PrepareConsoleResidentAccessResult> {
  await requireSuperadmin();
  const previewError = getEntryPreviewReadOnlyError();
  if (previewError) return { success: false, error: previewError };

  const communityId = input.communityId.trim();
  const unitId = input.unitId.trim();
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const email = (input.email ?? "").trim().toLowerCase();
  const phone = (input.phone ?? "").trim();

  if (!communityId || !unitId || !fullName) {
    return {
      success: false,
      error: "Community, unit, and resident name are required.",
    };
  }

  if (input.mode === "email" && (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    return { success: false, error: "Enter a valid resident email address." };
  }

  const supabase = await createClient();
  const { data: unit, error: unitError } = await supabase
    .from("houses")
    .select("id,house_label,is_active")
    .eq("community_id", communityId)
    .eq("id", unitId)
    .maybeSingle();

  if (unitError) {
    return { success: false, error: unitError.message };
  }
  if (!unit) {
    return { success: false, error: "Selected unit was not found in this community." };
  }
  if (unit.is_active === false) {
    return { success: false, error: "Activate this unit before preparing the resident." };
  }

  const unitLabel = getString(unit.house_label) || "Selected unit";

  if (input.mode === "email") {
    const { data, error } = await supabase.rpc(
      "prepare_resident_activation_invite_v1",
      {
        p_community_id: communityId,
        p_house_id: unitId,
        p_resident_name: fullName,
        p_email: email,
        p_phone: phone || null,
      },
    );

    const prepared = getRecord(data);
    const code = error?.message || getString(prepared.error);

    if (error || prepared.success !== true || !getString(prepared.queue_id)) {
      return { success: false, error: getPreparationError(code) };
    }

    const queueId = getString(prepared.queue_id);
    const communityName = getString(prepared.community_name);

    let emailSent = false;
    let warning: string | undefined;

    try {
      const delivery = await sendActivationEmails({
        communityId,
        communityName,
        queueIds: [queueId],
      });
      const item = delivery.data?.items.find((candidate) => candidate.queue_id === queueId);
      emailSent = delivery.success && item?.status === "sent";

      if (!delivery.success) {
        warning = delivery.error;
      } else if (!emailSent) {
        warning =
          item?.message ||
          "Resident prepared for activation, but the invitation email was not sent. Retry from Activation Queue.";
      } else {
        warning = delivery.data?.warning || item?.message;
      }
    } catch {
      warning =
        "Resident prepared for activation, but email delivery could not be confirmed. Retry from Activation Queue.";
    }

    revalidateConsoleResidentPaths(communityId, unitId);

    return {
      success: true,
      mode: "email",
      queueId,
      residentName: getString(prepared.resident_name) || fullName,
      unitLabel: getString(prepared.unit_label) || unitLabel,
      email: getString(prepared.email) || email,
      emailSent,
      warning,
    };
  }

  const { data: imported, error: importError } = await supabase.rpc(
    "confirm_resident_bulk_import_v1",
    {
      p_community_id: communityId,
      p_rows: [
        {
          unit_label: unitLabel,
          resident_name: fullName,
          email: null,
          phone: phone || null,
          is_owner: false,
          raw_data: {
            origin: "minerva_console_resident_access",
            requested_mode: "pin",
          },
        },
      ],
      p_create_missing_units: false,
    },
  );

  if (importError) {
    return {
      success: false,
      error: importError.message || "Could not prepare this resident for PIN activation.",
    };
  }

  const importRecord = getRecord(imported);
  const results = Array.isArray(importRecord.results) ? importRecord.results : [];
  const firstResult = getRecord(results[0]);
  const rowStatus = getString(firstResult.status);

  if (rowStatus === "failed") {
    return {
      success: false,
      error:
        "This resident conflicts with an existing activation record. Review Activation Queue before retrying.",
    };
  }

  let queueId = getString(firstResult.queue_id);
  if (!queueId) {
    queueId =
      (await resolvePreparedQueueId({
        communityId,
        unitId,
        fullName,
        phone,
      })) ?? "";
  }

  if (!queueId) {
    return {
      success: false,
      error:
        "Resident preparation completed, but ENTRY could not identify a single activation row. Review Activation Queue before retrying.",
    };
  }

  const pinResult = await generateActivationPins({
    communityId,
    queueIds: [queueId],
  });

  if (!pinResult.success) {
    revalidateConsoleResidentPaths(communityId, unitId);
    return {
      success: false,
      error: `Resident prepared, but PIN generation failed: ${pinResult.error}`,
    };
  }

  const pinItem = pinResult.data.items.find((item) => item.queue_id === queueId);
  if (!pinItem || pinItem.status !== "pin_generated" || !pinItem.pin) {
    revalidateConsoleResidentPaths(communityId, unitId);
    return {
      success: false,
      error:
        pinItem?.message ||
        "Resident prepared, but ENTRY did not return an activation PIN. Review Activation Queue.",
    };
  }

  revalidateConsoleResidentPaths(communityId, unitId);

  return {
    success: true,
    mode: "pin",
    queueId,
    residentName: pinItem.resident_name || fullName,
    unitLabel: pinItem.unit_label || unitLabel,
    pin: pinItem.pin,
  };
}
