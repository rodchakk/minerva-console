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

function populationUnitSet(workbook: ParsedSetupWorkbook) {
  return new Set(
    workbook.units
      .filter((unit) => unit.isActive !== false)
      .map((unit) => normalizedUnit(unit.unitLabel))
      .filter((unit): unit is string => Boolean(unit)),
  );
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
  const populationUnits = populationUnitSet(workbook);
  const residentPopulationUnits = new Set(
    workbook.residents
      .map((resident) => normalizedUnit(resident.unitLabel))
      .filter(
        (unit): unit is string => unit !== null && populationUnits.has(unit),
      ),
  );

  return {
    adminRows: workbook.admins.length,
    destinationRows: workbook.destinations.length,
    residentCoveragePercent:
      populationUnits.size === 0
        ? null
        : Math.round((residentPopulationUnits.size / populationUnits.size) * 100),
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
  workbook: ParsedSetupWorkbook,
) {
  if (validation.hasBlockingErrors) {
    return "Minerva debe corregir los datos marcados como error antes de continuar.";
  }

  const populationUnits = populationUnitSet(workbook).size;
  const unknownStatusUnits = workbook.units.filter(
    (unit) => unit.isActive === null,
  ).length;

  if (populationUnits === 0) {
    return "No hay unidades marcadas para iniciar activas. Minerva debe confirmar el estado inicial de las unidades antes de continuar.";
  }

  if (summary.residentRows === 0) {
    return "Aún no hay información de residentes para las unidades que iniciarán activas. Se recomienda completar esa población antes de la configuración final.";
  }

  if (summary.residentCoveragePercent === 100 && unknownStatusUnits === 0) {
    if (validation.counts.warnings === 0) {
      return "La información está lista para revisión final de Minerva. No se identifican faltantes de residentes en las unidades activas.";
    }

    return "La cobertura de residentes está completa para las unidades activas. Minerva debe revisar las observaciones restantes antes de aplicar la configuración.";
  }

  if (unknownStatusUnits > 0) {
    return "Se debe confirmar el estado inicial de algunas unidades y completar cualquier información pendiente antes de aplicar la configuración.";
  }

  return "Falta información de residentes para una o más unidades que iniciarán activas. Minerva debe completar o confirmar esos datos antes de continuar.";
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
    recommendation: recommendedNextStep(
      summary,
      input.validation,
      input.workbook,
    ),
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
