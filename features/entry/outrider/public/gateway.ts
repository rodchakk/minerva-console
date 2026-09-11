import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  isOutriderFileCategory,
  isOutriderStatus,
  normalizeOutriderSavePayload,
  type OutriderAdministrator,
  type OutriderFileCategory,
  type OutriderSavePayload,
  type OutriderSection,
  type OutriderUnitType,
  type PublicOutriderResult,
} from "@/features/entry/outrider/model";

type RpcRecord = Record<string, unknown>;

function asRecord(value: unknown): RpcRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RpcRecord)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  const text = asString(value).trim();
  return text || null;
}

function asNullableInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function asOutriderSections(value: unknown) {
  const sections = asStringArray(value);
  return sections.filter((section): section is OutriderSection =>
    ["units", "destinations", "inactive_units", "available_information", "contact"].includes(
      section,
    ),
  );
}

function asOutriderUnitTypes(value: unknown) {
  return asStringArray(value).filter((unitType): unitType is OutriderUnitType =>
    ["casas", "apartamentos", "condominios", "oficinas", "otro"].includes(
      unitType,
    ),
  );
}

function asAdministrators(value: unknown): OutriderAdministrator[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 25).map((item) => {
    const record = asRecord(item);
    return {
      email: asNullableString(record.email),
      name: asNullableString(record.name),
      phone: asNullableString(record.phone),
      unit: asNullableString(record.unit),
    };
  });
}

function mapPublicOutrider(data: unknown): PublicOutriderResult {
  const root = asRecord(data);
  if (root.available !== true) return { available: false };

  const community = asRecord(root.community);
  const outrider = asRecord(root.outrider);
  const status = asString(outrider.status);
  const id = asString(outrider.id);
  const communityId = asString(community.id);
  const communityName = asString(community.name);

  if (!id || !communityName || !isOutriderStatus(status)) {
    return { available: false };
  }

  const files = Array.isArray(root.files) ? root.files : [];
  const mappedFiles = files
    .map((file) => {
      const record = asRecord(file);
      const category = asString(record.category);
      const fileId = asString(record.id);
      const filename = asString(record.original_filename);

      if (!fileId || !filename || !isOutriderFileCategory(category)) {
        return null;
      }

      return {
        byteSize: Number(record.byte_size ?? 0),
        category,
        createdAt: asString(record.uploaded_at) || asString(record.created_at),
        id: fileId,
        mimeType: asString(record.mime_type),
        originalFilename: filename,
        storagePath: asString(record.storage_path),
      };
    })
    .filter((file): file is NonNullable<typeof file> => file !== null);

  return {
    available: true,
    communityId,
    communityName,
    completedSections: asOutriderSections(outrider.completed_sections),
    draft: {
      availableInformation: Array.from(
        new Set(mappedFiles.map((file) => file.category)),
      ),
      contactEmail: asNullableString(outrider.contact_email),
      contactName: asNullableString(outrider.contact_name),
      contactPhone: asNullableString(outrider.contact_phone),
      contacts: (function () {
        const raw = Array.isArray(outrider.contacts)
          ? outrider.contacts.slice(0, 3).map((item) => {
              const record = asRecord(item);
              return {
                email: asNullableString(record.email),
                name: asNullableString(record.name),
                phone: asNullableString(record.phone),
              };
            })
          : [];
        if (raw.length > 0) return raw;
        const name = asNullableString(outrider.contact_name);
        const phone = asNullableString(outrider.contact_phone);
        const email = asNullableString(outrider.contact_email);
        if (name || phone || email) {
          return [{ email, name, phone }];
        }
        return [];
      })(),
      destinationNames: asStringArray(outrider.destinations),
      establishmentNames: asStringArray(outrider.establishments),
      hasDestinations: asBoolean(outrider.has_destinations),
      hasEstablishments: asBoolean(outrider.has_establishments),
      hasInactiveUnits: asBoolean(outrider.has_inactive_units),
      inactiveUnitNotes: asNullableString(outrider.inactive_units_notes),
      initialAdminCount: asNullableInteger(outrider.initial_admin_count),
      initialAdmins: asAdministrators(outrider.initial_admins),
      otherUnitType: asNullableString(outrider.unit_type_other),
      securityStaffCount: asNullableInteger(outrider.security_staff_count),
      securityStaffNames: asStringArray(outrider.security_staff_names),
      securityStaffNotes: asNullableString(outrider.security_staff_notes),
      unitNamingExample: asNullableString(outrider.unit_naming_example),
      unitTypes: asOutriderUnitTypes(outrider.unit_types),
    },
    files: mappedFiles,
    id,
    reviewNote: asNullableString(outrider.review_note),
    status,
    submittedAt: asNullableString(outrider.submitted_at),
    updatedAt: asString(outrider.updated_at),
  };
}

function toRpcPayload(payload: OutriderSavePayload) {
  const normalized = normalizeOutriderSavePayload(payload);

  return {
    completedSections: normalized.completedSections,
    payload: {
      contact_email: normalized.contactEmail,
      contact_name: normalized.contactName,
      contact_phone: normalized.contactPhone,
      contacts: normalized.contacts,
      destinations: normalized.destinationNames,
      establishments: normalized.establishmentNames,
      has_destinations: normalized.hasDestinations,
      has_establishments: normalized.hasEstablishments,
      has_inactive_units: normalized.hasInactiveUnits,
      inactive_units_notes: normalized.inactiveUnitNotes,
      initial_admin_count: normalized.initialAdminCount,
      initial_admins: normalized.initialAdmins,
      security_staff_count: normalized.securityStaffCount,
      security_staff_names: normalized.securityStaffNames,
      security_staff_notes: normalized.securityStaffNotes,
      unit_naming_example: normalized.unitNamingExample,
      unit_type_other: normalized.otherUnitType,
      unit_types: normalized.unitTypes,
    },
  };
}

export async function resolvePublicOutrider(input: {
  tokenHash: string;
}): Promise<PublicOutriderResult> {
  if (!input.tokenHash) return { available: false };

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("resolve_community_outrider_v1", {
      p_token_hash: input.tokenHash,
    });

    if (error) return { available: false };

    return mapPublicOutrider(data);
  } catch {
    return { available: false };
  }
}

export async function savePublicOutrider(input: {
  payload: OutriderSavePayload;
  tokenHash: string;
}) {
  const normalized = toRpcPayload(input.payload);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("save_community_outrider_v1", {
    p_completed_sections: normalized.completedSections,
    p_payload: normalized.payload,
    p_token_hash: input.tokenHash,
  });

  if (error) {
    return {
      error: error.message,
      saved: false as const,
    };
  }

  return {
    completedSections: asOutriderSections(asRecord(data).completed_sections),
    saved: true as const,
    status: asString(asRecord(data).status),
  };
}

export async function submitPublicOutrider(input: { tokenHash: string }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("submit_community_outrider_v1", {
    p_token_hash: input.tokenHash,
  });

  if (error) {
    return {
      error: error.message,
      submitted: false as const,
    };
  }

  const result = asRecord(data);
  const completedSections = Array.isArray(result.completed_sections)
    ? asOutriderSections(result.completed_sections)
    : undefined;

  return {
    completedSections,
    submitted: result.accepted === true,
  };
}

export async function recordPublicOutriderFile(input: {
  byteSize: number;
  category: OutriderFileCategory;
  mimeType: string;
  originalFilename: string;
  storagePath: string;
  tokenHash: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("record_community_outrider_file_v1", {
    p_byte_size: input.byteSize,
    p_category: input.category,
    p_mime_type: input.mimeType,
    p_original_filename: input.originalFilename,
    p_storage_path: input.storagePath,
    p_token_hash: input.tokenHash,
  });

  if (error) {
    return {
      error: error.message,
      recorded: false as const,
    };
  }

  const result = asRecord(data);

  return {
    fileId: asString(result.file_id),
    recorded: result.accepted === true,
    storagePath: asString(result.storage_path),
  };
}
