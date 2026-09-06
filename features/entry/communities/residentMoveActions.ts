"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { coerceString } from "@/lib/supabase/utils";

export type ResidentMoveUnitOption = {
  id: string;
  label: string;
};

export type ResidentMoveUnitOptionsResult = {
  error?: string;
  options?: ResidentMoveUnitOption[];
  success: boolean;
};

export type MoveResidentToUnitInput = {
  communityId: string;
  sourceHouseId: string;
  targetHouseId: string;
  userId: string;
};

export type MoveResidentToUnitResult = {
  error?: string;
  success: boolean;
};

function revalidateMovePaths(
  communityId: string,
  sourceHouseId: string,
  targetHouseId: string,
) {
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);
  revalidatePath(`/products/entry/communities/${communityId}/units`);
  revalidatePath(`/products/entry/communities/${communityId}/units/${sourceHouseId}`);
  revalidatePath(`/products/entry/communities/${communityId}/units/${targetHouseId}`);
  revalidatePath("/products/entry/users");
  revalidatePath(`/field/entry/communities/${communityId}`);
  revalidatePath(`/field/entry/communities/${communityId}/people`);
  revalidatePath(`/field/entry/communities/${communityId}/people/units/${sourceHouseId}`);
  revalidatePath(`/field/entry/communities/${communityId}/people/units/${targetHouseId}`);
}

export async function listResidentMoveUnitOptionsAction(input: {
  communityId: string;
  currentHouseId: string;
}): Promise<ResidentMoveUnitOptionsResult> {
  await requireSuperadmin();

  const communityId = input.communityId.trim();
  const currentHouseId = input.currentHouseId.trim();

  if (!communityId) {
    return { error: "Community is required.", success: false };
  }

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("houses")
    .select("id,house_label")
    .eq("community_id", communityId)
    .eq("is_active", true)
    .order("house_label", { ascending: true });

  if (error) {
    return { error: error.message, success: false };
  }

  const options = (Array.isArray(data) ? data : [])
    .map((house) => ({
      id: coerceString(house.id),
      label: coerceString(house.house_label, "Unnamed unit"),
    }))
    .filter((house) => house.id && house.id !== currentHouseId);

  return { options, success: true };
}

export async function moveResidentToUnitAction(
  input: MoveResidentToUnitInput,
): Promise<MoveResidentToUnitResult> {
  await requireSuperadmin();

  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const sourceHouseId = input.sourceHouseId.trim();
  const targetHouseId = input.targetHouseId.trim();
  const userId = input.userId.trim();

  if (!communityId || !userId || !targetHouseId) {
    return {
      error: "Community, resident, and target unit are required.",
      success: false,
    };
  }

  if (sourceHouseId && sourceHouseId === targetHouseId) {
    return { error: "Select a different unit.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_move_community_resident_unit", {
    p_community_id: communityId,
    p_target_house_id: targetHouseId,
    p_target_user_id: userId,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateMovePaths(communityId, sourceHouseId, targetHouseId);
  return { success: true };
}
