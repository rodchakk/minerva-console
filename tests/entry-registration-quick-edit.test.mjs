import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260916060000_entry_registration_admin_quick_edit.sql";
const removalMigrationPath =
  "supabase/migrations/20260922170500_entry_registration_remove_resident.sql";
const actionPath =
  "features/entry/communityRegistration/review/quickEditActions.ts";
const dialogPath =
  "features/entry/communityRegistration/review/QuickEditResidentDialog.tsx";
const workspacePath =
  "features/entry/communityRegistration/review/ReviewWorkspace.tsx";
const pagePath =
  "app/(console)/products/entry/communities/[communityId]/registration/page.tsx";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("quick edit is restricted to the current submitted household", async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /v_unit\.status <> 'submitted'/);
  assert.match(sql, /v_submission\.status <> 'submitted'/);
  assert.match(sql, /v_latest_submission_id is distinct from p_submission_id/);
  assert.match(sql, /resident_id = p_resident_id|id = p_resident_id/);
});

test("quick edit changes resident fields without advancing review workflow", async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /update public\.community_registration_residents/);
  assert.match(sql, /set full_name = v_name/);
  assert.doesNotMatch(sql, /update public\.community_registration_units\s+set status/i);
  assert.doesNotMatch(sql, /update public\.community_registration_submissions\s+set status/i);
  assert.doesNotMatch(sql, /community_registration_reviews/);
});

test("quick edit RPC is service-role only and the server action requires superadmin", async () => {
  const [sql, action] = await Promise.all([source(migrationPath), source(actionPath)]);

  assert.match(sql, /_cr_service_role_only_v1\(\)/);
  assert.match(sql, /revoke all on function public\.quick_edit_community_registration_resident_v1[\s\S]*from anon/);
  assert.match(sql, /revoke all on function public\.quick_edit_community_registration_resident_v1[\s\S]*from authenticated/);
  assert.match(sql, /grant execute on function public\.quick_edit_community_registration_resident_v1[\s\S]*to service_role/);
  assert.match(action, /requireSuperadmin\(\)/);
  assert.match(action, /getEntryPreviewReadOnlyError\(\)/);
});

test("quick edit lives inside household submission and opens a compact modal", async () => {
  const [dialog, workspace, page] = await Promise.all([
    source(dialogPath),
    source(workspacePath),
    source(pagePath),
  ]);

  assert.match(dialog, /Edit resident/);
  assert.match(dialog, /without changing the household review status/);
  assert.match(dialog, /Save changes/);
  assert.match(workspace, /setEditingResident\(quickResident\)/);
  assert.match(workspace, /<QuickEditResidentDialog/);
  assert.match(workspace, />\s*Edit\s*</);
  assert.doesNotMatch(page, /<QuickEditResidents/);
  assert.match(page, /quickEditData=\{quickEditData\}/);
});


test("resident removal is restricted to the current submitted household and keeps at least one resident", async () => {
  const sql = await source(removalMigrationPath);

  assert.match(sql, /v_unit\.status <> 'submitted'/);
  assert.match(sql, /v_submission\.status <> 'submitted'/);
  assert.match(sql, /v_latest_submission_id is distinct from p_submission_id/);
  assert.match(sql, /ENTRY_CR_RESIDENT_REMOVAL_LAST_RESIDENT/);
  assert.match(sql, /ENTRY_CR_RESIDENT_REMOVAL_ACTIVATION_LINKED/);
});

test("resident removal archives the original row before deleting it and preserves workflow state", async () => {
  const sql = await source(removalMigrationPath);

  assert.match(sql, /private\.community_registration_removed_residents/);
  assert.match(sql, /resident_snapshot/);
  assert.match(sql, /to_jsonb\(v_resident\)/);
  assert.match(sql, /'action', 'resident_removed'/);
  assert.match(sql, /delete from public\.community_registration_residents/);
  assert.match(sql, /row_number\(\) over \(order by position, id\)/);
  assert.doesNotMatch(sql, /update public\.community_registration_units\s+set status/i);
  assert.doesNotMatch(sql, /update public\.community_registration_submissions\s+set status/i);
});

test("resident removal is service-role only and exposed through the same quick edit modal", async () => {
  const [sql, action, dialog] = await Promise.all([
    source(removalMigrationPath),
    source(actionPath),
    source(dialogPath),
  ]);

  assert.match(sql, /_cr_service_role_only_v1\(\)/);
  assert.match(
    sql,
    /revoke all on function public\.remove_community_registration_resident_v1[\s\S]*from anon/,
  );
  assert.match(
    sql,
    /grant execute on function public\.remove_community_registration_resident_v1[\s\S]*to service_role/,
  );
  assert.match(action, /removeCommunityRegistrationResident/);
  assert.match(action, /remove_community_registration_resident_v1/);
  assert.match(dialog, /Danger zone/);
  assert.match(dialog, /Remove resident from household/);
  assert.match(dialog, /original record is preserved in[\s\S]*private audit history/i);
  assert.match(
    dialog,
    /will\s+not\s+be shown to Patronato or moved to Activation Queue/,
  );
});
