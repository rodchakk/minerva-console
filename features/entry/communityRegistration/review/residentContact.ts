import {
  getUnitMissingFields,
  type RegistrationCompletenessResident,
  type RegistrationMissingField,
} from "@/features/entry/communityRegistration/review/completeness";

export type SharedContactIssue = {
  kind: "email" | "phone";
  residentNames: string[];
  residentPositions: number[];
  value: string;
};

export type ResidentContactIssue = {
  key: string;
  kind:
    | "missing_email"
    | "missing_phone"
    | "missing_full_name"
    | "missing_unit_reference"
    | "shared_email"
    | "shared_phone";
  label: string;
};

export type ResidentContactDiagnosticInput = {
  reference: string | null;
  residents: RegistrationCompletenessResident[];
  unitLabel: string;
};

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase("es-HN");
}

function normalizePhoneDigits(value: string | null | undefined) {
  let digits = String(value ?? "").replace(/\D+/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = `504${digits}`;
  return digits;
}

export function normalizeWhatsAppNumber(value: string | null | undefined) {
  const digits = normalizePhoneDigits(value);
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function getSharedContactIssues(
  residents: RegistrationCompletenessResident[],
): SharedContactIssue[] {
  const groups = new Map<
    string,
    {
      kind: "email" | "phone";
      names: string[];
      positions: number[];
      value: string;
    }
  >();

  for (const resident of residents) {
    const email = normalizeEmail(resident.email);
    if (email) {
      const key = `email:${email}`;
      const current = groups.get(key) ?? {
        kind: "email" as const,
        names: [],
        positions: [],
        value: email,
      };
      current.names.push(resident.fullName);
      current.positions.push(resident.position);
      groups.set(key, current);
    }

    const phone = normalizePhoneDigits(resident.phone);
    if (phone) {
      const key = `phone:${phone}`;
      const current = groups.get(key) ?? {
        kind: "phone" as const,
        names: [],
        positions: [],
        value: phone,
      };
      current.names.push(resident.fullName);
      current.positions.push(resident.position);
      groups.set(key, current);
    }
  }

  return Array.from(groups.values())
    .filter((group) => group.positions.length > 1)
    .map((group) => ({
      kind: group.kind,
      residentNames: Array.from(new Set(group.names)),
      residentPositions: Array.from(new Set(group.positions)).sort(
        (left, right) => left - right,
      ),
      value: group.value,
    }));
}

function residentLabel(field: RegistrationMissingField) {
  return (
    field.residentName?.trim() ||
    `Residente ${field.residentPosition ?? ""}`.trim()
  );
}

export function buildResidentContactIssues(
  input: ResidentContactDiagnosticInput,
): ResidentContactIssue[] {
  const missingFields = getUnitMissingFields(input);
  const sharedContactIssues = getSharedContactIssues(input.residents);
  const issues: ResidentContactIssue[] = [];

  for (const field of missingFields) {
    if (field.code === "unit_reference") {
      issues.push({
        key: "unit:reference",
        kind: "missing_unit_reference",
        label: "Referencia o ubicación de la vivienda",
      });
      continue;
    }

    const position = field.residentPosition ?? 0;
    const name = residentLabel(field);

    if (field.code === "email") {
      issues.push({
        key: `resident:${position}:email`,
        kind: "missing_email",
        label: `${name} — ${
          field.message === "Invalid email address"
            ? "correo electrónico válido"
            : "correo electrónico"
        }`,
      });
    } else if (field.code === "phone") {
      issues.push({
        key: `resident:${position}:phone`,
        kind: "missing_phone",
        label: `${name} — número de teléfono`,
      });
    } else if (field.code === "full_name") {
      issues.push({
        key: `resident:${position}:full_name`,
        kind: "missing_full_name",
        label: `${name} — nombre completo`,
      });
    }
  }

  for (const issue of sharedContactIssues) {
    const positions = issue.residentPositions.join(",");
    const names = issue.residentNames.join(" y ");

    issues.push({
      key: `shared:${issue.kind}:${positions}`,
      kind: issue.kind === "email" ? "shared_email" : "shared_phone",
      label:
        issue.kind === "email"
          ? `Confirmar correo electrónico de ${names} (actualmente comparten el mismo correo)`
          : `Confirmar número de teléfono de ${names} (actualmente comparten el mismo número)`,
    });
  }

  const byKey = new Map(issues.map((issue) => [issue.key, issue]));
  return Array.from(byKey.values()).sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

export function buildResidentContactIssueSignature(
  issues: ResidentContactIssue[],
) {
  return issues
    .map((issue) => issue.key)
    .sort()
    .join("|");
}

export function buildResidentContactMessage(input: {
  communityName: string;
  issues: ResidentContactIssue[];
  unitLabel: string;
}) {
  const list = input.issues.map((issue) => `• ${issue.label}`).join("\n");

  return [
    `*ENTRY · ${input.communityName}*`,
    `*Vivienda: ${input.unitLabel}*`,
    "",
    "Este es un mensaje generado por ENTRY para completar la información registrada de su vivienda.",
    "",
    "Para finalizar el proceso necesitamos:",
    "",
    list,
    "",
    "Por favor, responda directamente a este mensaje con la información solicitada. Su respuesta será revisada por nuestro equipo.",
    "",
    "Gracias.",
    "*ENTRY by Minerva Technologies*",
  ].join("\n");
}
