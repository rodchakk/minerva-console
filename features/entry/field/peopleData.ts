import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  type FieldActivationRow,
  type FieldReadState,
  type FieldResident,
  type FieldUnit,
  getResidentIdentity,
} from "@/features/entry/field/peopleModel";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceString,
} from "@/lib/supabase/utils";

export type FieldPeopleCommunity = {
  city: string;
  id: string;
  name: string;
  unitLabel: string;
};

export type FieldPeopleResult<T> = {
  error?: string;
  items: T[];
  state: FieldReadState;
};

export type FieldPeoplePageData = {
  activation: FieldPeopleResult<FieldActivationRow>;
  community: FieldPeopleCommunity | null;
  residents: FieldPeopleResult<FieldResident>;
  units: FieldPeopleResult<FieldUnit>;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function normalizeRole(value: string): FieldResident["role"] | null {
  const normalized = value.trim().toUpperCase();

  if (normalized === "RESIDENT" || normalized === "UNASSIGNED") {
    return normalized;
  }

  return null;
}

function formatFallback(value: string, fallback: string) {
  const trimmed = value.trim();
  return trimmed && trimmed !== "-" && trimmed !== "\u2014" ? trimmed : fallback;
}

function mapResident(item: unknown): FieldResident | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const role = normalizeRole(coerceString(record.role));
  const userId = coerceString(record.user_id) || coerceString(record.id);

  if (!role || !userId) {
    return null;
  }

  const email = formatFallback(coerceString(record.email), "");
  const username = coerceString(record.username);
  const fullName = formatFallback(coerceString(record.full_name), "Unnamed resident");
  const houseLabel = formatFallback(
    coerceString(record.house_label) || coerceString(record.unit_label),
    "No unit linked",
  );
  const isActive = coerceBoolean(record.is_active);

  return {
    accountState: isActive ? "Active" : "Inactive",
    authType: formatFallback(coerceString(record.auth_type), "unknown"),
    email,
    fullName,
    houseId: coerceString(record.house_id) || coerceString(record.unit_id),
    houseLabel,
    identity: getResidentIdentity({ email, username }),
    isActive,
    phone: formatFallback(coerceString(record.phone), ""),
    role,
    userId,
    username,
  };
}

function mapActivationRow(item: unknown): FieldActivationRow | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const id = coerceString(record.id) || coerceString(record.queue_id);

  if (!id) {
    return null;
  }

  const email = formatFallback(coerceString(record.email), "");
  const phone = formatFallback(coerceString(record.phone), "");
  const suggestedUsername =
    formatFallback(coerceString(record.suggested_username), "");
  const identityHint = email || phone || suggestedUsername || "No identity hint";

  return {
    email,
    id,
    identityHint,
    method:
      formatFallback(
        coerceString(record.activation_method) || coerceString(record.method),
        "not configured",
      ),
    phone,
    resident:
      formatFallback(
        coerceString(record.resident_name) || coerceString(record.full_name),
        "Unnamed resident",
      ),
    status: formatFallback(coerceString(record.status), "pending"),
    suggestedUsername,
    unit:
      formatFallback(
        coerceString(record.unit_label) ||
          coerceString(record.house_label) ||
          coerceString(record.house_name),
        "No unit linked",
      ),
  };
}

async function loadCommunity(
  supabase: SupabaseServerClient,
  communityId: string,
) {
  const { data, error } = await supabase
    .from("communities")
    .select("id,name,city,unit_label")
    .eq("id", communityId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    city: coerceString(data.city),
    id: coerceString(data.id),
    name: coerceString(data.name, "Untitled community"),
    unitLabel: coerceString(data.unit_label, "Units"),
  };
}

async function loadResidents(
  supabase: SupabaseServerClient,
  communityId: string,
): Promise<FieldPeopleResult<FieldResident>> {
  const { data, error } = await supabase.rpc("sa_list_community_users", {
    p_community_id: communityId,
    p_include_inactive: true,
  });

  if (error) {
    return {
      error: error.message,
      items: [],
      state: "unavailable",
    };
  }

  const items = Array.isArray(data)
    ? data
        .map(mapResident)
        .filter((resident): resident is FieldResident => resident !== null)
    : [];

  return {
    items,
    state: "ready",
  };
}

async function loadUnits(
  supabase: SupabaseServerClient,
  communityId: string,
  residents: FieldResident[],
): Promise<FieldPeopleResult<FieldUnit>> {
  const { data, error } = await supabase
    .from("houses")
    .select("id,house_label,is_active")
    .eq("community_id", communityId)
    .order("house_label", { ascending: true });

  if (error) {
    return {
      error: error.message,
      items: [],
      state: "unavailable",
    };
  }

  const residentCountsByUnit = residents.reduce((counts, resident) => {
    if (!resident.houseId) {
      return counts;
    }

    counts.set(resident.houseId, (counts.get(resident.houseId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  const items = Array.isArray(data)
    ? data
        .map((item) => {
          const id = coerceString(item.id);
          if (!id) return null;

          return {
            id,
            isActive:
              item.is_active === undefined ? true : coerceBoolean(item.is_active),
            label: formatFallback(coerceString(item.house_label), "Unnamed unit"),
            residentCount: residentCountsByUnit.get(id) ?? 0,
          };
        })
        .filter((unit): unit is FieldUnit => unit !== null)
    : [];

  return {
    items,
    state: "ready",
  };
}

async function loadActivation(
  supabase: SupabaseServerClient,
  communityId: string,
): Promise<FieldPeopleResult<FieldActivationRow>> {
  const { data, error } = await supabase.rpc("list_resident_activation_queue_v1", {
    p_community_id: communityId,
    p_status: null,
  });

  if (error) {
    return {
      error: error.message,
      items: [],
      state: "unavailable",
    };
  }

  const items = Array.isArray(data)
    ? data
        .map(mapActivationRow)
        .filter((row): row is FieldActivationRow => row !== null)
    : [];

  return {
    items,
    state: "ready",
  };
}

export async function getFieldPeoplePageData(
  communityId: string,
): Promise<FieldPeoplePageData> {
  await requireSuperadmin();

  const supabase = await createClient();
  const [community, residents] = await Promise.all([
    loadCommunity(supabase, communityId),
    loadResidents(supabase, communityId),
  ]);
  const safeResidents = residents.state === "ready" ? residents.items : [];
  const [units, activation] = await Promise.all([
    loadUnits(supabase, communityId, safeResidents),
    loadActivation(supabase, communityId),
  ]);

  return {
    activation,
    community,
    residents,
    units,
  };
}

export async function getFieldResidentDetailData(
  communityId: string,
  userId: string,
) {
  const data = await getFieldPeoplePageData(communityId);
  const resident =
    data.residents.state === "ready"
      ? data.residents.items.find((item) => item.userId === userId) ?? null
      : null;

  return {
    ...data,
    resident,
  };
}

export async function getFieldUnitDetailData(
  communityId: string,
  unitId: string,
) {
  const data = await getFieldPeoplePageData(communityId);
  const unit =
    data.units.state === "ready"
      ? data.units.items.find((item) => item.id === unitId) ?? null
      : null;
  const residents =
    data.residents.state === "ready"
      ? data.residents.items.filter((resident) => resident.houseId === unitId)
      : [];

  return {
    ...data,
    residentsForUnit: residents,
    unit,
  };
}

export async function getFieldActivationDetailData(
  communityId: string,
  queueId: string,
) {
  const data = await getFieldPeoplePageData(communityId);
  const activationRow =
    data.activation.state === "ready"
      ? data.activation.items.find((item) => item.id === queueId) ?? null
      : null;

  return {
    ...data,
    activationRow,
  };
}
