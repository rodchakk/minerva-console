"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH } from "@/features/entry/passwordPolicy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { coerceBoolean, coerceString } from "@/lib/supabase/utils";

export type StaffUserItem = {
  accountMode: string;
  contact: string;
  description: string;
  fullName: string;
  houseId: string;
  houseLabel: string;
  id: string;
  isActive: boolean;
  phone: string;
  role: string;
  username: string;
};

export type CommunityStaffPageData = {
  admins: StaffUserItem[];
  guards: StaffUserItem[];
  residents: StaffUserItem[];
};

export type StaffActionState = {
  message?: string;
  ok?: boolean;
};

export type StaffMutationResult = {
  error?: string;
  success: boolean;
};

export type UpdateGuardOperatorInput = {
  accountType: "individual" | "shared";
  communityId: string;
  description: string;
  fullName: string;
  phone: string;
  userId: string;
};

export type ResetGuardPasswordInput = {
  communityId: string;
  password: string;
  userId: string;
};

export type SetGuardActiveStatusInput = {
  communityId: string;
  isActive: boolean;
  userId: string;
};

export type RemoveResidentAdminAccessInput = {
  communityId: string;
  userId: string;
};

function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isSyntheticEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  return (
    !normalized ||
    normalized.endsWith("@entry.local") ||
    normalized.endsWith("@entry.internal")
  );
}

function normalizeGuardUsername(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

function buildGuardSyntheticEmail(username: string) {
  return `guard-${username}@entry.internal`;
}

function normalizeGuardAccountType(value: string) {
  return value.trim().toLowerCase() === "shared" ? "shared" : "individual";
}

function normalizeFullName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function revalidateStaffPaths(communityId: string) {
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/staff`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);
  revalidatePath("/products/entry/users");
  revalidatePath(`/field/entry/communities/${communityId}`);
  revalidatePath(`/field/entry/communities/${communityId}/people`);
  revalidatePath("/field/entry/access");
  revalidatePath("/field/entry/people");
}

function getPreferredContact(record: Record<string, unknown>) {
  const email = coerceString(record.email).trim();
  const username = coerceString(record.username).trim();

  if (email && !isSyntheticEmail(email)) {
    return email;
  }

  if (username) {
    return username;
  }

  return "No contact available";
}

async function loadCommunityStaffProfiles(communityId: string, userIds: string[]) {
  if (userIds.length === 0) {
    return [] as Array<Record<string, unknown>>;
  }

  try {
    const adminSupabase = createAdminClient();
    const { data } = await adminSupabase
      .from("profiles")
      .select("user_id,username,synthetic_email")
      .eq("community_id", communityId)
      .in("user_id", userIds);

    return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

async function loadCommunityStaffAuthMetadata(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, Record<string, unknown>>();
  }

  try {
    const adminSupabase = createAdminClient();
    const results = await Promise.allSettled(
      userIds.map(async (userId) => {
        const { data, error } = await adminSupabase.auth.admin.getUserById(userId);

        if (error || !data.user) {
          return null;
        }

        return [
          userId,
          (data.user.user_metadata ?? {}) as Record<string, unknown>,
        ] as const;
      }),
    );

    return new Map(
      results
        .map((result) => (result.status === "fulfilled" ? result.value : null))
        .filter((item): item is readonly [string, Record<string, unknown>] => item !== null),
    );
  } catch {
    return new Map<string, Record<string, unknown>>();
  }
}

function mapStaffUser(record: Record<string, unknown>): StaffUserItem {
  return {
    accountMode:
      coerceString(record.account_mode) ||
      coerceString(record.guard_account_type) ||
      coerceString(record.account_type),
    contact: getPreferredContact(record),
    description:
      coerceString(record.guard_description) ||
      coerceString(record.description),
    fullName: coerceString(record.full_name, "Unnamed user"),
    houseId: coerceString(record.house_id),
    houseLabel: coerceString(record.house_label, "No unit linked"),
    id: coerceString(record.user_id),
    isActive: coerceBoolean(record.is_active),
    phone: coerceString(record.phone),
    role: coerceString(record.role, "Unknown"),
    username: coerceString(record.username),
  };
}

async function loadCommunityUserRecord(communityId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_list_community_users", {
    p_community_id: communityId,
    p_include_inactive: true,
  });

  if (error || !Array.isArray(data)) {
    return {
      error: error?.message ?? "Could not validate the selected operator.",
      record: null,
    };
  }

  const record =
    data
      .map((item) => item as Record<string, unknown>)
      .find((item) => {
        const id = coerceString(item.user_id) || coerceString(item.id);
        return id === userId;
      }) ?? null;

  return { error: null, record };
}

export async function getCommunityStaffPageData(
  communityId: string,
): Promise<CommunityStaffPageData> {
  await requireSuperadmin();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_list_community_users", {
    p_community_id: communityId,
    p_include_inactive: true,
  });

  if (error || !Array.isArray(data)) {
    return {
      admins: [],
      guards: [],
      residents: [],
    };
  }

  const userRecords = data.map((item) => item as Record<string, unknown>);
  const userIds = Array.from(
    new Set(
      userRecords
        .map((item) => coerceString(item.user_id) || coerceString(item.id))
        .filter(Boolean),
    ),
  );
  const operatorUserIds = Array.from(
    new Set(
      userRecords
        .filter((item) => {
          const role = coerceString(item.role).toUpperCase();
          return role === "ADMIN" || role === "GUARD";
        })
        .map((item) => coerceString(item.user_id) || coerceString(item.id))
        .filter(Boolean),
    ),
  );
  const profilesData = await loadCommunityStaffProfiles(communityId, userIds);
  const metadataByUserId = await loadCommunityStaffAuthMetadata(operatorUserIds);
  const profilesByUserId = new Map(
    profilesData.map((profile) => [
      coerceString(profile.user_id),
      profile,
    ]),
  );

  const users = userRecords
    .map((item) => {
      const userId = coerceString(item.user_id) || coerceString(item.id);
      const profile = profilesByUserId.get(userId);
      const metadata = metadataByUserId.get(userId);

      return mapStaffUser({
        ...item,
        account_mode:
          coerceString(metadata?.guard_account_type) ||
          coerceString(item.account_mode),
        description:
          coerceString(metadata?.guard_description) ||
          coerceString(item.description),
        email: isSyntheticEmail(coerceString(item.email))
          ? coerceString(profile?.synthetic_email) || coerceString(item.email)
          : coerceString(item.email),
        user_id: userId,
        username: coerceString(profile?.username) || coerceString(item.username),
      });
    })
    .filter((item) => item.id);

  return {
    admins: users.filter(
      (item) => item.role.toUpperCase() === "ADMIN" && item.isActive,
    ),
    guards: users.filter((item) => item.role.toUpperCase() === "GUARD"),
    residents: users.filter(
      (item) => item.role.toUpperCase() === "RESIDENT" && item.isActive,
    ),
  };
}

export async function promoteResidentAdminAction(
  _previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { ok: false, message: previewReadOnlyError };
  }

  const communityId = getString(formData, "communityId");
  const userId = getString(formData, "userId");

  if (!communityId || !userId) {
    return {
      ok: false,
      message: "Select an active resident to promote.",
    };
  }

  const supabase = await createClient();
  const { data: users, error: usersError } = await supabase.rpc("sa_list_users", {
    p_community_id: communityId,
    p_search: null,
  });

  if (usersError || !Array.isArray(users)) {
    return {
      ok: false,
      message: usersError?.message ?? "Could not validate the selected resident.",
    };
  }

  const selectedUser = users
    .map((item) => mapStaffUser(item as Record<string, unknown>))
    .find((item) => item.id === userId);

  if (!selectedUser || !selectedUser.isActive) {
    return {
      ok: false,
      message: "The selected user is not an active resident in this community.",
    };
  }

  const normalizedRole = selectedUser.role.toUpperCase();

  if (normalizedRole === "ADMIN") {
    return {
      ok: true,
      message: "This resident already has community admin access.",
    };
  }

  if (normalizedRole !== "RESIDENT") {
    return {
      ok: false,
      message: "Only active residents can be promoted to community admin.",
    };
  }

  const { error } = await supabase.rpc("sa_change_user_role", {
    p_user_id: userId,
    p_community_id: communityId,
    p_new_role: "ADMIN",
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/staff`);

  return {
    ok: true,
    message: "Resident admin assigned successfully.",
  };
}

export async function createGuardAction(
  _previousState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { ok: false, message: previewReadOnlyError };
  }

  const communityId = getString(formData, "communityId");
  const fullName = getString(formData, "fullName");
  const username = normalizeGuardUsername(getString(formData, "username"));
  const phone = getString(formData, "phone");
  const description = getString(formData, "description");
  const password = getString(formData, "password");
  const accountType =
    getString(formData, "accountType") === "shared" ? "shared" : "individual";
  const authEmail = buildGuardSyntheticEmail(username);

  if (!communityId || !fullName || !username || !password) {
    return {
      ok: false,
      message:
        "Guard name, username, and temporary password are required.",
    };
  }

  if (username.length < 3) {
    return {
      ok: false,
      message:
        "Username must be at least 3 characters after normalization. Use letters, numbers, or underscores.",
    };
  }

  if (password.length < ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      message: `Temporary password must be at least ${ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH} characters.`,
    };
  }

  let adminSupabase: ReturnType<typeof createAdminClient>;

  try {
    adminSupabase = createAdminClient();
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Missing Supabase admin configuration.",
    };
  }

  const { data: existingUsername, error: usernameLookupError } = await adminSupabase
    .from("profiles")
    .select("user_id")
    .ilike("username", username)
    .limit(1);

  if (usernameLookupError) {
    return {
      ok: false,
      message: `Could not validate username uniqueness: ${usernameLookupError.message}`,
    };
  }

  if (Array.isArray(existingUsername) && existingUsername.length > 0) {
    return {
      ok: false,
      message: `Username "${username}" is already in use. Choose another guard username.`,
    };
  }

  const { data: createdUser, error: createError } =
    await adminSupabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        entry_role: "GUARD",
        entry_username: username,
        guard_account_type: accountType,
        guard_description: description || null,
      },
    });

  if (createError || !createdUser.user) {
    return {
      ok: false,
      message: createError?.message ?? "Could not create guard auth user.",
    };
  }

  const supabase = await createClient();
  const { error: setupError } = await supabase.rpc("sa_setup_user_profile", {
    p_user_id: createdUser.user.id,
    p_community_id: communityId,
    p_full_name: fullName,
    p_role: "GUARD",
    p_house_id: null,
    p_phone: phone || null,
  });

  if (setupError) {
    await Promise.allSettled([
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
    const { error: cleanupError } = await adminSupabase.auth.admin.deleteUser(
      createdUser.user.id,
      true,
    );

    return {
      ok: false,
      message: cleanupError
        ? `${setupError.message} Cleanup also failed for auth user ${createdUser.user.id}: ${cleanupError.message}`
        : `${setupError.message} The newly created auth user was deleted.`,
    };
  }

  const syntheticEmail = buildGuardSyntheticEmail(username);
  const { error: profileUpdateError } = await adminSupabase
    .from("profiles")
    .update({
      auth_type: "username",
      synthetic_email: syntheticEmail,
      username,
      username_login_enabled: true,
    })
    .eq("user_id", createdUser.user.id)
    .eq("community_id", communityId);

  if (profileUpdateError) {
    await Promise.allSettled([
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
    const { error: cleanupError } = await adminSupabase.auth.admin.deleteUser(
      createdUser.user.id,
      true,
    );

    return {
      ok: false,
      message: cleanupError
        ? `${profileUpdateError.message} Cleanup also failed for auth user ${createdUser.user.id}: ${cleanupError.message}`
        : `${profileUpdateError.message} The newly created auth user was deleted.`,
    };
  }

  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/staff`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);

  return {
    ok: true,
    message:
      accountType === "shared"
        ? `Shared guard account created successfully. Username credential: ${username}.`
        : `Individual guard account created successfully. Username credential: ${username}.`,
  };
}

export async function updateGuardOperatorAction(
  input: UpdateGuardOperatorInput,
): Promise<StaffMutationResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  const fullName = normalizeFullName(input.fullName);
  const phone = normalizePhone(input.phone);
  const description = input.description.trim();
  const accountType = normalizeGuardAccountType(input.accountType);

  if (!communityId || !userId) {
    return { error: "Community and guard are required.", success: false };
  }

  if (!fullName) {
    return { error: "Guard name is required.", success: false };
  }

  if (fullName.length > 120) {
    return { error: "Guard name must be 120 characters or fewer.", success: false };
  }

  if (phone.length > 40) {
    return { error: "Phone must be 40 characters or fewer.", success: false };
  }

  if (description.length > 160) {
    return { error: "Description must be 160 characters or fewer.", success: false };
  }

  const { error: lookupError, record } = await loadCommunityUserRecord(
    communityId,
    userId,
  );

  if (lookupError || !record) {
    return {
      error: lookupError ?? "Guard account was not found in this community.",
      success: false,
    };
  }

  if (coerceString(record.role).trim().toUpperCase() !== "GUARD") {
    return { error: "Only guard accounts can be edited here.", success: false };
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

  const { error: profileError } = await adminSupabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
    .eq("community_id", communityId)
    .eq("user_id", userId);

  if (profileError) {
    return { error: profileError.message, success: false };
  }

  const { data: authUser, error: authLookupError } =
    await adminSupabase.auth.admin.getUserById(userId);

  if (authLookupError || !authUser.user) {
    return {
      error: authLookupError?.message ?? "Could not load guard auth metadata.",
      success: false,
    };
  }

  const existingMetadata = (authUser.user.user_metadata ?? {}) as Record<
    string,
    unknown
  >;
  const { error: authUpdateError } =
    await adminSupabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingMetadata,
        entry_role: "GUARD",
        full_name: fullName,
        guard_account_type: accountType,
        guard_description: description || null,
      },
    });

  if (authUpdateError) {
    return { error: authUpdateError.message, success: false };
  }

  revalidateStaffPaths(communityId);

  return { success: true };
}

export async function resetGuardPasswordAction(
  input: ResetGuardPasswordInput,
): Promise<StaffMutationResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  const password = input.password.trim();

  if (!communityId || !userId) {
    return { error: "Community and guard are required.", success: false };
  }

  if (password.length < ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH) {
    return {
      error: `Password must be at least ${ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH} characters.`,
      success: false,
    };
  }

  const { error: lookupError, record } = await loadCommunityUserRecord(
    communityId,
    userId,
  );

  if (lookupError || !record) {
    return {
      error: lookupError ?? "Guard account was not found in this community.",
      success: false,
    };
  }

  if (coerceString(record.role).trim().toUpperCase() !== "GUARD") {
    return { error: "Only guard account passwords can be reset here.", success: false };
  }

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateStaffPaths(communityId);

  return { success: true };
}

export async function setGuardActiveStatusAction(
  input: SetGuardActiveStatusInput,
): Promise<StaffMutationResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();

  if (!communityId || !userId) {
    return { error: "Community and guard are required.", success: false };
  }

  const { error: lookupError, record } = await loadCommunityUserRecord(
    communityId,
    userId,
  );

  if (lookupError || !record) {
    return {
      error: lookupError ?? "Guard account was not found in this community.",
      success: false,
    };
  }

  if (coerceString(record.role).trim().toUpperCase() !== "GUARD") {
    return { error: "Only guard accounts can be deactivated here.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_set_community_user_active_status", {
    p_community_id: communityId,
    p_is_active: input.isActive,
    p_target_user_id: userId,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateStaffPaths(communityId);

  return { success: true };
}

export async function removeResidentAdminAccessAction(
  input: RemoveResidentAdminAccessInput,
): Promise<StaffMutationResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();

  if (!communityId || !userId) {
    return { error: "Community and resident admin are required.", success: false };
  }

  const { error: lookupError, record } = await loadCommunityUserRecord(
    communityId,
    userId,
  );

  if (lookupError || !record) {
    return {
      error: lookupError ?? "Resident admin was not found in this community.",
      success: false,
    };
  }

  if (coerceString(record.role).trim().toUpperCase() !== "ADMIN") {
    return {
      error: "Only resident admin access can be removed here.",
      success: false,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_change_user_role", {
    p_community_id: communityId,
    p_new_role: "RESIDENT",
    p_user_id: userId,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateStaffPaths(communityId);
  const houseId = coerceString(record.house_id) || coerceString(record.unit_id);

  if (houseId) {
    revalidatePath(`/products/entry/communities/${communityId}/units/${houseId}`);
    revalidatePath(`/field/entry/communities/${communityId}/people/units/${houseId}`);
    revalidatePath(
      `/field/entry/communities/${communityId}/people/residents/${userId}`,
    );
  }

  return { success: true };
}
