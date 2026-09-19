export type RegistrationMissingFieldCode =
  | "email"
  | "phone"
  | "full_name"
  | "unit_reference";

export type RegistrationMissingField = {
  code: RegistrationMissingFieldCode;
  label: string;
  message: string;
  residentName?: string;
  residentPosition?: number;
};

export type RegistrationCompletenessResident = {
  email: string | null;
  fullName: string;
  phone: string | null;
  position: number;
};

export type RegistrationCompletenessUnit = {
  reference: string | null;
  residents: RegistrationCompletenessResident[];
  unitLabel: string;
};

export type RegistrationCompletenessSummary = {
  missingEmailCount: number;
  missingFieldCount: number;
  residentCount: number;
  unitCount: number;
};

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function hasUsableEmail(value: string | null | undefined) {
  const email = clean(value);
  return Boolean(email) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getResidentMissingFields(
  resident: RegistrationCompletenessResident,
): RegistrationMissingField[] {
  const fields: RegistrationMissingField[] = [];
  const residentName = clean(resident.fullName) || `Resident ${resident.position}`;

  if (clean(resident.fullName).length < 2) {
    fields.push({
      code: "full_name",
      label: "Name missing",
      message: "Valid name missing",
      residentName,
      residentPosition: resident.position,
    });
  }

  if (!hasUsableEmail(resident.email)) {
    fields.push({
      code: "email",
      label: "Email missing",
      message: clean(resident.email)
        ? "Invalid email address"
        : "Email missing",
      residentName,
      residentPosition: resident.position,
    });
  }

  if (!clean(resident.phone)) {
    fields.push({
      code: "phone",
      label: "Phone missing",
      message: "Phone missing",
      residentName,
      residentPosition: resident.position,
    });
  }

  return fields;
}

export function getUnitMissingFields(
  unit: RegistrationCompletenessUnit,
): RegistrationMissingField[] {
  const fields: RegistrationMissingField[] = [];

  if (!clean(unit.reference)) {
    fields.push({
      code: "unit_reference",
      label: "Reference missing",
      message: "Unit reference missing",
    });
  }

  for (const resident of unit.residents) {
    fields.push(...getResidentMissingFields(resident));
  }

  return fields;
}

export function getResidentCompletenessStatus(
  resident: RegistrationCompletenessResident,
) {
  const missingFields = getResidentMissingFields(resident);

  if (missingFields.length === 0) {
    return {
      complete: true,
      label: "Data complete",
      missingFields,
    } as const;
  }

  return {
    complete: false,
    label:
      missingFields.length === 1
        ? missingFields[0].label
        : `${missingFields.length} missing fields`,
    missingFields,
  } as const;
}

export function summarizeRegistrationCompleteness(
  units: RegistrationCompletenessUnit[],
): RegistrationCompletenessSummary {
  const missingFields = units.flatMap((unit) => getUnitMissingFields(unit));

  return {
    missingEmailCount: missingFields.filter((field) => field.code === "email").length,
    missingFieldCount: missingFields.length,
    residentCount: units.reduce((total, unit) => total + unit.residents.length, 0),
    unitCount: units.length,
  };
}
