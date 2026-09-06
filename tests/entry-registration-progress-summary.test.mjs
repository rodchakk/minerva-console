import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const card = read(
  "features/entry/communityRegistration/admin/CommunityRegistrationCard.tsx",
);
const queries = read(
  "features/entry/communityRegistration/admin/queries.ts",
);

test("registration card replaces submitted states with unit-based registration progress", () => {
  assert.match(card, /Registration progress/);
  assert.match(card, /units submitted/);
  assert.match(card, /residents received/);
  assert.match(card, /units remaining/);
  assert.match(card, /registrationProgress\.percent/);
  assert.match(card, /registrationProgress\.submittedUnits/);
  assert.match(card, /registrationProgress\.totalUnits/);
  assert.match(card, /registrationProgress\.residentCount/);
  assert.doesNotMatch(card, /Submitted states/);
});

test("registration progress denominator is participating units, not resident limits", () => {
  assert.match(queries, /const totalUnits = participatingUnits\.length/);
  assert.match(queries, /submittedUnits/);
  assert.match(queries, /residentCount/);
  assert.match(queries, /submittedUnits \/ totalUnits/);
  assert.match(queries, /Math\.max\(totalUnits - submittedUnits, 0\)/);
  assert.doesNotMatch(queries, /resident_limit_override/);
  assert.doesNotMatch(queries, /default_resident_limit/);
});
