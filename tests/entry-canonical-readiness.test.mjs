import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("ENTRY community list readiness delegates to the canonical onboarding progress RPC", () => {
  const migration = read(
    "supabase/migrations/20260906224056_unify_entry_onboarding_readiness.sql",
  );

  assert.match(
    migration,
    /create or replace function public\.list_superadmin_communities_with_progress_v1\(\)/,
  );
  assert.match(
    migration,
    /public\.get_community_onboarding_progress_v1\(c\.id\)/,
  );
  assert.match(migration, /onboarding_status/);
  assert.match(migration, /completed_tasks/);
  assert.match(migration, /total_tasks/);
  assert.match(migration, /next_step_key/);
  assert.match(migration, /activation_queue_pending/);
  assert.match(migration, /activation_queue_failed/);
  assert.match(migration, /activation_queue_total/);

  assert.doesNotMatch(migration, /units_ok/);
  assert.doesNotMatch(migration, /residents_ok/);
  assert.doesNotMatch(migration, /invitations_ok/);
  assert.doesNotMatch(migration, /facilities_ok/);
});
