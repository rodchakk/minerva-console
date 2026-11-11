import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
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
  assert.equal(sheet.G8.v, "");
  assert.equal(sheet.B9.v, "Casa 105");
});

test("directory retains review controls, frozen headers and Minerva styles", () => {
  const bytes = buildDirectoryExcel("Paradis", new Date("2026-11-10T18:00:00Z"), [
    ["Por confirmar", "Local 01", "—", "Sin referencia registrada", "Sin residente registrado", "Por revisar", ""],
  ]);
  const workbook = XLSX.read(bytes, { type: "buffer", bookFiles: true });
  const files = workbook.files;
  assert.ok(files);
  const sheet = files["xl/worksheets/sheet1.xml"].asNodeBuffer().toString();
  const styles = files["xl/styles.xml"].asNodeBuffer().toString();
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
