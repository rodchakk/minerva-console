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
