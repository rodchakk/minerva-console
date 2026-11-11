import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as XLSX from "xlsx";
import { inflateRawSync } from "node:zlib";

function extractZipEntry(bytes, path) {
  let pos = 0;
  while (pos + 30 < bytes.length && bytes.readUInt32LE(pos) === 0x04034b50) {
    const method = bytes.readUInt16LE(pos + 8);
    const compressed = bytes.readUInt32LE(pos + 18);
    const nameLength = bytes.readUInt16LE(pos + 26);
    const extraLength = bytes.readUInt16LE(pos + 28);
    const name = bytes.subarray(pos + 30, pos + 30 + nameLength).toString();
    const start = pos + 30 + nameLength + extraLength;
    if (name === path) {
      const raw = bytes.subarray(start, start + compressed);
      return (method === 8 ? inflateRawSync(raw) : raw).toString();
    }
    pos = start + compressed;
  }
  throw new Error("Missing ZIP entry: " + path);
}

import { buildDirectoryExcel, DIRECTORY_HEADERS } from "../features/entry/communities/directoryExcel.ts";
import { linkedGroups } from "../features/entry/communities/directoryGroups.ts";

test("patronato directory is valid XLSX with one sheet and seven columns", () => {
  const bytes = buildDirectoryExcel("Residencial Andalucía", new Date("2026-11-10T18:00:00Z"), [
    ["Apartamento", "Apto 02", "Apartamentos Los Pinos", "Casa 1363", "Ana López", "Por revisar", ""],
    ["Casa", "Casa 105", "—", "Calle A", "Sin residente registrado", "Por revisar", ""],
  ]);
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  const book = XLSX.read(bytes, { type: "buffer" });
  assert.deepEqual(book.SheetNames, ["Directorio"]);
  const sheet = book.Sheets.Directorio;
  assert.equal(sheet.A1.v, "DIRECTORIO DE RESIDENCIAL ANDALUCÍA");
  assert.deepEqual(DIRECTORY_HEADERS, ["Tipo", "Unidad / negocio", "Conjunto / edificio", "Referencia para ubicar", "Residentes / contacto", "Revisión", "Corrección"]);
  assert.equal(sheet.A7.v, "Tipo");
  assert.equal(sheet.B8.v, "Apto 02");
  assert.equal(sheet.C8.v, "Apartamentos Los Pinos");
  assert.equal(sheet.F8.v, "Por revisar");
  assert.equal(sheet.G8?.v ?? "", "");
  assert.equal(sheet.B9.v, "Casa 105");
});

test("directory retains review controls, frozen headers and Minerva styles", () => {
  const bytes = buildDirectoryExcel("Paradis", new Date("2026-11-10T18:00:00Z"), [
    ["Por confirmar", "Local 01", "—", "Sin referencia registrada", "Sin residente registrado", "Por revisar", ""],
  ]);
  const sheet = extractZipEntry(bytes, "xl/worksheets/sheet1.xml");
  const styles = extractZipEntry(bytes, "xl/styles.xml");
  assert.match(sheet, /ySplit="7"/);
  assert.match(sheet, /autoFilter ref="A7:G8"/);
  assert.match(sheet, /sqref="F8:F1048576"/);
  assert.match(sheet, /Por revisar,Correcto,Corregir/);
  assert.match(styles, /FFA32231/);
  assert.match(styles, /FFFFF5E8/);
});

test("untrusted strings are emitted as text, not executable formulas", () => {
  const bytes = buildDirectoryExcel("=HYPERLINK()", new Date("2026-11-10T18:00:00Z"), [
    ["Casa", "=2+3", "—", "Ref", "@bad", "Por revisar", ""],
  ]);
  const book = XLSX.read(bytes, { type: "buffer" });
  const sheet = book.Sheets.Directorio;
  assert.equal(sheet.B8.t, "s");
  assert.equal(sheet.B8.v, "=2+3");
  assert.equal(sheet.B8.f, undefined);
  assert.equal(sheet.E8.f, undefined);
});

test("linked apartments share an existing verified building label, not numbered unit labels", () => {
  const units = [
    { id: "base", label: "Apartamentos Aracely" },
    { id: "2", label: "Apartamentos Aracely #02" },
    { id: "3", label: "Apartamentos Aracely #03" },
    { id: "other", label: "Casa 12" },
  ];
  const groups = linkedGroups(units, [
    { unit_a_id: "base", unit_b_id: "2" },
    { unit_a_id: "2", unit_b_id: "3" },
  ]);
  assert.equal(groups.get("base"), "Apartamentos Aracely");
  assert.equal(groups.get("2"), "Apartamentos Aracely");
  assert.equal(groups.get("3"), "Apartamentos Aracely");
  assert.equal(groups.has("other"), false);
});

test("no inferred links, missing parent and conflicting groups remain unconfirmed", () => {
  const units = [
    { id: "2", label: "Apartamentos Calderón #02" },
    { id: "6", label: "Apartamentos Calderón #06" },
    { id: "a", label: "Edificio Norte" },
    { id: "b", label: "Edificio Sur" },
    { id: "c", label: "Casa 9" },
  ];
  const groups = linkedGroups(units, [
    { unit_a_id: "2", unit_b_id: "6" },
    { unit_a_id: "a", unit_b_id: "b" },
  ]);
  assert.match(groups.get("2"), /^Conjunto por confirmar/);
  assert.match(groups.get("a"), /^Conjunto por confirmar/);
  assert.equal(groups.has("c"), false);
});

test("export endpoint requires superadmin and community-scoped, non-cacheable download", () => {
  const route = readFileSync("app/(console)/products/entry/communities/[communityId]/units/export/route.ts", "utf8");
  const query = readFileSync("features/entry/communities/directoryExportQueries.ts", "utf8");
  assert.match(route, /await requireSuperadmin\(\)/);
  assert.match(route, /getCommunityWithProgress\(communityId\)/);
  assert.match(route, /getCommunityDirectoryExport\(communityId\)/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.match(query, /"house_residents"\)\.select\("id,house_id,user_id,is_active"\)/);
  assert.match(query, /\.eq\("is_active", true\)/);
  assert.match(query, /\.eq\("community_id", communityId\)/);
  assert.match(query, /start \+= size/);
  assert.match(query, /throw new Error\("Directory export source unavailable/);
});

test("full-size community export keeps every row and does not mix community labels", () => {
  const input = Array.from({ length: 148 }, (_, i) => [
    "Casa", "Casa " + (i + 1), "—", "Referencia " + (i + 1),
    "Residente " + (i + 1), "Por revisar", "",
  ]);
  const bytes = buildDirectoryExcel("Residencial Andalucia", new Date("2026-11-10T18:00:00Z"), input);
  const wb = XLSX.read(bytes, { type: "buffer" });
  assert.deepEqual(wb.SheetNames, ["Directorio"]);
  assert.equal(wb.Sheets.Directorio["!ref"], "A1:G155");
  assert.equal(wb.Sheets.Directorio.B155.v, "Casa 148");
  assert.equal(wb.Sheets.Directorio.A1.v, "DIRECTORIO DE RESIDENCIAL ANDALUCIA");
  assert.doesNotMatch(extractZipEntry(bytes, "xl/worksheets/sheet1.xml"), /Paradis/);
});

test("worksheet follows SpreadsheetML element order required by desktop Excel", () => {
  const bytes = buildDirectoryExcel("Residencial Andalucia", new Date("2026-11-10T18:00:00Z"), [
    ["Casa", "Casa 1", "—", "Ref", "Test Resident", "Por revisar", ""],
  ]);
  const sheet = extractZipEntry(bytes, "xl/worksheets/sheet1.xml");
  const order = ["<sheetViews>", "<sheetFormatPr", "<cols>", "<sheetData>", "<autoFilter", "<mergeCells", "<dataValidations", "<pageMargins"];
  let previous = -1;
  for (const tag of order) {
    const index = sheet.indexOf(tag);
    assert.ok(index > previous, "Invalid SpreadsheetML element sequence: " + tag);
    previous = index;
  }
  assert.equal((sheet.match(/<worksheet\\b/g) ?? []).length, 1);
  assert.equal((sheet.match(/<\\/worksheet>/g) ?? []).length, 1);
});
