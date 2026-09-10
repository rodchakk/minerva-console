"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { getPasswordResetRedirectTo } from "@/features/entry/passwordResetRedirect";
import {
  canSendResidentResetEmail,
  canUseResidentRecoveryCode,
} from "@/features/entry/field/peopleModel";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceString,
  getSupabaseEnv,
} from "@/lib/supabase/utils";

export type FieldResetAccessResult = {
  code?: string;
  error?: string;
  expiresAt?: string | null;
  mode: "email" | "recovery_code" | "unsupported";
  success: boolean;
};

type CanonicalResident = {
  email: string;
  fullName: string;
  isActive: boolean;
  role: string;
  userId: string;
  username: string;
};

function mapResident(item: unknown): CanonicalResident | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const userId = coerceString(record.user_id) || coerceString(record.id);
  if (!userId) return null;

  return {
    email: coerceString(record.email).trim().toLowerCase(),
    fullName:
      coerceString(record.full_name) ||
      coerceString(record.username) ||
      "Unnamed resident",
    isActive: coerceBoolean(record.is_active),
    role: coerceString(record.role).trim().toUpperCase(),
    userId,
    username: coerceString(record.username),
  };
}

function extractString(data: unknown, keys: string[]) {
  const record = (data as Record<string, unknown> | null) ?? {};
  const nested = (record.data as Record<string, unknown> | undefined) ?? {};

  for (const key of keys) {
    const candidate = record[key] ?? nested[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
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

  if (error || !Array.isArray(data)) return null;

  return (
    data
      .map(mapResident)
      .find((resident) => resident?.userId === userId) ?? null
  );
}

export async function resetFieldResidentAccess(input: {
  communityId: string;
  userId: string;
}): Promise<FieldResetAccessResult> {
  await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return {
      error: previewReadOnlyError,
      mode: "unsupported",
      success: false,
    };
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

  if (resident.role !== "RESIDENT" && resident.role !== "UNASSIGNED") {
    return {
      error: "Only resident accounts can use this recovery flow.",
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
      return { error: error.message, mode: "email", success: false };
    }

    return { mode: "email", success: true };
  }

  if (!canUseResidentRecoveryCode(resident)) {
    return {
      error: "This account does not support the temporary PIN recovery flow.",
      mode: "unsupported",
      success: false,
    };
  }

  // Important: invoke with the authenticated operator client, not the service-role
  // client. The Edge Function validates the caller JWT and then authorizes either
  // a Minerva superadmin or an active community admin.
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke(
    "admin-generate-recovery-code",
    {
      body: {
        community_id: communityId,
        target_user_id: userId,
      },
    },
  );

  const functionError =
    extractString(data, ["detail", "error", "message"]) ||
    (error instanceof Error ? error.message : "");

  if (error || (data as { ok?: boolean } | null)?.ok === false) {
    return {
      error: functionError || "Could not generate a temporary access PIN.",
      mode: "recovery_code",
      success: false,
    };
  }

  const code = extractString(data, [
    "activation_code",
    "recovery_code",
    "temporary_code",
    "code",
  ]);

  if (!code) {
    return {
      error: "The recovery service did not return a usable temporary access PIN.",
      mode: "recovery_code",
      success: false,
    };
  }

  return {
    code,
    expiresAt:
      extractString(data, ["expires_at", "expiresAt", "expiration"]) || null,
    mode: "recovery_code",
    success: true,
  };
}
