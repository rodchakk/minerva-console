import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("registration review reads the staging unit reference without duplicating it", () => {
  const query = read(
    "features/entry/communityRegistration/review/unitReferenceQuery.ts",
  );

  assert.match(query, /community_registration_units/);
  assert.match(query, /unit_reference_snapshot/);
  assert.doesNotMatch(query, /insert\(|update\(|upsert\(/);
});

test("selected household review visibly presents the unit reference", () => {
  const page = read(
    "app/(console)/products/entry/communities/[communityId]/registration/page.tsx",
  );
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(page, /getCommunityRegistrationUnitReference/);
  assert.match(page, /Referencia de la vivienda/);
  assert.match(page, /selectedUnitReference/);
  assert.match(page, /selectedUnit\.unitLabel/);
  assert.match(page, /Para revisión/);

  assert.match(page, /selectedUnitReference=\{selectedUnitReference\}/);
  assert.match(workspace, /selectedUnitReference: string \| null/);
  assert.match(workspace, /Referencia de la vivienda/);
  assert.match(workspace, /\{selectedUnitReference\}/);
  assert.match(workspace, /Household submission/);
});
