import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Resident Registration opens as a Pending-first operational queue", () => {
  const source = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(source, /useState<UnitFilter>\("pending"\)/);
  assert.match(
    source,
    /\["pending", "Pending"\][\s\S]*\["duplicates", "Duplicates"\][\s\S]*\["reviewed", "Reviewed"\][\s\S]*\["activation", "Activation"\][\s\S]*\["all", "All"\][\s\S]*\["resolved", "Resolved"\]/,
  );
  assert.match(source, /Search unit, resident, email or phone/);
});

test("selected unit separates duplicate alert from activation status", () => {
  const source = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(source, /Duplicate alert/);
  assert.match(source, /Possible duplicate found/);
  assert.match(source, /Compare & review/);
  assert.match(source, /Mark not duplicate/);
  assert.match(source, /Activation status/);
  assert.match(source, /Open Activation Queue/);
});

test("resolved duplicate history stays distinct from a real merge", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateQueries.ts",
  );
  const workspace = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );
  const migration = read(
    "supabase/migrations/20260922023000_entry_registration_duplicate_resolution.sql",
  );

  assert.match(source, /resolutionType: "merged" \| "resolved_duplicate" \| null/);
  assert.match(source, /resolvedUnitIds/);
  assert.match(workspace, /Resolved duplicate/);
  assert.match(workspace, /Related registrations/);
  assert.match(migration, /resolution_type='resolved_duplicate' is authoritative/i);
});

test("duplicate matcher keeps shared family contacts conservative", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateQueries.ts",
  );

  assert.match(source, /A shared family email by itself is not enough/);
  assert.match(source, /Shared email only; not enough to merge residents/);
  assert.match(source, /Shared phone only; not enough to merge residents/);
  assert.match(source, /Compatible names share a phone; operator must confirm/);
});

test("Herberth and Herbert style tiny-name variants require both contacts", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateQueries.ts",
  );

  assert.match(source, /function isTinyNameVariant/);
  assert.match(source, /\(expandedName \|\| tinyNameVariant\) && sameEmail && samePhone/);
  assert.match(source, /near-identical names with the same email and phone/);
});

test("dialog switches between merge, archive, and manual identity review", () => {
  const source = read(
    "features/entry/communityRegistration/review/DuplicateReviewDialog.tsx",
  );

  assert.match(source, /Compare & resolve household/);
  assert.match(source, /const resolveMode/);
  assert.match(source, /const manualIdentityReview/);
  assert.match(source, /Archive duplicate/);
  assert.match(source, /Resolve duplicate/);
  assert.match(source, /Manual identity review required/);
  assert.match(source, /Merge units/);
});

test("advanced canonical resolution preserves unique information for review", () => {
  const source = read(
    "features/entry/communityRegistration/review/DuplicateReviewDialog.tsx",
  );

  assert.match(source, /Unique information found in/);
  assert.match(source, /uniqueDataAcknowledged/);
  assert.match(source, /Preserve it in archived/);
  assert.match(source, /operational household will not be changed/);
});

test("merge backend derives truth from source residents rather than client result fields", () => {
  const migration = read(
    "supabase/migrations/20260922023000_entry_registration_duplicate_resolution.sql",
  );

  assert.match(migration, /server_resolved_plan/);
  assert.match(migration, /client_resident_plan/);
  assert.match(migration, /ENTRY_CR_DUPLICATE_RESIDENT_UNRESOLVED/);
  assert.match(migration, /ENTRY_CR_DUPLICATE_RESIDENT_CONFLICT/);
  assert.match(migration, /v_result_email := coalesce\(v_source_match\.email, v_resident\.email\)/);
  assert.doesNotMatch(
    migration,
    /v_result_email := nullif\(btrim\(coalesce\(v_plan_decision->>'resultEmail'/,
  );
});

test("tampered resident ids are rejected by the merge RPC", () => {
  const migration = read(
    "supabase/migrations/20260922023000_entry_registration_duplicate_resolution.sql",
  );

  assert.match(
    migration,
    /duplicate_resident\.submission_id = v_duplicate_submission\.id/,
  );
  assert.match(
    migration,
    /canonical_resident\.submission_id = v_canonical_submission\.id/,
  );
  assert.match(migration, /ENTRY_CR_DUPLICATE_RESIDENT_PLAN_REQUIRED/);
});

test("resolve duplicate backend never rewrites operational identity tables", () => {
  const migration = read(
    "supabase/migrations/20260922023000_entry_registration_duplicate_resolution.sql",
  );
  const start = migration.indexOf(
    "create or replace function public.resolve_community_registration_archived_duplicate_v1",
  );
  assert.ok(start >= 0);
  const resolveSource = migration.slice(start);

  assert.match(resolveSource, /resolution_type/);
  assert.match(resolveSource, /'resolved_duplicate'/);
  assert.match(resolveSource, /ENTRY_CR_DUPLICATE_MANUAL_IDENTITY_REVIEW_REQUIRED/);
  assert.match(resolveSource, /ENTRY_CR_DUPLICATE_UNIQUE_DATA_REVIEW_REQUIRED/);
  assert.match(resolveSource, /update public\.community_registration_units/);
  assert.doesNotMatch(resolveSource, /update auth\.users/);
  assert.doesNotMatch(resolveSource, /update public\.resident_activation_queue/);
  assert.doesNotMatch(resolveSource, /update public\.houses/);
  assert.doesNotMatch(resolveSource, /update public\.house_residents/);
});

test("duplicate mutations remain behind Preview read-only boundary", () => {
  const source = read(
    "features/entry/communityRegistration/review/duplicateActions.ts",
  );

  assert.match(source, /getEntryPreviewReadOnlyError/);
  assert.match(source, /merge_community_registration_units_v1/);
  assert.match(source, /resolve_community_registration_archived_duplicate_v1/);
  assert.match(source, /resolve_community_registration_duplicate_v1/);
});
