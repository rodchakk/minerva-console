import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url),"utf8");
const search = read("features/entry/users/UserSearch.tsx");
const units = read("features/entry/users/globalUnitActions.ts");
const drawer = read("features/entry/users/GlobalUnitDrawer.tsx");
test("global unit search does not depend on a resident account",()=>{
  assert.match(units,/from\("houses"\)/);
  assert.match(units,/await requireSuperadmin\(\)/);
  assert.match(units,/\.ilike\(field, pattern\)/);
  assert.match(search,/\["units", "Units", unitResults.length\]/);
  assert.match(search,/visibleUnits.map/);
});
test("only one drawer is visible; unit details are scoped",()=>{
  assert.match(search,/selectedUser\?\.source === "account" && !selectedUnit/);
  assert.match(units,/getCommunityUnitDetailPageData\(communityId, unitId\)/);
  assert.match(drawer,/onOpenUnit=\{openUnit\}/);
});
test("V3 unit overview and operational remain small; actions are separated",()=>{
  for(const label of ["Overview","Household","Operational","Unit connections","Actions"]) assert.ok(drawer.includes(label));
  assert.match(drawer,/title="Operational context"/);
  assert.doesNotMatch(drawer,/Dependency inspection|Review permanent deletion/);
  assert.match(drawer,/CommunityUnitQuickActions/);
  assert.match(drawer,/UnitRelationshipsPanel/);
});
