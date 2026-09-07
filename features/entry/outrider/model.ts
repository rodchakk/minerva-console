export const OUTRIDER_STORAGE_BUCKET = "entry-outrider";

export const OUTRIDER_STATUSES = [
  "not_started",
  "in_progress",
  "needs_information",
  "ready_for_review",
  "approved",
] as const;

export type OutriderStatus = (typeof OUTRIDER_STATUSES)[number];

export const OUTRIDER_UNIT_TYPES = [
  "casas",
  "apartamentos",
  "condominios",
  "oficinas",
  "otro",
] as const;

export type OutriderUnitType = (typeof OUTRIDER_UNIT_TYPES)[number];

export const OUTRIDER_SECTIONS = [
  "units",
  "destinations",
  "inactive_units",
  "available_information",
  "contact",
] as const;

export type OutriderSection = (typeof OUTRIDER_SECTIONS)[number];

// Keep legacy categories readable/exportable, but only units and residents are
// offered as new public uploads after the first production QA walkthrough.
export const OUTRIDER_FILE_CATEGORIES = [
  "units",
  "residents",
  "security_staff",
  "common_areas",
] as const;

export type OutriderFileCategory = (typeof OUTRIDER_FILE_CATEGORIES)[number];

export const OUTRIDER_PUBLIC_UPLOAD_CATEGORIES = ["units", "residents"] as const;
export type OutriderPublicUploadCategory =
  (typeof OUTRIDER_PUBLIC_UPLOAD_CATEGORIES)[number];

export const OUTRIDER_MAX_FILE_BYTES = 20 * 1024 * 1024;

export const OUTRIDER_ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "image/jpeg",
  "image/png",
] as const;

const OUTRIDER_ALLOWED_EXTENSIONS = new Set([
  "csv",
  "doc",
  "docx",
  "jpeg",
  "jpg",
  "pdf",
  "png",
  "xls",
  "xlsx",
]);

const UNIT_TYPE_LABELS: Record<OutriderUnitType, string> = {
  apartamentos: "Apartamentos",
  casas: "Casas",
  condominios: "Condominios",
  oficinas: "Oficinas",
  otro: "Otro",
};

const SECTION_LABELS: Record<OutriderSection, string> = {
  available_information: "Informacion disponible",
  contact: "Contacto",
  destinations: "Destinos internos",
  inactive_units: "Unidades inactivas",
  units: "Unidades",
};

const STATUS_LABELS: Record<OutriderStatus, string> = {
  approved: "Approved",
  in_progress: "In progress",
  needs_information: "Needs information",
  not_started: "Not started",
  ready_for_review: "Ready for review",
};

export type OutriderFileRecord = {
  byteSize: number;
  category: OutriderFileCategory;
  createdAt: string;
  id: string;
  mimeType: string;
  originalFilename: string;
  storagePath: string;
};

export type OutriderDraft = {
  availableInformation: OutriderFileCategory[];
  contactEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  destinationNames: string[];
  hasDestinations: boolean | null;
  hasInactiveUnits: boolean | null;
  inactiveUnitNotes: string | null;
  otherUnitType: string | null;
  securityStaffCount: number | null;
  securityStaffNotes: string | null;
  unitNamingExample: string | null;
  unitTypes: OutriderUnitType[];
};

export type PublicOutriderSession = {
  available: true;
  communityId: string;
  communityName: string;
  completedSections: OutriderSection[];
  draft: OutriderDraft;
  files: OutriderFileRecord[];
  id: string;
  reviewNote: string | null;
  status: OutriderStatus;
  submittedAt: string | null;
  updatedAt: string;
};

export type PublicOutriderResult =
  | {
      available: false;
    }
  | PublicOutriderSession;

export type OutriderSavePayload = {
  availableInformation?: unknown;
  contactEmail?: unknown;
  contactName?: unknown;
  contactPhone?: unknown;
  destinationNames?: unknown;
  hasDestinations?: unknown;
  hasInactiveUnits?: unknown;
  inactiveUnitNotes?: unknown;
  markSectionsComplete?: unknown;
  otherUnitType?: unknown;
  securityStaffCount?: unknown;
  securityStaffNotes?: unknown;
  unitNamingExample?: unknown;
  unitTypes?: unknown;
};

export type NormalizedOutriderSave = OutriderDraft & {
  completedSections: OutriderSection[];
};

export type OutriderExportSummary = {
  attachments: Array<{
    byteSize: number;
    category: OutriderFileCategory;
    filename: string;
    mimeType: string;
    storagePath: string;
  }>;
  community: {
    city: string | null;
    id: string;
    name: string;
  };
  contact: {
    email: string | null;
    name: string | null;
    phone: string | null;
  };
  destinations: {
    hasDestinations: boolean | null;
    names: string[];
  };
  inactiveUnits: {
    hasInactiveUnits: boolean | null;
    notes: string | null;
  };
  metadata: {
    approvedAt: string | null;
    generatedAt: string;
    progressPercent: number;
    schemaVersion: "entry-outrider-export-v1";
    status: OutriderStatus;
    submittedAt: string | null;
  };
  reviewNote: string | null;
  securityStaff: {
    count: number | null;
    notes: string | null;
  };
  setupBoundary: string;
  unitProfile: {
    otherUnitType: string | null;
    types: OutriderUnitType[];
  };
};

export function isOutriderStatus(value: unknown): value is OutriderStatus {
  return (
    typeof value === "string" &&
    OUTRIDER_STATUSES.includes(value as OutriderStatus)
  );
}

export function isOutriderFileCategory(
  value: unknown,
): value is OutriderFileCategory {
  return (
    typeof value === "string" &&
    OUTRIDER_FILE_CATEGORIES.includes(value as OutriderFileCategory)
  );
}

export function isOutriderPublicUploadCategory(
  value: unknown,
): value is OutriderPublicUploadCategory {
  return (
    typeof value === "string" &&
    OUTRIDER_PUBLIC_UPLOAD_CATEGORIES.includes(
      value as OutriderPublicUploadCategory,
    )
  );
}

export function getOutriderStatusLabel(status: OutriderStatus) {
  return STATUS_LABELS[status];
}

export function getOutriderUnitTypeLabel(unitType: OutriderUnitType) {
  return UNIT_TYPE_LABELS[unitType];
}

export function getOutriderSectionLabel(section: OutriderSection) {
  return SECTION_LABELS[section];
}

export function normalizeOutriderText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  return normalized.slice(0, Math.max(0, maxLength));
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeInteger(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) return null;
  return numeric;
}

function normalizeStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    const text = normalizeOutriderText(item, maxLength);
    if (!text) continue;

    const key = text.toLocaleLowerCase("es-GT");
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(text);

    if (normalized.length >= maxItems) break;
  }

  return normalized;
}

function normalizeUnitTypes(value: unknown) {
  if (!Array.isArray(value)) return [];

  const normalized = new Set<OutriderUnitType>();

  for (const item of value) {
    if (
      typeof item === "string" &&
      OUTRIDER_UNIT_TYPES.includes(item as OutriderUnitType)
    ) {
      normalized.add(item as OutriderUnitType);
    }
  }

  return Array.from(normalized);
}

function normalizeFileCategories(value: unknown) {
  if (!Array.isArray(value)) return [];

  const normalized = new Set<OutriderFileCategory>();

  for (const item of value) {
    if (isOutriderFileCategory(item)) {
      normalized.add(item);
    }
  }

  return Array.from(normalized);
}

function normalizeCompletedSections(value: unknown) {
  if (!Array.isArray(value)) return [];

  const normalized = new Set<OutriderSection>();

  for (const item of value) {
    if (
      typeof item === "string" &&
      OUTRIDER_SECTIONS.includes(item as OutriderSection)
    ) {
      normalized.add(item as OutriderSection);
    }
  }

  return Array.from(normalized);
}

export function isValidOutriderEmail(value: string | null) {
  if (!value) return false;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export function normalizeOutriderSavePayload(
  payload: OutriderSavePayload,
): NormalizedOutriderSave {
  return {
    availableInformation: normalizeFileCategories(payload.availableInformation),
    completedSections: normalizeCompletedSections(payload.markSectionsComplete),
    contactEmail: normalizeOutriderText(payload.contactEmail, 254),
    contactName: normalizeOutriderText(payload.contactName, 180),
    contactPhone: normalizeOutriderText(payload.contactPhone, 80),
    destinationNames: normalizeStringArray(payload.destinationNames, 75, 180),
    hasDestinations: normalizeBoolean(payload.hasDestinations),
    hasInactiveUnits: normalizeBoolean(payload.hasInactiveUnits),
    inactiveUnitNotes: normalizeOutriderText(payload.inactiveUnitNotes, 1000),
    otherUnitType: normalizeOutriderText(payload.otherUnitType, 120),
    securityStaffCount: normalizeInteger(payload.securityStaffCount, 0, 500),
    securityStaffNotes: normalizeOutriderText(payload.securityStaffNotes, 2000),
    unitNamingExample: normalizeOutriderText(payload.unitNamingExample, 160),
    unitTypes: normalizeUnitTypes(payload.unitTypes),
  };
}

export function calculateOutriderCompletedSections(
  draft: OutriderDraft,
  markSectionsComplete: OutriderSection[] = [],
) {
  const completed = new Set<OutriderSection>(markSectionsComplete);

  if (
    draft.unitTypes.length > 0 &&
    Boolean(draft.unitNamingExample) &&
    (!draft.unitTypes.includes("otro") || Boolean(draft.otherUnitType))
  ) {
    completed.add("units");
  } else {
    completed.delete("units");
  }

  if (
    draft.hasDestinations === false ||
    (draft.hasDestinations === true && draft.destinationNames.length > 0)
  ) {
    completed.add("destinations");
  } else {
    completed.delete("destinations");
  }

  if (
    draft.hasInactiveUnits === false ||
    (draft.hasInactiveUnits === true && Boolean(draft.inactiveUnitNotes))
  ) {
    completed.add("inactive_units");
  } else {
    completed.delete("inactive_units");
  }

  if (draft.securityStaffCount !== null) {
    completed.add("available_information");
  } else {
    completed.delete("available_information");
  }

  const contactEmailValid =
    !draft.contactEmail || isValidOutriderEmail(draft.contactEmail);
  if (
    draft.contactName &&
    (draft.contactPhone || isValidOutriderEmail(draft.contactEmail)) &&
    contactEmailValid
  ) {
    completed.add("contact");
  } else {
    completed.delete("contact");
  }

  return OUTRIDER_SECTIONS.filter((section) => completed.has(section));
}

export function getOutriderProgressPercent(sections: OutriderSection[]) {
  const completedCount = new Set(sections).size;
  return Math.round((completedCount / OUTRIDER_SECTIONS.length) * 100);
}

export function isOutriderEditable(status: OutriderStatus) {
  return ["not_started", "in_progress", "needs_information"].includes(status);
}

export function sanitizeOutriderFilename(name: string) {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 120);

  return cleaned || "archivo";
}

export function isAllowedOutriderFile(input: {
  byteSize: number;
  mimeType: string;
  originalFilename: string;
}) {
  const extension = input.originalFilename.split(".").pop()?.toLowerCase() ?? "";

  return (
    input.byteSize > 0 &&
    input.byteSize <= OUTRIDER_MAX_FILE_BYTES &&
    OUTRIDER_ALLOWED_FILE_TYPES.includes(
      input.mimeType as (typeof OUTRIDER_ALLOWED_FILE_TYPES)[number],
    ) &&
    OUTRIDER_ALLOWED_EXTENSIONS.has(extension)
  );
}

export function buildOutriderStoragePath(input: {
  category: OutriderFileCategory;
  filename: string;
  outriderId: string;
  uploadId: string;
}) {
  const safeFilename = sanitizeOutriderFilename(input.filename);
  return `${input.outriderId}/${input.category}/${input.uploadId}-${safeFilename}`;
}
