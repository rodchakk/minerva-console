"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { getCommunityUsersPage } from "@/features/entry/users/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export type FieldResidentProfileUpdateInput = {
  communityId: string;
  fullName: string;
  phone: string;
  userId: string;
};

export type FieldResidentProfileUpdateResult = {
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

function revalidateResidentProfilePaths(input: {
  communityId: string;
  unitId?: string | null;
  userId: string;
}) {
  revalidatePath(`/products/entry/communities/${input.communityId}`);
  revalidatePath(`/products/entry/communities/${input.communityId}/users`);
  revalidatePath(`/field/entry/communities/${input.communityId}`);
  revalidatePath(`/field/entry/communities/${input.communityId}/people`);
  revalidatePath("/field/entry/people");
  revalidatePath(
    `/field/entry/communities/${input.communityId}/people/residents/${input.userId}`,
  );

  if (input.unitId) {
    revalidatePath(
      `/field/entry/communities/${input.communityId}/people/units/${input.unitId}`,
    );
  }
}

export async function updateFieldResidentProfile(
  input: FieldResidentProfileUpdateInput,
): Promise<FieldResidentProfileUpdateResult> {
  await requireSuperadmin();

  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  const fullName = normalizeFullName(input.fullName);
  const phone = normalizePhone(input.phone);

  if (!communityId || !userId) {
    return { error: "Community and resident are required.", success: false };
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

  const pageData = await getCommunityUsersPage(communityId);
  const resident = pageData.users.find((user) => user.userId === userId) ?? null;

  if (!resident || resident.role.trim().toUpperCase() !== "RESIDENT") {
    return {
      error: "Resident was not found in this community.",
      success: false,
    };
  }

  let adminSupabase: ReturnType<typeof createAdminClient>;

  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    console.error("[field-resident-profile] admin client unavailable", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      error: "Resident profile could not be updated right now.",
      success: false,
    };
  }

  const { data, error } = await adminSupabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: phone || null,
    })
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .select("user_id,full_name,phone")
    .maybeSingle();

  if (error) {
    console.error("[field-resident-profile] profile update failed", {
      code: error.code,
      communityId,
      userId,
    });
    return {
      error: "Resident profile could not be updated.",
      success: false,
    };
  }

  if (!data) {
    return {
      error: "Resident profile was not found.",
      success: false,
    };
  }

  revalidateResidentProfilePaths({
    communityId,
    unitId: resident.houseId,
    userId,
  });

  return {
    fullName: String(data.full_name ?? fullName),
    phone: String(data.phone ?? ""),
    success: true,
  };
}
