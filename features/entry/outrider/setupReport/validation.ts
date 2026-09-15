import "server-only";

import {
  SETUP_WORKBOOK_SCHEMA_VERSION,
  type ParsedSetupWorkbook,
  type SetupFinding,
  type SetupValidationResult,
  type SetupWorkbookSheet,
} from "@/features/entry/outrider/setupReport/model";
import { normalizeSetupUnitIdentity } from "@/features/entry/outrider/setupReport/normalization";

function normalizeIdentity(value: string | null) {
  return value?.replace(/\s+/g, " ").trim().toLocaleLowerCase("es-GT") ?? null;
}

function emailIsValid(value: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function addFinding(
  findings: SetupFinding[],
  input: {
    code: string;
    field: string | null;
    message: string;
    row: number | null;
    severity: SetupFinding["severity"];
    sheet: SetupWorkbookSheet | "Workbook" | null;
  },
) {
  findings.push(input);
}

export function validateSetupWorkbook(
  workbook: ParsedSetupWorkbook | null,
  parserFindings: SetupFinding[],
  context: { outriderCommunityName: string },
): SetupValidationResult {
  const findings = [...parserFindings];

  if (!workbook) {
    return summarize(null, findings);
  }

  if (workbook.schemaVersion !== SETUP_WORKBOOK_SCHEMA_VERSION) {
    addFinding(findings, {
      code: "WORKBOOK_SCHEMA_VERSION_UNSUPPORTED",
      field: "schema_version",
      message: "Workbook schema_version is missing or unsupported.",
      row: null,
      severity: "error",
      sheet: "Meta",
    });
  }

  if (
    workbook.meta.communityName &&
    normalizeIdentity(workbook.meta.communityName) !==
      normalizeIdentity(context.outriderCommunityName)
  ) {
    addFinding(findings, {
      code: "COMMUNITY_NAME_MISMATCH",
      field: "community_name",
      message: "Workbook community_name differs from the Outrider community name.",
      row: null,
      severity: "warning",
      sheet: "Meta",
    });
  }

  const unitKeys = new Map<string, { label: string; row: number }>();
  const populationUnitKeys = new Set<string>();

  for (const unit of workbook.units) {
    const key = normalizeSetupUnitIdentity(unit.unitLabel);
    if (!key) {
      addFinding(findings, {
        code: "UNIT_LABEL_MISSING",
        field: "unit_label",
        message: "Unit row is missing unit_label.",
        row: unit.row,
        severity: "error",
        sheet: "Units",
      });
      continue;
    }

    const existing = unitKeys.get(key);
    if (existing) {
      addFinding(findings, {
        code: "UNIT_LABEL_DUPLICATE",
        field: "unit_label",
        message: `Unit ${unit.unitLabel} duplicates row ${existing.row} after normalization.`,
        row: unit.row,
        severity: "error",
        sheet: "Units",
      });
    } else {
      unitKeys.set(key, { label: unit.unitLabel ?? "", row: unit.row });
    }

    // Explicitly inactive units are not expected to have resident information at launch.
    // Unknown activity state remains in the population denominator until it is confirmed.
    if (unit.isActive !== false) {
      populationUnitKeys.add(key);
    }

    if (!unit.publicReference) {
      addFinding(findings, {
        code: "UNIT_REFERENCE_MISSING",
        field: "public_reference",
        message: `Unit ${unit.unitLabel ?? "row"} does not have a resident-facing reference.`,
        row: unit.row,
        severity: "warning",
        sheet: "Units",
      });
    }

    if (!unit.unitType) {
      addFinding(findings, {
        code: "UNIT_TYPE_MISSING",
        field: "unit_type",
        message: `Unit ${unit.unitLabel ?? "row"} does not have a unit type.`,
        row: unit.row,
        severity: "warning",
        sheet: "Units",
      });
    }

    if (unit.isActive === null) {
      addFinding(findings, {
        code: "UNIT_ACTIVE_UNKNOWN",
        field: "is_active",
        message: `Unit ${unit.unitLabel ?? "row"} does not state whether it is active.`,
        row: unit.row,
        severity: "warning",
        sheet: "Units",
      });
    }
  }

  const populatedUnitKeys = new Set<string>();
  const residentKeys = new Map<string, number>();
  for (const resident of workbook.residents) {
    const unitKey = normalizeSetupUnitIdentity(resident.unitLabel);
    if (!resident.fullName) {
      addFinding(findings, {
        code: "RESIDENT_NAME_MISSING",
        field: "full_name",
        message: "Resident row is missing full_name.",
        row: resident.row,
        severity: "error",
        sheet: "Residents",
      });
    }

    if (!unitKey) {
      addFinding(findings, {
        code: "RESIDENT_UNIT_MISSING",
        field: "unit_label",
        message: "Resident row is missing unit_label.",
        row: resident.row,
        severity: "error",
        sheet: "Residents",
      });
    } else if (!unitKeys.has(unitKey)) {
      addFinding(findings, {
        code: "RESIDENT_UNIT_NOT_FOUND",
        field: "unit_label",
        message: `Resident references unit ${resident.unitLabel}, which is not present in Units.`,
        row: resident.row,
        severity: "error",
        sheet: "Residents",
      });
    } else {
      populatedUnitKeys.add(unitKey);
    }

    if (resident.email && !emailIsValid(resident.email)) {
      addFinding(findings, {
        code: "EMAIL_INVALID",
        field: "email",
        message: "Resident email is not valid.",
        row: resident.row,
        severity: "error",
        sheet: "Residents",
      });
    }

    if (!resident.phone && !resident.email) {
      addFinding(findings, {
        code: "RESIDENT_CONTACT_MISSING",
        field: null,
        message: "Resident row is missing both phone and email.",
        row: resident.row,
        severity: "warning",
        sheet: "Residents",
      });
    }

    const duplicateKey = normalizeIdentity(
      `${resident.fullName ?? ""}|${resident.unitLabel ?? ""}`,
    );
    if (duplicateKey) {
      const firstRow = residentKeys.get(duplicateKey);
      if (firstRow) {
        addFinding(findings, {
          code: "RESIDENT_PROBABLE_DUPLICATE",
          field: "full_name",
          message: `Resident may duplicate row ${firstRow}.`,
          row: resident.row,
          severity: "warning",
          sheet: "Residents",
        });
      } else {
        residentKeys.set(duplicateKey, resident.row);
      }
    }
  }

  for (const unit of workbook.units) {
    const key = normalizeSetupUnitIdentity(unit.unitLabel);
    if (key && unit.isActive !== false && !populatedUnitKeys.has(key)) {
      addFinding(findings, {
        code: "UNIT_HAS_NO_RESIDENT_INFORMATION",
        field: "unit_label",
        message: `Unit ${unit.unitLabel} has no resident information.`,
        row: unit.row,
        severity: "warning",
        sheet: "Units",
      });
    }
  }

  if (populationUnitKeys.size > 0 && workbook.residents.length > 0) {
    const populatedPopulationUnits = Array.from(populatedUnitKeys).filter((key) =>
      populationUnitKeys.has(key),
    ).length;
    const coverage = populatedPopulationUnits / populationUnitKeys.size;
    if (coverage > 0 && coverage < 1) {
      addFinding(findings, {
        code: "RESIDENT_COVERAGE_PARTIAL",
        field: null,
        message:
          "Resident information covers only part of the active or not-yet-confirmed units.",
        row: null,
        severity: "warning",
        sheet: "Residents",
      });
    }
  }

  for (const destination of workbook.destinations) {
    if (!destination.name) {
      addFinding(findings, {
        code: "DESTINATION_NAME_MISSING",
        field: "name",
        message: "Destination row is missing name.",
        row: destination.row,
        severity: "error",
        sheet: "Destinations",
      });
    }
  }

  for (const admin of workbook.admins) {
    if (!admin.fullName) {
      addFinding(findings, {
        code: "ADMIN_NAME_MISSING",
        field: "full_name",
        message: "Admin row is missing full_name.",
        row: admin.row,
        severity: "error",
        sheet: "Admins",
      });
    }
    if (admin.email && !emailIsValid(admin.email)) {
      addFinding(findings, {
        code: "EMAIL_INVALID",
        field: "email",
        message: "Admin email is not valid.",
        row: admin.row,
        severity: "error",
        sheet: "Admins",
      });
    }
  }

  return summarize(workbook, findings);
}

function summarize(
  workbook: ParsedSetupWorkbook | null,
  findings: SetupFinding[],
): SetupValidationResult {
  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter(
    (finding) => finding.severity === "warning",
  ).length;
  const units = workbook?.units ?? [];

  return {
    counts: {
      admins: workbook?.admins.length ?? 0,
      destinations: workbook?.destinations.length ?? 0,
      errors,
      residents: workbook?.residents.length ?? 0,
      units: units.length,
      unitsMissingReferences: units.filter((unit) => !unit.publicReference).length,
      unitsWithReferences: units.filter((unit) => Boolean(unit.publicReference)).length,
      warnings,
    },
    findings,
    hasBlockingErrors: errors > 0,
  };
}
