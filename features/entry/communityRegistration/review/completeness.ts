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
  const residentName = clean(resident.fullName) || `Residente ${resident.position}`;

  if (clean(resident.fullName).length < 2) {
    fields.push({
      code: "full_name",
      label: "Nombre pendiente",
      message: "Falta nombre válido",
      residentName,
      residentPosition: resident.position,
    });
  }

  if (!hasUsableEmail(resident.email)) {
    fields.push({
      code: "email",
      label: "Correo pendiente",
      message: clean(resident.email)
        ? "Correo electrónico inválido"
        : "Falta correo electrónico",
      residentName,
      residentPosition: resident.position,
    });
  }

  if (!clean(resident.phone)) {
    fields.push({
      code: "phone",
      label: "Teléfono pendiente",
      message: "Falta teléfono",
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
      label: "Referencia pendiente",
      message: "Falta referencia de la vivienda",
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
      label: "Datos completos",
      missingFields,
    } as const;
  }

  return {
    complete: false,
    label:
      missingFields.length === 1
        ? missingFields[0].label
        : `${missingFields.length} datos pendientes`,
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
