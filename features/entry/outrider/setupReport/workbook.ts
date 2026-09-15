import "server-only";

import * as XLSX from "xlsx";
import {
  SETUP_WORKBOOK_SCHEMA_VERSION,
  type ParsedSetupWorkbook,
  type SetupFinding,
  type SetupWorkbookAdmin,
  type SetupWorkbookDestination,
  type SetupWorkbookResident,
  type SetupWorkbookSheet,
  type SetupWorkbookUnit,
} from "@/features/entry/outrider/setupReport/model";

const MAX_WORKSHEETS = 8;
const MAX_ROWS_PER_SHEET = 1_000;
const MAX_TOTAL_ROWS = 3_000;
const MAX_CELL_STRING_LENGTH = 2_000;

const SHEET_HEADERS: Record<SetupWorkbookSheet, string[]> = {
  Admins: ["full_name", "phone", "email", "unit_label"],
  Destinations: ["name", "type", "unit_label", "reference", "notes"],
  Meta: ["key", "value"],
  Residents: ["unit_label", "full_name", "phone", "email"],
  Units: ["unit_label", "public_reference", "unit_type", "is_active", "notes"],
};

const REQUIRED_SHEET_HEADERS: Record<SetupWorkbookSheet, string[]> = {
  Admins: ["full_name"],
  Destinations: ["name"],
  Meta: ["key", "value"],
  Residents: ["unit_label", "full_name"],
  Units: ["unit_label"],
};

type Row = {
  __row: number;
  [key: string]: number | string | null;
};

function finding(input: Omit<SetupFinding, "severity"> & { severity?: SetupFinding["severity"] }): SetupFinding {
  return {
    severity: input.severity ?? "error",
    code: input.code,
    field: input.field,
    message: input.message,
    row: input.row,
    sheet: input.sheet,
  };
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeBooleanCell(value: string | null) {
  if (value === null) return null;
  const normalized = value.toLowerCase();
  if (["true", "t", "yes", "y", "1", "si", "sí"].includes(normalized)) return true;
  if (["false", "f", "no", "n", "0"].includes(normalized)) return false;
  return null;
}

function cell(row: Row, key: string) {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function sheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, {
    blankrows: false,
    defval: null,
    header: 1,
    raw: false,
  }) as unknown[][];
}

function scanSheetSafety(
  workbook: XLSX.WorkBook,
  sheetName: SetupWorkbookSheet,
): SetupFinding[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.["!ref"]) return [];

  const findings: SetupFinding[] = [];
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const rows = range.e.r - range.s.r + 1;

  if (rows > MAX_ROWS_PER_SHEET) {
    findings.push(
      finding({
        code: "WORKBOOK_ROW_LIMIT_EXCEEDED",
        field: null,
        message: `${sheetName} exceeds the ${MAX_ROWS_PER_SHEET} row safety limit.`,
        row: null,
        sheet: sheetName,
      }),
    );
  }

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const address = XLSX.utils.encode_cell({ c, r });
      const cell = sheet[address] as XLSX.CellObject | undefined;
      if (!cell) continue;

      if (cell.f) {
        findings.push(
          finding({
            code: "FORMULA_NOT_ALLOWED",
            field: null,
            message: "Formula cells are not accepted in the setup workbook contract.",
            row: r + 1,
            sheet: sheetName,
          }),
        );
      }

      if (
        typeof cell.v === "string" &&
        cell.v.length > MAX_CELL_STRING_LENGTH
      ) {
        findings.push(
          finding({
            code: "CELL_STRING_TOO_LONG",
            field: null,
            message: `Cell text exceeds the ${MAX_CELL_STRING_LENGTH} character limit.`,
            row: r + 1,
            sheet: sheetName,
          }),
        );
      }
    }
  }

  return findings;
}

function rowsWithHeaders(
  workbook: XLSX.WorkBook,
  sheetName: SetupWorkbookSheet,
  requiredHeaders: string[],
): { findings: SetupFinding[]; rows: Row[] } {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      findings: [
        finding({
          code: `${sheetName.toUpperCase()}_SHEET_MISSING`,
          field: null,
          message: `${sheetName} sheet is required.`,
          row: null,
          sheet: sheetName,
        }),
      ],
      rows: [],
    };
  }

  const rawRows = sheetRows(sheet);
  const [headerRow, ...bodyRows] = rawRows;
  const headers = (headerRow ?? []).map(normalizeHeader);
  const findings: SetupFinding[] = [];

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      findings.push(
        finding({
          code: "REQUIRED_COLUMN_MISSING",
          field: header,
          message: `${sheetName} is missing required column ${header}.`,
          row: 1,
          sheet: sheetName,
        }),
      );
    }
  }

  const rows = bodyRows
    .map((row, index) => {
      const mapped: Row = { __row: index + 2 };
      headers.forEach((header, columnIndex) => {
        if (header) mapped[header] = normalizeText((row as unknown[])[columnIndex]);
      });
      return mapped;
    })
    .filter((row) =>
      Object.entries(row).some(([key, value]) => key !== "__row" && value !== null),
    );

  return { findings, rows };
}

export function buildSetupWorkbookTemplate() {
  const workbook = XLSX.utils.book_new();

  const meta = [
    ["key", "value"],
    ["schema_version", SETUP_WORKBOOK_SCHEMA_VERSION],
    ["community_name", ""],
    ["prepared_at", ""],
    ["notes", "Use this workbook as a normalized internal setup artifact."],
  ];

  const units = [
    SHEET_HEADERS.Units,
    ["UNIT-001", "Resident-facing reference", "house", "true", ""],
    ["UNIT-002", "Second reference", "house", "true", ""],
  ];

  const residents = [
    SHEET_HEADERS.Residents,
    ["UNIT-001", "Nombre Residente", "+504 0000-0000", "residente@example.com"],
  ];

  const destinations = [
    SHEET_HEADERS.Destinations,
    ["Casa club", "common_area", "", "Referencia visible", ""],
    ["Tienda interna", "business", "UNIT-002", "", ""],
  ];

  const admins = [
    SHEET_HEADERS.Admins,
    ["Nombre Administrador", "+504 0000-0000", "admin@example.com", "UNIT-001"],
  ];

  for (const [name, data] of [
    ["Meta", meta],
    ["Units", units],
    ["Residents", residents],
    ["Destinations", destinations],
    ["Admins", admins],
  ] as const) {
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = data[0].map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }

  return Buffer.from(
    XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer,
  );
}

export function parseSetupWorkbookBytes(bytes: Buffer | Uint8Array): {
  findings: SetupFinding[];
  workbook: ParsedSetupWorkbook | null;
} {
  const findings: SetupFinding[] = [];
  let workbook: XLSX.WorkBook;
  const input = Buffer.from(bytes);

  if (
    input.length < 4 ||
    input[0] !== 0x50 ||
    input[1] !== 0x4b
  ) {
    return {
      findings: [
        finding({
          code: "WORKBOOK_UNREADABLE",
          field: null,
          message: "The setup workbook could not be read as XLSX.",
          row: null,
          sheet: "Workbook",
        }),
      ],
      workbook: null,
    };
  }

  try {
    workbook = XLSX.read(input, {
      cellDates: false,
      cellFormula: true,
      dense: false,
      raw: false,
      type: "buffer",
    });
  } catch {
    return {
      findings: [
        finding({
          code: "WORKBOOK_UNREADABLE",
          field: null,
          message: "The setup workbook could not be read as XLSX.",
          row: null,
          sheet: "Workbook",
        }),
      ],
      workbook: null,
    };
  }

  if (workbook.SheetNames.length > MAX_WORKSHEETS) {
    findings.push(
      finding({
        code: "WORKBOOK_SHEET_LIMIT_EXCEEDED",
        field: null,
        message: `Workbook exceeds the ${MAX_WORKSHEETS} worksheet safety limit.`,
        row: null,
        sheet: "Workbook",
      }),
    );
  }

  let totalRows = 0;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    totalRows += range.e.r - range.s.r + 1;
  }
  if (totalRows > MAX_TOTAL_ROWS) {
    findings.push(
      finding({
        code: "WORKBOOK_TOTAL_ROW_LIMIT_EXCEEDED",
        field: null,
        message: `Workbook exceeds the ${MAX_TOTAL_ROWS} total row safety limit.`,
        row: null,
        sheet: "Workbook",
      }),
    );
  }

  for (const sheetName of ["Meta", "Units", "Residents", "Destinations", "Admins"] as const) {
    findings.push(...scanSheetSafety(workbook, sheetName));
  }

  const metaResult = rowsWithHeaders(workbook, "Meta", REQUIRED_SHEET_HEADERS.Meta);
  const unitsResult = rowsWithHeaders(workbook, "Units", REQUIRED_SHEET_HEADERS.Units);
  findings.push(...metaResult.findings, ...unitsResult.findings);

  const optionalResults = {
    Admins: rowsWithHeaders(workbook, "Admins", REQUIRED_SHEET_HEADERS.Admins),
    Destinations: rowsWithHeaders(
      workbook,
      "Destinations",
      REQUIRED_SHEET_HEADERS.Destinations,
    ),
    Residents: rowsWithHeaders(workbook, "Residents", REQUIRED_SHEET_HEADERS.Residents),
  };

  for (const sheetName of ["Residents", "Destinations", "Admins"] as const) {
    if (!workbook.Sheets[sheetName]) {
      findings.push(
        finding({
          code: "OPTIONAL_SHEET_ABSENT",
          field: null,
          message: `${sheetName} sheet was not provided.`,
          row: null,
          severity: "warning",
          sheet: sheetName,
        }),
      );
    } else {
      findings.push(...optionalResults[sheetName].findings);
    }
  }

  const metaMap = new Map(
    metaResult.rows
      .filter((row) => cell(row, "key"))
      .map((row) => [String(cell(row, "key")), cell(row, "value")]),
  );

  const parsed: ParsedSetupWorkbook = {
    admins: workbook.Sheets.Admins
      ? optionalResults.Admins.rows.map(
          (row): SetupWorkbookAdmin => ({
            email: cell(row, "email"),
            fullName: cell(row, "full_name"),
            phone: cell(row, "phone"),
            row: row.__row,
            unitLabel: cell(row, "unit_label"),
          }),
        )
      : [],
    destinations: workbook.Sheets.Destinations
      ? optionalResults.Destinations.rows.map(
          (row): SetupWorkbookDestination => ({
            name: cell(row, "name"),
            notes: cell(row, "notes"),
            reference: cell(row, "reference"),
            row: row.__row,
            type: cell(row, "type"),
            unitLabel: cell(row, "unit_label"),
          }),
        )
      : [],
    meta: {
      communityName: metaMap.get("community_name") ?? null,
      notes: metaMap.get("notes") ?? null,
      preparedAt: metaMap.get("prepared_at") ?? null,
    },
    residents: workbook.Sheets.Residents
      ? optionalResults.Residents.rows.map(
          (row): SetupWorkbookResident => ({
            email: cell(row, "email"),
            fullName: cell(row, "full_name"),
            phone: cell(row, "phone"),
            row: row.__row,
            unitLabel: cell(row, "unit_label"),
          }),
        )
      : [],
    schemaVersion: metaMap.get("schema_version") ?? null,
    units: unitsResult.rows.map(
      (row): SetupWorkbookUnit => ({
        isActive: normalizeBooleanCell(cell(row, "is_active")),
        notes: cell(row, "notes"),
        publicReference: cell(row, "public_reference"),
        row: row.__row,
        unitLabel: cell(row, "unit_label"),
        unitType: cell(row, "unit_type"),
      }),
    ),
  };

  return { findings, workbook: parsed };
}
