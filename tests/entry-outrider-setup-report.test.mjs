import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createJiti } from "jiti";
import * as XLSX from "xlsx";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const jiti = createJiti(join(root, "tests", "entry-outrider-setup-report.test.mjs"), {
  alias: {
    "@": root,
    "server-only": join(root, "tests", "server-only-stub.cjs"),
  },
});
const { parseSetupWorkbookBytes } = jiti(
  join(root, "features", "entry", "outrider", "setupReport", "workbook.ts"),
);
const { validateSetupWorkbook } = jiti(
  join(root, "features", "entry", "outrider", "setupReport", "validation.ts"),
);

const model = read("features/entry/outrider/model.ts");
const actions = read("features/entry/outrider/actions.ts");
const queries = read("features/entry/outrider/queries.ts");
const publicGateway = read("features/entry/outrider/public/gateway.ts");
const detailWorkspace = read(
  "features/entry/outrider/internal/OutriderDetailWorkspace.tsx",
);
const workbook = read("features/entry/outrider/setupReport/workbook.ts");
const setupReportModel = read("features/entry/outrider/setupReport/model.ts");
const validation = read("features/entry/outrider/setupReport/validation.ts");
const reportSnapshot = read(
  "features/entry/outrider/setupReport/reportSnapshot.ts",
);
const pdf = read("features/entry/outrider/setupReport/pdf.ts");
const migration = read(
  "supabase/migrations/20260915043000_outrider_preliminary_setup_reports.sql",
);
const ci = read(".github/workflows/ci.yml");

function buildWorkbookBuffer(sheets) {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return Buffer.from(XLSX.write(book, { bookType: "xlsx", type: "buffer" }));
}

function analyzeWorkbook(sheets, context = { outriderCommunityName: "Villa Serena" }) {
  const parsed = parseSetupWorkbookBytes(buildWorkbookBuffer(sheets));
  const validationResult = validateSetupWorkbook(
    parsed.workbook,
    parsed.findings,
    context,
  );

  return { parsed, validation: validationResult };
}

function minimalSheets(overrides = {}) {
  return {
    Admins: [["full_name"], ["Admin Uno"]],
    Destinations: [["name"], ["Porton Norte"]],
    Meta: [
      ["key", "value"],
      ["schema_version", "entry-onboarding-workbook-v1"],
      ["community_name", "Villa Serena"],
    ],
    Residents: [
      ["unit_label", "full_name"],
      ["Casa 1", "Residente Uno"],
    ],
    Units: [["unit_label"], ["Casa 1"]],
    ...overrides,
  };
}

function codes(result) {
  return result.validation.findings.map((finding) => finding.code);
}

function assertFinding(result, code) {
  assert.ok(
    codes(result).includes(code),
    `Expected finding ${code}; saw ${codes(result).join(", ")}`,
  );
}

function assertNoFinding(result, code) {
  assert.ok(
    !codes(result).includes(code),
    `Did not expect finding ${code}; saw ${codes(result).join(", ")}`,
  );
}

function functionBody(source, functionName) {
  const start = source.indexOf(`create or replace function public.${functionName}`);
  assert.notEqual(start, -1, `Expected SQL function body for ${functionName}`);
  const afterStart = source.slice(start);
  const endMarker = "$function$;";
  const end = afterStart.indexOf(endMarker);
  assert.notEqual(end, -1, `Expected SQL function terminator for ${functionName}`);
  return afterStart.slice(0, end + endMarker.length);
}

test("setup_workbook is internal-only while public uploads remain community_data", () => {
  assert.match(model, /"setup_workbook"/);
  assert.match(model, /OUTRIDER_PUBLIC_UPLOAD_CATEGORIES = \["community_data"\] as const/);
  assert.match(publicGateway, /category === "setup_workbook"/);
  assert.match(actions, /uploadSetupWorkbook/);
  assert.match(actions, /requireSuperadmin/);
  assert.match(detailWorkspace, /Upload internal setup workbook/);
  assert.match(detailWorkspace, /Download setup workbook template/);
  assert.match(detailWorkspace, /workflowLocked/);
});

test("workbook contract is deterministic XLSX v1 with safety limits", () => {
  const contract = [setupReportModel, workbook].join("\n");
  assert.match(workbook, /SETUP_WORKBOOK_SCHEMA_VERSION/);
  assert.match(contract, /entry-onboarding-workbook-v1/);
  for (const sheet of ["Meta", "Units", "Residents", "Destinations", "Admins"]) {
    assert.match(workbook, new RegExp(`"${sheet}"`));
  }
  for (const header of [
    "unit_label",
    "public_reference",
    "full_name",
    "schema_version",
  ]) {
    assert.match(workbook, new RegExp(header));
  }
  assert.match(workbook, /MAX_WORKSHEETS/);
  assert.match(workbook, /MAX_ROWS_PER_SHEET/);
  assert.match(workbook, /MAX_TOTAL_ROWS/);
  assert.match(workbook, /MAX_CELL_STRING_LENGTH/);
  assert.match(workbook, /FORMULA_NOT_ALLOWED/);
  assert.doesNotMatch(workbook, /OpenAI|Anthropic|Gemini/i);
});

test("XLSX parser accepts minimal valid workbook with optional columns omitted", () => {
  const result = analyzeWorkbook(minimalSheets());

  assert.equal(result.parsed.workbook?.units[0].unitLabel, "Casa 1");
  assert.equal(result.parsed.workbook?.units[0].publicReference, null);
  assert.equal(result.parsed.workbook?.residents[0].email, null);
  assert.equal(result.validation.hasBlockingErrors, false);
  assertNoFinding(result, "REQUIRED_COLUMN_MISSING");
  assertFinding(result, "UNIT_REFERENCE_MISSING");
});

test("XLSX parser treats Residents, Destinations, and Admins as optional sheets", () => {
  const result = analyzeWorkbook({
    Meta: [
      ["key", "value"],
      ["schema_version", "entry-onboarding-workbook-v1"],
      ["community_name", "Villa Serena"],
    ],
    Units: [["unit_label"], ["Casa 1"]],
  });

  assert.equal(result.validation.hasBlockingErrors, false);
  assert.equal(codes(result).filter((code) => code === "OPTIONAL_SHEET_ABSENT").length, 3);
  assertNoFinding(result, "REQUIRED_COLUMN_MISSING");
});

test("XLSX validation catches duplicate normalized units without label semantics", () => {
  const result = analyzeWorkbook(
    minimalSheets({
      Units: [["unit_label"], ["Casa 1"], ["casa-1"]],
    }),
  );

  assertFinding(result, "UNIT_LABEL_DUPLICATE");
  assert.doesNotMatch(validation, /C1301|Andaluc/i);
});

test("XLSX validation catches resident references to unknown units", () => {
  const result = analyzeWorkbook(
    minimalSheets({
      Residents: [
        ["unit_label", "full_name"],
        ["Casa 404", "Residente Sin Unidad"],
      ],
    }),
  );

  assertFinding(result, "RESIDENT_UNIT_NOT_FOUND");
});

test("XLSX validation catches invalid resident email", () => {
  const result = analyzeWorkbook(
    minimalSheets({
      Residents: [
        ["unit_label", "full_name", "email"],
        ["Casa 1", "Residente Uno", "correo-invalido"],
      ],
    }),
  );

  assertFinding(result, "EMAIL_INVALID");
});

test("XLSX validation flags wrong schema version and malformed workbooks", () => {
  const wrongVersion = analyzeWorkbook(
    minimalSheets({
      Meta: [
        ["key", "value"],
        ["schema_version", "unexpected-v9"],
      ],
    }),
  );
  assertFinding(wrongVersion, "WORKBOOK_SCHEMA_VERSION_UNSUPPORTED");

  const malformed = parseSetupWorkbookBytes(Buffer.alloc(0));
  assert.equal(malformed.workbook, null);
  assert.equal(malformed.findings[0]?.code, "WORKBOOK_UNREADABLE");
});

test("XLSX validation reports partial coverage and community-name mismatch", () => {
  const result = analyzeWorkbook(
    minimalSheets({
      Meta: [
        ["key", "value"],
        ["schema_version", "entry-onboarding-workbook-v1"],
        ["community_name", "Otra Comunidad"],
      ],
      Units: [["unit_label"], ["Casa 1"], ["Casa 2"]],
    }),
  );

  assertFinding(result, "RESIDENT_COVERAGE_PARTIAL");
  assertFinding(result, "COMMUNITY_NAME_MISMATCH");
});

test("validation separates blocking errors from warnings without guessing values", () => {
  for (const code of [
    "WORKBOOK_SCHEMA_VERSION_UNSUPPORTED",
    "UNIT_LABEL_MISSING",
    "UNIT_LABEL_DUPLICATE",
    "RESIDENT_NAME_MISSING",
    "RESIDENT_UNIT_NOT_FOUND",
    "EMAIL_INVALID",
    "DESTINATION_NAME_MISSING",
    "ADMIN_NAME_MISSING",
  ]) {
    assert.match(validation, new RegExp(code));
  }
  for (const code of [
    "UNIT_REFERENCE_MISSING",
    "UNIT_ACTIVE_UNKNOWN",
    "UNIT_HAS_NO_RESIDENT_INFORMATION",
    "RESIDENT_COVERAGE_PARTIAL",
    "OPTIONAL_SHEET_ABSENT",
    "COMMUNITY_NAME_MISMATCH",
  ]) {
    assert.match([validation, workbook].join("\n"), new RegExp(code));
  }
  assert.match(validation, /severity: "error"/);
  assert.match(validation, /severity: "warning"/);
  assert.match(workbook, /return null/);
  assert.doesNotMatch(validation, /unitLabel.*C1301|Andaluc/i);
});

test("report snapshots and approval use stable fingerprints and immutable records", () => {
  assert.match(actions, /sha256Hex\(bytes\)/);
  assert.match(actions, /inputFingerprintHex/);
  assert.match(reportSnapshot, /buildRelevantOutriderInput/);
  assert.doesNotMatch(reportSnapshot, /updatedAt: detail\.updatedAt/);
  assert.match(reportSnapshot, /buildSetupReportSnapshot/);
  assert.match(queries, /isStale/);
  assert.match(queries, /latestWorkbookIsNewer/);
  assert.match(queries, /setupReports/);
  assert.match(actions, /latestSource/);
  assert.match(actions, /Regenerate analysis from the latest setup workbook/);
  assert.match(migration, /community_outrider_setup_reports/);
  assert.match(migration, /community_outrider_setup_reports_current_idx/);
  assert.match(migration, /community_outrider_setup_reports_generation_idx/);
  assert.match(migration, /prepare_community_outrider_setup_report_v1/);
  assert.match(migration, /finalize_community_outrider_setup_report_v1/);
  assert.match(migration, /cancel_community_outrider_setup_report_generation_v1/);
  assert.match(migration, /ENTRY_OUTRIDER_SETUP_WORKBOOK_STALE/);
  assert.match(migration, /ENTRY_OUTRIDER_APPROVED_LOCKED/);
  assert.match(migration, /_outrider_prevent_approved_report_mutation_v1/);
  assert.match(migration, /approve_community_outrider_setup_report_v1/);
  assert.match(migration, /ENTRY_OUTRIDER_SETUP_REPORT_REQUIRED/);
});

test("report PDF route downloads finalized history by exact report id", () => {
  const route = read(
    "app/(console)/products/entry/outrider/[outriderId]/setup-reports/[reportId]/pdf/route.ts",
  );

  assert.match(queries, /setupReports = asRows\(reportData\)/);
  assert.match(route, /detail\?\.setupReports\.find\(\(item\) => item\.id === params\.reportId\)/);
  assert.doesNotMatch(route, /currentSetupReport\?\.id === params\.reportId/);
  assert.match(route, /createSignedUrl/);
});

test("setup report approval and final Outrider approval remain separate gates", () => {
  const setupApproval = functionBody(
    migration,
    "approve_community_outrider_setup_report_v1",
  );
  const finalApproval = functionBody(migration, "approve_community_outrider_v1");

  assert.match(setupApproval, /set status = 'approved'/);
  assert.doesNotMatch(setupApproval, /set status = 'approved'[\s\S]*community_outrider_sessions/);
  assert.match(finalApproval, /where outrider_id = v_outrider\.id[\s\S]*and status = 'approved'/);
  assert.match(finalApproval, /ENTRY_OUTRIDER_SETUP_REPORT_REQUIRED/);
  assert.match(finalApproval, /v_latest_source_id is distinct from v_report\.source_file_id/);
  assert.match(finalApproval, /v_report\.input_sha256 is distinct from p_current_input_sha256/);
  assert.match(finalApproval, /ENTRY_OUTRIDER_SETUP_REPORT_STALE/);
  assert.match(finalApproval, /update public\.community_outrider_sessions[\s\S]*set status = 'approved'/);
  assert.match(actions, /approveOutriderSession/);
  assert.match(actions, /p_current_input_sha256/);
  assert.match(detailWorkspace, /Final approve Outrider/);
});

test("final approval locks setup mutations after Outrider approval", () => {
  for (const functionName of [
    "record_community_outrider_setup_workbook_v1",
    "prepare_community_outrider_setup_report_v1",
    "finalize_community_outrider_setup_report_v1",
    "approve_community_outrider_setup_report_v1",
  ]) {
    assert.match(
      functionBody(migration, functionName),
      /v_outrider\.status = 'approved'[\s\S]*ENTRY_OUTRIDER_APPROVED_LOCKED/,
    );
  }
});

test("generation reservations are recoverable without reusing versions", () => {
  const prepare = functionBody(
    migration,
    "prepare_community_outrider_setup_report_v1",
  );
  const cancel = functionBody(
    migration,
    "cancel_community_outrider_setup_report_generation_v1",
  );
  const finalize = functionBody(
    migration,
    "finalize_community_outrider_setup_report_v1",
  );
  const approval = functionBody(
    migration,
    "approve_community_outrider_setup_report_v1",
  );

  assert.match(migration, /'abandoned'/);
  assert.match(migration, /abandoned_at\s+timestamptz/);
  assert.match(prepare, /generated_at < now\(\) - interval '15 minutes'/);
  assert.match(prepare, /set status = 'abandoned'/);
  assert.match(prepare, /where r\.outrider_id = v_outrider\.id[\s\S]*and r\.status = 'generating'[\s\S]*ENTRY_OUTRIDER_SETUP_REPORT_GENERATION_IN_PROGRESS/);
  assert.match(prepare, /select coalesce\(max\(version\), 0\) \+ 1/);
  assert.match(cancel, /set status = 'abandoned'/);
  assert.doesNotMatch(cancel, /delete from public\.community_outrider_setup_reports/);
  assert.match(finalize, /v_report\.status <> 'generating'/);
  assert.match(approval, /v_report\.status <> 'draft'/);
  assert.match(queries, /\.in\("status", \["draft", "approved", "superseded"\]\)/);
});

test("PDF output is Spanish, preliminary, and omits resident PII roster", () => {
  assert.match(pdf, /Resumen preliminar de preparación/);
  assert.match(pdf, /Documento preliminar/);
  assert.match(pdf, /Todavía no se ha aplicado ningún cambio operativo a ENTRY/);
  assert.match(pdf, /Siguiente paso/);
  assert.match(pdf, /á|é|í|ó|ú|ñ|Ñ/);
  assert.match(pdf, /Este reporte no incluye nombres, teléfonos ni correos del directorio de residentes/);
  assert.doesNotMatch(pdf, /resident\.phone|resident\.email|resident\.fullName/);
  assert.match(actions, /renderSetupReportPdf/);
  assert.match(actions, /application\/pdf/);
});

test("database mutation stays service-role-only and does not create operational ENTRY data", () => {
  for (const rpc of [
    "record_community_outrider_setup_workbook_v1",
    "prepare_community_outrider_setup_report_v1",
    "finalize_community_outrider_setup_report_v1",
    "cancel_community_outrider_setup_report_generation_v1",
    "approve_community_outrider_setup_report_v1",
  ]) {
    assert.match(migration, new RegExp(`${rpc}[\\s\\S]*_outrider_service_role_only_v1`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]*to service_role`));
  }
  for (const table of [
    "houses",
    "community_users",
    "profiles",
    "guards",
    "community_destinations",
    "resident_activation_queue",
    "community_registration_campaigns",
  ]) {
    assert.doesNotMatch(
      migration,
      new RegExp(`\\b(insert into|update|delete from)\\s+public\\.${table}\\b`, "i"),
    );
  }
});

test("ENTRY Outrider CI includes setup report regressions", () => {
  assert.match(ci, /tests\/entry-outrider-setup-report\.test\.mjs/);
});
