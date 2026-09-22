"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegistrationBulkActionResult =
  | {
      success: true;
      message: string;
      changedCount: number;
      blockedCount?: number;
    }
  | {
      success: false;
      error: string;
    };

function normalizeIds(unitIds: string[]) {
  return Array.from(
    new Set(unitIds.map((value) => value.trim()).filter(Boolean)),
  ).slice(0, 100);
}

function revalidate(communityId: string) {
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/registration`);
  revalidatePath("/products/entry/activation");
}

export async function markRegistrationUnitsReadyForPatronato(input: {
  communityId: string;
  unitIds: string[];
}): Promise<RegistrationBulkActionResult> {
  const auth = await requireSuperadmin();
  const previewError = getEntryPreviewReadOnlyError();

  if (previewError) return { success: false, error: previewError };

  const communityId = input.communityId.trim();
  const unitIds = normalizeIds(input.unitIds);

  if (!communityId || unitIds.length === 0) {
    return { success: false, error: "Select submitted units first." };
  }

  const supabase = createAdminClient();
  const { data: units, error: unitsError } = await supabase
    .from("community_registration_units")
    .select("id,status")
    .eq("community_id", communityId)
    .in("id", unitIds);

  if (
    unitsError ||
    !Array.isArray(units) ||
    units.length !== unitIds.length ||
    units.some((unit) => unit.status !== "submitted")
  ) {
    return {
      success: false,
      error: "Only current Submitted units can be sent to Patronato.",
    };
  }

  for (const unitId of [...unitIds].sort()) {
    const { error } = await supabase.rpc(
      "mark_community_registration_unit_reviewed_v1",
      {
        p_actor_user_id: auth.user.id,
        p_campaign_unit_id: unitId,
      },
    );

    if (error) {
      return {
        success: false,
        error:
          "One unit changed while the batch was running. Refresh and review the current state.",
      };
    }
  }

  revalidate(communityId);

  return {
    success: true,
    changedCount: unitIds.length,
    message: `${unitIds.length} ${unitIds.length === 1 ? "unit is" : "units are"} ready for Patronato.`,
  };
}

export async function prepareApprovedRegistrationUnitsForActivation(input: {
  communityId: string;
  unitIds: string[];
}): Promise<RegistrationBulkActionResult> {
  const auth = await requireSuperadmin();
  const previewError = getEntryPreviewReadOnlyError();

  if (previewError) return { success: false, error: previewError };

  const communityId = input.communityId.trim();
  const unitIds = normalizeIds(input.unitIds);

  if (!communityId || unitIds.length === 0) {
    return { success: false, error: "Select Patronato-approved units first." };
  }

  const supabase = createAdminClient();
  const { data: units, error: unitsError } = await supabase
    .from("community_registration_units")
    .select("id,status")
    .eq("community_id", communityId)
    .in("id", unitIds);

  if (
    unitsError ||
    !Array.isArray(units) ||
    units.length !== unitIds.length ||
    units.some((unit) => unit.status !== "confirmed")
  ) {
    return {
      success: false,
      error: "Only Patronato-approved units can move to Activation Queue.",
    };
  }

  let changedCount = 0;
  let blockedCount = 0;

  for (const unitId of [...unitIds].sort()) {
    const { data, error } = await supabase.rpc(
      "convert_community_registration_unit_to_activation_v1",
      {
        p_actor_user_id: auth.user.id,
        p_campaign_unit_id: unitId,
        p_reason: "Patronato approved · batch handoff from Resident Registration",
      },
    );

    if (error) {
      return {
        success: false,
        error:
          "Activation Queue preparation stopped because one unit changed. Refresh before retrying.",
      };
    }

    const record =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};

    if (String(record.status) === "blocked") {
      blockedCount += 1;
    } else {
      changedCount += 1;
    }
  }

  revalidate(communityId);

  return {
    success: true,
    changedCount,
    blockedCount,
    message:
      blockedCount > 0
        ? `${changedCount} moved to Activation Queue · ${blockedCount} need manual review.`
        : `${changedCount} ${changedCount === 1 ? "unit moved" : "units moved"} to Activation Queue.`,
  };
}
