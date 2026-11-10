import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(new URL("../supabase/migrations/20261110021500_entry_allow_bound_activation_unit_rename.sql", import.meta.url), "utf8");
const helper = readFileSync(new URL("../features/entry/activation/currentUnitLabels.ts", import.meta.url), "utf8");
const queue = readFileSync(new URL("../features/entry/activation/actions.ts", import.meta.url), "utf8");
const pins = readFileSync(new URL("../features/entry/activation/pinActions.ts", import.meta.url), "utf8");
const ci = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

test("rename allows UUID-bound pending activations without weakening unrelated guards", () => {
  assert.match(migration, /create or replace function public\.enforce_entry_house_label_update_v1\(\)/i);
  assert.match(migration, /q\.house_id is null/i);
  assert.doesNotMatch(migration, /q\.house_id\s*=\s*old\.id/i);
  assert.match(migration, /q\.status in \('pending', 'invited', 'pin_generated'\)/i);
  assert.match(migration, /u\.status = 'unregistered'/i);
  assert.match(migration, /c\.status in \('open', 'paused'\)/i);
  assert.match(migration, /unit_label_conflict/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /revoke all on function public\.enforce_entry_house_label_update_v1\(\)/i);
  assert.doesNotMatch(migration, /update\s+public\.resident_activation_queue/i);
});

test("live unit name is display-only and looked up by stable community-scoped IDs", () => {
  assert.match(helper, /from\("resident_activation_queue"\)/);
  assert.match(helper, /\.eq\("community_id", communityId\)/);
  assert.match(helper, /\.select\("id,house_id"\)/);
  assert.match(helper, /\.from\("houses"\)/);
  assert.match(helper, /\.select\("id,house_label"\)/);
  assert.match(queue, /getCurrentActivationUnitLabels\(/);
  assert.match(pins, /getCurrentActivationUnitLabels\(/);
  assert.match(ci, /entry-safe-unit-rename-pending-activation\.test\.mjs/);
  assert.match(ci, /entry-unit-rename-after-activation\.sql/);
});
