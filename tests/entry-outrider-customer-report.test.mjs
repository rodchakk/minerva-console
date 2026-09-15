import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { createJiti } from "jiti";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const jiti = createJiti(join(root, "tests", "entry-outrider-customer-report.test.mjs"), {
  alias: {
    "@": root,
    "server-only": join(root, "tests", "server-only-stub.cjs"),
  },
});

const { validateSetupWorkbook } = jiti(
  join(root, "features", "entry", "outrider", "setupReport", "validation.ts"),
);
const { buildSetupReportSummary, recommendedNextStep } = jiti(
  join(root, "features", "entry", "outrider", "setupReport", "reportSnapshot.ts"),
);
const { renderSetupReportPdf } = jiti(
  join(root, "features", "entry", "outrider", "setupReport", "pdf.ts"),
);

const pdf = read("features/entry/outrider/setupReport/pdf.ts");
const model = read("features/entry/outrider/setupReport/model.ts");

function workbookFixture() {
  return {
    admins: [
      {
        email: "admin@example.com",
        fullName: "Admin QA",
        phone: "9999-0000",
        row: 2,
        unitLabel: "CASA-01",
      },
    ],
    destinations: [
      {
        name: "Mini Súper QA",
        notes: null,
        reference: null,
        row: 2,
        type: "business",
        unitLabel: null,
      },
    ],
    meta: {
      communityName: "Residencial QA",
      notes: null,
      preparedAt: "2026-09-15",
    },
    residents: [
      {
        email: "uno@example.com",
        fullName: "Residente Uno",
        phone: null,
        row: 2,
        unitLabel: "CASA-01",
      },
      {
        email: "dos@example.com",
        fullName: "Residente Dos",
        phone: null,
        row: 3,
        unitLabel: "CASA-02",
      },
    ],
    schemaVersion: "entry-onboarding-workbook-v1",
    units: [
      {
        isActive: true,
        notes: null,
        publicReference: "Casa 01",
        row: 2,
        unitLabel: "CASA-01",
        unitType: "house",
      },
      {
        isActive: true,
        notes: null,
        publicReference: "Casa 02",
        row: 3,
        unitLabel: "CASA-02",
        unitType: "house",
      },
      {
        isActive: false,
        notes: "Vacía al inicio",
        publicReference: "Casa 03",
        row: 4,
        unitLabel: "CASA-03",
        unitType: "house",
      },
    ],
  };
}

function snapshotFixture(workbook = workbookFixture()) {
  return {
    generatedAt: "2026-09-15T12:00:00.000Z",
    intake: {
      communityCity: "San Pedro Sula",
      communityId: null,
      communityName: "Residencial QA",
      contactName: "Carlos Mendoza",
      hasDestinations: true,
      hasEstablishments: true,
      hasInactiveUnits: true,
      initialAdminCount: workbook.admins.length,
      securityStaffCount: 2,
      unitNamingExample: null,
      unitTypes: ["casas"],
    },
    recommendation:
      "Confirmar las observaciones pendientes con la administración antes de continuar con la activación de la comunidad.",
    reportSchemaVersion: "entry-outrider-setup-report-v2",
    source: {
      fileId: "11111111-1111-1111-1111-111111111111",
      filename: "source.xlsx",
      sha256: "a".repeat(64),
      sha256Prefix: "aaaaaaaaaaaa",
      uploadedAt: "2026-09-15T11:00:00.000Z",
      versionLabel: "v2",
    },
    summary: {
      adminRows: workbook.admins.length,
      destinationRows: workbook.destinations.length,
      residentCoveragePercent: 100,
      residentRows: workbook.residents.length,
      units: workbook.units.length,
      unitsMissingReferences: 0,
      unitsWithReferences: workbook.units.length,
      warnings: 0,
    },
    validation: { findings: [] },
    workbook,
    workbookSchemaVersion: "entry-onboarding-workbook-v1",
  };
}

function findingCodes(validation) {
  return validation.findings.map((finding) => finding.code);
}

test("inactive units do not reduce resident coverage or create missing-resident warnings", () => {
  const workbook = workbookFixture();
  const validation = validateSetupWorkbook(workbook, [], {
    outriderCommunityName: "Residencial QA",
  });
  const summary = buildSetupReportSummary(workbook, validation);

  assert.equal(summary.residentCoveragePercent, 100);
  assert.equal(validation.counts.warnings, 0);
  assert.ok(!findingCodes(validation).includes("UNIT_HAS_NO_RESIDENT_INFORMATION"));
  assert.ok(!findingCodes(validation).includes("RESIDENT_COVERAGE_PARTIAL"));
  assert.match(
    recommendedNextStep(summary, validation, workbook),
    /lista para revisión final/i,
  );
});

test("active units without residents still produce a population warning", () => {
  const workbook = workbookFixture();
  workbook.residents = [workbook.residents[0]];
  const validation = validateSetupWorkbook(workbook, [], {
    outriderCommunityName: "Residencial QA",
  });
  const summary = buildSetupReportSummary(workbook, validation);

  assert.equal(summary.residentCoveragePercent, 50);
  assert.ok(findingCodes(validation).includes("UNIT_HAS_NO_RESIDENT_INFORMATION"));
  assert.ok(findingCodes(validation).includes("RESIDENT_COVERAGE_PARTIAL"));
});

test("customer PDF is Spanish, customer-facing, and hides internal implementation details", () => {
  assert.match(model, /entry-outrider-setup-report-v2/);
  assert.match(pdf, /Resumen preliminar de preparación/);
  assert.match(pdf, /Estado de preparación/i);
  assert.match(pdf, /Resumen de la comunidad/);
  assert.match(pdf, /Cobertura unidades activas/);
  assert.match(pdf, /Información preparada/);
  assert.match(pdf, /Observaciones antes de activar/);
  assert.match(pdf, /Siguiente paso/);
  assert.match(pdf, /Detalle para confirmación/);
  assert.match(pdf, /Listado de unidades/);
  assert.match(pdf, /Administrador inicial propuesto/);
  assert.match(pdf, /Privacidad y alcance/);
  assert.match(pdf, /Fuente de preparación: información validada por Minerva/);
  assert.match(
    pdf,
    /Una vez confirmada esta información, Minerva incorporará la comunidad a ENTRY y dará inicio a la fase de registro de residentes/,
  );
  assert.match(
    pdf,
    /Las unidades marcadas expresamente como inactivas no se cuentan como faltantes de residentes/,
  );
  assert.doesNotMatch(pdf, /Appendix/);
  assert.doesNotMatch(pdf, /snapshot\.source\.filename/);
  assert.doesNotMatch(pdf, /finding\.message/);
  assert.doesNotMatch(pdf, /finding\.field/);
  assert.doesNotMatch(pdf, /resident\.phone|resident\.email|resident\.fullName/);
});

test("customer PDF pagination keeps section headings single and sizes wrapped content", () => {
  assert.match(pdf, /const ensureDetailSpace = \(height: number\) => \{/);
  assert.doesNotMatch(
    pdf,
    /const ensureDetailSpace = \(height: number, title\?: string\)/,
  );
  assert.doesNotMatch(pdf, /if \(title\) detailY = drawSectionTitle/);
  assert.match(pdf, /const destinationRowHeight =\s*wrapText\(/);
  assert.match(pdf, /const adminRowHeight =\s*wrapText\(/);
  assert.match(pdf, /const nextStepLines = wrapText\(/);
  assert.match(pdf, /const nextHeight = Math\.max\(58,/);
  assert.match(pdf, /nextStepY - nextHeight < SAFE_CONTENT_BOTTOM/);
  assert.match(pdf, /Resumen preliminar de preparación · continuación/);
  assert.match(pdf, /measureUnitRowHeight\(label, fonts\)/);
  assert.match(pdf, /splitOversizedWord/);
  assert.match(pdf, /Establecimientos y destinos informados.*continuación/s);
  assert.match(pdf, /Administradores iniciales propuestos.*continuación/s);
});

test("customer PDF constrains long identity values and footer metadata", () => {
  assert.match(pdf, /function ellipsizeText\(/);
  assert.match(pdf, /function wrapTextClamped\(/);
  assert.match(pdf, /communityNameLines = wrapTextClamped\(/);
  assert.match(pdf, /const leftMaxWidth = Math\.max\(80, rightX - MARGIN - 14\)/);
  assert.match(pdf, /ellipsizeText\(rawLeft, fonts\.regular, footerSize, leftMaxWidth\)/);
  assert.match(pdf, /input\.width - 30/);
});

test("customer PDF renders a multi-page stress case without layout exceptions", async () => {
  const workbook = workbookFixture();
  workbook.units = Array.from({ length: 90 }, (_, index) => ({
    isActive: index % 9 !== 0,
    notes: null,
    publicReference:
      index % 11 === 0
        ? `Referencia residencial extraordinariamente larga sector norte bloque ${index + 1}`
        : `Casa ${String(index + 1).padStart(3, "0")}`,
    row: index + 2,
    unitLabel: `CASA-${String(index + 1).padStart(3, "0")}`,
    unitType: "house",
  }));
  workbook.destinations = Array.from({ length: 22 }, (_, index) => ({
    name: `Establecimiento de prueba ${index + 1} con nombre suficientemente largo para validar saltos de línea`,
    notes: null,
    reference: null,
    row: index + 2,
    type: "business",
    unitLabel: null,
  }));
  workbook.admins = Array.from({ length: 8 }, (_, index) => ({
    email: null,
    fullName: `Administrador de prueba con nombre extendido ${index + 1}`,
    phone: null,
    row: index + 2,
    unitLabel: null,
  }));

  const snapshot = snapshotFixture(workbook);
  snapshot.intake.communityName =
    "Residencial Comunitaria de Prueba con un Nombre Extraordinariamente Largo para Validar el Encabezado del Reporte y su Comportamiento en Dos Líneas";
  snapshot.intake.communityCity =
    "San Pedro Sula, Cortés, Honduras, sector metropolitano de referencia extraordinariamente largo para prueba";
  snapshot.summary.units = workbook.units.length;
  snapshot.summary.unitsWithReferences = workbook.units.length;
  snapshot.summary.destinationRows = workbook.destinations.length;
  snapshot.summary.adminRows = workbook.admins.length;
  snapshot.summary.residentCoveragePercent = 40;
  snapshot.validation.findings = [
    {
      code: "COMMUNITY_NAME_MISMATCH",
      field: null,
      message: "internal",
      row: null,
      severity: "warning",
      sheet: "Workbook",
    },
    {
      code: "UNIT_REFERENCE_MISSING",
      field: "public_reference",
      message: "internal",
      row: 3,
      severity: "warning",
      sheet: "Units",
    },
    {
      code: "UNIT_TYPE_MISSING",
      field: "unit_type",
      message: "internal",
      row: 4,
      severity: "warning",
      sheet: "Units",
    },
    {
      code: "RESIDENT_CONTACT_MISSING",
      field: null,
      message: "internal",
      row: 5,
      severity: "warning",
      sheet: "Residents",
    },
  ];
  snapshot.recommendation =
    "Confirmar con la administración cada observación pendiente antes de continuar. ".repeat(14);

  const bytes = await renderSetupReportPdf(snapshot);
  assert.ok(bytes.length > 1_000);

  const rendered = await PDFDocument.load(bytes);
  assert.ok(rendered.getPageCount() >= 5);
});
