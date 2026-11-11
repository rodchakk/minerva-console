import assert from "node:assert/strict";
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
