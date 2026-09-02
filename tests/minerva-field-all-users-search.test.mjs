import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const peopleModelPath = "features/entry/field/peopleModel.ts";
const peopleDataPath = "features/entry/field/peopleData.ts";
const globalModelPath = "features/entry/field/globalPeopleSearchModel.ts";
const allSearchPath = "features/entry/field/allPeopleSearch.ts";
const globalPagePath = "app/(field)/field/entry/people/page.tsx";
const overviewPath = "features/entry/field/FieldPeopleOverview.tsx";
const detailPath =
  "app/(field)/field/entry/communities/[communityId]/people/residents/[userId]/page.tsx";

test("Field People model supports every ENTRY community role", () => {
  const model = read(peopleModelPath);
  const data = read(peopleDataPath);

  assert.match(model, /"ADMIN" \| "GUARD" \| "RESIDENT" \| "UNASSIGNED"/);
  assert.match(data, /normalized === "ADMIN"/);
  assert.match(data, /normalized === "GUARD"/);
  assert.match(data, /p_include_inactive: true/);
  assert.match(data, /dedupeUsers/);
});

test("global People candidate filtering no longer drops admins or guards", () => {
  const source = read(globalModelPath);

  assert.match(source, /normalized === "ADMIN"/);
  assert.match(source, /normalized === "GUARD"/);
  assert.match(source, /normalized === "RESIDENT"/);
  assert.match(source, /normalized === "UNASSIGNED"/);
});

test("global People search hydrates effective community membership role", () => {
  const source = read(allSearchPath);

  assert.match(source, /searchFieldPeople/);
  assert.match(source, /community_members/);
  assert.match(source, /select\("community_id,user_id,role"\)/);
  assert.match(source, /kind: "user"/);
  assert.match(source, /role: roles\.get/);
});

test("People UI shows role instead of calling every account a resident", () => {
  const page = read(globalPagePath);
  const overview = read(overviewPath);

  assert.match(page, /searchAllFieldPeople/);
  assert.match(page, /\$\{result\.role\} - \$\{result\.accountState\}/);
  assert.match(page, /result\.kind === "user"/);
  assert.match(overview, />\s*People\s*</);
  assert.match(overview, /resident\.role/);
  assert.match(overview, /Search people/);
});

test("non-resident detail is visible but resident-only writes stay gated", () => {
  const source = read(detailPath);

  assert.match(source, /const isResident = data\.resident\.role === "RESIDENT"/);
  assert.match(source, /Selected user/);
  assert.match(source, /label="Role"/);
  assert.match(source, /\{isResident \? \(/);
  assert.match(source, /<FieldResidentProfileEditor/);
  assert.match(source, /<FieldResidentActions/);
  assert.match(source, /<FieldResidentStatusAction/);
  assert.match(source, /Resident-only actions are not available for this role/);
});

test("unit resident counts and household membership remain resident-only", () => {
  const source = read(peopleDataPath);

  assert.match(source, /resident\.role !== "RESIDENT"/);
  assert.match(
    source,
    /resident\.role === "RESIDENT" && resident\.houseId === unitId/,
  );
});
