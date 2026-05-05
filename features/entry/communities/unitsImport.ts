"use client";

import * as XLSX from "xlsx";

export const TEMPLATE_HEADERS = [
  "Unit Label",
  "Resident Name",
  "Phone",
  "Email",
  "Is Owner",
] as const;

export const TEMPLATE_EXAMPLE_ROWS = [
  ["Casa 1", "Ana Perez", "9999-9999", "ana@example.com", "Yes"],
  ["Casa 1", "Juan Perez", "9888-8888", "juan@example.com", "No"],
  ["Casa 2", "Carlos Ruiz", "9777-7777", "", "Yes"],
] as const;

export type AdvancedImportSeverity = "error" | "warning";

export type AdvancedImportIssue = {
  message: string;
  rowNumber?: number;
  severity: AdvancedImportSeverity;
};

export type AdvancedImportRow = {
  email: string;
  isOwner: string;
  phone: string;
  rawData: Record<string, string | number>;
  residentName: string;
  residentStatus: "Prepared / not created yet";
  rowNumber: number;
  unitLabel: string;
};

export type AdvancedUnitsImportPayload = {
  blankRowsIgnored: number;
  errors: AdvancedImportIssue[];
  parsedResidentRows: number;
  rows: AdvancedImportRow[];
  sourceName: string;
  uniqueUnitLabels: string[];
  warnings: AdvancedImportIssue[];
};

type ImportColumnKey =
  | "email"
  | "isOwner"
  | "phone"
  | "residentName"
  | "unitLabel";

const HEADER_ALIASES: Record<string, ImportColumnKey> = {
  email: "email",
  isowner: "isOwner",
  owner: "isOwner",
  phone: "phone",
  resident: "residentName",
  residentname: "residentName",
  unit: "unitLabel",
  unitlabel: "unitLabel",
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function normalizeValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getHeaderIndexes(headerRow: unknown[]) {
  const indexes: Partial<Record<ImportColumnKey, number>> = {};

  headerRow.forEach((cell, index) => {
    const alias = HEADER_ALIASES[normalizeHeader(normalizeValue(cell))];
    if (alias && indexes[alias] === undefined) {
      indexes[alias] = index;
    }
  });

  return indexes;
}

function parseSheetRows(
  matrix: unknown[][],
  sourceName: string,
): AdvancedUnitsImportPayload {
  const errors: AdvancedImportIssue[] = [];
  const warnings: AdvancedImportIssue[] = [];
  const rows: AdvancedImportRow[] = [];
  const uniqueUnitLabels: string[] = [];
  const seenUnits = new Set<string>();
  let blankRowsIgnored = 0;
  let parsedResidentRows = 0;

  if (matrix.length === 0) {
    return {
      blankRowsIgnored,
      errors: [
        {
          message: "The file is empty. Download the template and add at least one row.",
          severity: "error",
        },
      ],
      parsedResidentRows,
      rows,
      sourceName,
      uniqueUnitLabels,
      warnings,
    };
  }

  const [headerRow, ...dataRows] = matrix;
  const headerIndexes = getHeaderIndexes(headerRow ?? []);

  if (headerIndexes.unitLabel === undefined) {
    errors.push({
      message: 'Missing required "Unit Label" column.',
      severity: "error",
    });
  }

  dataRows.forEach((rawRow, rowIndex) => {
    const unitLabel =
      headerIndexes.unitLabel === undefined
        ? ""
        : normalizeValue(rawRow[headerIndexes.unitLabel]);
    const residentName =
      headerIndexes.residentName === undefined
        ? ""
        : normalizeValue(rawRow[headerIndexes.residentName]);
    const phone =
      headerIndexes.phone === undefined
        ? ""
        : normalizeValue(rawRow[headerIndexes.phone]);
    const email =
      headerIndexes.email === undefined
        ? ""
        : normalizeValue(rawRow[headerIndexes.email]);
    const isOwner =
      headerIndexes.isOwner === undefined
        ? ""
        : normalizeValue(rawRow[headerIndexes.isOwner]);

    const isBlankRow = [unitLabel, residentName, phone, email, isOwner].every(
      (value) => value.length === 0,
    );

    if (isBlankRow) {
      blankRowsIgnored += 1;
      return;
    }

    const rowNumber = rowIndex + 2;

    if (!unitLabel) {
      errors.push({
        message: "Unit Label is required.",
        rowNumber,
        severity: "error",
      });
    }

    if (email && !isValidEmail(email)) {
      warnings.push({
        message: "Email format looks invalid. This will not block unit creation.",
        rowNumber,
        severity: "warning",
      });
    }

    if (residentName || phone || email || isOwner) {
      parsedResidentRows += 1;
    }

    rows.push({
      email,
      isOwner,
      phone,
      rawData: {
        email,
        isOwner,
        phone,
        residentName,
        rowNumber,
        unitLabel,
      },
      residentName,
      residentStatus: "Prepared / not created yet",
      rowNumber,
      unitLabel,
    });

    if (!unitLabel) {
      return;
    }

    const normalizedUnit = unitLabel.toLowerCase();
    if (!seenUnits.has(normalizedUnit)) {
      seenUnits.add(normalizedUnit);
      uniqueUnitLabels.push(unitLabel);
    }
  });

  return {
    blankRowsIgnored,
    errors,
    parsedResidentRows,
    rows,
    sourceName,
    uniqueUnitLabels,
    warnings,
  };
}

function sheetToMatrix(workbook: XLSX.WorkBook) {
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [] as unknown[][];
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    blankrows: false,
    defval: "",
    header: 1,
  }) as unknown[][];
}

export async function parseAdvancedUnitsFile(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  return parseSheetRows(sheetToMatrix(workbook), file.name);
}

export function parseAdvancedUnitsText(rawText: string) {
  const workbook = XLSX.read(rawText, { type: "string" });
  return parseSheetRows(sheetToMatrix(workbook), "Pasted data");
}

export function downloadAdvancedUnitsTemplate() {
  const templateRows = [
    [...TEMPLATE_HEADERS],
    ...TEMPLATE_EXAMPLE_ROWS.map((row) => [...row]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet([...templateRows]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Units");
  XLSX.writeFile(workbook, "community-units-import-template.xlsx");
}
