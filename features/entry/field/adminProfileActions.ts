"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { getCommunityUsersPage } from "@/features/entry/users/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type FieldAdminActionResult = {
  error?: string;
  fullName?: string;
  phone?: string;
  success: boolean;
};

function normalizeFullName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function revalidateAdminPaths(input: {
  communityId: string;
  previousUnitId?: string | null;
  unitId?: string | null;
  userId: string;
}) {
  revalidatePath("/field/entry/people");
  revalidatePath("/field/entry/access");
  revalidatePath(`/field/entry/communities/${input.communityId}`);
  revalidatePath(`/field/entry/communities/${input.communityId}/people`);
  revalidatePath(`/products/entry/communities/${input.communityId}`);
  revalidatePath(`/products/entry/communities/${input.communityId}/users`);
  revalidatePath(`/products/entry/communities/${input.communityId}/staff`);
  revalidatePath(
    `/field/entry/communities/${input.communityId}/people/residents/${input.userId}`,
  );

  for (const unitId of [input.previousUnitId, input.unitId]) {
    if (unitId) {
      revalidatePath(
        `/field/entry/communities/${input.communityId}/people/units/${unitId}`,
      );
    }
  }
}

async function loadAdmin(communityId: string, userId: string) {
  const pageData = await getCommunityUsersPage(communityId);
  const user = pageData.users.find((item) => item.userId === userId) ?? null;

  if (!user || user.role.trim().toUpperCase() !== "ADMIN") {
    return null;
  }

  return { pageData, user };
}

export async function updateFieldAdminProfile(input: {
  communityId: string;
  fullName: string;
  phone: string;
  userId: string;
}): Promise<FieldAdminActionResult> {
  const { user: actor } = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  const fullName = normalizeFullName(input.fullName);
  const phone = normalizePhone(input.phone);

  if (!communityId || !userId) {
    return { error: "Community and admin are required.", success: false };
  }

  if (!fullName) {
    return { error: "Full name is required.", success: false };
  }

  if (fullName.length > 120) {
    return { error: "Full name must be 120 characters or fewer.", success: false };
  }

  if (phone.length > 40) {
    return { error: "Phone must be 40 characters or fewer.", success: false };
  }

  const target = await loadAdmin(communityId, userId);
  if (!target) {
    return { error: "Admin was not found in this community.", success: false };
  }

  const supabase = await createClient();
  const { data: targetIsSystemOwner, error: ownerCheckError } = await supabase.rpc(
    "is_superadmin",
    { p_user_id: userId },
  );

  if (ownerCheckError) {
    return {
      error: "Could not verify protected system-owner status. No profile was changed.",
      success: false,
    };
  }

  if (targetIsSystemOwner === true && userId !== actor.id) {
    return {
      error: "Another Minerva system owner cannot be edited from Field.",
      success: false,
    };
  }

  let adminSupabase: ReturnType<typeof createAdminClient>;
  try {
    adminSupabase = createAdminClient();
  } catch {
    return { error: "Admin profile could not be updated right now.", success: false };
  }

  const { data, error } = await adminSupabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .select("user_id,full_name,phone")
    .maybeSingle();

  if (error || !data) {
    return { error: "Admin profile could not be updated.", success: false };
  }

  revalidateAdminPaths({
    communityId,
    previousUnitId: target.user.houseId,
    userId,
  });

  return {
    fullName: String(data.full_name ?? fullName),
    phone: String(data.phone ?? ""),
    success: true,
  };
}

export async function assignFieldAdminToUnit(input: {
  communityId: string;
  unitId: string;
  userId: string;
}): Promise<FieldAdminActionResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  const unitId = input.unitId.trim();

  if (!communityId || !userId || !unitId) {
    return {
      error: "Community, admin, and target unit are required.",
      success: false,
    };
  }

  const target = await loadAdmin(communityId, userId);
  if (!target) {
    return { error: "Admin was not found in this community.", success: false };
  }

  const unit = target.pageData.houses.find((house) => house.id === unitId) ?? null;
  if (!unit) {
    return { error: "Target unit was not found in this community.", success: false };
  }

  if (!unit.isActive) {
    return { error: "Select an active unit for this admin.", success: false };
  }

  if (target.user.houseId === unitId) {
    return { success: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_update_community_user", {
    p_community_id: communityId,
    p_full_name: target.user.fullName.trim(),
    p_house_id: unitId,
    p_is_active: target.user.isActive,
    p_phone: target.user.phone.trim() || null,
    p_target_user_id: userId,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateAdminPaths({
    communityId,
    previousUnitId: target.user.houseId,
    unitId,
    userId,
  });

  return { success: true };
}
