"use server";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceString,
} from "@/lib/supabase/utils";

export type UserSearchItem = {
  email: string;
  fullName: string;
  id: string;
  isActive: boolean;
  role: string;
};

export type UserSearchState = {
  message?: string;
  query?: string;
  results?: UserSearchItem[];
};

export type ResetPasswordState = {
  email?: string;
  error?: string;
  ok?: boolean;
  message?: string;
};

function isSyntheticEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return (
    normalized.endsWith("@entry.local") ||
    normalized.endsWith("@entry.internal") ||
    normalized.endsWith("@minerva.local") ||
    normalized.endsWith("@synthetic.local")
  );
}

function isRealEmail(email: string) {
  const normalized = email.trim();
  return normalized.includes("@") && !isSyntheticEmail(normalized);
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
  const { data, error } = await supabase.rpc("admin_search_users_v1", {
    p_query: query,
  });

  if (error) {
    return {
      message: error.message,
      query,
      results: [],
    };
  }

  const results = Array.isArray(data)
    ? data.map((item) => {
        const record = item as Record<string, unknown>;
        return {
          email: coerceString(record.email, "No email"),
          fullName: coerceString(record.full_name, "Unnamed user"),
          id: coerceString(record.id, crypto.randomUUID()),
          isActive: coerceBoolean(record.is_active),
          role: coerceString(record.role, "Unknown"),
        };
      })
    : [];

  return {
    query,
    results,
  };
}

export async function sendPasswordResetEmailAction(
  _previousState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  await requireSuperadmin();

  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "user").trim() || "user";

  if (!email || !isRealEmail(email)) {
    return {
      email,
      ok: false,
      error:
        "This account does not have a real email. Username-only users need an admin PIN reset flow.",
    };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://www.minervatechs.com";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  });

  if (error) {
    return {
      email,
      ok: false,
      error: error.message,
    };
  }

  return {
    email,
    ok: true,
    message: `Password reset email sent to ${fullName}.`,
  };
}
