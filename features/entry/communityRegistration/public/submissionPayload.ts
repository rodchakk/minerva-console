export type HouseholdRelationship =
  | ""
  | "owner"
  | "tenant"
  | "family"
  | "other";

export type ReviewedResidentForSubmission = {
  isOwnerReference: boolean;
  normalizedEmail: string;
  normalizedFullName: string;
  normalizedPhone: string;
  position: number;
  relationship: HouseholdRelationship;
};

export type HouseholdSubmissionResident = {
  email?: string;
  full_name: string;
  is_owner_reference: boolean;
  phone?: string;
  position: number;
  relationship_to_house: Exclude<HouseholdRelationship, ""> | "unknown";
};

export type HouseholdSubmissionBody = {
  residents: HouseholdSubmissionResident[];
  unitLabel: string;
};

type ParseSubmissionResult =
  | {
      body: HouseholdSubmissionBody;
      ok: true;
    }
  | {
      ok: false;
    };

const MAX_UNIT_LABEL_LENGTH = 120;
const NAME_MAX_LENGTH = 160;
const EMAIL_MAX_LENGTH = 254;
const PHONE_MAX_LENGTH = 32;
const ALLOWED_RELATIONSHIPS = new Set([
  "owner",
  "tenant",
  "family",
  "other",
  "unknown",
]);
const RESIDENT_KEYS = new Set([
  "position",
  "full_name",
  "email",
  "phone",
  "relationship_to_house",
  "is_owner_reference",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyResidentKeys(value: Record<string, unknown>) {
  return Object.keys(value).every((key) => RESIDENT_KEYS.has(key));
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.trim().replace(/[\s().-]+/g, "");
}

function countCharacters(value: string) {
  return Array.from(value).length;
}

function isValidEmail(value: string) {
  return (
    countCharacters(value) <= EMAIL_MAX_LENGTH &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
  );
}

function isValidPhone(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  return (
    countCharacters(value) <= PHONE_MAX_LENGTH &&
    /^\+?[0-9]+$/.test(value) &&
    digits.length >= 7
  );
}

export function buildHouseholdSubmissionResidents(
  residents: ReviewedResidentForSubmission[],
): HouseholdSubmissionResident[] {
  return residents.map((resident) => {
    const payload: HouseholdSubmissionResident = {
      full_name: resident.normalizedFullName,
      is_owner_reference: resident.isOwnerReference,
      position: resident.position,
      relationship_to_house: resident.relationship || "unknown",
    };

    if (resident.normalizedEmail) {
      payload.email = resident.normalizedEmail;
    }

    if (resident.normalizedPhone) {
      payload.phone = resident.normalizedPhone;
    }

    return payload;
  });
}

export function parseHouseholdSubmissionBody(
  body: unknown,
): ParseSubmissionResult {
  if (!isRecord(body)) return { ok: false };

  const unitLabel = typeof body.unitLabel === "string" ? body.unitLabel.trim() : "";
  if (!unitLabel || countCharacters(unitLabel) > MAX_UNIT_LABEL_LENGTH) {
    return { ok: false };
  }

  if (!Array.isArray(body.residents)) return { ok: false };
  if (body.residents.length < 1) {
    return { ok: false };
  }

  const seenPositions = new Set<number>();
  const seenResidentKeys = new Set<string>();
  let ownerReferenceCount = 0;
  const residents: HouseholdSubmissionResident[] = [];

  for (const item of body.residents) {
    if (!isRecord(item) || !hasOnlyResidentKeys(item)) return { ok: false };

    const position = item.position;
    if (
      typeof position !== "number" ||
      !Number.isInteger(position) ||
      position <= 0 ||
      position > body.residents.length ||
      seenPositions.has(position)
    ) {
      return { ok: false };
    }
    seenPositions.add(position);

    const fullName =
      typeof item.full_name === "string" ? normalizeName(item.full_name) : "";
    if (!fullName || countCharacters(fullName) > NAME_MAX_LENGTH) {
      return { ok: false };
    }

    const relationship =
      typeof item.relationship_to_house === "string"
        ? item.relationship_to_house.trim().toLowerCase()
        : "";
    if (!ALLOWED_RELATIONSHIPS.has(relationship)) {
      return { ok: false };
    }

    if (typeof item.is_owner_reference !== "boolean") {
      return { ok: false };
    }

    if (item.is_owner_reference) {
      ownerReferenceCount += 1;
      if (relationship !== "owner" || ownerReferenceCount > 1) {
        return { ok: false };
      }
    }

    const resident: HouseholdSubmissionResident = {
      full_name: fullName,
      is_owner_reference: item.is_owner_reference,
      position,
      relationship_to_house:
        relationship as HouseholdSubmissionResident["relationship_to_house"],
    };

    if ("email" in item) {
      if (typeof item.email !== "string") return { ok: false };
      const email = normalizeEmail(item.email);
      if (!email || !isValidEmail(email)) return { ok: false };
      resident.email = email;
    }

    if ("phone" in item) {
      if (typeof item.phone !== "string") return { ok: false };
      const phone = normalizePhone(item.phone);
      if (!phone || !isValidPhone(phone)) return { ok: false };
      resident.phone = phone;
    }

    const duplicateKey = [
      resident.full_name.toLowerCase(),
      resident.email ?? "",
      resident.phone ?? "",
    ].join("|");
    if (seenResidentKeys.has(duplicateKey)) {
      return { ok: false };
    }
    seenResidentKeys.add(duplicateKey);

    residents.push(resident);
  }

  return {
    body: {
      residents,
      unitLabel,
    },
    ok: true,
  };
}
