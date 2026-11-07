"use server";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import { coerceBoolean, coerceString } from "@/lib/supabase/utils";

export type GlobalHouseholdMember = {
  userId: string;
  fullName: string;
  contact: string;
  role: string;
  isActive: boolean;
  isPrimary: boolean;
};

export type GlobalHouseholdResult =
  | { success: true; members: GlobalHouseholdMember[] }
  | { success: false; error: string; members: [] };

// Read only, scoped to a single community and unit and authorized as superadmin.
// Reuses the same community user read model as Community Directory.
export async function getGlobalHouseholdMembersAction(
  communityId: string,
  houseId: string,
): Promise<GlobalHouseholdResult> {
  await requireSuperadmin();
  if (!communityId || !houseId) return { success: true, members: [] };

  const supabase = await createClient();
  const [{ data, error }, { data: assignments, error: assignmentError }] = await Promise.all([
    supabase.rpc("sa_list_community_users", {
      p_community_id: communityId,
      p_include_inactive: true,
    }),
    supabase.from("house_residents")
      .select("user_id,house_id,is_primary")
      .eq("community_id", communityId)
      .eq("house_id", houseId),
  ]);

  if (error || assignmentError || !Array.isArray(data)) {
    return { success: false, error: error?.message ?? assignmentError?.message ?? "Unable to load household.", members: [] };
  }

  const primaryIds = new Set((assignments ?? [])
    .filter((record) => coerceBoolean(record.is_primary))
    .map((record) => coerceString(record.user_id)));

  const members: GlobalHouseholdMember[] = data
    .filter((record) => coerceString(record.house_id || record.unit_id) === houseId)
    .map((record) => {
      const userId = coerceString(record.user_id || record.id);
      const email = coerceString(record.email);
      const username = coerceString(record.username);
      const role = coerceString(record.role, "RESIDENT").toUpperCase();
      return {
        userId,
        fullName: coerceString(record.full_name) || username || "Unnamed resident",
        contact: email && !email.endsWith("@entry.local") && !email.endsWith("@entry.internal")
          ? email
          : username ? `@${username}` : coerceString(record.phone, "No contact provided"),
        role,
        isActive: record.is_active === undefined ? true : coerceBoolean(record.is_active),
        isPrimary: primaryIds.has(userId) || coerceBoolean(record.is_primary),
      };
    })
    .filter((member) => Boolean(member.userId));

  return { success: true, members };
}
