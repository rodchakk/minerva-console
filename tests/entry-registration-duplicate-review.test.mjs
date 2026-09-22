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
  assert.match(source, /Search unit, resident, email or phone/);
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

test("duplicate matcher promotes strong normalized resident evidence and keeps expanded-name cases reviewable", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateQueries.ts",
  );

  assert.match(source, /normalizedEmail\(row\.normalized_email\) \?\? normalizedEmail\(row\.email\)/);
  assert.match(source, /normalizedPhone\(row\.normalized_phone\) \?\? normalizedPhone\(row\.phone\)/);
  assert.match(source, /sameName && \(sameEmail \|\| samePhone\)/);
  assert.match(source, /expandedName && sameEmail && samePhone/);
  assert.match(source, /kind: "needs_review"/);
  assert.match(source, /Compatible names share a phone; operator must confirm/);
  assert.match(source, /Activated/);
});

test("merge dialog shows lifecycle blockers and resident-level resolution preview", () => {
  const source = read(
    "features/entry/communityRegistration/review/DuplicateReviewDialog.tsx",
  );

  assert.match(source, /Step \{unit\.lifecycle\.step \|\| 1\} of/);
  assert.match(source, /Resolve resident matches/);
  assert.match(source, /Merge as same person/);
  assert.match(source, /Keep separate/);
  assert.match(source, /Resulting resident/);
  assert.match(source, /Merge result/);
  assert.match(source, /resident_merge_plan/);
  assert.match(source, /Merge is locked because resident decisions are still unresolved/);
});

test("registration search uses latest staging resident identity and contact data", () => {
  const source = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(source, /registrationSearchByUnitId/);
  assert.match(source, /resident\.fullName/);
  assert.match(source, /resident\.email/);
  assert.match(source, /resident\.phone/);
  assert.match(source, /normalizedSearchPhone\(unitSearch\)/);
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
  assert.match(migration, /p_resident_plan jsonb/);
  assert.match(migration, /resident_resolution_plan/);
  assert.match(migration, /ENTRY_CR_DUPLICATE_RESIDENT_UNRESOLVED/);
});

test("duplicate mutations stay behind the existing Preview read-only boundary", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateActions.ts",
  );

  assert.match(source, /getEntryPreviewReadOnlyError/);
  assert.match(source, /merge_community_registration_units_v1/);
  assert.match(source, /resolve_community_registration_duplicate_v1/);
});
