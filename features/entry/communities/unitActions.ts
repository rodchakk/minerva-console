"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { coerceBoolean, coerceString } from "@/lib/supabase/utils";

export type CommunityUnitActionResult = {
  error?: string;
  success: boolean;
};

export type CreateResidentResult = CommunityUnitActionResult & {
  credentials?: {
    login: string;
    password: string;
    residentName: string;
    unitLabel: string;
  };
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

export type CreateQuickResidentInput = {
  communityId: string;
  fullName: string;
  password: string;
  unitId: string;
};

export type SetResidentPasswordInput = {
  communityId: string;
  password: string;
  userId: string;
};

function revalidateUnitPaths(communityId: string, unitId: string) {
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/units`);
  revalidatePath(`/products/entry/communities/${communityId}/units/${unitId}`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);
  revalidatePath("/products/entry/users");
  revalidatePath(`/field/entry/communities/${communityId}`);
  revalidatePath(`/field/entry/communities/${communityId}/people`);
  revalidatePath(`/field/entry/communities/${communityId}/people/units/${unitId}`);
}

function normalizeResidentUsername(value: string) {
  const base = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 26);

  return base || "resident";
}

function buildResidentSyntheticEmail(username: string) {
  return `resident-${username}@entry.internal`;
}

async function getUniqueResidentUsername(
  adminSupabase: ReturnType<typeof createAdminClient>,
  fullName: string,
) {
  const base = normalizeResidentUsername(fullName);

  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const { data, error } = await adminSupabase
      .from("profiles")
      .select("user_id")
      .ilike("username", candidate)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return candidate;
    }
  }

  return `${base}_${crypto.randomUUID().slice(0, 8)}`;
}

async function loadUnitInCommunity(input: {
  communityId: string;
  unitId: string;
}) {
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("houses")
    .select("id,house_label,is_active")
    .eq("community_id", input.communityId)
    .eq("id", input.unitId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data
    ? {
        id: coerceString(data.id),
        isActive: data.is_active === undefined ? true : coerceBoolean(data.is_active),
        label: coerceString(data.house_label, "Unnamed unit"),
      }
    : null;
}

async function ensureResidentInCommunity(input: {
  communityId: string;
  userId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_list_community_users", {
    p_community_id: input.communityId,
    p_include_inactive: true,
  });

  if (error || !Array.isArray(data)) {
    return null;
  }

  return (
    data
      .map((item) => item as Record<string, unknown>)
      .find((record) => {
        const userId = coerceString(record.user_id) || coerceString(record.id);
        return userId === input.userId;
      }) ?? null
  );
}

export async function updateCommunityUnitAction(
  input: UpdateCommunityUnitInput,
): Promise<CommunityUnitActionResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

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
  const { data, error } = await supabase
    .from("houses")
    .update({ house_label: unitLabel })
    .eq("community_id", communityId)
    .eq("id", unitId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      error: error.message,
      success: false,
    };
  }

  if (!data) {
    return {
      error: "Unit not found in this community.",
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
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

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

export async function createQuickResidentAction(
  input: CreateQuickResidentInput,
): Promise<CreateResidentResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const fullName = input.fullName.trim();
  const password = input.password.trim();
  const unitId = input.unitId.trim();

  if (!communityId || !unitId) {
    return { error: "A unit is required before creating a resident.", success: false };
  }

  if (!fullName) {
    return { error: "Resident name is required.", success: false };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false };
  }

  let adminSupabase: ReturnType<typeof createAdminClient>;

  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Missing Supabase admin configuration.",
      success: false,
    };
  }

  let unit: Awaited<ReturnType<typeof loadUnitInCommunity>>;

  try {
    unit = await loadUnitInCommunity({ communityId, unitId });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not validate the unit.",
      success: false,
    };
  }

  if (!unit) {
    return { error: "Unit not found in this community.", success: false };
  }

  if (!unit.isActive) {
    return {
      error: "Activate this unit before creating a resident account.",
      success: false,
    };
  }

  let username: string;

  try {
    username = await getUniqueResidentUsername(adminSupabase, fullName);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? `Could not validate username uniqueness: ${error.message}`
          : "Could not validate username uniqueness.",
      success: false,
    };
  }

  const authEmail = buildResidentSyntheticEmail(username);
  const { data: createdUser, error: createError } =
    await adminSupabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        entry_role: "RESIDENT",
        entry_username: username,
        full_name: fullName,
      },
    });

  if (createError || !createdUser.user) {
    return {
      error: createError?.message ?? "Could not create resident auth user.",
      success: false,
    };
  }

  const supabase = await createClient();
  const { error: setupError } = await supabase.rpc("sa_setup_user_profile", {
    p_user_id: createdUser.user.id,
    p_community_id: communityId,
    p_full_name: fullName,
    p_role: "RESIDENT",
    p_house_id: unit.id,
    p_phone: null,
  });

  if (setupError) {
    await adminSupabase.auth.admin.deleteUser(createdUser.user.id, true);
    return {
      error: `${setupError.message} The newly created auth user was deleted.`,
      success: false,
    };
  }

  const { error: profileUpdateError } = await adminSupabase
    .from("profiles")
    .update({
      auth_type: "username",
      synthetic_email: authEmail,
      username,
      username_login_enabled: true,
    })
    .eq("user_id", createdUser.user.id)
    .eq("community_id", communityId);

  if (profileUpdateError) {
    await Promise.allSettled([
      adminSupabase
        .from("house_residents")
        .delete()
        .eq("user_id", createdUser.user.id)
        .eq("community_id", communityId),
      adminSupabase
        .from("community_members")
        .delete()
        .eq("user_id", createdUser.user.id)
        .eq("community_id", communityId),
      adminSupabase
        .from("profiles")
        .delete()
        .eq("user_id", createdUser.user.id)
        .eq("community_id", communityId),
    ]);
    await adminSupabase.auth.admin.deleteUser(createdUser.user.id, true);

    return {
      error: `${profileUpdateError.message} The newly created auth user was deleted.`,
      success: false,
    };
  }

  revalidateUnitPaths(communityId, unit.id);

  return {
    credentials: {
      login: username,
      password,
      residentName: fullName,
      unitLabel: unit.label,
    },
    success: true,
  };
}

export async function setResidentPasswordAction(
  input: SetResidentPasswordInput,
): Promise<CommunityUnitActionResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  const password = input.password.trim();

  if (!communityId || !userId) {
    return { error: "Community and resident are required.", success: false };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false };
  }

  const resident = await ensureResidentInCommunity({ communityId, userId });

  if (!resident) {
    return { error: "Resident was not found in this community.", success: false };
  }

  const role = coerceString(resident.role).trim().toUpperCase();

  if (role !== "RESIDENT" && role !== "UNASSIGNED" && role !== "ADMIN") {
    return { error: "This account cannot be reset from the unit profile.", success: false };
  }

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  const houseId = coerceString(resident.house_id) || coerceString(resident.unit_id);
  revalidateUnitPaths(communityId, houseId);

  return { success: true };
}
