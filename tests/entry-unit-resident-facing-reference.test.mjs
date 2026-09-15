import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("operational units store a durable resident-facing reference without changing identity", () => {
  const migration = read(
    "supabase/migrations/20260915033000_house_resident_facing_reference.sql",
  );

  assert.match(migration, /alter table public\.houses[\s\S]*public_reference text/);
  assert.match(migration, /char_length\(public_reference\) <= 160/);
  assert.match(migration, /Not part of unit identity/);
  assert.match(
    migration,
    /residents cannot change public_reference/,
  );
});

test("house references flow only into available existing-unit registration snapshots", () => {
  const migration = read(
    "supabase/migrations/20260915033000_house_resident_facing_reference.sql",
  );

  assert.match(
    migration,
    /tg_cr_units_inherit_house_public_reference_v1/,
  );
  assert.match(
    migration,
    /tg_houses_sync_public_reference_to_registration_units_v1/,
  );
  assert.match(migration, /u\.status = 'unregistered'/);
  assert.match(migration, /c\.registration_mode = 'existing_units'/);
  assert.match(migration, /c\.status in \('draft', 'open', 'paused', 'review'\)/);
});

test("Edit Unit exposes optional resident-facing reference controls", () => {
  const quickActions = read(
    "features/entry/communities/CommunityUnitQuickActions.tsx",
  );
  const actions = read(
    "features/entry/communities/unitReferenceActions.ts",
  );

  assert.match(quickActions, /Resident-facing reference/);
  assert.match(quickActions, /e\.g\. Calle 13 · vivienda 01/);
  assert.match(
    quickActions,
    /This does not change the unit label/,
  );
  assert.match(quickActions, /maxLength=\{160\}/);
  assert.match(quickActions, /getCommunityUnitPublicReferenceAction/);
  assert.match(quickActions, /updateCommunityUnitPublicReferenceAction/);

  assert.match(actions, /\.from\("houses"\)/);
  assert.match(actions, /public_reference/);
  assert.match(actions, /publicReference\.length > 160/);
});
