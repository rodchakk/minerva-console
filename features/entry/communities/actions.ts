"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  buildActivationQueueRows,
  parseActivationQueueImportResult,
} from "@/features/entry/activation/actions";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceNumber,
  coerceString,
} from "@/lib/supabase/utils";

export type CreateCommunityState = {
  activationFailed?: number;
  activationInserted?: number;
  activationRowsWithMissingHouse?: number;
  activationSkipped?: number;
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
  residentQueueRows: Array<{
    email: string;
    isOwner: string;
    phone: string;
    rawData: Record<string, unknown>;
    residentName: string;
    unitLabel: string;
  }>;
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
      rows?: unknown;
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

    const residentQueueRows = Array.isArray(parsed.rows)
      ? parsed.rows
          .map((item) => {
            const record = item as Record<string, unknown>;

            return {
              email: coerceString(record.email),
              isOwner: coerceString(record.isOwner),
              phone: coerceString(record.phone),
              rawData:
                record.rawData && typeof record.rawData === "object"
                  ? (record.rawData as Record<string, unknown>)
                  : {},
              residentName: coerceString(record.residentName),
              unitLabel: coerceString(record.unitLabel),
            };
          })
          .filter(
            (item) =>
              item.unitLabel.length > 0 ||
              item.residentName.length > 0 ||
              item.phone.length > 0 ||
              item.email.length > 0,
          )
      : [];

    return {
      parsedResidentRows: coerceNumber(parsed.parsedResidentRows),
      residentQueueRows,
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

export async function addCommunityUnitsAction(formData: FormData) {
  await requireSuperadmin();

  const communityId = String(formData.get("community_id") ?? "").trim();
  const unitsInput = String(formData.get("units_input") ?? "");
  const parsedUnits = parseUnits(unitsInput);

  if (!communityId) {
    redirect("/products/entry/communities");
  }

  if (parsedUnits.units.length === 0) {
    redirect(`/products/entry/communities/${communityId}/units/new?error=empty`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_houses_bulk_v2", {
    p_community_id: communityId,
    p_houses: parsedUnits.units,
  });

  if (error) {
    redirect(
      `/products/entry/communities/${communityId}/units/new?error=import_failed`,
    );
  }

  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/units`);
  redirect(`/products/entry/communities/${communityId}?units_added=1`);
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
  const activationRows = parsedAdvancedUnits
    ? buildActivationQueueRows(parsedAdvancedUnits.residentQueueRows)
    : [];
  let insertedUnits = 0;
  let insertedFacilities = 0;
  let activationInserted = 0;
  let activationSkipped = 0;
  let activationFailed = 0;
  let activationRowsWithMissingHouse = 0;
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

  if (activationRows.length > 0) {
    const { data: activationData, error: activationError } = await supabase.rpc(
      "create_resident_activation_queue_bulk_v1",
      {
        p_community_id: communityId,
        p_rows: activationRows,
      },
    );

    if (activationError) {
      activationFailed = activationRows.length;
    } else {
      const activationResult = parseActivationQueueImportResult(
        activationData,
        activationRows.length,
      );

      activationInserted = activationResult.inserted;
      activationSkipped = activationResult.skipped;
      activationFailed = activationResult.failed;
      activationRowsWithMissingHouse = activationResult.rowsWithMissingHouse;
    }
  }

  return {
    activationFailed,
    activationInserted,
    activationRowsWithMissingHouse,
    activationSkipped,
    communityId,
    communityName: name,
    insertedFacilities,
    insertedUnits,
    message:
      activationRows.length > 0
        ? "Community created successfully. Resident activation records were prepared without creating active users."
        : "Community created successfully with onboarding data for units and reservable areas.",
    parsedResidentRows,
    skippedFacilityBlank,
    skippedFacilityDuplicates,
    skippedBlank,
    skippedDuplicates,
    success: true,
    usedAdvancedImport: Boolean(parsedAdvancedUnits),
  };
}
