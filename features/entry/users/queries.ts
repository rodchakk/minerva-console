import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  coerceBoolean,
  coerceString,
} from "@/lib/supabase/utils";

export type CommunityUsersPageCommunity = {
  city: string;
  id: string;
  isActive: boolean;
  name: string;
  unitLabel: string;
};

export type CommunityUserHouse = {
  id: string;
  isActive: boolean;
  label: string;
};

export type CommunityUserRecord = {
  authType: string;
  createdAt: string;
  email: string;
  fullName: string;
  houseId: string;
  houseLabel: string;
  isActive: boolean;
  isPrimary: boolean;
  phone: string;
  role: string;
  userId: string;
  username: string;
};

export type CommunityUsersPageData = {
  community: CommunityUsersPageCommunity | null;
  houses: CommunityUserHouse[];
  users: CommunityUserRecord[];
  usersError: string | null;
};

function isSyntheticEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return (
    normalized.endsWith("@entry.local") ||
    normalized.endsWith("@entry.internal")
  );
}

function normalizeRole(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized || "UNASSIGNED";
}

function inferAuthType(record: Record<string, unknown>) {
  const rawAuthType = coerceString(record.auth_type).trim().toLowerCase();

  if (rawAuthType) {
    return rawAuthType;
  }

  const email = coerceString(record.email).trim();
  const username = coerceString(record.username).trim();

  if (email && !isSyntheticEmail(email)) {
    return "email";
  }

  if (username) {
    return "username";
  }

  return "synthetic";
}

function mapCommunity(value: unknown): CommunityUsersPageCommunity | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = coerceString(record.id);

  if (!id) {
    return null;
  }

  return {
    city: coerceString(record.city),
    id,
    isActive: coerceBoolean(record.is_active),
    name: coerceString(record.name, "Untitled community"),
    unitLabel: coerceString(record.unit_label, "Units"),
  };
}

function mapHouse(value: unknown): CommunityUserHouse | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = coerceString(record.id);

  if (!id) {
    return null;
  }

  return {
    id,
    isActive: record.is_active === undefined ? true : coerceBoolean(record.is_active),
    label: coerceString(record.house_label, "Unnamed unit"),
  };
}

function mapUser(value: unknown): CommunityUserRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const userId =
    coerceString(record.user_id) ||
    coerceString(record.id) ||
    coerceString(record.target_user_id);

  if (!userId) {
    return null;
  }

  const email = coerceString(record.email);
  const username = coerceString(record.username);

  return {
    authType: inferAuthType(record),
    createdAt:
      coerceString(record.created_at) ||
      coerceString(record.inserted_at) ||
      coerceString(record.joined_at),
    email,
    fullName:
      coerceString(record.full_name) ||
      coerceString(record.name) ||
      coerceString(record.display_name) ||
      username ||
      "Unnamed user",
    houseId:
      coerceString(record.house_id) ||
      coerceString(record.unit_id),
    houseLabel:
      coerceString(record.house_label) ||
      coerceString(record.unit_label) ||
      "No unit linked",
    isActive: record.is_active === undefined ? true : coerceBoolean(record.is_active),
    isPrimary: coerceBoolean(record.is_primary),
    phone: coerceString(record.phone),
    role: normalizeRole(coerceString(record.role)),
    userId,
    username,
  };
}

export async function getCommunityUsersPage(
  communityId: string,
): Promise<CommunityUsersPageData> {
  await requireSuperadmin();

  const supabase = await createClient();
  const adminSupabase = createAdminClient();
  const [
    { data: communityData },
    { data: housesData, error: housesError },
    { data: usersData, error: usersError },
    { data: primaryAssignmentsData },
  ] = await Promise.all([
    supabase
      .from("communities")
      .select("id,name,city,is_active,unit_label")
      .eq("id", communityId)
      .maybeSingle(),
    supabase
      .from("houses")
      .select("id,house_label,is_active")
      .eq("community_id", communityId)
      .order("house_label", { ascending: true }),
    supabase.rpc("sa_list_community_users", {
      p_community_id: communityId,
      p_include_inactive: true,
    }),
    adminSupabase
      .from("house_residents")
      .select("house_id,user_id,is_primary")
      .eq("community_id", communityId)
      .eq("is_active", true)
      .eq("is_primary", true),
  ]);

  const community = mapCommunity(communityData);
  const houses = housesError || !Array.isArray(housesData)
    ? []
    : housesData
        .map(mapHouse)
        .filter((house): house is CommunityUserHouse => house !== null);
  const primaryAssignments = new Set(
    (Array.isArray(primaryAssignmentsData) ? primaryAssignmentsData : [])
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const record = item as Record<string, unknown>;
        const houseId = coerceString(record.house_id);
        const userId = coerceString(record.user_id);
        return houseId && userId ? `${houseId}:${userId}` : "";
      })
      .filter(Boolean),
  );

  const users = usersError || !Array.isArray(usersData)
    ? []
    : usersData
        .map(mapUser)
        .filter((user): user is CommunityUserRecord => user !== null)
        .map((user) => ({
          ...user,
          isPrimary:
            user.isPrimary ||
            Boolean(
              user.houseId &&
                primaryAssignments.has(`${user.houseId}:${user.userId}`),
            ),
        }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    community,
    houses,
    users,
    usersError: usersError?.message ?? null,
  };
}
