import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const migration = read(
  "supabase/migrations/20260907061021_outrider_standalone_intakes.sql",
);
const actions = read("features/entry/outrider/actions.ts");
const queries = read("features/entry/outrider/queries.ts");
const gateway = read("features/entry/outrider/public/gateway.ts");
const workspace = read("features/entry/outrider/internal/OutriderWorkspace.tsx");

test("Outrider can exist before an ENTRY community", () => {
  assert.match(migration, /alter column community_id drop not null/);
  assert.match(migration, /community_name text/);
  assert.match(migration, /community_city text/);
  assert.match(migration, /create_community_outrider_session_v2/);
  assert.match(migration, /p_community_id uuid/);
  assert.match(migration, /v_outrider\.community_id is null/);
  assert.match(migration, /community_outrider_events[\s\S]*alter column community_id drop not null/);
});

test("standalone creation remains service-role mediated and keeps old v1 compatible", () => {
  assert.match(migration, /_outrider_service_role_only_v1/);
  assert.match(migration, /grant execute on function public\.create_community_outrider_session_v2[\s\S]*to service_role/);
  assert.match(migration, /_outrider_fill_community_snapshot_v2/);
  assert.match(migration, /before insert or update of community_id, community_name, community_city/);
  assert.match(actions, /create_community_outrider_session_v2/);
  assert.match(actions, /p_community_id: communityId \|\| null/);
});

test("Start Outrider defaults to a pre-ENTRY name-first flow", () => {
  assert.match(workspace, /Community name/);
  assert.match(workspace, /City/);
  assert.match(workspace, /\(optional\)/);
  assert.match(workspace, /Already exists in ENTRY\? Link existing community/);
  assert.match(workspace, /Create a new community intake instead/);
  assert.match(workspace, /Pre-ENTRY/);
});

test("standalone identity survives internal and public reads", () => {
  assert.match(queries, /community_name,community_city/);
  assert.match(queries, /nullableString\(row\.community_name\)/);
  assert.match(queries, /rawCommunityId \?\? ""/);
  assert.doesNotMatch(gateway, /!communityId \|\| !communityName/);
  assert.match(gateway, /!id \|\| !communityName/);
});

test("standalone intake does not create live ENTRY operational records", () => {
  for (const table of [
    "houses",
    "community_users",
    "guards",
    "community_destinations",
    "activation_queue",
  ]) {
    assert.doesNotMatch(
      [migration, actions].join("\n"),
      new RegExp(`\\b(insert into|update|delete from)\\s+public\\.${table}\\b`, "i"),
    );
  }
});
