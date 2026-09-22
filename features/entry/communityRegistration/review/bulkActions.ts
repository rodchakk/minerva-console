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
  const { data, error } = await supabase.rpc(
    "mark_community_registration_units_reviewed_v2",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_ids: unitIds,
      p_community_id: communityId,
    },
  );

  if (error) {
    return {
      success: false,
      error:
        "One or more units changed before the batch was committed. Refresh and review the current state.",
    };
  }

  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const changedCount = Number(record.reviewed_count ?? 0);

  revalidate(communityId);

  return {
    success: true,
    changedCount,
    message: `${changedCount} ${changedCount === 1 ? "unit is" : "units are"} ready for Patronato.`,
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
  const { data, error } = await supabase.rpc(
    "convert_community_registration_units_to_activation_v2",
    {
      p_actor_user_id: auth.user.id,
      p_campaign_unit_ids: unitIds,
      p_community_id: communityId,
      p_reason: "Patronato approved · batch handoff from Resident Registration",
    },
  );

  if (error) {
    return {
      success: false,
      error:
        "The Activation Queue batch was rolled back because one or more units changed. Refresh before retrying.",
    };
  }

  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const changedCount = Number(record.processed_count ?? 0);
  const blockedCount = Number(record.blocked_count ?? 0);

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
