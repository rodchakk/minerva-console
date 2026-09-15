import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
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
