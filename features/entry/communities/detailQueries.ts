import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  getCommunityWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";
import { createClient } from "@/lib/supabase/server";
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
};

export type CommunityUnitsSummary = {
  activePasses: number;
  activeResidents: number;
  activeUnits: number;
  inactiveUnits: number;
  totalUnits: number;
  unitsWithRecentAccess: number;
};

export type CommunityUnitsPageData = {
  filteredItems: CommunityUnitPreview[];
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
  allowReservations: boolean;
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
    const { data, error } = await supabase.rpc("list_community_users_admin", {
      p_community_id: communityId,
      p_include_inactive: true,
    });

    if (error) {
      return {
        ...buildUnavailableResult<CommunityUserPreview>(error.message),
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

    const items = data
      .map((item) => {
        const record = item as Record<string, unknown>;
        const fullName =
          coerceString(record.full_name) ||
          coerceString(record.name) ||
          "Unnamed user";
        const role = formatRole(coerceString(record.role));
        const contact =
          coerceString(record.email) ||
          coerceString(record.username) ||
          "No contact available";
        const houseLabel =
          coerceString(record.house_label) ||
          coerceString(record.unit_label) ||
          coerceString(record.house_name) ||
          "No unit linked";
        const id =
          coerceString(record.user_id) ||
          coerceString(record.id) ||
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

    const counts = items.reduce<CommunityUserCounts>(
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
      items: items.slice(0, PREVIEW_LIMIT),
      state: items.length > 0 ? "live" : "empty",
      total: items.length,
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

async function loadUnitsDirectory(
  supabase: SupabaseServerClient,
  communityId: string,
): Promise<CommunityDetailPreviews["units"]> {
  const result = await loadUnitsPreview(supabase, communityId);

  if (result.state !== "live") {
    return result;
  }

  return {
    ...result,
    items: result.items.slice(0, PREVIEW_LIMIT),
  };
}

function getEmptyUnitsSummary(): CommunityUnitsSummary {
  return {
    activePasses: 0,
    activeResidents: 0,
    activeUnits: 0,
    inactiveUnits: 0,
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
      item.ownerName.toLowerCase().includes(normalizedQuery);

    if (!matchesQuery) {
      return false;
    }

    switch (status) {
      case "active":
        return item.isActive;
      case "inactive":
        return !item.isActive;
      case "has_residents":
        return item.activeResidents > 0;
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
  allowReservations: boolean,
): Promise<CommunityDetailPreviews["facilities"]> {
  if (!allowReservations) {
    return {
      activeCount: 0,
      items: [],
      state: "disabled",
      total: 0,
    };
  }

  try {
    const { data, error } = await supabase.rpc(
      "superadmin_list_community_facilities",
      {
        p_community_id: communityId,
      },
    );

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
        state: "empty",
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
    loadUnitsDirectory(supabase, communityId),
    loadFacilitiesPreview(supabase, communityId, options.allowReservations),
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
  const units = await loadUnitsPreview(supabase, input.communityId);
  const items = units.state === "live" ? units.items : [];
  const filteredItems = filterCommunityUnits(items, query, status);

  return {
    filteredItems,
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
      state: "empty",
      unit: null,
    };
  }

  const unitsData = await getCommunityUnitsPageData({
    communityId: community.id,
  });

  if (unitsData.state === "unavailable") {
    return {
      community,
      state: "unavailable",
      unit: null,
    };
  }

  return {
    community,
    state: unitsData.state,
    unit: unitsData.items.find((item) => item.id === unitId) ?? null,
  };
}
