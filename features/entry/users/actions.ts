"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  getEntryPreviewReadOnlyError,
} from "@/features/entry/deploymentBoundary";
import { getPasswordResetRedirectTo } from "@/features/entry/passwordResetRedirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceString,
  getSupabaseEnv,
} from "@/lib/supabase/utils";

export type UserSearchItem = {
  communityCity: string;
  communityId: string;
  communityName: string;
  createdAt: string;
  email: string;
  fullName: string;
  houseId: string;
  houseLabel: string;
  id: string;
  isActive: boolean;
  isPrimary: boolean;
  lastSignIn: string;
  phone: string;
  role: string;
  username: string;
};

export type GlobalUserHouseOption = {
  id: string;
  isActive: boolean;
  label: string;
};

export type GlobalUserManagementContext = {
  error?: string;
  houses: GlobalUserHouseOption[];
  success: boolean;
};

export type SetCommunityUserUnitInput = {
  communityId: string;
  houseId: string;
  userId: string;
};

export type SetCommunityUserUnitResult = {
  error?: string;
  houseLabel?: string;
  isPrimary?: boolean;
  success: boolean;
};

export type UpdateGlobalUserIdentityInput = {
  communityId: string;
  fullName: string;
  phone: string;
  userId: string;
};

export type UserSearchState = {
  message?: string;
  query?: string;
  results?: UserSearchItem[];
};

export type PasswordResetActionState = {
  code?: string;
  error?: string;
  expiresAt?: string | null;
  fullName?: string;
  houseLabel?: string;
  success?: boolean;
};

export type UpdateCommunityUserInput = {
  communityId: string;
  fullName: string;
  houseId: string | null;
  isActive: boolean;
  phone: string;
  userId: string;
};

export type SetCommunityUserActiveStatusInput = {
  communityId: string;
  isActive: boolean;
  userId: string;
};

export type CommunityUserActionResult = {
  error?: string;
  success: boolean;
};

function isSyntheticEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  return (
    !normalized ||
    normalized.endsWith("@entry.local") ||
    normalized.endsWith("@entry.internal")
  );
}

function normalizeFunctionMessage(value: unknown) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object") {
    const candidate =
      (value as Record<string, unknown>).error ??
      (value as Record<string, unknown>).message ??
      (value as Record<string, unknown>).details ??
      (value as Record<string, unknown>).msg ??
      (value as Record<string, unknown>).reason ??
      ((value as Record<string, unknown>).data as Record<string, unknown> | undefined)?.error ??
      ((value as Record<string, unknown>).data as Record<string, unknown> | undefined)?.message ??
      "";

    return typeof candidate === "string" ? candidate.trim() : "";
  }

  return "";
}

async function readFunctionResponseBody(response?: Response | null) {
  if (!response) return null;

  try {
    const text = await response.clone().text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

function extractRecoveryCode(data: unknown) {
  const record = (data as Record<string, unknown> | null) ?? {};
  const nestedData = (record.data as Record<string, unknown> | undefined) ?? {};
  const candidates = [
    record.recovery_code,
    record.temporary_code,
    record.code,
    record.activation_code,
    record.recoveryCode,
    record.temp_code,
    nestedData.recovery_code,
    nestedData.temporary_code,
    nestedData.code,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function extractExpiration(data: unknown) {
  const record = (data as Record<string, unknown> | null) ?? {};
  const nestedData = (record.data as Record<string, unknown> | undefined) ?? {};
  const candidates = [
    record.expires_at,
    record.expiresAt,
    record.expiration,
    nestedData.expires_at,
    nestedData.expiresAt,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function revalidateCommunityUserPaths(communityId: string, houseId?: string) {
  revalidatePath("/products/entry/communities");
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

export async function searchUsersAction(
  _previousState: UserSearchState,
  formData: FormData,
): Promise<UserSearchState> {
  await requireSuperadmin();

  const query = String(formData.get("query") ?? "").trim();

  if (!query) {
    return {
      message: "Enter a name, email, username, phone, unit, or community to search users.",
      query,
      results: [],
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_list_users", {
    p_community_id: null,
    p_search: query,
  });

  if (error) {
    return {
      message: error.message,
      query,
      results: [],
    };
  }

  const baseResults = Array.isArray(data)
    ? data.map((item) => {
        const record = item as Record<string, unknown>;

        return {
          communityId: coerceString(record.community_id),
          communityName: coerceString(record.community_name),
          createdAt: coerceString(record.created_at),
          email: coerceString(record.email, "No email"),
          fullName: coerceString(record.full_name, "Unnamed user"),
          houseId: coerceString(record.house_id),
          houseLabel: coerceString(record.house_label),
          id:
            coerceString(record.user_id) ||
            coerceString(record.id) ||
            crypto.randomUUID(),
          isActive: coerceBoolean(record.is_active),
          isPrimary: false,
          lastSignIn: coerceString(record.last_sign_in),
          phone: coerceString(record.phone),
          role: coerceString(record.role, "Unknown"),
        };
      })
    : [];

  const communityIds = Array.from(
    new Set(baseResults.map((item) => item.communityId).filter(Boolean)),
  );
  const userIds = Array.from(new Set(baseResults.map((item) => item.id).filter(Boolean)));

  const adminSupabase = createAdminClient();
  const [
    { data: communitiesData },
    { data: profilesData },
    { data: primaryAssignmentsData },
  ] = await Promise.all([
    communityIds.length > 0
      ? supabase
          .from("communities")
          .select("id,city")
          .in("id", communityIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    userIds.length > 0
      ? supabase
          .from("profiles")
          .select("user_id,community_id,username")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    userIds.length > 0
      ? adminSupabase
          .from("house_residents")
          .select("community_id,house_id,user_id,is_primary")
          .in("user_id", userIds)
          .eq("is_active", true)
          .eq("is_primary", true)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const communitiesById = new Map(
    (Array.isArray(communitiesData) ? communitiesData : []).map((community) => [
      coerceString(community.id),
      {
        city: coerceString(community.city),
      },
    ]),
  );
  const profileUsernameByMembershipKey = new Map(
    (Array.isArray(profilesData) ? profilesData : []).map((profile) => [
      `${coerceString(profile.user_id)}::${coerceString(profile.community_id)}`,
      coerceString(profile.username),
    ]),
  );

  const primaryAssignmentKeys = new Set(
    (Array.isArray(primaryAssignmentsData) ? primaryAssignmentsData : [])
      .map((assignment) => {
        const userId = coerceString(assignment.user_id);
        const communityId = coerceString(assignment.community_id);
        const houseId = coerceString(assignment.house_id);
        return userId && communityId && houseId
          ? `${userId}::${communityId}::${houseId}`
          : "";
      })
      .filter(Boolean),
  );

  const results = Array.isArray(data)
    ? baseResults.map((item) => {
        const community = communitiesById.get(item.communityId);
        const username =
          profileUsernameByMembershipKey.get(`${item.id}::${item.communityId}`) ?? "";

        return {
          ...item,
          communityCity: community?.city ?? "",
          communityName: item.communityName || "Unknown community",
          houseLabel: item.houseLabel || "",
          isPrimary:
            Boolean(item.houseId) &&
            primaryAssignmentKeys.has(
              `${item.id}::${item.communityId}::${item.houseId}`,
            ),
          username,
        };
      })
    : [];

  return {
    query,
    results,
  };
}

export async function updateGlobalUserIdentityAction(
  input: UpdateGlobalUserIdentityInput,
): Promise<CommunityUserActionResult> {
  const actor = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();

  if (!communityId || !userId || !fullName) {
    return {
      error: "Community, user, and full name are required.",
      success: false,
    };
  }

  const adminSupabase = createAdminClient();
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("user_id,house_id")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message, success: false };
  }

  if (!profile) {
    return { error: "User not found in this community.", success: false };
  }

  const { error: updateError } = await adminSupabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: phone || null,
    })
    .eq("community_id", communityId)
    .eq("user_id", userId);

  if (updateError) {
    return { error: updateError.message, success: false };
  }

  const details = {
    full_name: fullName,
    phone: phone || null,
    target_user_id: userId,
  };

  await Promise.allSettled([
    adminSupabase.from("system_event_log").insert({
      actor_id: actor.user.id,
      community_id: communityId,
      details,
      entity_id: userId,
      entity_type: "user",
      event_type: "COMMUNITY_USER_IDENTITY_UPDATED",
      message: "Community user identity updated by superadmin",
      module: "superadmin",
      severity: "INFO",
      source: "minerva_console",
      user_id: userId,
    }),
    adminSupabase.from("superadmin_audit_log").insert({
      action: "community_user.identity_update",
      actor_user_id: actor.user.id,
      metadata: details,
      target_id: userId,
      target_type: "user",
    }),
  ]);

  revalidateCommunityUserPaths(
    communityId,
    coerceString(profile.house_id) || undefined,
  );
  return { success: true };
}

export async function getGlobalUserManagementContextAction(
  communityId: string,
  userId: string,
): Promise<GlobalUserManagementContext> {
  await requireSuperadmin();

  if (!communityId.trim() || !userId.trim()) {
    return {
      error: "Community and user are required.",
      houses: [],
      success: false,
    };
  }

  const adminSupabase = createAdminClient();
  const [{ data: membership }, { data: houses, error: housesError }] =
    await Promise.all([
      adminSupabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .maybeSingle(),
      adminSupabase
        .from("houses")
        .select("id,house_label,is_active")
        .eq("community_id", communityId)
        .order("house_label", { ascending: true }),
    ]);

  if (!membership) {
    return {
      error: "User not found in this community.",
      houses: [],
      success: false,
    };
  }

  if (housesError) {
    return {
      error: housesError.message,
      houses: [],
      success: false,
    };
  }

  return {
    houses: (Array.isArray(houses) ? houses : []).map((house) => ({
      id: coerceString(house.id),
      isActive:
        house.is_active === undefined ? true : coerceBoolean(house.is_active),
      label: coerceString(house.house_label, "Unnamed unit"),
    })),
    success: true,
  };
}

export async function setCommunityUserUnitAction(
  input: SetCommunityUserUnitInput,
): Promise<SetCommunityUserUnitResult> {
  const actor = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();
  const houseId = input.houseId.trim();

  if (!communityId || !userId || !houseId) {
    return {
      error: "Community, user, and unit are required.",
      success: false,
    };
  }

  const adminSupabase = createAdminClient();
  const [
    { data: profile, error: profileError },
    { data: targetHouse, error: houseError },
    { data: activeAssignments, error: assignmentError },
  ] = await Promise.all([
    adminSupabase
      .from("profiles")
      .select("house_id,role")
      .eq("community_id", communityId)
      .eq("user_id", userId)
      .maybeSingle(),
    adminSupabase
      .from("houses")
      .select("id,house_label,is_active")
      .eq("community_id", communityId)
      .eq("id", houseId)
      .maybeSingle(),
    adminSupabase
      .from("house_residents")
      .select("id,house_id,is_primary,is_primary_contact,is_active")
      .eq("community_id", communityId)
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  if (profileError) return { error: profileError.message, success: false };
  if (houseError) return { error: houseError.message, success: false };
  if (assignmentError) return { error: assignmentError.message, success: false };
  if (!profile) return { error: "User not found in this community.", success: false };
  if (!targetHouse) return { error: "Unit not found in this community.", success: false };
  if (targetHouse.is_active === false) {
    return { error: "Activate this unit before assigning a user to it.", success: false };
  }

  const normalizedRole = coerceString(profile.role).trim().toUpperCase();
  if (normalizedRole === "GUARD") {
    return {
      error: "Guard accounts are not assigned to residential units.",
      success: false,
    };
  }

  if (coerceString(profile.house_id) === houseId) {
    const currentAssignment = (Array.isArray(activeAssignments) ? activeAssignments : []).find(
      (assignment) => coerceString(assignment.house_id) === houseId,
    );
    return {
      houseLabel: coerceString(targetHouse.house_label, "Unnamed unit"),
      isPrimary: currentAssignment ? coerceBoolean(currentAssignment.is_primary) : false,
      success: true,
    };
  }

  const previousWasPrimary = (Array.isArray(activeAssignments) ? activeAssignments : []).some(
    (assignment) => coerceBoolean(assignment.is_primary),
  );

  const { data: targetPrimary } = await adminSupabase
    .from("house_residents")
    .select("id")
    .eq("community_id", communityId)
    .eq("house_id", houseId)
    .eq("is_active", true)
    .eq("is_primary", true)
    .neq("user_id", userId)
    .limit(1)
    .maybeSingle();

  const shouldRemainPrimary = previousWasPrimary && !targetPrimary;

  const { error: profileUpdateError } = await adminSupabase
    .from("profiles")
    .update({ house_id: houseId })
    .eq("community_id", communityId)
    .eq("user_id", userId);

  if (profileUpdateError) {
    return { error: profileUpdateError.message, success: false };
  }

  const { error: deactivateError } = await adminSupabase
    .from("house_residents")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .neq("house_id", houseId)
    .eq("is_active", true);

  if (deactivateError) {
    return { error: deactivateError.message, success: false };
  }

  const { data: existingTarget } = await adminSupabase
    .from("house_residents")
    .select("id")
    .eq("community_id", communityId)
    .eq("house_id", houseId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const assignmentPayload = {
    is_active: true,
    is_primary: shouldRemainPrimary,
    is_primary_contact: shouldRemainPrimary,
    updated_at: new Date().toISOString(),
  };

  const assignmentResult = existingTarget
    ? await adminSupabase
        .from("house_residents")
        .update(assignmentPayload)
        .eq("id", existingTarget.id)
    : await adminSupabase.from("house_residents").insert({
        community_id: communityId,
        house_id: houseId,
        user_id: userId,
        ...assignmentPayload,
      });

  if (assignmentResult.error) {
    return { error: assignmentResult.error.message, success: false };
  }

  const details = {
    from_house_id: coerceString(profile.house_id) || null,
    is_primary: shouldRemainPrimary,
    target_user_id: userId,
    to_house_id: houseId,
  };

  await Promise.allSettled([
    adminSupabase.from("system_event_log").insert({
      actor_id: actor.user.id,
      community_id: communityId,
      details,
      entity_id: userId,
      entity_type: "user",
      event_type: "COMMUNITY_USER_UNIT_CHANGED",
      message: "Community user unit changed by superadmin",
      module: "superadmin",
      severity: "INFO",
      source: "minerva_console",
      user_id: userId,
    }),
    adminSupabase.from("superadmin_audit_log").insert({
      action: "community_user.unit_change",
      actor_user_id: actor.user.id,
      metadata: details,
      target_id: userId,
      target_type: "user",
    }),
  ]);

  revalidateCommunityUserPaths(communityId, houseId);
  return {
    houseLabel: coerceString(targetHouse.house_label, "Unnamed unit"),
    isPrimary: shouldRemainPrimary,
    success: true,
  };
}

export async function updateCommunityUserAction(
  input: UpdateCommunityUserInput,
): Promise<CommunityUserActionResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  if (!input.communityId || !input.userId) {
    return {
      error: "Community ID and user ID are required.",
      success: false,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_update_community_user", {
    p_community_id: input.communityId,
    p_full_name: input.fullName.trim(),
    p_house_id: input.houseId?.trim() || null,
    p_is_active: input.isActive,
    p_phone: input.phone.trim() || null,
    p_target_user_id: input.userId,
  });

  if (error) {
    return {
      error: error.message,
      success: false,
    };
  }

  revalidateCommunityUserPaths(input.communityId, input.houseId?.trim() || undefined);

  return { success: true };
}

export async function sendPasswordResetEmailAction(
  _previousState: PasswordResetActionState,
  formData: FormData,
): Promise<PasswordResetActionState> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!email || isSyntheticEmail(email)) {
    return {
      error: "This user does not have a real email for password reset.",
      success: false,
    };
  }

  const redirectTo = await getPasswordResetRedirectTo();
  const { url, anonKey } = getSupabaseEnv();
  const recoveryClient = createSupabaseClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      flowType: "implicit",
      persistSession: false,
    },
  });
  const { error } = await recoveryClient.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    return {
      error: error.message,
      success: false,
    };
  }

  return {
    success: true,
    error: fullName ? undefined : undefined,
  };
}

export async function generateTemporaryRecoveryCodeAction(
  _previousState: PasswordResetActionState,
  formData: FormData,
): Promise<PasswordResetActionState> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const communityId = String(formData.get("communityId") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const houseLabel = String(formData.get("houseLabel") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!userId || !communityId) {
    return {
      error: "Missing user or community information.",
      success: false,
    };
  }

  if (!isSyntheticEmail(email)) {
    return {
      error:
        "This user has a real email. Use the password reset email flow instead.",
      success: false,
    };
  }

  if (role !== "RESIDENT" && role !== "GUARD") {
    return {
      error:
        "Temporary recovery codes are only available for resident or guard accounts without email.",
      success: false,
    };
  }

  const supabase = createAdminClient();
  const { data, error, response } = await supabase.functions.invoke(
    "admin-generate-recovery-code",
    {
      body: {
        community_id: communityId,
        resident_user_id: userId,
        target_user_id: userId,
        user_id: userId,
      },
    },
  );

  const responseBody = await readFunctionResponseBody(response);
  const bodyMessage = normalizeFunctionMessage(responseBody);
  const dataMessage = normalizeFunctionMessage(data);
  const errorMessage =
    bodyMessage || dataMessage || (error instanceof Error ? error.message : "");

  if (error || ((data as Record<string, unknown> | null)?.ok === false)) {
    const normalizedError = errorMessage.toLowerCase();

    if (
      normalizedError.includes("correo") ||
      normalizedError.includes("email") ||
      normalizedError.includes("olvid") ||
      normalizedError.includes("contrase")
    ) {
      return {
        error:
          "This user has an email-based recovery flow. Use Reset Password instead.",
        success: false,
      };
    }

    if (
      normalizedError.includes("admin") ||
      normalizedError.includes("superadmin")
    ) {
      return {
        error:
          "Administrative accounts cannot use temporary recovery codes from this flow.",
        success: false,
      };
    }

    return {
      error: errorMessage || "Could not generate a temporary recovery code.",
      success: false,
    };
  }

  const code = extractRecoveryCode(data);
  if (!code) {
    return {
      error: "The recovery service did not return a usable temporary code.",
      success: false,
    };
  }

  return {
    code,
    expiresAt: extractExpiration(data),
    fullName,
    houseLabel,
    success: true,
  };
}

export async function setCommunityUserActiveStatusAction(
  input: SetCommunityUserActiveStatusInput,
): Promise<CommunityUserActionResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  if (!input.communityId || !input.userId) {
    return {
      error: "Community ID and user ID are required.",
      success: false,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_set_community_user_active_status", {
    p_community_id: input.communityId,
    p_is_active: input.isActive,
    p_target_user_id: input.userId,
  });

  if (error) {
    return {
      error: error.message,
      success: false,
    };
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("house_id")
    .eq("community_id", input.communityId)
    .eq("user_id", input.userId)
    .maybeSingle();

  revalidateCommunityUserPaths(
    input.communityId,
    coerceString(profileData?.house_id) || undefined,
  );

  return { success: true };
}