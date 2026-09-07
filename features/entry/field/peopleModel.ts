export type FieldReadState = "ready" | "unavailable";

export type FieldResident = {
  accountState: "Active" | "Inactive";
  authType: string;
  email: string;
  fullName: string;
  houseId: string;
  houseLabel: string;
  identity: string;
  isActive: boolean;
  phone: string;
  role: "ADMIN" | "GUARD" | "RESIDENT" | "UNASSIGNED";
  userId: string;
  username: string;
};

export type FieldUnit = {
  id: string;
  isActive: boolean;
  label: string;
  residentCount: number | null;
};

export type FieldActivationRow = {
  email: string;
  id: string;
  identityHint: string;
  method: string;
  phone: string;
  resident: string;
  status: string;
  suggestedUsername: string;
  unit: string;
};

export function isSyntheticResidentEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  return (
    !normalized ||
    normalized === "-" ||
    normalized === "\u2014" ||
    normalized.endsWith("@entry.local") ||
    normalized.endsWith("@entry.internal")
  );
}

export function getResidentIdentity(input: {
  email: string;
  username: string;
}) {
  if (input.email && !isSyntheticResidentEmail(input.email)) {
    return input.email;
  }

  if (input.username.trim()) {
    return input.username.trim();
  }

  return "No login identity visible";
}

export function canUseResidentRecoveryCode(resident: {
  email: string;
  role: string;
}) {
  return (
    resident.role.trim().toUpperCase() === "RESIDENT" &&
    isSyntheticResidentEmail(resident.email)
  );
}

export function canSendResidentResetEmail(resident: { email: string }) {
  return Boolean(resident.email.trim()) && !isSyntheticResidentEmail(resident.email);
}

export function filterFieldResidents(
  residents: FieldResident[],
  query: string,
) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return residents;
  }

  return residents.filter((resident) =>
    [
      resident.fullName,
      resident.houseLabel,
      resident.email,
      resident.username,
      resident.phone,
      resident.role,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function normalizeFieldUnitSearch(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function collapseNumericUnitTokens(value: string) {
  return normalizeFieldUnitSearch(value)
    .split(" ")
    .filter(Boolean)
    .map((token) => {
      if (!/^\d+$/.test(token)) {
        return token;
      }

      return String(Number.parseInt(token, 10));
    })
    .join(" ");
}

export function filterFieldUnits(units: FieldUnit[], query: string) {
  const normalized = normalizeFieldUnitSearch(query);

  if (!normalized) {
    return units;
  }

  const collapsedQuery = collapseNumericUnitTokens(query);

  return units.filter((unit) => {
    const normalizedLabel = normalizeFieldUnitSearch(unit.label);
    const collapsedLabel = collapseNumericUnitTokens(unit.label);

    return (
      normalizedLabel.includes(normalized) ||
      collapsedLabel.includes(collapsedQuery)
    );
  });
}

export function formatFieldUnitResidentCount(unit: FieldUnit) {
  if (unit.residentCount === null) {
    return "Resident count unavailable";
  }

  return `${unit.residentCount} linked resident(s)`;
}

export function getFieldResidentAssignmentUnits(
  units: FieldUnit[],
  currentUnitId: string,
) {
  return units.filter((unit) => unit.isActive || unit.id === currentUnitId);
}

export function filterFieldActivationRows(
  rows: FieldActivationRow[],
  query: string,
) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return rows;
  }

  return rows.filter((row) =>
    [
      row.resident,
      row.unit,
      row.method,
      row.status,
      row.identityHint,
      row.suggestedUsername,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

export function isActivationPinEligible(row: FieldActivationRow) {
  return !["activated", "skipped"].includes(row.status.trim().toLowerCase());
}
