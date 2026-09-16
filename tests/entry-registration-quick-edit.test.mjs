import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260916060000_entry_registration_admin_quick_edit.sql";
const actionPath =
  "features/entry/communityRegistration/review/quickEditActions.ts";
const panelPath =
  "features/entry/communityRegistration/review/QuickEditResidents.tsx";
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

test("review page surfaces quick edit as a separate non-formal admin tool", async () => {
  const [panel, page] = await Promise.all([source(panelPath), source(pagePath)]);

  assert.match(panel, /Admin quick edit/);
  assert.match(panel, /does not mark the household reviewed or open a correction request/);
  assert.match(panel, /Save changes/);
  assert.match(page, /<QuickEditResidents/);
  assert.match(page, /<ReviewWorkspace/);
});
