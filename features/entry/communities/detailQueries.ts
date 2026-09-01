import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  getCommunityWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
} from "@/lib/supabase/utils";

type PreviewState = "live" | "empty" | "unavailable" | "disabled";

export type CommunityUnitsStatusFilter =
  | "all"
  | "active"
  | "inactive"
  | "occupied"
  | "no_residents"
  | "pending_activation"
  | "has_residents"
  | "has_passes"
  | "recent_access";

export type CommunityUserPreview = {
  contact: string;
  fullName: string;
  houseLabel: string;
  id: string;
  isActive: boolean;
  role: string;
};

export type CommunityUserCounts = {
  admins: number;
  guards: number;
  inactive: number;
  residents: number;
};

export type CommunityUnitPreview = {
  activePasses: number;
  activeResidents: number;
  createdAt: string;
  id: string;
  isActive: boolean;
  label: string;
  lastAccess: string;
  ownerName: string;
  pendingActivations: number;
  primaryResidentName: string;
  residentCount: number;
  residents: CommunityUnitResident[];
  activePassItems: CommunityUnitPass[];
  pendingActivationItems: CommunityUnitPendingActivation[];
};

export type CommunityUnitsSummary = {
  activePasses: number;
  activeResidents: number;
  activeUnits: number;
  inactiveUnits: number;
  pendingActivations: number;
  residentCount: number;
  totalUnits: number;
  unitsWithRecentAccess: number;
};

export type CommunityUnitsPageData = {
  filteredItems: CommunityUnitPreview[];
  houses: CommunityUnitHouseOption[];
  items: CommunityUnitPreview[];
  query: string;
  state: CommunityPreviewResult<CommunityUnitPreview>["state"];
  status: CommunityUnitsStatusFilter;
  summary: CommunityUnitsSummary;
  totalMatching: number;
};

export type CommunityUnitDetailPageData = {
  community: CommunityWithProgressItem | null;
  state: CommunityPreviewResult<CommunityUnitPreview>["state"];
  unit: CommunityUnitPreview | null;
  houses: CommunityUnitHouseOption[];
};

export type CommunityUnitHouseOption = {
  id: string;
  isActive: boolean;
  label: string;
};

export type CommunityUnitResident = {
  account: string;
  authType: string;
  email: string;
  fullName: string;
  houseId: string;
  houseLabel: string;
  isActive: boolean;
  phone: string;
  role: string;
  status: "active" | "inactive" | "no_account";
  userId: string;
  username: string;
};

export type CommunityUnitPendingActivation = {
  id: string;
  method: string;
  residentName: string;
  status: string;
  unitLabel: string;
};

export type CommunityUnitPass = {
  expiresAt: string;
  houseId: string;
  holderName: string;
  id: string;
  passName: string;
  residentName: string;
  status: string;
};

export type CommunityFacilityPreview = {
  closesAt: string;
  currency: string;
  id: string;
  isActive: boolean;
  name: string;
  opensAt: string;
  pricePerSlot: string;
  slotMinutes: number;
};

export type CommunityMessagePreview = {
  expiresAt: string;
  id: string;
  publishedAt: string;
  sourceType: string;
  title: string;
};

export type CommunityPreviewResult<T> = {
  error?: string;
  items: T[];
  state: PreviewState;
  total: number;
};

export type CommunityDetailPreviews = {
  facilities: CommunityPreviewResult<CommunityFacilityPreview> & {
    activeCount: number;
  };
  messages: CommunityPreviewResult<CommunityMessagePreview>;
  units: CommunityPreviewResult<CommunityUnitPreview>;
  users: CommunityPreviewResult<CommunityUserPreview> & {
    counts: CommunityUserCounts;
  };
};

type PreviewOptions = {
  allowMessages: boolean;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const PREVIEW_LIMIT = 6;

const emptyUserCounts: CommunityUserCounts = {
  admins: 0,
  guards: 0,
  inactive: 0,
  residents: 0,
};

function makePreviewId(...parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("::");
}

function formatDateTime(value: string) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDate(value: string) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

function formatTime(value: string) {
  if (!value) {
    return "Not set";
  }

  if (/^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRole(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "Unknown";
  }

  if (normalized.includes("admin")) {
    return "Admin";
  }

  if (normalized.includes("guard")) {
    return "Guard";
  }

  if (normalized.includes("resident")) {
    return "Resident";
  }

  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function normalizeRole(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized || "UNASSIGNED";
}

function isSyntheticEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return (
    !normalized ||
    normalized.endsWith("@entry.local") ||
    normalized.endsWith("@entry.internal")
  );
}

function getResidentAccount(email: string, username: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (username.trim()) {
    return username.trim();
  }

  if (normalizedEmail && !isSyntheticEmail(normalizedEmail)) {
    return email.trim();
  }

  return "No login identity visible";
}

function getComputedPassStatus(record: Record<string, unknown>) {
  const explicit =
    coerceString(record.computed_status) ||
    coerceString(record.status);

  if (explicit) {
    return explicit
      .trim()
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`)
      .join(" ");
  }

  if (record.is_active !== undefined && !coerceBoolean(record.is_active)) {
    return "Revoked";
  }

  const expiresAt = coerceString(record.expires_at);
  const parsedExpiresAt = expiresAt ? new Date(expiresAt) : null;

  if (parsedExpiresAt && !Number.isNaN(parsedExpiresAt.getTime()) && parsedExpiresAt <= new Date()) {
    return "Expired";
  }

  return "Active";
}

function parseDateValue(value: string) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function hasInactivePassStatus(record: Record<string, unknown>) {
  const explicit =
    coerceString(record.computed_status) ||
    coerceString(record.status);
  const normalized = explicit.trim().toLowerCase();

  return ["expired", "revoked", "inactive", "cancelled", "canceled", "suspended"].includes(
    normalized,
  );
}

function isCurrentlyActivePass(record: Record<string, unknown>, now: Date) {
  if (record.is_active !== undefined && !coerceBoolean(record.is_active)) {
    return false;
  }

  if (hasInactivePassStatus(record)) {
    return false;
  }

  const startsAt = parseDateValue(coerceString(record.starts_at));
  const expiresAt = parseDateValue(coerceString(record.expires_at));

  if (startsAt && startsAt > now) {
    return false;
  }

  if (expiresAt && expiresAt <= now) {
    return false;
  }

  return true;
}

function formatSourceType(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "Official";
  }

  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function getUsernameFromSyntheticEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail.endsWith("@entry.local")) {
    return "";
  }

  const localPart = normalizedEmail.slice(0, normalizedEmail.indexOf("@"));
  const match = localPart.match(
    /^(?:(?:resident|guard|admin)-)?(.+?)-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
  );

  return match?.[1] ?? localPart;
}

function getPreferredUserContact(email: string, username: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail && !normalizedEmail.endsWith("@entry.local")) {
    return email;
  }

  const normalizedUsername = username.trim();

  if (normalizedUsername) {
    return normalizedUsername;
  }

  const derivedUsername = getUsernameFromSyntheticEmail(email);

  if (derivedUsername) {
    return derivedUsername;
  }

  return "No contact available";
}

function buildUnavailableResult<T>(
  error: string,
  extras?: Partial<CommunityPreviewResult<T>>,
): CommunityPreviewResult<T> {
  return {
    error,
    items: [],
    state: "unavailable",
    total: 0,
    ...extras,
  };
}

async function loadUsersPreview(
  supabase: SupabaseServerClient,
  communityId: string,
): Promise<CommunityDetailPreviews["users"]> {
  try {
    const [
      { data, error },
      { data: profilesData, error: profilesError },
      { data: operatorMembershipsData, error: operatorMembershipsError },
    ] = await Promise.all([
      supabase.rpc("sa_list_users", {
        p_community_id: communityId,
        p_search: null,
      }),
      supabase
        .from("profiles")
        .select("user_id,username,full_name,phone,synthetic_email,house_id")
        .eq("community_id", communityId),
      supabase
        .from("community_members")
        .select("user_id,role,is_active")
        .eq("community_id", communityId),
    ]);

    if (error) {
      return {
        ...buildUnavailableResult<CommunityUserPreview>(error.message),
        counts: emptyUserCounts,
      };
    }

    if (profilesError) {
      return {
        ...buildUnavailableResult<CommunityUserPreview>(profilesError.message),
        counts: emptyUserCounts,
      };
    }

    if (operatorMembershipsError) {
      return {
        ...buildUnavailableResult<CommunityUserPreview>(operatorMembershipsError.message),
        counts: emptyUserCounts,
      };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        counts: emptyUserCounts,
        items: [],
        state: "empty",
        total: 0,
      };
    }

    const profilesByUserId = new Map(
      (Array.isArray(profilesData) ? profilesData : []).map((profile) => [
        coerceString(profile.user_id),
        profile,
      ]),
    );

    const items = data
      .map((item) => {
        const record = item as Record<string, unknown>;
        const userId = coerceString(record.user_id) || coerceString(record.id);
        const profile = profilesByUserId.get(userId);
        const fullName =
          coerceString(record.full_name) ||
          coerceString(record.name) ||
          coerceString(profile?.full_name) ||
          coerceString(profile?.username) ||
          "Unnamed user";
        const role = formatRole(coerceString(record.role));
        const contact = getPreferredUserContact(
          coerceString(record.email),
          coerceString(profile?.username),
        );
        const houseLabel =
          coerceString(record.house_label) ||
          coerceString(record.unit_label) ||
          "No unit linked";
        const id =
          userId ||
          makePreviewId(fullName, role, contact, houseLabel);

        return {
          contact,
          fullName,
          houseLabel,
          id,
          isActive: coerceBoolean(record.is_active),
          role,
        };
      })
      .filter((item) => item.id);

    const existingUserIds = new Set(items.map((item) => item.id));
    const missingOperatorHouseIds = Array.from(
      new Set(
        (Array.isArray(operatorMembershipsData) ? operatorMembershipsData : [])
          .filter((membership) => {
            const membershipRecord = membership as Record<string, unknown>;
            const normalizedRole = coerceString(membershipRecord.role).toUpperCase();
            return normalizedRole === "ADMIN" || normalizedRole === "GUARD";
          })
          .map((membership) => {
            const membershipRecord = membership as Record<string, unknown>;
            const operatorUserId = coerceString(membershipRecord.user_id);

            if (!operatorUserId || existingUserIds.has(operatorUserId)) {
              return "";
            }

            const profile = profilesByUserId.get(operatorUserId);
            return coerceString(profile?.house_id);
          })
          .filter(Boolean),
      ),
    );

    let housesById = new Map<string, string>();

    if (missingOperatorHouseIds.length > 0) {
      const { data: housesData, error: housesError } = await supabase
        .from("houses")
        .select("id,house_label")
        .eq("community_id", communityId)
        .in("id", missingOperatorHouseIds);

      if (housesError) {
        return {
          ...buildUnavailableResult<CommunityUserPreview>(housesError.message),
          counts: emptyUserCounts,
        };
      }

      housesById = new Map(
        (Array.isArray(housesData) ? housesData : []).map((house) => [
          coerceString(house.id),
          coerceString(house.house_label),
        ]),
      );
    }

    const missingOperators = (Array.isArray(operatorMembershipsData)
      ? operatorMembershipsData
      : []
    )
      .filter((membership) => {
        const membershipRecord = membership as Record<string, unknown>;
        const normalizedRole = coerceString(membershipRecord.role).toUpperCase();
        return normalizedRole === "ADMIN" || normalizedRole === "GUARD";
      })
      .map((membership) => {
        const membershipRecord = membership as Record<string, unknown>;
        const userId = coerceString(membershipRecord.user_id);

        if (!userId || existingUserIds.has(userId)) {
          return null;
        }

        const profile = profilesByUserId.get(userId);
        const role = formatRole(coerceString(membershipRecord.role));
        const contact = getPreferredUserContact(
          coerceString(profile?.synthetic_email),
          coerceString(profile?.username),
        );
        const houseLabel =
          housesById.get(coerceString(profile?.house_id)) ||
          "No unit linked";

        return {
          contact,
          fullName:
            coerceString(profile?.full_name) ||
            coerceString(profile?.username) ||
            "Unnamed user",
          houseLabel,
          id: userId,
          isActive: coerceBoolean(membershipRecord.is_active),
          role,
        };
      })
      .filter((item): item is CommunityUserPreview => item !== null);

    const mergedItems = [...items, ...missingOperators].sort((a, b) => {
      const roleOrder = (role: string) => {
        const normalizedRole = role.trim().toLowerCase();
        if (normalizedRole === "admin") {
          return 0;
        }
        if (normalizedRole === "guard") {
          return 1;
        }
        if (normalizedRole === "resident") {
          return 2;
        }
        return 3;
      };

      return roleOrder(a.role) - roleOrder(b.role) || a.fullName.localeCompare(b.fullName);
    });

    const counts = mergedItems.reduce<CommunityUserCounts>(
      (acc, item) => {
        const normalizedRole = item.role.toLowerCase();

        if (normalizedRole === "admin") {
          acc.admins += 1;
        } else if (normalizedRole === "guard") {
          acc.guards += 1;
        } else if (normalizedRole === "resident") {
          acc.residents += 1;
        }

        if (!item.isActive) {
          acc.inactive += 1;
        }

        return acc;
      },
      { ...emptyUserCounts },
    );

    return {
      counts,
      items: mergedItems,
      state: mergedItems.length > 0 ? "live" : "empty",
      total: mergedItems.length,
    };
  } catch (error) {
    return {
      ...buildUnavailableResult<CommunityUserPreview>(
        error instanceof Error ? error.message : "Preview unavailable",
      ),
      counts: emptyUserCounts,
    };
  }
}

async function loadUnitsPreview(
  supabase: SupabaseServerClient,
  communityId: string,
): Promise<CommunityDetailPreviews["units"]> {
  try {
    const { data, error } = await supabase.rpc("admin_list_houses", {
      p_community_id: communityId,
    });

    if (error) {
      return buildUnavailableResult<CommunityUnitPreview>(error.message);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        items: [],
        state: "empty",
        total: 0,
      };
    }

    const items = data
      .map((item) => {
        const record = item as Record<string, unknown>;
        const label =
          coerceString(record.house_label) ||
          coerceString(record.unit_label) ||
          coerceString(record.house_name) ||
          coerceString(record.name) ||
          "Unnamed unit";
        const ownerName =
          coerceString(record.owner_name) ||
          coerceString(record.owner_full_name) ||
          coerceString(record.primary_owner_name) ||
          "No owner linked";
        const id =
          coerceString(record.house_id) ||
          coerceString(record.id) ||
          makePreviewId(label, ownerName);

        return {
          activePasses:
            coerceNumber(record.active_passes_count) ||
            coerceNumber(record.active_passes) ||
            coerceNumber(record.total_active_passes) ||
            coerceNumber(record.active_guests_count),
          activeResidents:
            coerceNumber(record.active_residents) ||
            coerceNumber(record.active_residents_count) ||
            coerceNumber(record.resident_count) ||
            coerceNumber(record.active_members_count),
          createdAt: formatDateTime(
            coerceString(record.created_at) ||
              coerceString(record.inserted_at) ||
              coerceString(record.created_on),
          ),
          id,
          isActive:
            record.is_active === undefined
              ? true
              : coerceBoolean(record.is_active),
          label,
          lastAccess: formatDateTime(
            coerceString(record.last_access_at) ||
              coerceString(record.last_entry_at) ||
              coerceString(record.last_visit_at) ||
              coerceString(record.last_access),
          ),
          ownerName,
          pendingActivations: 0,
          primaryResidentName: ownerName === "No owner linked" ? "" : ownerName,
          residentCount:
            coerceNumber(record.resident_count) ||
            coerceNumber(record.total_residents) ||
            coerceNumber(record.linked_residents_count) ||
            coerceNumber(record.residents_count),
          residents: [],
          activePassItems: [],
          pendingActivationItems: [],
        };
      })
      .filter((item) => item.id);

    return {
      items,
      state: items.length > 0 ? "live" : "empty",
      total: items.length,
    };
  } catch (error) {
    return buildUnavailableResult<CommunityUnitPreview>(
      error instanceof Error ? error.message : "Preview unavailable",
    );
  }
}

async function loadHouseOptions(
  supabase: SupabaseServerClient,
  communityId: string,
): Promise<CommunityUnitHouseOption[]> {
  const { data, error } = await supabase
    .from("houses")
    .select("id,house_label,is_active")
    .eq("community_id", communityId)
    .order("house_label", { ascending: true });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      const id = coerceString(item.id);
      if (!id) return null;

      return {
        id,
        isActive: item.is_active === undefined ? true : coerceBoolean(item.is_active),
        label: coerceString(item.house_label, "Unnamed unit"),
      };
    })
    .filter((item): item is CommunityUnitHouseOption => item !== null);
}

async function loadUnitResidents(
  supabase: SupabaseServerClient,
  communityId: string,
): Promise<CommunityUnitResident[]> {
  const { data, error } = await supabase.rpc("sa_list_community_users", {
    p_community_id: communityId,
    p_include_inactive: true,
  });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const userId = coerceString(record.user_id) || coerceString(record.id);
      const houseId = coerceString(record.house_id) || coerceString(record.unit_id);
      const role = normalizeRole(coerceString(record.role));

      if (!userId || !houseId || (role !== "RESIDENT" && role !== "ADMIN" && role !== "UNASSIGNED")) {
        return null;
      }

      const email = coerceString(record.email).trim();
      const username = coerceString(record.username).trim();
      const isActive =
        record.is_active === undefined ? true : coerceBoolean(record.is_active);

      const resident: CommunityUnitResident = {
        account: getResidentAccount(email, username),
        authType: coerceString(record.auth_type) || (username ? "username" : "email"),
        email,
        fullName:
          coerceString(record.full_name) ||
          username ||
          "Unnamed resident",
        houseId,
        houseLabel:
          coerceString(record.house_label) ||
          coerceString(record.unit_label) ||
          "No unit linked",
        isActive,
        phone: coerceString(record.phone),
        role,
        status: isActive ? "active" : "inactive",
        userId,
        username,
      };

      return resident;
    })
    .filter((item): item is CommunityUnitResident => item !== null);
}

async function loadPendingActivations(
  supabase: SupabaseServerClient,
  communityId: string,
): Promise<CommunityUnitPendingActivation[]> {
  const { data, error } = await supabase.rpc("list_resident_activation_queue_v1", {
    p_community_id: communityId,
    p_status: null,
  });

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = coerceString(record.id) || coerceString(record.queue_id);
      const status = coerceString(record.status, "pending").trim().toLowerCase();

      if (!id || !["pending", "invited", "pin_generated", "failed"].includes(status)) {
        return null;
      }

      return {
        id,
        method:
          coerceString(record.activation_method) ||
          coerceString(record.method) ||
          "not_configured",
        residentName:
          coerceString(record.resident_name) ||
          coerceString(record.full_name) ||
          "Unnamed resident",
        status,
        unitLabel:
          coerceString(record.unit_label) ||
          coerceString(record.house_label) ||
          "Unknown unit",
      };
    })
    .filter((item): item is CommunityUnitPendingActivation => item !== null);
}

async function loadUnitPasses(communityId: string): Promise<CommunityUnitPass[]> {
  try {
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("authorized_frequent_visitors")
      .select("id,house_id,full_name,expires_at,is_active,starts_at,created_at")
      .eq("community_id", communityId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) {
      return [];
    }

    const now = new Date();

    return data
      .filter((item) => item && typeof item === "object")
      .filter((item) => isCurrentlyActivePass(item as Record<string, unknown>, now))
      .map((item) => {
        const record = item as Record<string, unknown>;
        const id = coerceString(record.id);
        const houseId = coerceString(record.house_id);

        if (!id || !houseId) return null;

        return {
          expiresAt: formatDate(coerceString(record.expires_at)),
          houseId,
          holderName: coerceString(record.full_name, "Unnamed visitor"),
          id,
          passName: "Frequent visitor pass",
          residentName: "",
          status: getComputedPassStatus(record),
        };
      })
      .filter((item): item is CommunityUnitPass => item !== null);
  } catch {
    return [];
  }
}

function normalizeUnitLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function enrichUnits(
  items: CommunityUnitPreview[],
  residents: CommunityUnitResident[],
  pendingActivations: CommunityUnitPendingActivation[],
  passes: CommunityUnitPass[],
) {
  const residentsByHouseId = residents.reduce((map, resident) => {
    const current = map.get(resident.houseId) ?? [];
    current.push(resident);
    map.set(resident.houseId, current);
    return map;
  }, new Map<string, CommunityUnitResident[]>());

  const pendingByUnitLabel = pendingActivations.reduce((map, item) => {
    const key = normalizeUnitLabel(item.unitLabel);
    const current = map.get(key) ?? [];
    current.push(item);
    map.set(key, current);
    return map;
  }, new Map<string, CommunityUnitPendingActivation[]>());

  const passesByHouseId = passes.reduce((map, item) => {
    const current = map.get(item.houseId) ?? [];
    current.push(item);
    map.set(item.houseId, current);
    return map;
  }, new Map<string, CommunityUnitPass[]>());

  return items.map((unit) => {
    const unitResidents = residentsByHouseId.get(unit.id) ?? [];
    const activeResidents = unitResidents.filter((resident) => resident.isActive);
    const primaryResident =
      unitResidents.find((resident) => resident.role === "ADMIN") ??
      activeResidents[0] ??
      unitResidents[0] ??
      null;
    const activePassItems = passesByHouseId.get(unit.id) ?? [];
    const pendingActivationItems = pendingByUnitLabel.get(normalizeUnitLabel(unit.label)) ?? [];
    const residentCount = Math.max(unit.residentCount, unitResidents.length);

    return {
      ...unit,
      activePasses: Math.max(unit.activePasses, activePassItems.length),
      activeResidents: activeResidents.length,
      ownerName: primaryResident?.fullName || "No residents",
      pendingActivations: pendingActivationItems.length,
      primaryResidentName: primaryResident?.fullName || "",
      residentCount,
      residents: unitResidents,
      activePassItems,
      pendingActivationItems,
    };
  });
}

function getEmptyUnitsSummary(): CommunityUnitsSummary {
  return {
    activePasses: 0,
    activeResidents: 0,
    activeUnits: 0,
    inactiveUnits: 0,
    pendingActivations: 0,
    residentCount: 0,
    totalUnits: 0,
    unitsWithRecentAccess: 0,
  };
}

function buildUnitsSummary(items: CommunityUnitPreview[]): CommunityUnitsSummary {
  return items.reduce<CommunityUnitsSummary>(
    (acc, item) => {
      acc.totalUnits += 1;
      acc.activeResidents += item.activeResidents;
      acc.activePasses += item.activePasses;
      acc.pendingActivations += item.pendingActivations;
      acc.residentCount += item.residentCount;

      if (item.isActive) {
        acc.activeUnits += 1;
      } else {
        acc.inactiveUnits += 1;
      }

      if (item.lastAccess !== "Not available") {
        acc.unitsWithRecentAccess += 1;
      }

      return acc;
    },
    getEmptyUnitsSummary(),
  );
}

function normalizeUnitsStatusFilter(
  value: string | undefined,
): CommunityUnitsStatusFilter {
  if (
    value === "active" ||
    value === "inactive" ||
    value === "occupied" ||
    value === "no_residents" ||
    value === "pending_activation" ||
    value === "has_residents" ||
    value === "has_passes" ||
    value === "recent_access"
  ) {
    return value;
  }

  return "all";
}

function filterCommunityUnits(
  items: CommunityUnitPreview[],
  query: string,
  status: CommunityUnitsStatusFilter,
) {
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      item.label.toLowerCase().includes(normalizedQuery) ||
      item.ownerName.toLowerCase().includes(normalizedQuery) ||
      item.residents.some((resident) =>
        [
          resident.fullName,
          resident.account,
          resident.email,
          resident.username,
          resident.phone,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ) ||
      item.pendingActivationItems.some((activation) =>
        activation.residentName.toLowerCase().includes(normalizedQuery),
      );

    if (!matchesQuery) {
      return false;
    }

    switch (status) {
      case "active":
        return item.isActive;
      case "inactive":
        return !item.isActive;
      case "occupied":
      case "has_residents":
        return item.residentCount > 0;
      case "no_residents":
        return item.residentCount === 0;
      case "pending_activation":
        return item.pendingActivations > 0;
      case "has_passes":
        return item.activePasses > 0;
      case "recent_access":
        return item.lastAccess !== "Not available";
      default:
        return true;
    }
  });
}

async function loadFacilitiesPreview(
  supabase: SupabaseServerClient,
  communityId: string,
): Promise<CommunityDetailPreviews["facilities"]> {
  try {
    const [{ data: settingsData, error: settingsError }, { data, error }] =
      await Promise.all([
        supabase
          .from("community_settings")
          .select("allow_reservations")
          .eq("community_id", communityId)
          .maybeSingle(),
        supabase
          .from("community_facilities")
          .select(
            "id,name,is_active,opening_time,closing_time,slot_minutes,price_per_slot,currency_code,created_at",
          )
          .eq("community_id", communityId)
          .order("created_at", { ascending: false }),
      ]);

    if (settingsError) {
      return {
        ...buildUnavailableResult<CommunityFacilityPreview>(settingsError.message),
        activeCount: 0,
      };
    }

    const allowReservations =
      settingsData?.allow_reservations === undefined
        ? true
        : coerceBoolean(settingsData.allow_reservations);

    if (error) {
      return {
        ...buildUnavailableResult<CommunityFacilityPreview>(error.message),
        activeCount: 0,
      };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        activeCount: 0,
        items: [],
        state: allowReservations ? "empty" : "disabled",
        total: 0,
      };
    }

    const items = data
      .map((item) => {
        const record = item as Record<string, unknown>;
        const name =
          coerceString(record.name) ||
          coerceString(record.facility_name) ||
          "Unnamed facility";
        const id =
          coerceString(record.facility_id) ||
          coerceString(record.id) ||
          makePreviewId(name, coerceString(record.opens_at));
        const rawPrice =
          coerceNumber(record.price_per_slot) ||
          coerceNumber(record.slot_price) ||
          coerceNumber(record.price);
        const currency =
          coerceString(record.currency) ||
          coerceString(record.currency_code) ||
          "USD";

        return {
          closesAt: formatTime(
            coerceString(record.closes_at) ||
              coerceString(record.closing_time) ||
              coerceString(record.close_time) ||
              coerceString(record.end_time),
          ),
          currency,
          id,
          isActive:
            record.is_active === undefined
              ? true
              : coerceBoolean(record.is_active),
          name,
          opensAt: formatTime(
            coerceString(record.opens_at) ||
              coerceString(record.opening_time) ||
              coerceString(record.open_time) ||
              coerceString(record.start_time),
          ),
          pricePerSlot: rawPrice > 0 ? `${rawPrice} ${currency}` : "Free",
          slotMinutes:
            coerceNumber(record.slot_minutes) ||
            coerceNumber(record.slot_duration_minutes) ||
            coerceNumber(record.duration_minutes),
        };
      })
      .filter((item) => item.id);

    return {
      activeCount: items.filter((item) => item.isActive).length,
      items: items.slice(0, PREVIEW_LIMIT),
      state: items.length > 0 ? "live" : "empty",
      total: items.length,
    };
  } catch (error) {
    return {
      ...buildUnavailableResult<CommunityFacilityPreview>(
        error instanceof Error ? error.message : "Preview unavailable",
      ),
      activeCount: 0,
    };
  }
}

async function loadMessagesPreview(
  supabase: SupabaseServerClient,
  communityId: string,
  allowMessages: boolean,
): Promise<CommunityDetailPreviews["messages"]> {
  if (!allowMessages) {
    return {
      items: [],
      state: "disabled",
      total: 0,
    };
  }

  try {
    const { data, error } = await supabase.rpc("list_community_messages", {
      p_community_id: communityId,
      p_limit: PREVIEW_LIMIT,
      p_offset: 0,
    });

    if (error) {
      return buildUnavailableResult<CommunityMessagePreview>(error.message);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        items: [],
        state: "empty",
        total: 0,
      };
    }

    const items = data
      .map((item) => {
        const record = item as Record<string, unknown>;
        const title =
          coerceString(record.title) ||
          coerceString(record.subject) ||
          "Untitled message";
        const publishedAtRaw =
          coerceString(record.published_at) ||
          coerceString(record.sent_at) ||
          coerceString(record.created_at);
        const sourceType = formatSourceType(
          coerceString(record.source_type) ||
            coerceString(record.message_type) ||
            coerceString(record.source),
        );
        const id =
          coerceString(record.message_id) ||
          coerceString(record.id) ||
          makePreviewId(title, publishedAtRaw, sourceType);

        return {
          expiresAt: formatDate(
            coerceString(record.expires_at) ||
              coerceString(record.expires_on) ||
              coerceString(record.expiration_date),
          ),
          id,
          publishedAt: formatDateTime(publishedAtRaw),
          sourceType,
          title,
        };
      })
      .filter((item) => item.id);

    return {
      items,
      state: items.length > 0 ? "live" : "empty",
      total: items.length,
    };
  } catch (error) {
    return buildUnavailableResult<CommunityMessagePreview>(
      error instanceof Error ? error.message : "Preview unavailable",
    );
  }
}

export async function getCommunityDetailPreviews(
  communityId: string,
  options: PreviewOptions,
): Promise<CommunityDetailPreviews> {
  await requireSuperadmin();

  const supabase = await createClient();
  const [users, units, facilities, messages] = await Promise.all([
    loadUsersPreview(supabase, communityId),
    loadUnitsPreview(supabase, communityId),
    loadFacilitiesPreview(supabase, communityId),
    loadMessagesPreview(supabase, communityId, options.allowMessages),
  ]);

  return {
    facilities,
    messages,
    units,
    users,
  };
}

export async function getCommunityUnitsPageData(input: {
  communityId: string;
  q?: string;
  status?: string;
}): Promise<CommunityUnitsPageData> {
  await requireSuperadmin();

  const query = input.q?.trim() ?? "";
  const status = normalizeUnitsStatusFilter(input.status);
  const supabase = await createClient();
  const [units, residents, pendingActivations, passes, houses] = await Promise.all([
    loadUnitsPreview(supabase, input.communityId),
    loadUnitResidents(supabase, input.communityId),
    loadPendingActivations(supabase, input.communityId),
    loadUnitPasses(input.communityId),
    loadHouseOptions(supabase, input.communityId),
  ]);
  const items =
    units.state === "live"
      ? enrichUnits(units.items, residents, pendingActivations, passes)
      : [];
  const filteredItems = filterCommunityUnits(items, query, status);

  return {
    filteredItems,
    houses,
    items,
    query,
    state: units.state,
    status,
    summary: buildUnitsSummary(items),
    totalMatching: filteredItems.length,
  };
}

export async function getCommunityUnitDetailPageData(
  communityId: string,
  unitId: string,
): Promise<CommunityUnitDetailPageData> {
  const community = await getCommunityWithProgress(communityId);

  if (!community) {
    return {
      community: null,
      houses: [],
      state: "empty",
      unit: null,
    };
  }

  const supabase = await createClient();
  const [unitsData, houses] = await Promise.all([
    getCommunityUnitsPageData({
      communityId: community.id,
    }),
    loadHouseOptions(supabase, community.id),
  ]);

  if (unitsData.state === "unavailable") {
    return {
      community,
      houses,
      state: "unavailable",
      unit: null,
    };
  }

  return {
    community,
    houses,
    state: unitsData.state,
    unit: unitsData.items.find((item) => item.id === unitId) ?? null,
  };
}
