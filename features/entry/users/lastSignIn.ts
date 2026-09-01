import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getUsersLastSignIn(
  userIds: string[],
): Promise<Record<string, string | null>> {
  const ids = Array.from(new Set(userIds.map((id) => id.trim()).filter(Boolean)));

  if (ids.length === 0) return {};

  const supabase = createAdminClient();
  const entries = await Promise.all(
    ids.map(async (userId) => {
      try {
        const { data, error } = await supabase.auth.admin.getUserById(userId);

        if (error || !data.user) {
          return [userId, null] as const;
        }

        return [userId, data.user.last_sign_in_at ?? null] as const;
      } catch {
        return [userId, null] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}
