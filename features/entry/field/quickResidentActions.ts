"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { getCommunityUsersPage } from "@/features/entry/users/queries";
import { setCommunityUserActiveStatusAction } from "@/features/entry/users/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { coerceBoolean, coerceString } from "@/lib/supabase/utils";

export type FieldResidentStatusResult = {
  error?: string;
  success: boolean;
};

export type FieldQuickResidentCreateInput = {
  communityId: string;
  email: string;
  fullName: string;
  password: string;
  phone: string;
  unitId: string;
  username: string;
};

export type FieldQuickResidentCreateResult = {
  error?: string;
  loginIdentity?: string;
  residentName?: string;
  success: boolean;
  unitLabel?: string;
  userId?: string;
};

type AdminClient = ReturnType<typeof createAdminClient>;

function normalizeResidentUsername(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 32);
}

function isValidEmail(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function buildResidentSyntheticEmail(username: string) {
  return `resident-${username}@entry.internal`;
}

function revalidateResidentPaths(input: {
  communityId: string;
  unitId?: string | null;
  userId?: string | null;
}) {
  revalidatePath("/products/entry/communities");
  revalidatePath(`/products/entry/communities/${input.communityId}`);
  revalidatePath(`/products/entry/communities/${input.communityId}/users`);
  revalidatePath(`/field/entry/communities/${input.communityId}`);
  revalidatePath(`/field/entry/communities/${input.communityId}/people`);
  revalidatePath("/field/entry/people");

  if (input.unitId) {
    revalidatePath(
      `/field/entry/communities/${input.communityId}/people/units/${input.unitId}`,
    );
  }

  if (input.userId) {
    revalidatePath(
      `/field/entry/communities/${input.communityId}/people/residents/${input.userId}`,
    );
  }
}

async function cleanupCreatedResident(input: {
  adminSupabase: AdminClient;
  communityId: string;
  userId: string;
}) {
  const { adminSupabase, communityId, userId } = input;

  await Promise.allSettled([
    adminSupabase
      .from("house_residents")
      .delete()
      .eq("community_id", communityId)
      .eq("user_id", userId),
    adminSupabase
      .from("community_members")
      .delete()
      .eq("community_id", communityId)
      .eq("user_id", userId),
    adminSupabase
      .from("profiles")
      .delete()
      .eq("user_id", userId),
  ]);

  return adminSupabase.auth.admin.deleteUser(userId, true);
}

export async function setFieldResidentActiveStatus(input: {
  communityId: string;
  isActive: boolean;
  userId: string;
}): Promise<FieldResidentStatusResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();

  if (!communityId || !userId) {
    return {
      error: "Community and resident are required.",
      success: false,
    };
  }

  const pageData = await getCommunityUsersPage(communityId);
  const resident = pageData.users.find((user) => user.userId === userId) ?? null;

  if (!resident || resident.role.trim().toUpperCase() !== "RESIDENT") {
    return {
      error: "Resident was not found in this community.",
      success: false,
    };
  }

  if (resident.isActive === input.isActive) {
    return { success: true };
  }

  const result = await setCommunityUserActiveStatusAction({
    communityId,
    isActive: input.isActive,
    userId,
  });

  if (!result.success) {
    return result;
  }

  revalidateResidentPaths({
    communityId,
    unitId: resident.houseId,
    userId,
  });

  return { success: true };
}

export async function createFieldQuickResident(
  input: FieldQuickResidentCreateInput,
): Promise<FieldQuickResidentCreateResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const unitId = input.unitId.trim();
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const email = input.email.trim().toLowerCase();
  const username = normalizeResidentUsername(input.username);
  const password = input.password;

  if (!communityId || !unitId || !fullName || !password) {
    return {
      error: "Name, unit, and password are required.",
      success: false,
    };
  }

  if (!email && !username) {
    return {
      error: "Enter either a username or an email for resident sign-in.",
      success: false,
    };
  }

  if (email && !isValidEmail(email)) {
    return {
      error: "Enter a valid resident email address.",
      success: false,
    };
  }

  if (username && username.length < 3) {
    return {
      error: "Username must contain at least 3 letters or numbers.",
      success: false,
    };
  }

  if (password.length < 8) {
    return {
      error: "Password must be at least 8 characters.",
      success: false,
    };
  }

  const supabase = await createClient();
  const { data: unitData, error: unitError } = await supabase
    .from("houses")
    .select("id,house_label,is_active")
    .eq("community_id", communityId)
    .eq("id", unitId)
    .maybeSingle();

  if (unitError || !unitData) {
    return {
      error: "Selected unit was not found in this community.",
      success: false,
    };
  }

  if (!coerceBoolean(unitData.is_active)) {
    return {
      error: "Residents cannot be created in an inactive unit from Field.",
      success: false,
    };
  }

  let adminSupabase: AdminClient;

  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Supabase admin configuration is unavailable.",
      success: false,
    };
  }

  if (username) {
    const { data: usernameMatches, error: usernameError } = await adminSupabase
      .from("profiles")
      .select("user_id")
      .ilike("username", username)
      .limit(1);

    if (usernameError) {
      return {
        error: `Could not validate username: ${usernameError.message}`,
        success: false,
      };
    }

    if (Array.isArray(usernameMatches) && usernameMatches.length > 0) {
      return {
        error: `Username "${username}" is already in use.`,
        success: false,
      };
    }
  }

  const authType = email ? "email" : "username";
  const syntheticEmail = authType === "username"
    ? buildResidentSyntheticEmail(username)
    : null;
  const authEmail = email || syntheticEmail;

  if (!authEmail) {
    return {
      error: "Could not prepare a valid resident login identity.",
      success: false,
    };
  }

  const { data: createdUser, error: createError } =
    await adminSupabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        entry_role: "RESIDENT",
        entry_username: username || null,
        full_name: fullName,
      },
    });

  if (createError || !createdUser.user) {
    const message = createError?.message || "Could not create resident account.";
    const normalized = message.toLowerCase();

    return {
      error:
        normalized.includes("already") || normalized.includes("registered")
          ? "That email or resident identity is already registered. Find the existing person instead of creating a duplicate."
          : message,
      success: false,
    };
  }

  const userId = createdUser.user.id;
  const { error: setupError } = await supabase.rpc("sa_setup_user_profile", {
    p_community_id: communityId,
    p_full_name: fullName,
    p_house_id: unitId,
    p_phone: phone || null,
    p_role: "RESIDENT",
    p_user_id: userId,
  });

  if (setupError) {
    const { error: cleanupError } = await cleanupCreatedResident({
      adminSupabase,
      communityId,
      userId,
    });

    return {
      error: cleanupError
        ? `${setupError.message} Cleanup also failed for Auth user ${userId}: ${cleanupError.message}`
        : `${setupError.message} The partially-created resident account was removed.`,
      success: false,
    };
  }

  const { error: profileIdentityError } = await adminSupabase
    .from("profiles")
    .update({
      auth_type: authType,
      synthetic_email: syntheticEmail,
      username: username || null,
      username_login_enabled: authType === "username",
    })
    .eq("community_id", communityId)
    .eq("user_id", userId);

  if (profileIdentityError) {
    const { error: cleanupError } = await cleanupCreatedResident({
      adminSupabase,
      communityId,
      userId,
    });

    return {
      error: cleanupError
        ? `${profileIdentityError.message} Cleanup also failed for Auth user ${userId}: ${cleanupError.message}`
        : `${profileIdentityError.message} The partially-created resident account was removed.`,
      success: false,
    };
  }

  revalidateResidentPaths({ communityId, unitId, userId });

  return {
    loginIdentity: authType === "email" ? email : username,
    residentName: fullName,
    success: true,
    unitLabel: coerceString(unitData.house_label, "Selected unit"),
    userId,
  };
}
