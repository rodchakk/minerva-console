import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261106090000_entry_unit_relationships_mvp.sql", import.meta.url),
  "utf8",
);
const fixture = readFileSync(
  new URL("../supabase/tests/fixtures/entry-unit-relationships.sql", import.meta.url),
  "utf8",
);
const unitActions = readFileSync(
  new URL("../features/entry/communities/unitActions.ts", import.meta.url),
  "utf8",
);


test("unit links and responsibilities are separate, tenant-scoped, historical associations", () => {
  assert.match(migration, /create table public\.entry_unit_links/i);
  assert.match(migration, /create table public\.entry_unit_responsibilities/i);
  assert.match(migration, /foreign key \(unit_a_id, community_id\)/i);
  assert.match(migration, /foreign key \(unit_b_id, community_id\)/i);
  assert.match(migration, /foreign key \(community_id, user_id\)[\s\S]*?community_members\(community_id, user_id\)/i);
  assert.match(migration, /where ended_at is null/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /revoke all on function[\s\S]*?from public,anon/i);
  assert.doesNotMatch(migration, /update public\.house_residents/i);
  assert.doesNotMatch(migration, /update public\.profiles/i);
});

test("PostgreSQL fixture covers reversals, same-community integrity and safe rename", () => {
  for (const phrase of ["reverse link duplicated", "self-link accepted", "cross-community link accepted", "missing membership accepted", "relink history missing", "rename altered relationship", "entry-unit-relationships fixture PASS"]) {
    assert.ok(fixture.includes(phrase), `Missing fixture assertion: ${phrase}`);
  }
});


test("rename delegates only to the audited RPC, even with an injected primary resident field", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const { runInNewContext } = await import("node:vm");
  const calls = [];
  const result = { success: true };
  const testModule = { exports: {} };
  const code = ts.transpileModule(unitActions, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, {
    exports: testModule.exports,
    module: testModule,
    require(name) {
      if (name.includes("unitRelationshipActions")) return { manageUnitRelationship: async (input) => { calls.push(input); return result; } };
      if (name.includes("requireSuperadmin")) return { requireSuperadmin: async () => ({}) };
      if (name.includes("deploymentBoundary")) return { getEntryPreviewReadOnlyError: () => null };
      if (name.includes("supabase/admin")) return { createAdminClient: () => { throw new Error("Rename touched the administrative database client"); } };
      return {};
    },
  });
  const response = await testModule.exports.updateCommunityUnitAction({
    communityId: "community", unitId: "stable-uuid", expectedUnitLabel: "Apartamento 1",
    unitLabel: "Casa 2009", primaryResidentUserId: "must-not-be-used",
  });
  assert.equal(response, result);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
    action: "rename_unit", communityId: "community", unitId: "stable-uuid",
    label: "Casa 2009", expectedLabel: "Apartamento 1",
  });
  result.success = false;
  result.error = "unit_relationships_disabled";
  assert.equal((await testModule.exports.updateCommunityUnitAction({
    communityId: "community", unitId: "stable-uuid", expectedUnitLabel: "old", unitLabel: "new",
  })).success, false);
});

test("scope exception rejects unrelated authorization and financial files", async () => {
  const { entryRelationshipsScope } = await import("./helpers/entry-relationships-scope.mjs");
  for (const path of ["features/entry/auth.ts", "features/brain/model.ts", "supabase/migrations/unrelated.sql", "features/seshat/payments.ts"]) {
    assert.equal(entryRelationshipsScope.has(path), false);
  }
});
