"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";

export type CommunityUnitActionResult = {
  error?: string;
  success: boolean;
};

export type UpdateCommunityUnitInput = {
  communityId: string;
  unitId: string;
  unitLabel: string;
};

export type SetCommunityUnitActiveStatusInput = {
  communityId: string;
  isActive: boolean;
  unitId: string;
};

function revalidateUnitPaths(communityId: string, unitId: string) {
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/units`);
  revalidatePath(`/products/entry/communities/${communityId}/units/${unitId}`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);
  revalidatePath("/products/entry/users");
}

export async function updateCommunityUnitAction(
  input: UpdateCommunityUnitInput,
): Promise<CommunityUnitActionResult> {
  await requireSuperadmin();

  const communityId = input.communityId.trim();
  const unitId = input.unitId.trim();
  const unitLabel = input.unitLabel.trim();

  if (!communityId || !unitId) {
    return {
      error: "Community ID and unit ID are required.",
      success: false,
    };
  }

  if (!unitLabel) {
    return {
      error: "Unit label is required.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("houses")
    .update({ house_label: unitLabel })
    .eq("community_id", communityId)
    .eq("id", unitId);

  if (error) {
    return {
      error: error.message,
      success: false,
    };
  }

  revalidateUnitPaths(communityId, unitId);

  return { success: true };
}

export async function setCommunityUnitActiveStatusAction(
  input: SetCommunityUnitActiveStatusInput,
): Promise<CommunityUnitActionResult> {
  await requireSuperadmin();

  const communityId = input.communityId.trim();
  const unitId = input.unitId.trim();

  if (!communityId || !unitId) {
    return {
      error: "Community ID and unit ID are required.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("houses")
    .update({ is_active: input.isActive })
    .eq("community_id", communityId)
    .eq("id", unitId);

  if (error) {
    return {
      error: error.message,
      success: false,
    };
  }

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("community_id", communityId)
    .eq("house_id", unitId);

  if (profilesError) {
    return {
      error: profilesError.message,
      success: false,
    };
  }

  const profileUserIds = Array.isArray(profilesData)
    ? profilesData
        .map((profile) => coerceString(profile.user_id))
        .filter(Boolean)
    : [];

  if (profileUserIds.length > 0) {
    const { data: membershipsData, error: membershipsError } = await supabase
      .from("community_members")
      .select("user_id,role")
      .eq("community_id", communityId)
      .in("user_id", profileUserIds);

    if (membershipsError) {
      return {
        error: membershipsError.message,
        success: false,
      };
    }

    const linkedResidentIds = Array.isArray(membershipsData)
      ? membershipsData
          .map((membership) => membership as Record<string, unknown>)
          .filter((record) => {
            const role = coerceString(record.role).trim().toUpperCase();
            return role === "RESIDENT" || role === "UNASSIGNED";
          })
          .map((record) => coerceString(record.user_id))
          .filter(Boolean)
      : [];

    const uniqueResidentIds = Array.from(new Set(linkedResidentIds));

    if (uniqueResidentIds.length > 0) {
      const { error: membershipUpdateError } = await supabase
        .from("community_members")
        .update({ is_active: input.isActive })
        .eq("community_id", communityId)
        .in("user_id", uniqueResidentIds);

      if (membershipUpdateError) {
        return {
          error: membershipUpdateError.message,
          success: false,
        };
      }
    }
  }

  revalidateUnitPaths(communityId, unitId);

  return { success: true };
}
