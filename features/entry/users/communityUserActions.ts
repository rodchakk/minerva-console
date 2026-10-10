"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH } from "@/features/entry/passwordPolicy";
import { getPasswordResetRedirectTo } from "@/features/entry/passwordResetRedirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { coerceString, getSupabaseEnv } from "@/lib/supabase/utils";

export type CommunityUserRole = "ADMIN" | "RESIDENT" | "GUARD";

export type CreateCommunityUserInput = {
  communityId: string;
  email: string;
  fullName: string;
  houseId: string | null;
  password: string;
  phone: string;
  role: CommunityUserRole;
  username?: string | null;
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

export type SetCommunityUserRoleInput = {
  communityId: string;
  role: "ADMIN" | "RESIDENT";
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

function normalizeGuardUsername(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 32);
}

function buildGuardSyntheticEmail(username: string) {
  return `guard-${username}@entry.internal`;
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

async function ensureUsernameAvailable(username: string) {
  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("profiles")
    .select("user_id")
    .ilike("username", username)
    .limit(1);

  if (error) throw new Error(error.message);

  return !Array.isArray(data) || data.length === 0;
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
    return { error: "Activate this unit before creating the account." } as const;
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
  const requestedUsername = normalizeGuardUsername(input.username ?? "");

  if (!communityId || !fullName) {
    return { error: "Community and full name are required.", success: false };
  }

  if (!["ADMIN", "RESIDENT", "GUARD"].includes(role)) {
    return { error: "Select a supported user role.", success: false };
  }

  if (password.length < ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH) {
    return {
      error: `Password must be at least ${ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH} characters.`,
      success: false,
    };
  }

  if ((role === "RESIDENT" || role === "ADMIN") && !houseId) {
    return { error: "A unit is required for resident and admin accounts.", success: false };
  }

  if (role === "GUARD" && !requestedUsername) {
    return { error: "Username is required for guard accounts.", success: false };
  }

  if (role === "GUARD" && requestedUsername.length < 3) {
    return {
      error:
        "Username must be at least 3 characters after normalization. Use letters, numbers, dots, or underscores.",
      success: false,
    };
  }

  if ((role === "RESIDENT" || role === "ADMIN") && houseId) {
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

  if (role === "GUARD") {
    username = requestedUsername;

    try {
      const usernameAvailable = await ensureUsernameAvailable(username);

      if (!usernameAvailable) {
        return {
          error: `Username "${username}" is already in use. Choose another guard username.`,
          success: false,
        };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not validate username uniqueness.",
        success: false,
      };
    }

    authEmail = buildGuardSyntheticEmail(username);
    authType = "username";
  } else if (!authEmail) {
    try {
      username = await getUniqueUsername(fullName);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Could not generate a login username.",
        success: false,
      };
    }

    authEmail = `${role.toLowerCase()}-${username}@entry.internal`;
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
    p_house_id: role === "GUARD" ? null : houseId,
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

export async function setCommunityUserRoleAction(
  input: SetCommunityUserRoleInput,
): Promise<CommunityUserOperationResult> {
  const actor = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) return { error: previewReadOnlyError, success: false };

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  const role = input.role;

  if (!communityId || !userId) {
    return { error: "Community and user are required.", success: false };
  }

  if (role !== "ADMIN" && role !== "RESIDENT") {
    return {
      error: "Role changes are limited to Resident and Admin accounts.",
      success: false,
    };
  }

  const adminSupabase = createAdminClient();

  const [
    { data: membership, error: membershipError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    adminSupabase
      .from("community_members")
      .select("role,is_active")
      .eq("community_id", communityId)
      .eq("user_id", userId)
      .maybeSingle(),
    adminSupabase
      .from("profiles")
      .select("house_id,role")
      .eq("community_id", communityId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (membershipError) {
    return { error: membershipError.message, success: false };
  }

  if (profileError) {
    return { error: profileError.message, success: false };
  }

  if (!membership) {
    return { error: "User not found in this community.", success: false };
  }

  const currentRole = coerceString(membership.role).trim().toUpperCase();

  if (currentRole !== "ADMIN" && currentRole !== "RESIDENT") {
    return {
      error:
        "Only Resident and Admin accounts can be switched here. Guard accounts keep their dedicated access model.",
      success: false,
    };
  }

  if (!profile?.house_id) {
    return {
      error: "Assign this account to a unit before changing it between Resident and Admin.",
      success: false,
    };
  }

  if (currentRole === role) {
    return { success: true };
  }

  const { error: updateError } = await adminSupabase
    .from("community_members")
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("community_id", communityId)
    .eq("user_id", userId);

  if (updateError) {
    return { error: updateError.message, success: false };
  }

  const details = {
    from_role: currentRole,
    to_role: role,
    target_user_id: userId,
  };

  await Promise.allSettled([
    adminSupabase.from("system_event_log").insert({
      actor_id: actor.user.id,
      community_id: communityId,
      details,
      entity_id: userId,
      entity_type: "user",
      event_type: "COMMUNITY_USER_ROLE_CHANGED",
      message: "Community user role changed by superadmin",
      module: "superadmin",
      severity: "INFO",
      source: "minerva_console",
      user_id: userId,
    }),
    adminSupabase.from("superadmin_audit_log").insert({
      action: "community_user.role_change",
      actor_user_id: actor.user.id,
      metadata: details,
      target_id: userId,
      target_type: "user",
    }),
  ]);

  revalidateCommunityUserPaths(communityId, coerceString(profile.house_id) || undefined);
  return { success: true };
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

  if (password.length < ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH) {
    return {
      error: `Password must be at least ${ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH} characters.`,
      success: false,
    };
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


/**
 * Request the existing ENTRY self-service password recovery email without
 * changing the user's password or creating any temporary credentials.
 */
export async function sendCommunityUserPasswordResetEmailAction(input: {
  communityId: string;
  userId: string;
}): Promise<CommunityUserOperationResult> {
  const actor = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) return { error: previewReadOnlyError, success: false };

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  if (!communityId || !userId) {
    return { error: "Community and user are required.", success: false };
  }

  // Validate the target against this specific community before using Admin Auth.
  // Do not accept an email from the browser: it may be stale or tampered with.
  if (!(await ensureUserInCommunity(communityId, userId))) {
    return { error: "User not found in this community.", success: false };
  }

  const adminSupabase = createAdminClient();
  const { data, error: lookupError } = await adminSupabase.auth.admin.getUserById(userId);
  if (lookupError || !data.user || data.user.id !== userId) {
    return { error: "Unable to verify this ENTRY account.", success: false };
  }

  const email = data.user.email?.trim().toLowerCase() ?? "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.endsWith("@entry.local") ||
    email.endsWith("@entry.internal")
  ) {
    return {
      error: "This account has no real email. Use the manual password reset instead.",
      success: false,
    };
  }

  try {
    const redirectTo = await getPasswordResetRedirectTo();
    const { url, anonKey } = getSupabaseEnv();
    const recoveryClient = createSupabaseClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        flowType: "implicit",
        persistSession: false,
      },
    });
    const { error } = await recoveryClient.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      return { error: error.message, success: false };
    }

    // Best-effort trace for support, deliberately excluding reset links/tokens.
    await adminSupabase.from("superadmin_audit_log").insert({
      action: "community_user.password_reset_email",
      actor_user_id: actor.user.id,
      metadata: { community_id: communityId },
      target_id: userId,
      target_type: "user",
    });

    return { success: true };
  } catch {
    return {
      error: "Could not send the recovery email. Try again later.",
      success: false,
    };
  }
}
