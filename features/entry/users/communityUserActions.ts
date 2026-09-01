"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { coerceString } from "@/lib/supabase/utils";

export type CommunityUserRole = "ADMIN" | "RESIDENT" | "GUARD";

export type CreateCommunityUserInput = {
  communityId: string;
  email: string;
  fullName: string;
  houseId: string | null;
  password: string;
  phone: string;
  role: CommunityUserRole;
};

export type CommunityUserOperationResult = {
  credentials?: {
    login: string;
    password: string;
  };
  error?: string;
  success: boolean;
};

export type SetCommunityUserPasswordInput = {
  communityId: string;
  password: string;
  userId: string;
};

function revalidateCommunityUserPaths(communityId: string, houseId?: string) {
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);
  revalidatePath(`/products/entry/communities/${communityId}/units`);
  revalidatePath("/products/entry/users");

  if (houseId) {
    revalidatePath(`/products/entry/communities/${communityId}/units/${houseId}`);
    revalidatePath(`/field/entry/communities/${communityId}`);
    revalidatePath(`/field/entry/communities/${communityId}/people`);
    revalidatePath(`/field/entry/communities/${communityId}/people/units/${houseId}`);
  }
}

function normalizeUsername(value: string) {
  const base = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 26);

  return base || "user";
}

async function getUniqueUsername(fullName: string) {
  const adminSupabase = createAdminClient();
  const base = normalizeUsername(fullName);

  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const { data, error } = await adminSupabase
      .from("profiles")
      .select("user_id")
      .ilike("username", candidate)
      .limit(1);

    if (error) throw new Error(error.message);
    if (!Array.isArray(data) || data.length === 0) return candidate;
  }

  return `${base}_${crypto.randomUUID().slice(0, 8)}`;
}

async function validateHouse(communityId: string, houseId: string) {
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("houses")
    .select("id,is_active")
    .eq("community_id", communityId)
    .eq("id", houseId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { error: "Unit not found in this community." } as const;
  if (data.is_active === false) {
    return { error: "Activate this unit before creating a resident account." } as const;
  }

  return { id: coerceString(data.id) } as const;
}

async function ensureUserInCommunity(communityId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_list_community_users", {
    p_community_id: communityId,
    p_include_inactive: true,
  });

  if (error || !Array.isArray(data)) return false;

  return data.some((item) => {
    const record = item as Record<string, unknown>;
    return (coerceString(record.user_id) || coerceString(record.id)) === userId;
  });
}

export async function createCommunityUserAction(
  input: CreateCommunityUserInput,
): Promise<CommunityUserOperationResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) return { error: previewReadOnlyError, success: false };

  const communityId = input.communityId.trim();
  const fullName = input.fullName.trim();
  const role = input.role;
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const phone = input.phone.trim();
  const houseId = input.houseId?.trim() || null;

  if (!communityId || !fullName) {
    return { error: "Community and full name are required.", success: false };
  }

  if (!["ADMIN", "RESIDENT", "GUARD"].includes(role)) {
    return { error: "Select a supported user role.", success: false };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false };
  }

  if (role === "RESIDENT" && !houseId) {
    return { error: "A unit is required for resident accounts.", success: false };
  }

  if ((role === "ADMIN" || role === "GUARD") && !email) {
    return { error: "Email is required for admin and guard accounts.", success: false };
  }

  if (role === "RESIDENT" && houseId) {
    try {
      const house = await validateHouse(communityId, houseId);
      if ("error" in house) return { error: house.error, success: false };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not validate the unit.",
        success: false,
      };
    }
  }

  const adminSupabase = createAdminClient();
  let username = "";
  let authEmail = email;
  let authType = "email";

  if (!authEmail) {
    try {
      username = await getUniqueUsername(fullName);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not generate a login username.",
        success: false,
      };
    }

    authEmail = `resident-${username}@entry.internal`;
    authType = "username";
  }

  const { data: createdUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      entry_role: role,
      entry_username: username || undefined,
      full_name: fullName,
    },
  });

  if (createError || !createdUser.user) {
    return {
      error: createError?.message ?? "Could not create the auth user.",
      success: false,
    };
  }

  const supabase = await createClient();
  const { error: setupError } = await supabase.rpc("sa_setup_user_profile", {
    p_user_id: createdUser.user.id,
    p_community_id: communityId,
    p_full_name: fullName,
    p_role: role,
    p_house_id: role === "RESIDENT" ? houseId : null,
    p_phone: phone || null,
  });

  if (setupError) {
    await adminSupabase.auth.admin.deleteUser(createdUser.user.id, true);
    return {
      error: `${setupError.message} The newly created auth user was removed.`,
      success: false,
    };
  }

  const profileUpdate: Record<string, unknown> = {
    auth_type: authType,
  };

  if (authType === "username") {
    profileUpdate.synthetic_email = authEmail;
    profileUpdate.username = username;
    profileUpdate.username_login_enabled = true;
  }

  const { error: profileUpdateError } = await adminSupabase
    .from("profiles")
    .update(profileUpdate)
    .eq("community_id", communityId)
    .eq("user_id", createdUser.user.id);

  if (profileUpdateError) {
    await Promise.allSettled([
      adminSupabase
        .from("house_residents")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", createdUser.user.id),
      adminSupabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", createdUser.user.id),
      adminSupabase
        .from("profiles")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", createdUser.user.id),
    ]);
    await adminSupabase.auth.admin.deleteUser(createdUser.user.id, true);

    return {
      error: `${profileUpdateError.message} The newly created auth user was removed.`,
      success: false,
    };
  }

  revalidateCommunityUserPaths(communityId, houseId ?? undefined);

  return {
    credentials: {
      login: username || authEmail,
      password,
    },
    success: true,
  };
}

export async function setCommunityUserPasswordAction(
  input: SetCommunityUserPasswordInput,
): Promise<CommunityUserOperationResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) return { error: previewReadOnlyError, success: false };

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  const password = input.password.trim();

  if (!communityId || !userId) {
    return { error: "Community and user are required.", success: false };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: false };
  }

  if (!(await ensureUserInCommunity(communityId, userId))) {
    return { error: "User not found in this community.", success: false };
  }

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.auth.admin.updateUserById(userId, { password });

  if (error) return { error: error.message, success: false };

  revalidateCommunityUserPaths(communityId);
  return { success: true };
}
