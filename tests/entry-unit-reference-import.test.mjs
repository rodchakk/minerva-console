import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import * as XLSX from "xlsx";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function loadUnitsImportModule() {
  const source = read("features/entry/communities/unitsImport.ts");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({
    exports: module.exports,
    module,
    require(specifier) {
      if (specifier === "xlsx") return XLSX;
      return require(specifier);
    },
  });

  vm.runInContext(transpiled, context, {
    filename: "features/entry/communities/unitsImport.ts",
  });

  return module.exports;
}

const unitsImport = loadUnitsImportModule();

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("structured import template includes optional Reference after Unit Label", () => {
  assert.deepEqual(plain(unitsImport.TEMPLATE_HEADERS), [
    "Unit Label",
    "Reference",
    "Resident Name",
    "Phone",
    "Email",
    "Is Owner",
  ]);
  assert.equal(unitsImport.TEMPLATE_EXAMPLE_ROWS[2][0], "C1202");
  assert.equal(unitsImport.TEMPLATE_EXAMPLE_ROWS[2][1], "Calle 12, casa 02");
  assert.equal(unitsImport.TEMPLATE_EXAMPLE_ROWS[2][2], "");
});

test("legacy structured imports without Reference remain valid", () => {
  const result = unitsImport.parseAdvancedUnitsText(
    [
      "Unit Label,Resident Name,Phone,Email,Is Owner",
      "Casa 1,Ana Perez,9999-9999,ana@example.com,Yes",
      "Casa 2,Carlos Ruiz,9777-7777,,No",
    ].join("\n"),
  );

  assert.equal(result.errors.length, 0);
  assert.equal(result.parsedResidentRows, 2);
  assert.deepEqual(plain(result.uniqueUnits), [
    { unitLabel: "Casa 1", reference: "" },
    { unitLabel: "Casa 2", reference: "" },
  ]);
});

test("unit-only rows with references are valid and not counted as resident rows", () => {
  const result = unitsImport.parseAdvancedUnitsText(
    [
      "Unit Label,Reference,Resident Name,Phone,Email,Is Owner",
      "C1201,\"Calle 12, casa 01\",,,,",
      "C1202,\"Calle 12, casa 02\",,,,",
    ].join("\n"),
  );

  assert.equal(result.errors.length, 0);
  assert.equal(result.parsedResidentRows, 0);
  assert.equal(result.rows[0].residentStatus, "Unit only");
  assert.deepEqual(plain(result.uniqueUnits), [
    { unitLabel: "C1201", reference: "Calle 12, casa 01" },
    { unitLabel: "C1202", reference: "Calle 12, casa 02" },
  ]);
});

test("duplicate units allow identical or blank plus populated references", () => {
  const result = unitsImport.parseAdvancedUnitsText(
    [
      "Unit Label\tReference\tResident Name\tPhone\tEmail\tIs Owner",
      "C1201\t\tAna Perez\t9999-9999\tana@example.com\tYes",
      "C1201\tCalle 12, casa 01\tJuan Perez\t9888-8888\tjuan@example.com\tNo",
      "C1201\tCalle 12, casa 01\t\t\t\t",
    ].join("\n"),
  );

  assert.equal(result.errors.length, 0);
  assert.equal(result.parsedResidentRows, 2);
  assert.deepEqual(plain(result.uniqueUnits), [
    { unitLabel: "C1201", reference: "Calle 12, casa 01" },
  ]);
});

test("duplicate units with conflicting references are blocking errors", () => {
  const result = unitsImport.parseAdvancedUnitsText(
    [
      "Unit Label,Reference,Resident Name,Phone,Email,Is Owner",
      "C1201,\"Calle 12, casa 01\",Ana Perez,9999-9999,ana@example.com,Yes",
      "C1201,\"Calle 12, casa 99\",Juan Perez,9888-8888,juan@example.com,No",
    ].join("\n"),
  );

  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /Unit C1201 has conflicting references/);
});

test("references preserve commas, spaces, and accents", () => {
  const result = unitsImport.parseAdvancedUnitsText(
    [
      "Unit Label,Reference,Resident Name,Phone,Email,Is Owner",
      "A1365,\"Avenida José Cecilio del Valle, casa 65\",,,,",
    ].join("\n"),
  );

  assert.equal(result.errors.length, 0);
  assert.equal(
    result.uniqueUnits[0].reference,
    "Avenida José Cecilio del Valle, casa 65",
  );
});





////////////////////test//////////////////////

test("approved 100-unit Andalucia import can be parsed without resident data", () => {
  const rows = ["Unit Label,Reference,Resident Name,Phone,Email,Is Owner"];

  const sections = [
    { prefix: "C12", name: "Calle 12", start: 1, end: 11 },
    { prefix: "C13", name: "Calle 13", start: 12, end: 31 },
    { prefix: "C14", name: "Calle 14", start: 32, end: 40 },
    { prefix: "C15", name: "Calle 15", start: 41, end: 51 },
    { prefix: "C16", name: "Calle 16", start: 52, end: 60 },
    { prefix: "C17", name: "Calle 17", start: 61, end: 64 },
    { prefix: "A13", name: "Avenida 13", start: 65, end: 75 },
    { prefix: "A14", name: "Avenida 14", start: 76, end: 100 },
  ];

  for (const section of sections) {
    for (let index = section.start; index <= section.end; index += 1) {
      const correlativo = String(index).padStart(2, "0");
      rows.push(
        `${section.prefix}${correlativo},"${section.name}, casa ${correlativo}",,,,`,
      );
    }
  }

  const result = unitsImport.parseAdvancedUnitsText(rows.join("\n"));

  assert.equal(result.errors.length, 0);
  assert.equal(result.parsedResidentRows, 0);
  assert.equal(result.uniqueUnits.length, 100);

  assert.equal(result.uniqueUnits[0].unitLabel, "C1201");
  assert.equal(result.uniqueUnits[0].reference, "Calle 12, casa 01");

  assert.equal(result.uniqueUnits[10].unitLabel, "C1211");
  assert.equal(result.uniqueUnits[10].reference, "Calle 12, casa 11");

  assert.equal(result.uniqueUnits[64].unitLabel, "A1365");
  assert.equal(result.uniqueUnits[64].reference, "Avenida 13, casa 65");

  assert.equal(result.uniqueUnits[99].unitLabel, "A14100");
  assert.equal(result.uniqueUnits[99].reference, "Avenida 14, casa 100");
});


////////////////////////////test/////////









test("unit reference migration establishes canonical and snapshot fields", () => {
  const migration = read(
    "supabase/migrations/20260915090000_entry_unit_references.sql",
  );

  assert.match(migration, /alter table public\.houses\s+add column if not exists unit_reference text/i);
  assert.match(migration, /alter table public\.community_registration_units\s+add column if not exists unit_reference_snapshot text/i);
  assert.match(migration, /create_houses_with_references_bulk_v1/);
  assert.match(migration, /unit_reference_snapshot/);
  assert.match(migration, /'unit_reference', v_unit\.unit_reference_snapshot/);
  assert.match(migration, /unit_reference_conflict/);
});

test("manual units remain on create_houses_bulk_v2 while structured import uses reference-aware RPC", () => {
  const actions = read("features/entry/communities/actions.ts");

  assert.match(actions, /create_houses_with_references_bulk_v1/);
  assert.match(actions, /create_houses_bulk_v2/);
  assert.match(actions, /buildActivationQueueRows\(parsedAdvancedUnits\.residentQueueRows\)/);
});
