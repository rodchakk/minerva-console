import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
} from "@/lib/supabase/utils";
import {
  OUTRIDER_FILE_CATEGORIES,
  OUTRIDER_SECTIONS,
  getOutriderProgressPercent,
  isOutriderFileCategory,
  isOutriderStatus,
  type OutriderAdministrator,
  type OutriderFileRecord,
  type OutriderSection,
  type OutriderStatus,
  type OutriderUnitType,
} from "@/features/entry/outrider/model";

export type OutriderCommunityOption = {
  city: string;
  id: string;
  name: string;
};

export type OutriderListItem = {
  approvedAt: string | null;
  attachmentCount: number;
  communityCity: string;
  communityId: string;
  communityName: string;
  completedSections: OutriderSection[];
  contactName: string | null;
  createdAt: string;
  id: string;
  progressPercent: number;
  reviewNote: string | null;
  status: OutriderStatus;
  submittedAt: string | null;
  updatedAt: string;
};

export type OutriderEvent = {
  actorType: string;
  createdAt: string;
  eventType: string;
  id: string;
  metadata: Record<string, unknown>;
};

export type OutriderDetail = OutriderListItem & {
  availableInformation: string[];
  contactEmail: string | null;
  contactPhone: string | null;
  destinationNames: string[];
  events: OutriderEvent[];
  files: OutriderFileRecord[];
  hasDestinations: boolean | null;
  hasInactiveUnits: boolean | null;
  inactiveUnitNotes: string | null;
  initialAdminCount: number | null;
  initialAdmins: OutriderAdministrator[];
  otherUnitType: string | null;
  securityStaffCount: number | null;
  securityStaffNotes: string | null;
  unitNamingExample: string | null;
  unitTypes: OutriderUnitType[];
};

type Row = Record<string, unknown>;

const OUTRIDER_STATUS_PRIORITY: Record<OutriderStatus, number> = {
  ready_for_review: 0,
  needs_information: 1,
  in_progress: 2,
  not_started: 3,
  approved: 4,
};

function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

function nullableString(value: unknown) {
  const text = coerceString(value).trim();
  return text || null;
}

function nullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function administratorArray(value: unknown): OutriderAdministrator[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 25).map((item) => {
    const record =
      item && typeof item === "object" && !Array.isArray(item)
        ? (item as Row)
        : {};
    return {
      email: nullableString(record.email),
      name: nullableString(record.name),
      phone: nullableString(record.phone),
      unit: nullableString(record.unit),
    };
  });
}

function sectionArray(value: unknown) {
  return stringArray(value).filter((section): section is OutriderSection =>
    OUTRIDER_SECTIONS.includes(section as OutriderSection),
  );
}

function unitTypeArray(value: unknown) {
  return stringArray(value).filter((unitType): unitType is OutriderUnitType =>
    ["casas", "apartamentos", "condominios", "oficinas", "otro"].includes(
      unitType,
    ),
  );
}

function statusFrom(value: unknown): OutriderStatus {
  const status = coerceString(value);
  return isOutriderStatus(status) ? status : "not_started";
}

function compareOperationalPriority(
  left: OutriderListItem,
  right: OutriderListItem,
) {
  const statusDifference =
    OUTRIDER_STATUS_PRIORITY[left.status] - OUTRIDER_STATUS_PRIORITY[right.status];
  if (statusDifference !== 0) return statusDifference;

  const rightUpdated = new Date(right.updatedAt).getTime();
  const leftUpdated = new Date(left.updatedAt).getTime();
  if (Number.isFinite(rightUpdated) && Number.isFinite(leftUpdated)) {
    return rightUpdated - leftUpdated;
  }

  return left.communityName.localeCompare(right.communityName);
}

function communityById(
  communities: Map<string, OutriderCommunityOption>,
  communityId: string,
) {
  return communities.get(communityId) ?? null;
}

function mapListItem(
  row: Row,
  communities: Map<string, OutriderCommunityOption>,
  attachmentCount: number,
): OutriderListItem | null {
  const id = coerceString(row.id);
  const rawCommunityId = nullableString(row.community_id);
  const createdAt = coerceString(row.created_at);
  const updatedAt = coerceString(row.updated_at);

  if (!id || !createdAt || !updatedAt) return null;

  const linkedCommunity = rawCommunityId
    ? communityById(communities, rawCommunityId)
    : null;
  const communityName =
    linkedCommunity?.name ?? nullableString(row.community_name) ?? "Untitled community";
  const communityCity =
    linkedCommunity?.city ?? nullableString(row.community_city) ?? "Not set";
  const completedSections = sectionArray(row.completed_sections);

  return {
    approvedAt: nullableString(row.approved_at),
    attachmentCount,
    communityCity,
    communityId: rawCommunityId ?? "",
    communityName,
    completedSections,
    contactName: nullableString(row.contact_name),
    createdAt,
    id,
    progressPercent: getOutriderProgressPercent(completedSections),
    reviewNote: nullableString(row.review_note),
    status: statusFrom(row.status),
    submittedAt: nullableString(row.submitted_at),
    updatedAt,
  };
}

function mapFile(row: Row): OutriderFileRecord | null {
  const id = coerceString(row.id);
  const category = coerceString(row.category);
  const originalFilename = coerceString(row.original_filename);
  const storagePath = coerceString(row.storage_path);

  if (
    !id ||
    !originalFilename ||
    !storagePath ||
    !isOutriderFileCategory(category)
  ) {
    return null;
  }

  return {
    byteSize: coerceNumber(row.byte_size),
    category,
    createdAt: coerceString(row.uploaded_at) || coerceString(row.created_at),
    id,
    mimeType: coerceString(row.mime_type),
    originalFilename,
    storagePath,
  };
}

async function loadCommunities(ids?: string[]) {
  const supabase = createAdminClient();
  let query = supabase.from("communities").select("id,name,city,is_active");

  if (ids && ids.length > 0) query = query.in("id", ids);

  const { data } = await query;

  return new Map(
    asRows(data).map((row) => [
      coerceString(row.id),
      {
        city: coerceString(row.city, "Not set"),
        id: coerceString(row.id),
        name: coerceString(row.name, "Untitled community"),
      },
    ]),
  );
}

export async function listOutriderSessions(): Promise<OutriderListItem[]> {
  await requireSuperadmin();

  const supabase = createAdminClient();
  const [{ data: sessionData, error }, { data: fileData }] = await Promise.all([
    supabase
      .from("community_outrider_sessions")
      .select(
        "id,community_id,community_name,community_city,status,completed_sections,contact_name,review_note,created_at,updated_at,submitted_at,approved_at",
      )
      .order("last_activity_at", { ascending: false }),
    supabase.from("community_outrider_files").select("outrider_id"),
  ]);

  if (error) return [];

  const rows = asRows(sessionData);
  const communityIds = rows
    .map((row) => nullableString(row.community_id))
    .filter((value): value is string => Boolean(value));
  const communities = communityIds.length
    ? await loadCommunities(communityIds)
    : new Map<string, OutriderCommunityOption>();
  const attachmentCounts = new Map<string, number>();

  for (const file of asRows(fileData)) {
    const outriderId = coerceString(file.outrider_id);
    if (!outriderId) continue;
    attachmentCounts.set(outriderId, (attachmentCounts.get(outriderId) ?? 0) + 1);
  }

  return rows
    .map((row) =>
      mapListItem(row, communities, attachmentCounts.get(coerceString(row.id)) ?? 0),
    )
    .filter((item): item is OutriderListItem => item !== null)
    .sort(compareOperationalPriority);
}

export async function getOutriderAttentionCount() {
  await requireSuperadmin();

  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("community_outrider_sessions")
    .select("id", { count: "exact", head: true })
    .in("status", [
      "not_started",
      "in_progress",
      "ready_for_review",
      "needs_information",
    ]);

  if (error) return null;
  return count ?? 0;
}

export async function listCommunitiesAvailableForOutrider(): Promise<
  OutriderCommunityOption[]
> {
  await requireSuperadmin();

  const supabase = createAdminClient();
  const [{ data: communityData }, { data: sessionData }] = await Promise.all([
    supabase
      .from("communities")
      .select("id,name,city,is_active")
      .order("name", { ascending: true }),
    supabase.from("community_outrider_sessions").select("community_id"),
  ]);

  const reservedCommunityIds = new Set(
    asRows(sessionData)
      .map((row) => nullableString(row.community_id))
      .filter((value): value is string => Boolean(value)),
  );

  return asRows(communityData)
    .filter((row) => coerceBoolean(row.is_active))
    .map((row) => ({
      city: coerceString(row.city, "Not set"),
      id: coerceString(row.id),
      name: coerceString(row.name, "Untitled community"),
    }))
    .filter((community) => community.id && !reservedCommunityIds.has(community.id));
}

export async function getOutriderDetail(
  outriderId: string,
): Promise<OutriderDetail | null> {
  await requireSuperadmin();

  const supabase = createAdminClient();
  const [{ data: sessionData, error }, { data: fileData }, { data: eventData }] =
    await Promise.all([
      supabase
        .from("community_outrider_sessions")
        .select("*")
        .eq("id", outriderId)
        .maybeSingle(),
      supabase
        .from("community_outrider_files")
        .select("*")
        .eq("outrider_id", outriderId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("community_outrider_events")
        .select("id,event_type,actor_type,metadata,created_at")
        .eq("outrider_id", outriderId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  if (error || !sessionData) return null;

  const row = sessionData as Row;
  const communityId = nullableString(row.community_id);
  const communities = communityId
    ? await loadCommunities([communityId])
    : new Map<string, OutriderCommunityOption>();
  const files = asRows(fileData)
    .map(mapFile)
    .filter((file): file is OutriderFileRecord => file !== null);
  const listItem = mapListItem(row, communities, files.length);

  if (!listItem) return null;

  return {
    ...listItem,
    availableInformation: OUTRIDER_FILE_CATEGORIES.filter((category) =>
      files.some((file) => file.category === category),
    ),
    contactEmail: nullableString(row.contact_email),
    contactPhone: nullableString(row.contact_phone),
    destinationNames: stringArray(row.destinations),
    events: asRows(eventData).map((event) => ({
      actorType: coerceString(event.actor_type, "system"),
      createdAt: coerceString(event.created_at),
      eventType: coerceString(event.event_type, "operational_update"),
      id: coerceString(event.id),
      metadata:
        event.metadata && typeof event.metadata === "object"
          ? (event.metadata as Record<string, unknown>)
          : {},
    })),
    files,
    hasDestinations:
      row.has_destinations === null || row.has_destinations === undefined
        ? null
        : coerceBoolean(row.has_destinations),
    hasInactiveUnits:
      row.has_inactive_units === null || row.has_inactive_units === undefined
        ? null
        : coerceBoolean(row.has_inactive_units),
    inactiveUnitNotes: nullableString(row.inactive_units_notes),
    initialAdminCount: nullableInteger(row.initial_admin_count),
    initialAdmins: administratorArray(row.initial_admins),
    otherUnitType: nullableString(row.unit_type_other),
    securityStaffCount: nullableInteger(row.security_staff_count),
    securityStaffNotes: nullableString(row.security_staff_notes),
    unitNamingExample: nullableString(row.unit_naming_example),
    unitTypes: unitTypeArray(row.unit_types),
  };
}
