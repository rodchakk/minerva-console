import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const read = (path) => readFileSync(join(process.cwd(), path), "utf8");

test("community directory searches across unit label and reference, ignoring accents and word order", () => {
  const source = read("features/entry/communities/directorySearch.ts");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, { module: testModule, exports: testModule.exports });
  const { matchesDirectorySearch } = testModule.exports;

  assert.equal(matchesDirectorySearch("apartamentos orellana", ["Apartamentos del Capitán #1", "Familia Orellana"]), true);
  assert.equal(matchesDirectorySearch("orellana capitan", ["Apartamentos del Capitán #1", "Familia Orellana"]), true);
  assert.equal(matchesDirectorySearch("capitan", ["Apartamentos del Capitán #1"]), true);
  assert.equal(matchesDirectorySearch("orellana", ["Apartamentos del Capitán #1", ""]), false);
  assert.equal(matchesDirectorySearch("   ", ["Casa 14"]), true);
});

test("directory preview reads real saved public references, without modifying unit labels", () => {
  const source = read("features/entry/communities/detailQueries.ts");
  assert.match(source, /\.select\("id,house_label,is_active,public_reference,unit_reference"\)/);
  assert.match(source, /publicReference: coerceString\(item\.public_reference\)/);
  assert.match(source, /unitReference: coerceString\(item\.unit_reference\)/);
  assert.match(source, /publicReference: referenceByHouseId\.get\(unit\.id\)/);
  assert.match(source, /unitReference: unitReferenceByHouseId\.get\(unit\.id\)/);
  assert.match(source, /enrichUnits\(units\.items, residents, pendingActivations, passes, houses\)/);
  assert.match(source, /matchesDirectorySearch\(query,/);
});

test("directory displays references, searches them and identifies missing ones", () => {
  const directory = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");
  const detail = read("features/entry/communities/CommunityUnitDetailWorkspace.tsx");
  assert.match(directory, /unit\.unitReference,/);
  assert.match(directory, /unit\.publicReference,/);
  assert.match(directory, /matchesDirectorySearch\(query, searchable\)/);
  assert.match(directory, /Missing reference/);
  assert.match(directory, /No reference registered/);
  assert.match(directory, /\["Location reference", selectedUnit\.unitReference \|\| "Not registered"\]/);
  assert.match(directory, /\["Resident-facing reference", selectedUnit\.publicReference \|\| "Not registered"\]/);
  assert.match(detail, /unit\.unitReference \|\| "Not registered"/);
  assert.match(detail, /unit\.publicReference/);
});
