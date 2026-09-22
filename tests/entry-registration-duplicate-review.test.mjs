import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Resident Registration gives the unit navigator more workspace", () => {
  const source = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(
    source,
    /xl:grid-cols-\[minmax\(460px,0\.92fr\)_minmax\(0,1\.08fr\)\]/,
  );
  assert.match(source, /Search units, street, or unit number/);
  assert.match(source, /\["duplicates", "Duplicates"\]/);
  assert.match(source, /Possible duplicate/);
});

test("duplicate review is visible from summary, unit rows, and selected detail", () => {
  const source = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(source, /label="Duplicates"/);
  assert.match(source, /Under duplicate review/);
  assert.match(source, /Possible duplicate detected/);
  assert.match(source, /Compare & merge/);
  assert.match(source, /Not duplicate/);
  assert.match(source, /Likely match/);
});

test("duplicate detection does not treat a shared family email alone as enough evidence", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateQueries.ts",
  );

  assert.match(source, /A shared family email by itself is not enough/);
  assert.match(source, /sameResidentCount > 0/);
  assert.match(source, /unitIdentityMatch/);
  assert.match(source, /emailMatchCount > 0/);
  assert.match(source, /phoneMatchCount > 0/);
});

test("merge flow preserves registration history and blocks post-activation merging", () => {
  const migration = read(
    "supabase/migrations/20260922023000_entry_registration_duplicate_resolution.sql",
  );

  assert.match(migration, /community_registration_duplicate_resolutions/);
  assert.match(migration, /status = 'superseded'/);
  assert.match(migration, /status = 'invalidated'/);
  assert.match(migration, /status = 'merged'/);
  assert.match(migration, /ENTRY_CR_DUPLICATE_ALREADY_ACTIVATED/);
  assert.match(
    migration,
    /v_canonical\.status <> 'submitted'[\s\S]*v_duplicate\.status <> 'submitted'/,
  );
  assert.match(migration, /shared family email alone never drives the merge/i);
});

test("duplicate mutations stay behind the existing Preview read-only boundary", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateActions.ts",
  );

  assert.match(source, /getEntryPreviewReadOnlyError/);
  assert.match(source, /merge_community_registration_units_v1/);
  assert.match(source, /resolve_community_registration_duplicate_v1/);
});
