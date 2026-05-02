"use server";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceNumber,
  coerceString,
} from "@/lib/supabase/utils";

export type CreateCommunityState = {
  communityId?: string;
  communityName?: string;
  insertedFacilities?: number;
  insertedUnits?: number;
  message?: string;
  parsedResidentRows?: number;
  skippedFacilityBlank?: number;
  skippedFacilityDuplicates?: number;
  skippedBlank?: number;
  skippedDuplicates?: number;
  success?: boolean;
  usedAdvancedImport?: boolean;
};

function parseBooleanField(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function extractCommunityId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return extractCommunityId(value[0]);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      coerceString(record.community_id) ||
      coerceString(record.id) ||
      coerceString(record.p_community_id) ||
      null
    );
  }

  return null;
}

function parseUnits(rawInput: string) {
  const rawLines = rawInput.split(/\r?\n/);
  const seen = new Set<string>();
  const units: string[] = [];
  let skippedBlank = 0;
  let skippedDuplicates = 0;

  rawLines.forEach((line) => {
    const value = line.trim();
    if (!value) {
      skippedBlank += 1;
      return;
    }

    const normalized = value.toLowerCase();
    if (seen.has(normalized)) {
      skippedDuplicates += 1;
      return;
    }

    seen.add(normalized);
    units.push(value);
  });

  return { units, skippedBlank, skippedDuplicates };
}

type ParsedAdvancedUnitsPayload = {
  parsedResidentRows: number;
  skippedBlank: number;
  units: string[];
};

function parseAdvancedUnitsPayload(
  rawPayload: string,
): ParsedAdvancedUnitsPayload | null {
  if (!rawPayload.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as {
      blankRowsIgnored?: unknown;
      parsedResidentRows?: unknown;
      uniqueUnitLabels?: unknown;
    };

    const uniqueUnitLabels = Array.isArray(parsed.uniqueUnitLabels)
      ? parsed.uniqueUnitLabels
          .map((value) => String(value ?? "").trim())
          .filter((value) => value.length > 0)
      : [];

    const seen = new Set<string>();
    const units: string[] = [];

    uniqueUnitLabels.forEach((unit) => {
      const normalized = unit.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        units.push(unit);
      }
    });

    return {
      parsedResidentRows: coerceNumber(parsed.parsedResidentRows),
      skippedBlank: coerceNumber(parsed.blankRowsIgnored),
      units,
    };
  } catch {
    return null;
  }
}

function parseNamedList(values: string[]) {
  const seen = new Set<string>();
  const names: string[] = [];
  let skippedBlank = 0;
  let skippedDuplicates = 0;

  values.forEach((item) => {
    const value = item.trim();
    if (!value) {
      skippedBlank += 1;
      return;
    }

    const normalized = value.toLowerCase();
    if (seen.has(normalized)) {
      skippedDuplicates += 1;
      return;
    }

    seen.add(normalized);
    names.push(value);
  });

  return { names, skippedBlank, skippedDuplicates };
}

export async function createCommunityAction(
  _previousState: CreateCommunityState,
  formData: FormData,
): Promise<CreateCommunityState> {
  await requireSuperadmin();

  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const unitLabel = String(formData.get("unit_label") ?? "Casas").trim() || "Casas";
  const allowFrequentAccess = parseBooleanField(
    formData.get("allow_frequent_access"),
  );
  const allowReservations = parseBooleanField(
    formData.get("allow_reservations"),
  );
  const allowMessages = parseBooleanField(formData.get("allow_messages"));
  const unitsMode = String(formData.get("units_mode") ?? "simple");
  const unitsInput = String(formData.get("units_input") ?? "");
  const advancedUnitsPayload = String(formData.get("advanced_units_payload") ?? "");
  const facilityInput = formData
    .getAll("facility_name")
    .map((value) => String(value ?? ""));

  if (!name) {
    return { message: "Community name is required." };
  }

  const supabase = await createClient();
  const { data: communityData, error: communityError } = await supabase.rpc(
    "create_community_v1",
    {
      p_allow_frequent_access: allowFrequentAccess,
      p_allow_messages: allowMessages,
      p_allow_reservations: allowReservations,
      p_city: city,
      p_name: name,
      p_unit_label: unitLabel,
    },
  );

  if (communityError) {
    return { message: communityError.message };
  }

  const communityId = extractCommunityId(communityData);

  if (!communityId) {
    return {
      message: "The community was created, but the new community ID was not returned.",
    };
  }

  const parsedAdvancedUnits =
    unitsMode === "advanced"
      ? parseAdvancedUnitsPayload(advancedUnitsPayload)
      : null;

  if (unitsMode === "advanced" && !parsedAdvancedUnits) {
    return {
      message:
        "The advanced import preview is missing or invalid. Parse the file again before creating the community.",
    };
  }

  const parsedUnits = parsedAdvancedUnits
    ? {
        skippedBlank: parsedAdvancedUnits.skippedBlank,
        skippedDuplicates: 0,
        units: parsedAdvancedUnits.units,
      }
    : parseUnits(unitsInput);
  const parsedFacilities = parseNamedList(facilityInput);
  let insertedUnits = 0;
  let insertedFacilities = 0;
  const parsedResidentRows = parsedAdvancedUnits?.parsedResidentRows || 0;
  let skippedFacilityDuplicates = parsedFacilities.skippedDuplicates;
  let skippedFacilityBlank = parsedFacilities.skippedBlank;
  let skippedDuplicates = parsedUnits.skippedDuplicates;
  let skippedBlank = parsedUnits.skippedBlank;

  if (parsedUnits.units.length > 0) {
    const { data: bulkData, error: bulkError } = await supabase.rpc(
      "create_houses_bulk_v2",
      {
        p_community_id: communityId,
        p_houses: parsedUnits.units,
      },
    );

    if (bulkError) {
      return {
        message: `Community created, but units import failed: ${bulkError.message}`,
      };
    }

    const bulkRecord = (Array.isArray(bulkData)
      ? bulkData[0]
      : bulkData ?? {}) as Record<string, unknown>;

    insertedUnits =
      coerceNumber(bulkRecord.inserted_count) || parsedUnits.units.length;
    skippedDuplicates += coerceNumber(bulkRecord.skipped_duplicates);
    skippedBlank += coerceNumber(bulkRecord.skipped_blank);
  }

  if (allowReservations && parsedFacilities.names.length > 0) {
    const { data: facilitiesData, error: facilitiesError } = await supabase.rpc(
      "create_community_facilities_bulk_v1",
      {
        p_community_id: communityId,
        p_facilities: parsedFacilities.names,
      },
    );

    if (facilitiesError) {
      return {
        message: `Community created, but facilities import failed: ${facilitiesError.message}`,
      };
    }

    const facilitiesRecord = (Array.isArray(facilitiesData)
      ? facilitiesData[0]
      : facilitiesData ?? {}) as Record<string, unknown>;

    insertedFacilities =
      coerceNumber(facilitiesRecord.inserted_count) ||
      parsedFacilities.names.length;
    skippedFacilityDuplicates += coerceNumber(
      facilitiesRecord.skipped_duplicates_count,
    );
    skippedFacilityBlank += coerceNumber(
      facilitiesRecord.skipped_blank_count,
    );
  }

  return {
    communityId,
    communityName: name,
    insertedFacilities,
    insertedUnits,
    message:
      "Community created successfully with onboarding data for units and reservable areas.",
    parsedResidentRows,
    skippedFacilityBlank,
    skippedFacilityDuplicates,
    skippedBlank,
    skippedDuplicates,
    success: true,
    usedAdvancedImport: Boolean(parsedAdvancedUnits),
  };
}
