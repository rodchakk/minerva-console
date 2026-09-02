import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  FIELD_PEOPLE_MIN_QUERY_LENGTH,
  type FieldPeopleSearchResult,
  searchFieldPeople,
} from "@/features/entry/field/globalPeopleSearch";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";

export { FIELD_PEOPLE_MIN_QUERY_LENGTH };

export type FieldEntryUserRole = "ADMIN" | "GUARD" | "RESIDENT" | "UNASSIGNED";

export type FieldAllPeopleSearchResult =
  | {
      accountState: "Active" | "Inactive";
      communityId: string;
      communityName: string;
      identity: string;
      kind: "user";
      name: string;
      role: FieldEntryUserRole;
      unitLabel: string;
      userId: string;
    }
  | Extract<FieldPeopleSearchResult, { kind: "pending_activation" }>;

export type FieldAllPeopleSearchData = {
  error?: string;
  query: string;
  results: FieldAllPeopleSearchResult[];
  state: "idle" | "too_short" | "ready" | "unavailable";
};

function normalizeRole(value: string): FieldEntryUserRole | null {
  const normalized = value.trim().toUpperCase();

  if (
    normalized === "ADMIN" ||
    normalized === "GUARD" ||
    normalized === "RESIDENT" ||
    normalized === "UNASSIGNED"
  ) {
    return normalized;
  }

  return null;
}

function keyFor(communityId: string, userId: string) {
  return `${communityId}::${userId}`;
}

export async function searchAllFieldPeople(
  rawQuery: string,
): Promise<FieldAllPeopleSearchData> {
  await requireSuperadmin();

  const base = await searchFieldPeople(rawQuery);

  if (base.state !== "ready") {
    return {
      ...(base.error ? { error: base.error } : {}),
      query: base.query,
      results: [],
      state: base.state,
    };
  }

  const baseUsers = base.results.filter(
    (result): result is Extract<FieldPeopleSearchResult, { kind: "resident" }> =>
      result.kind === "resident",
  );
  const pending = base.results.filter(
    (
      result,
    ): result is Extract<FieldPeopleSearchResult, { kind: "pending_activation" }> =>
      result.kind === "pending_activation",
  );

  if (baseUsers.length === 0) {
    return {
      query: base.query,
      results: pending,
      state: "ready",
    };
  }

  const adminSupabase = createAdminClient();
  const userIds = Array.from(new Set(baseUsers.map((user) => user.userId)));
  const communityIds = Array.from(
    new Set(baseUsers.map((user) => user.communityId)),
  );
  const { data: memberships, error: membershipError } = await adminSupabase
    .from("community_members")
    .select("community_id,user_id,role")
    .in("user_id", userIds)
    .in("community_id", communityIds);

  if (membershipError) {
    return {
      error: membershipError.message,
      query: base.query,
      results: [],
      state: "unavailable",
    };
  }

  const roles = new Map<string, FieldEntryUserRole>();

  for (const item of Array.isArray(memberships) ? memberships : []) {
    const communityId = coerceString(item.community_id);
    const userId = coerceString(item.user_id);
    const role = normalizeRole(coerceString(item.role));

    if (communityId && userId && role) {
      roles.set(keyFor(communityId, userId), role);
    }
  }

  const users: FieldAllPeopleSearchResult[] = baseUsers.map((user) => ({
    accountState: user.accountState,
    communityId: user.communityId,
    communityName: user.communityName,
    identity: user.identity,
    kind: "user",
    name: user.name,
    role: roles.get(keyFor(user.communityId, user.userId)) ?? "UNASSIGNED",
    unitLabel: user.unitLabel,
    userId: user.userId,
  }));

  return {
    query: base.query,
    results: [...users, ...pending].sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.communityName.localeCompare(b.communityName),
    ),
    state: "ready",
  };
}
