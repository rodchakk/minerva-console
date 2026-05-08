"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
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
  email: string;
  fullName: string;
  houseLabel: string;
  id: string;
  isActive: boolean;
  role: string;
  username: string;
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

async function getPasswordResetRedirectTo() {
  const configuredRedirect = process.env.NEXT_PUBLIC_ENTRY_PASSWORD_RESET_REDIRECT?.trim();

  if (configuredRedirect && configuredRedirect !== "entry://reset-password") {
    return configuredRedirect;
  }

  const publicConsoleUrl =
    process.env.NEXT_PUBLIC_MINERVA_CONSOLE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (publicConsoleUrl) {
    return `${publicConsoleUrl.replace(/\/$/, "")}/reset-password`;
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.includes("localhost") ? "http" : "https");

  if (host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    return `${protocol}://${host}/reset-password`;
  }

  return "entry://reset-password";
}

export async function searchUsersAction(
  _previousState: UserSearchState,
  formData: FormData,
): Promise<UserSearchState> {
  await requireSuperadmin();

  const query = String(formData.get("query") ?? "").trim();

  if (!query) {
    return {
      message: "Enter a name or email to search users.",
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
          email: coerceString(record.email, "No email"),
          fullName: coerceString(record.full_name, "Unnamed user"),
          houseLabel: coerceString(record.house_label),
          id:
            coerceString(record.user_id) ||
            coerceString(record.id) ||
            crypto.randomUUID(),
          isActive: coerceBoolean(record.is_active),
          role: coerceString(record.role, "Unknown"),
        };
      })
    : [];

  const communityIds = Array.from(
    new Set(baseResults.map((item) => item.communityId).filter(Boolean)),
  );
  const userIds = Array.from(new Set(baseResults.map((item) => item.id).filter(Boolean)));

  const [{ data: communitiesData }, { data: profilesData }] = await Promise.all([
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
          username,
        };
      })
    : [];

  return {
    query,
    results,
  };
}

export async function updateCommunityUserAction(
  input: UpdateCommunityUserInput,
): Promise<CommunityUserActionResult> {
  await requireSuperadmin();

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

  revalidatePath("/products/entry/communities");
  revalidatePath(`/products/entry/communities/${input.communityId}`);
  revalidatePath(`/products/entry/communities/${input.communityId}/users`);

  return { success: true };
}

export async function sendPasswordResetEmailAction(
  _previousState: PasswordResetActionState,
  formData: FormData,
): Promise<PasswordResetActionState> {
  await requireSuperadmin();

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

  if (role !== "RESIDENT") {
    return {
      error:
        "Temporary recovery codes are only available for residents without email.",
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

  revalidatePath("/products/entry/communities");
  revalidatePath(`/products/entry/communities/${input.communityId}`);
  revalidatePath(`/products/entry/communities/${input.communityId}/users`);

  return { success: true };
}
