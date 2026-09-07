import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("unit resident actions expose a safe move-to-unit workflow", () => {
  const ui = read("features/entry/communities/UnitResidentActions.tsx");
  const actions = read("features/entry/communities/residentMoveActions.ts");

  assert.match(ui, /Move to another unit/);
  assert.match(ui, /listResidentMoveUnitOptionsAction/);
  assert.match(ui, /moveResidentToUnitAction/);
  assert.match(ui, /Current unit/);
  assert.match(ui, /Select destination unit/);
  assert.match(ui, /Move resident/);
  assert.match(ui, /login, role,[\s\S]*account status,[\s\S]*audit history stay unchanged/);

  assert.match(actions, /\.eq\("community_id", communityId\)/);
  assert.match(actions, /\.eq\("is_active", true\)/);
  assert.match(actions, /house\.id !== currentHouseId/);
  assert.match(actions, /getEntryPreviewReadOnlyError/);
  assert.match(actions, /sa_move_community_resident_unit/);
  assert.match(actions, /p_target_house_id: targetHouseId/);
  assert.match(actions, /p_target_user_id: userId/);
});

test("resident unit move RPC preserves identity and primary-resident consistency", () => {
  const migration = read(
    "supabase/migrations/20260906225538_move_resident_between_units.sql",
  );

  assert.match(migration, /public\.is_superadmin\(v_actor_id\)/);
  assert.match(migration, /v_profile\.role::text not in \('RESIDENT', 'ADMIN'\)/);
  assert.match(migration, /v_target_house\.is_active = false/);
  assert.match(migration, /set is_active = false,[\s\S]*is_primary = false/);
  assert.match(migration, /set house_id = p_target_house_id/);
  assert.match(migration, /v_target_has_primary/);
  assert.match(migration, /v_source_was_primary/);
  assert.match(migration, /v_replacement_primary_user_id/);
  assert.match(migration, /RESIDENT_MOVED_BETWEEN_UNITS/);
  assert.match(migration, /community_resident\.move_unit/);
  assert.doesNotMatch(migration, /delete from public\.profiles/i);
  assert.doesNotMatch(migration, /delete from auth/i);
});

test("ENTRY Operations promotes Outrider while preserving general setup and activation context", () => {
  const dashboard = read("app/(console)/products/entry/page.tsx");

  assert.match(dashboard, /label="Residents in activation queue"/);
  assert.match(dashboard, /label="Outrider"/);
  assert.match(dashboard, /Setup priorities across ENTRY/);
  assert.match(dashboard, />Outrider</);
  assert.match(dashboard, /Pending[\s\S]*activations/);
  assert.match(dashboard, /residentsInActivationQueue/);
  assert.doesNotMatch(dashboard, /title="Outrider operations"/);
});
