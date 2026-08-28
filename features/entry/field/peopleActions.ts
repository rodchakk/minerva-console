"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  createActivatedUsers,
  type CreateActivatedUserItem,
} from "@/features/entry/activation/createUserActions";
import { generateActivationPins } from "@/features/entry/activation/pinActions";
import { updateCommunityUnitAction } from "@/features/entry/communities/unitActions";
import {
  getEntryPreviewReadOnlyError,
} from "@/features/entry/deploymentBoundary";
import { getPasswordResetRedirectTo } from "@/features/entry/passwordResetRedirect";
import {
  canSendResidentResetEmail,
  canUseResidentRecoveryCode,
} from "@/features/entry/field/peopleModel";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceString,
  getSupabaseEnv,
} from "@/lib/supabase/utils";

export type FieldActionResult = {
  error?: string;
  success: boolean;
};

export type FieldResetAccessResult = FieldActionResult & {
  code?: string;
  expiresAt?: string | null;
  mode?: "email" | "recovery_code" | "unsupported";
};

export type FieldActivationPinResult = FieldActionResult & {
  activationMethod?: string | null;
  email?: string | null;
  pin?: string;
  residentName?: string | null;
  suggestedUsername?: string | null;
  unitLabel?: string | null;
};

export type FieldCreateAccountResult = FieldActionResult & {
  loginIdentity?: string | null;
  residentName?: string | null;
  temporaryPassword?: string | null;
  unitLabel?: string | null;
};

type CanonicalResident = {
  email: string;
  fullName: string;
  houseId: string | null;
  houseLabel: string;
  isActive: boolean;
  phone: string;
  role: string;
  userId: string;
  username: string;
};

function revalidateFieldPeoplePaths(communityId: string, unitId?: string | null) {
  revalidatePath(`/field/entry/communities/${communityId}`);
  revalidatePath(`/field/entry/communities/${communityId}/people`);

  if (unitId) {
    revalidatePath(`/field/entry/communities/${communityId}/people/units/${unitId}`);
  }
}

function revalidateFieldActivationPaths(communityId: string, queueId: string) {
  revalidateFieldPeoplePaths(communityId);
  revalidatePath(`/field/entry/communities/${communityId}/people/activation`);
  revalidatePath(
    `/field/entry/communities/${communityId}/people/activation/${queueId}`,
  );
}

function normalizeFunctionMessage(value: unknown) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nested = record.data as Record<string, unknown> | undefined;
    const candidate =
      record.error ??
      record.message ??
      record.details ??
      record.reason ??
      nested?.error ??
      nested?.message ??
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

function mapCanonicalResident(item: unknown): CanonicalResident | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const userId = coerceString(record.user_id) || coerceString(record.id);

  if (!userId) {
    return null;
  }

  return {
    email: coerceString(record.email).trim().toLowerCase(),
    fullName:
      coerceString(record.full_name) ||
      coerceString(record.username) ||
      "Unnamed resident",
    houseId: coerceString(record.house_id) || null,
    houseLabel:
      coerceString(record.house_label) ||
      coerceString(record.unit_label) ||
      "No unit linked",
    isActive: coerceBoolean(record.is_active),
    phone: coerceString(record.phone),
    role: coerceString(record.role).trim().toUpperCase(),
    userId,
    username: coerceString(record.username),
  };
}

async function loadCanonicalResident(
  communityId: string,
  userId: string,
): Promise<CanonicalResident | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sa_list_community_users", {
    p_community_id: communityId,
    p_include_inactive: true,
  });

  if (error || !Array.isArray(data)) {
    return null;
  }

  return (
    data
      .map(mapCanonicalResident)
      .find((resident) => resident?.userId === userId) ?? null
  );
}

async function loadCommunityUnit(communityId: string, unitId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("houses")
    .select("id,house_label,is_active")
    .eq("community_id", communityId)
    .eq("id", unitId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: coerceString(data.id),
    isActive: data.is_active === undefined ? true : coerceBoolean(data.is_active),
    label: coerceString(data.house_label, "Unnamed unit"),
  };
}

export async function assignFieldResidentToUnit(input: {
  communityId: string;
  unitId: string;
  userId: string;
}): Promise<FieldActionResult> {
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
      error: "Community, resident, and target unit are required.",
      success: false,
    };
  }

  const [resident, unit] = await Promise.all([
    loadCanonicalResident(communityId, userId),
    loadCommunityUnit(communityId, unitId),
  ]);

  if (!resident) {
    return {
      error: "Resident was not found in this community.",
      success: false,
    };
  }

  if (resident.role !== "RESIDENT" && resident.role !== "UNASSIGNED") {
    return {
      error: "Only residents can be assigned from Field.",
      success: false,
    };
  }

  if (!unit) {
    return {
      error: "Target unit was not found in this community.",
      success: false,
    };
  }

  if (!unit.isActive) {
    return {
      error: "This unit is inactive. Resident assignment from Field is unavailable.",
      success: false,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sa_update_community_user", {
    p_community_id: communityId,
    p_full_name: resident.fullName.trim(),
    p_house_id: unit.id,
    p_is_active: resident.isActive,
    p_phone: resident.phone.trim() || null,
    p_target_user_id: userId,
  });

  if (error) {
    return {
      error: error.message,
      success: false,
    };
  }

  revalidatePath("/products/entry/communities");
  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/users`);
  revalidateFieldPeoplePaths(communityId, resident.houseId);
  revalidateFieldPeoplePaths(communityId, unit.id);
  revalidatePath(
    `/field/entry/communities/${communityId}/people/residents/${userId}`,
  );

  return { success: true };
}

export async function renameFieldUnit(input: {
  communityId: string;
  unitId: string;
  unitLabel: string;
}): Promise<FieldActionResult> {
  return updateCommunityUnitAction(input);
}

export async function resetFieldResidentAccess(input: {
  communityId: string;
  userId: string;
}): Promise<FieldResetAccessResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, mode: "unsupported", success: false };
  }

  const communityId = input.communityId.trim();
  const userId = input.userId.trim();

  if (!communityId || !userId) {
    return {
      error: "Community and resident are required.",
      mode: "unsupported",
      success: false,
    };
  }

  const resident = await loadCanonicalResident(communityId, userId);

  if (!resident) {
    return {
      error: "Resident was not found in this community.",
      mode: "unsupported",
      success: false,
    };
  }

  if (canSendResidentResetEmail(resident)) {
    const redirectTo = await getPasswordResetRedirectTo();
    const { url, anonKey } = getSupabaseEnv();
    const recoveryClient = createSupabaseClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        flowType: "implicit",
        persistSession: false,
      },
    });
    const { error } = await recoveryClient.auth.resetPasswordForEmail(
      resident.email,
      { redirectTo },
    );

    if (error) {
      return {
        error: error.message,
        mode: "email",
        success: false,
      };
    }

    return {
      mode: "email",
      success: true,
    };
  }

  if (!canUseResidentRecoveryCode(resident)) {
    return {
      error: "This account does not support the resident recovery-code flow.",
      mode: "unsupported",
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
  const errorMessage =
    normalizeFunctionMessage(responseBody) ||
    normalizeFunctionMessage(data) ||
    (error instanceof Error ? error.message : "");

  if (error || ((data as Record<string, unknown> | null)?.ok === false)) {
    return {
      error: errorMessage || "Could not generate a temporary recovery code.",
      mode: "recovery_code",
      success: false,
    };
  }

  const code = extractRecoveryCode(data);
  if (!code) {
    return {
      error: "The recovery service did not return a usable temporary code.",
      mode: "recovery_code",
      success: false,
    };
  }

  return {
    code,
    expiresAt: extractExpiration(data),
    mode: "recovery_code",
    success: true,
  };
}

export async function generateFieldActivationPin(input: {
  communityId: string;
  queueId: string;
}): Promise<FieldActivationPinResult> {
  const communityId = input.communityId.trim();
  const queueId = input.queueId.trim();

  if (!communityId || !queueId) {
    return {
      error: "Community and activation row are required.",
      success: false,
    };
  }

  const result = await generateActivationPins({
    communityId,
    queueIds: [queueId],
  });

  if (!result.success) {
    return {
      error: result.error,
      success: false,
    };
  }

  const item = result.data.items.find((candidate) => candidate.queue_id === queueId);

  if (!item || item.status !== "pin_generated" || !item.pin) {
    return {
      error: item?.message || "Activation PIN was not generated for this row.",
      success: false,
    };
  }

  revalidateFieldActivationPaths(communityId, queueId);

  return {
    activationMethod: item.activation_method,
    email: item.email,
    pin: item.pin,
    residentName: item.resident_name,
    suggestedUsername: item.suggested_username,
    success: true,
    unitLabel: item.unit_label,
  };
}

function getSingleCreatedAccountItem(
  items: CreateActivatedUserItem[],
  queueId: string,
) {
  return items.find((candidate) => candidate.queue_id === queueId) ?? null;
}

export async function createFieldActivationAccount(input: {
  communityId: string;
  queueId: string;
}): Promise<FieldCreateAccountResult> {
  await requireSuperadmin();

  const communityId = input.communityId.trim();
  const queueId = input.queueId.trim();

  if (!communityId || !queueId) {
    return {
      error: "Community and activation row are required.",
      success: false,
    };
  }

  const result = await createActivatedUsers({
    communityId,
    queueIds: [queueId],
  });

  if (!result.success) {
    return {
      error: result.error,
      success: false,
    };
  }

  const item = getSingleCreatedAccountItem(result.data.items, queueId);

  if (!item || item.status !== "activated") {
    return {
      error: item?.message || "Account could not be created for this row.",
      success: false,
    };
  }

  if (!item.login_identity || !item.temporary_password) {
    return {
      error: "Account was created, but credentials were not returned for Field display.",
      success: false,
    };
  }

  revalidateFieldActivationPaths(communityId, queueId);
  revalidatePath(`/products/entry/communities/${communityId}/users`);

  return {
    loginIdentity: item.login_identity,
    residentName: item.resident_name,
    success: true,
    temporaryPassword: item.temporary_password,
    unitLabel: item.unit_label,
  };
}
