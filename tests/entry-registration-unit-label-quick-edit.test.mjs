import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260918233000_entry_registration_admin_unit_label_quick_edit.sql";
const actionPath =
  "features/entry/communityRegistration/review/quickEditActions.ts";
const dialogPath =
  "features/entry/communityRegistration/review/QuickEditUnitDialog.tsx";
const workspacePath =
  "features/entry/communityRegistration/review/ReviewWorkspace.tsx";
const queriesPath =
  "features/entry/communityRegistration/review/queries.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("unit label quick edit is limited to resident-provided submitted staging units", async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /registration_mode <> 'resident_provided_units'/);
  assert.match(sql, /v_unit\.house_id is not null/);
  assert.match(sql, /v_unit\.status <> 'submitted'/);
  assert.match(sql, /v_latest_submission_status is distinct from 'submitted'/);
});

test("unit label quick edit changes only staging identity and rejects duplicate labels", async () => {
  const sql = await source(migrationPath);

  assert.match(sql, /update public\.community_registration_units/);
  assert.match(sql, /unit_label_snapshot = v_display_label/);
  assert.match(sql, /normalized_unit_label = v_normalized_label/);
  assert.match(sql, /ENTRY_CR_UNIT_LABEL_CONFLICT/);
  assert.doesNotMatch(sql, /update public\.houses/);
  assert.doesNotMatch(sql, /set status =/i);
});

test("unit label quick edit remains service-role and superadmin mediated", async () => {
  const [sql, action] = await Promise.all([source(migrationPath), source(actionPath)]);

  assert.match(sql, /_cr_service_role_only_v1\(\)/);
  assert.match(sql, /grant execute on function public\.quick_edit_community_registration_unit_label_v1[\s\S]*to service_role/);
  assert.match(action, /quickEditCommunityRegistrationUnitLabel/);
  assert.match(action, /requireSuperadmin\(\)/);
  assert.match(action, /getEntryPreviewReadOnlyError\(\)/);
});

test("household review exposes a compact unit edit modal only for resident-provided submitted units", async () => {
  const [dialog, workspace, queries] = await Promise.all([
    source(dialogPath),
    source(workspacePath),
    source(queriesPath),
  ]);

  assert.match(dialog, /Unit number \/ label/);
  assert.match(dialog, /Save unit/);
  assert.match(workspace, /campaign\.registrationMode === "resident_provided_units"/);
  assert.match(workspace, /setEditingUnit\(true\)/);
  assert.match(workspace, /<QuickEditUnitDialog/);
  assert.match(queries, /registrationMode: string/);
  assert.match(queries, /registration_mode/);
});
