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

test("representative 150-unit import can be parsed without resident data", () => {
  const rows = ["Unit Label,Reference,Resident Name,Phone,Email,Is Owner"];
  for (let index = 1; index <= 150; index += 1) {
    rows.push(`A14${index},"Avenida 14, casa ${index}",,,,`);
  }

  const result = unitsImport.parseAdvancedUnitsText(rows.join("\n"));
  assert.equal(result.errors.length, 0);
  assert.equal(result.parsedResidentRows, 0);
  assert.equal(result.uniqueUnits.length, 150);
});

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
