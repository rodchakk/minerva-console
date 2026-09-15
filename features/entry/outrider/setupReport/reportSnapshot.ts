import "server-only";

import type { OutriderDetail } from "@/features/entry/outrider/queries";
import {
  SETUP_REPORT_SCHEMA_VERSION,
  type OutriderReportSourceMetadata,
  type OutriderSetupReportSnapshot,
  type ParsedSetupWorkbook,
  type SetupValidationResult,
} from "@/features/entry/outrider/setupReport/model";
import { normalizeSetupUnitIdentity } from "@/features/entry/outrider/setupReport/normalization";

function normalizedUnit(value: string | null) {
  return normalizeSetupUnitIdentity(value);
}

export function buildRelevantOutriderInput(detail: OutriderDetail) {
  return {
    communityCity: detail.communityCity === "Not set" ? null : detail.communityCity,
    communityId: detail.communityId || null,
    communityName: detail.communityName,
    contactEmail: detail.contactEmail,
    contactName: detail.contactName,
    contactPhone: detail.contactPhone,
    contacts: detail.contacts,
    destinationNames: detail.destinationNames,
    establishmentNames: detail.establishmentNames,
    hasDestinations: detail.hasDestinations,
    hasEstablishments: detail.hasEstablishments,
    hasInactiveUnits: detail.hasInactiveUnits,
    inactiveUnitNotes: detail.inactiveUnitNotes,
    initialAdminCount: detail.initialAdminCount,
    initialAdmins: detail.initialAdmins,
    otherUnitType: detail.otherUnitType,
    securityStaffCount: detail.securityStaffCount,
    securityStaffNames: detail.securityStaffNames,
    securityStaffNotes: detail.securityStaffNotes,
    unitNamingExample: detail.unitNamingExample,
    unitTypes: detail.unitTypes,
  };
}

export function buildSetupReportSummary(
  workbook: ParsedSetupWorkbook,
  validation: SetupValidationResult,
): OutriderSetupReportSnapshot["summary"] {
  const units = new Set(
    workbook.units
      .map((unit) => normalizedUnit(unit.unitLabel))
      .filter((unit): unit is string => Boolean(unit)),
  );
  const residentUnits = new Set(
    workbook.residents
      .map((resident) => normalizedUnit(resident.unitLabel))
      .filter((unit): unit is string => unit !== null && units.has(unit)),
  );

  return {
    adminRows: workbook.admins.length,
    destinationRows: workbook.destinations.length,
    residentCoveragePercent:
      units.size === 0 ? null : Math.round((residentUnits.size / units.size) * 100),
    residentRows: workbook.residents.length,
    units: workbook.units.length,
    unitsMissingReferences: validation.counts.unitsMissingReferences,
    unitsWithReferences: validation.counts.unitsWithReferences,
    warnings: validation.counts.warnings,
  };
}

export function recommendedNextStep(
  summary: OutriderSetupReportSnapshot["summary"],
  validation: SetupValidationResult,
) {
  if (validation.hasBlockingErrors) {
    return "Se requiere corregir los errores del workbook antes de continuar.";
  }

  if (summary.residentRows === 0) {
    return "Se recomienda utilizar el Registro de Residentes para completar la información.";
  }

  if (summary.residentCoveragePercent === 100) {
    return "La información recibida puede ser candidata para preparación directa, sujeta a revisión interna de Minerva.";
  }

  return "La información de residentes es parcial. Se requiere definir la estrategia de población antes de continuar.";
}

export function buildSetupReportSnapshot(input: {
  detail: OutriderDetail;
  generatedAt: string;
  source: OutriderReportSourceMetadata;
  validation: SetupValidationResult;
  workbook: ParsedSetupWorkbook;
}): OutriderSetupReportSnapshot {
  const summary = buildSetupReportSummary(input.workbook, input.validation);

  return {
    generatedAt: input.generatedAt,
    intake: {
      communityCity:
        input.detail.communityCity === "Not set" ? null : input.detail.communityCity,
      communityId: input.detail.communityId || null,
      communityName: input.detail.communityName,
      contactName: input.detail.contactName,
      hasDestinations: input.detail.hasDestinations,
      hasEstablishments: input.detail.hasEstablishments,
      hasInactiveUnits: input.detail.hasInactiveUnits,
      initialAdminCount: input.detail.initialAdminCount,
      securityStaffCount: input.detail.securityStaffCount,
      unitNamingExample: input.detail.unitNamingExample,
      unitTypes: input.detail.unitTypes,
    },
    recommendation: recommendedNextStep(summary, input.validation),
    reportSchemaVersion: SETUP_REPORT_SCHEMA_VERSION,
    source: input.source,
    summary,
    validation: {
      findings: input.validation.findings,
    },
    workbook: input.workbook,
    workbookSchemaVersion: input.workbook.schemaVersion ?? "",
  };
}
