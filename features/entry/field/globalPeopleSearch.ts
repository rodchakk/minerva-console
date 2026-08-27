import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getResidentIdentity } from "@/features/entry/field/peopleModel";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceString,
} from "@/lib/supabase/utils";

export const FIELD_PEOPLE_MIN_QUERY_LENGTH = 2;
export const FIELD_PEOPLE_RESULT_LIMIT = 24;

const RESIDENT_SOURCE_LIMIT = 18;
const PROFILE_SOURCE_LIMIT = 18;
const ACTIVATION_SOURCE_LIMIT = 18;
const ACTIONABLE_ACTIVATION_STATUSES = ["pending", "invited", "pin_generated"];

export type FieldPeopleSearchResult =
  | {
      accountState: "Active" | "Inactive";
      communityId: string;
      communityName: string;
      identity: string;
      kind: "resident";
      name: string;
      unitLabel: string;
      userId: string;
    }
  | {
      activationMethod: string;
      activationStatus: string;
      communityId: string;
      communityName: string;
      identityHint: string;
      kind: "pending_activation";
      name: string;
      queueId: string;
      unitLabel: string;
    };

export type FieldPeopleSearchData = {
  error?: string;
  query: string;
  results: FieldPeopleSearchResult[];
  state: "idle" | "too_short" | "ready" | "unavailable";
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ResidentCandidate = {
  communityId: string;
  communityName: string;
  email: string;
  houseId: string;
  houseLabel: string;
  isActive: boolean;
  name: string;
  userId: string;
  username: string;
};

type ProfileCandidate = {
  authType: string;
  communityId: string;
  houseId: string;
  isActive: boolean;
  name: string;
  syntheticEmail: string;
  userId: string;
  username: string;
};

type MembershipCandidate = {
  communityId: string;
  isActive: boolean;
  role: string;
  userId: string;
};

type ActivationCandidate = {
  activationMethod: string;
  activationStatus: string;
  communityId: string;
  email: string;
  houseId: string;
  identityHint: string;
  name: string;
  queueId: string;
  suggestedUsername: string;
  unitLabel: string;
};

function normalizePeopleQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, 80);
}

function buildPostgrestIlikePattern(query: string) {
  const normalized = normalizePeopleQuery(query)
    .replace(/[%,()*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized ? `%${normalized}%` : "";
}

function isResidentRole(role: string) {
  const normalized = role.trim().toUpperCase();
  return normalized === "RESIDENT" || normalized === "UNASSIGNED";
}

function fallback(value: string, fallbackValue: string) {
  const trimmed = value.trim();
  return trimmed && trimmed !== "-" && trimmed !== "\u2014"
    ? trimmed
    : fallbackValue;
}

function keyFor(communityId: string, userId: string) {
  return `${communityId}::${userId}`;
}

function mapResidentFromRpc(item: unknown): ResidentCandidate | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const role = coerceString(record.role);
  const userId = coerceString(record.user_id) || coerceString(record.id);
  const communityId = coerceString(record.community_id);

  if (!userId || !communityId || !isResidentRole(role)) {
    return null;
  }

  return {
    communityId,
    communityName: coerceString(record.community_name),
    email: coerceString(record.email),
    houseId: coerceString(record.house_id) || coerceString(record.unit_id),
    houseLabel:
      coerceString(record.house_label) ||
      coerceString(record.unit_label) ||
      "No unit linked",
    isActive: record.is_active === undefined ? true : coerceBoolean(record.is_active),
    name:
      coerceString(record.full_name) ||
      coerceString(record.name) ||
      "Unnamed resident",
    userId,
    username: coerceString(record.username),
  };
}

function mapProfileCandidate(item: unknown): ProfileCandidate | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const userId = coerceString(record.user_id);
  const communityId = coerceString(record.community_id);

  if (!userId || !communityId) {
    return null;
  }

  const username = coerceString(record.username);

  return {
    authType: coerceString(record.auth_type),
    communityId,
    houseId: coerceString(record.house_id),
    isActive: record.is_active === undefined ? true : coerceBoolean(record.is_active),
    name:
      coerceString(record.full_name) ||
      username ||
      "Unnamed resident",
    syntheticEmail: coerceString(record.synthetic_email),
    userId,
    username,
  };
}

function mapMembership(item: unknown): MembershipCandidate | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const userId = coerceString(record.user_id);
  const communityId = coerceString(record.community_id);

  if (!userId || !communityId) {
    return null;
  }

  return {
    communityId,
    isActive: record.is_active === undefined ? true : coerceBoolean(record.is_active),
    role: coerceString(record.role),
    userId,
  };
}

function mapActivationCandidate(item: unknown): ActivationCandidate | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const queueId = coerceString(record.id) || coerceString(record.queue_id);
  const communityId = coerceString(record.community_id);

  if (!queueId || !communityId) {
    return null;
  }

  const email = coerceString(record.email);
  const suggestedUsername =
    coerceString(record.suggested_username) ||
    coerceString(record.username_suggestion);

  return {
    activationMethod:
      coerceString(record.activation_method) ||
      coerceString(record.method) ||
      "not configured",
    activationStatus: coerceString(record.status, "pending"),
    communityId,
    email,
    houseId: coerceString(record.house_id),
    identityHint: email || suggestedUsername || "No identity hint",
    name:
      coerceString(record.resident_name) ||
      coerceString(record.full_name) ||
      "Unnamed resident",
    queueId,
    suggestedUsername,
    unitLabel:
      coerceString(record.unit_label) ||
      coerceString(record.house_label) ||
      "No unit linked",
  };
}

async function fetchMemberships(
  supabase: SupabaseServerClient,
  profiles: ProfileCandidate[],
) {
  const userIds = Array.from(new Set(profiles.map((profile) => profile.userId)));
  const communityIds = Array.from(
    new Set(profiles.map((profile) => profile.communityId)),
  );

  if (userIds.length === 0 || communityIds.length === 0) {
    return { error: null, items: [] as MembershipCandidate[] };
  }

  const { data, error } = await supabase
    .from("community_members")
    .select("community_id,user_id,role,is_active")
    .in("user_id", userIds)
    .in("community_id", communityIds);

  return {
    error,
    items: Array.isArray(data)
      ? data
          .map(mapMembership)
          .filter((item): item is MembershipCandidate => item !== null)
      : [],
  };
}

async function fetchResidentProfiles(
  supabase: SupabaseServerClient,
  residents: ResidentCandidate[],
) {
  const userIds = Array.from(new Set(residents.map((resident) => resident.userId)));
  const communityIds = Array.from(
    new Set(residents.map((resident) => resident.communityId)),
  );

  if (userIds.length === 0 || communityIds.length === 0) {
    return { error: null, items: [] as ProfileCandidate[] };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,community_id,house_id,full_name,username,synthetic_email,auth_type,is_active")
    .in("user_id", userIds)
    .in("community_id", communityIds);

  return {
    error,
    items: Array.isArray(data)
      ? data
          .map(mapProfileCandidate)
          .filter((item): item is ProfileCandidate => item !== null)
      : [],
  };
}

async function fetchCommunities(
  supabase: SupabaseServerClient,
  communityIds: string[],
) {
  const ids = Array.from(new Set(communityIds.filter(Boolean)));

  if (ids.length === 0) {
    return { error: null, items: new Map<string, string>() };
  }

  const { data, error } = await supabase
    .from("communities")
    .select("id,name")
    .in("id", ids);

  return {
    error,
    items: new Map(
      (Array.isArray(data) ? data : []).map((community) => [
        coerceString(community.id),
        coerceString(community.name, "Unknown community"),
      ]),
    ),
  };
}

async function fetchHouses(
  supabase: SupabaseServerClient,
  houseIds: string[],
) {
  const ids = Array.from(new Set(houseIds.filter(Boolean)));

  if (ids.length === 0) {
    return { error: null, items: new Map<string, string>() };
  }

  const { data, error } = await supabase
    .from("houses")
    .select("id,house_label")
    .in("id", ids);

  return {
    error,
    items: new Map(
      (Array.isArray(data) ? data : []).map((house) => [
        coerceString(house.id),
        coerceString(house.house_label, "No unit linked"),
      ]),
    ),
  };
}

function mergeResidents(
  rpcResidents: ResidentCandidate[],
  profileResidents: ProfileCandidate[],
  memberships: MembershipCandidate[],
) {
  const membershipByKey = new Map(
    memberships.map((membership) => [
      keyFor(membership.communityId, membership.userId),
      membership,
    ]),
  );
  const merged = new Map<string, ResidentCandidate>();

  for (const resident of rpcResidents) {
    merged.set(keyFor(resident.communityId, resident.userId), resident);
  }

  for (const profile of profileResidents) {
    const membership = membershipByKey.get(
      keyFor(profile.communityId, profile.userId),
    );

    if (!membership || !isResidentRole(membership.role)) {
      continue;
    }

    const existing = merged.get(keyFor(profile.communityId, profile.userId));

    merged.set(keyFor(profile.communityId, profile.userId), {
      communityId: profile.communityId,
      communityName: existing?.communityName ?? "",
      email: existing?.email || profile.syntheticEmail,
      houseId: existing?.houseId || profile.houseId,
      houseLabel: existing?.houseLabel || "No unit linked",
      isActive: existing?.isActive ?? membership.isActive ?? profile.isActive,
      name: existing?.name || profile.name,
      userId: profile.userId,
      username: existing?.username || profile.username,
    });
  }

  return Array.from(merged.values());
}

function sortResults(results: FieldPeopleSearchResult[]) {
  return results.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.communityName.localeCompare(b.communityName) ||
      a.kind.localeCompare(b.kind) ||
      ("userId" in a ? a.userId : a.queueId).localeCompare(
        "userId" in b ? b.userId : b.queueId,
      ),
  );
}

export async function searchFieldPeople(
  rawQuery: string,
): Promise<FieldPeopleSearchData> {
  await requireSuperadmin();

  const query = normalizePeopleQuery(rawQuery);

  if (!query) {
    return {
      query,
      results: [],
      state: "idle",
    };
  }

  if (query.length < FIELD_PEOPLE_MIN_QUERY_LENGTH) {
    return {
      query,
      results: [],
      state: "too_short",
    };
  }

  const pattern = buildPostgrestIlikePattern(query);

  if (!pattern) {
    return {
      query,
      results: [],
      state: "ready",
    };
  }

  const supabase = await createClient();
  const [residentRpcResult, profileResult, activationResult] = await Promise.all([
    supabase
      .rpc("sa_list_users", {
        p_community_id: null,
        p_search: query,
      })
      .order("full_name", { ascending: true })
      .order("user_id", { ascending: true })
      .limit(RESIDENT_SOURCE_LIMIT),
    supabase
      .from("profiles")
      .select("user_id,community_id,house_id,full_name,username,synthetic_email,auth_type,is_active")
      .or(`full_name.ilike.${pattern},username.ilike.${pattern},synthetic_email.ilike.${pattern}`)
      .order("full_name", { ascending: true })
      .order("user_id", { ascending: true })
      .limit(PROFILE_SOURCE_LIMIT),
    supabase
      .from("resident_activation_queue")
      .select("id,community_id,house_id,unit_label,resident_name,email,suggested_username,activation_method,status")
      .in("status", ACTIONABLE_ACTIVATION_STATUSES)
      .or(`resident_name.ilike.${pattern},email.ilike.${pattern},suggested_username.ilike.${pattern}`)
      .order("resident_name", { ascending: true })
      .order("id", { ascending: true })
      .limit(ACTIVATION_SOURCE_LIMIT),
  ]);

  if (residentRpcResult.error || profileResult.error || activationResult.error) {
    return {
      error:
        residentRpcResult.error?.message ||
        profileResult.error?.message ||
        activationResult.error?.message ||
        "People search unavailable.",
      query,
      results: [],
      state: "unavailable",
    };
  }

  const rpcResidents = Array.isArray(residentRpcResult.data)
    ? residentRpcResult.data
        .map(mapResidentFromRpc)
        .filter((item): item is ResidentCandidate => item !== null)
    : [];
  const matchingProfiles = Array.isArray(profileResult.data)
    ? profileResult.data
        .map(mapProfileCandidate)
        .filter((item): item is ProfileCandidate => item !== null)
    : [];
  const activationCandidates = Array.isArray(activationResult.data)
    ? activationResult.data
        .map(mapActivationCandidate)
        .filter((item): item is ActivationCandidate => item !== null)
    : [];

  const memberships = await fetchMemberships(supabase, matchingProfiles);

  if (memberships.error) {
    return {
      error: memberships.error.message,
      query,
      results: [],
      state: "unavailable",
    };
  }

  const mergedResidents = mergeResidents(
    rpcResidents,
    matchingProfiles,
    memberships.items,
  );
  const residentProfiles = await fetchResidentProfiles(supabase, mergedResidents);

  if (residentProfiles.error) {
    return {
      error: residentProfiles.error.message,
      query,
      results: [],
      state: "unavailable",
    };
  }

  const profileByKey = new Map(
    residentProfiles.items.map((profile) => [
      keyFor(profile.communityId, profile.userId),
      profile,
    ]),
  );
  const communityIds = [
    ...mergedResidents.map((resident) => resident.communityId),
    ...activationCandidates.map((row) => row.communityId),
  ];
  const houseIds = [
    ...mergedResidents.map((resident) => resident.houseId),
    ...activationCandidates.map((row) => row.houseId),
  ];
  const [communities, houses] = await Promise.all([
    fetchCommunities(supabase, communityIds),
    fetchHouses(supabase, houseIds),
  ]);

  if (communities.error || houses.error) {
    return {
      error:
        communities.error?.message ||
        houses.error?.message ||
        "People search context unavailable.",
      query,
      results: [],
      state: "unavailable",
    };
  }

  const residentResults: FieldPeopleSearchResult[] = mergedResidents.map(
    (resident) => {
      const profile = profileByKey.get(
        keyFor(resident.communityId, resident.userId),
      );
      const username = resident.username || profile?.username || "";
      const email = resident.email || profile?.syntheticEmail || "";

      return {
        accountState: resident.isActive ? "Active" : "Inactive",
        communityId: resident.communityId,
        communityName:
          resident.communityName ||
          communities.items.get(resident.communityId) ||
          "Unknown community",
        identity: getResidentIdentity({ email, username }),
        kind: "resident",
        name: fallback(resident.name || profile?.name || "", "Unnamed resident"),
        unitLabel:
          houses.items.get(resident.houseId) ||
          resident.houseLabel ||
          "No unit linked",
        userId: resident.userId,
      };
    },
  );

  const activationResults: FieldPeopleSearchResult[] = activationCandidates.map(
    (row) => ({
      activationMethod: row.activationMethod,
      activationStatus: row.activationStatus,
      communityId: row.communityId,
      communityName:
        communities.items.get(row.communityId) || "Unknown community",
      identityHint: row.identityHint,
      kind: "pending_activation",
      name: fallback(row.name, "Unnamed resident"),
      queueId: row.queueId,
      unitLabel:
        houses.items.get(row.houseId) ||
        row.unitLabel ||
        "No unit linked",
    }),
  );

  return {
    query,
    results: sortResults([...residentResults, ...activationResults]).slice(
      0,
      FIELD_PEOPLE_RESULT_LIMIT,
    ),
    state: "ready",
  };
}
