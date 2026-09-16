"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { requireEntryMutationAllowed } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";

export type DeleteCommunityUnitsResult = {
  deletedCount?: number;
  message?: string;
  success: boolean;
};

export async function deleteCommunityUnitsAction(input: {
  communityId: string;
  houseIds: string[];
}): Promise<DeleteCommunityUnitsResult> {
  await requireSuperadmin();
  requireEntryMutationAllowed();

  const communityId = input.communityId?.trim();
  const houseIds = Array.from(
    new Set(
      (Array.isArray(input.houseIds) ? input.houseIds : [])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (!communityId || houseIds.length === 0) {
    return { message: "Select at least one unit to delete.", success: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_delete_empty_houses_bulk_v1", {
    p_community_id: communityId,
    p_house_ids: houseIds,
  });

  if (error) {
    const message = error.message || "The selected units could not be deleted.";
    return { message, success: false };
  }

  const record = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  const deletedCount = Number(record.deleted_count ?? 0);

  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/units`);
  revalidatePath(`/products/entry/communities/${communityId}/registration`);

  return {
    deletedCount: Number.isFinite(deletedCount) ? deletedCount : houseIds.length,
    success: true,
  };
}
