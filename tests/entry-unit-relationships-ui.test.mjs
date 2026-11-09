import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(path, "utf8");
const actions = source("features/entry/communities/unitRelationshipActions.ts");
const panel = source("features/entry/communities/UnitRelationshipsPanel.tsx");
const workspace = source("features/entry/communities/CommunityUnitDetailWorkspace.tsx");
const page = source("app/(console)/products/entry/communities/[communityId]/units/[unitId]/page.tsx");
const section = source("features/entry/communities/UnitRelationshipsSection.tsx");

test("unit details integrates a clear gated relationships workspace", () => {
  assert.match(page, /relationships=\{/);
  assert.match(workspace, /relationships\\?: ReactNode/); // slot keeps the existing workspace intact
  assert.match(workspace, /\{relationships\s*\?\s*<div/);
  assert.match(workspace, /Unit overview/);
  assert.match(page, /casas\?\|apartamentos\?/i);
  assert.match(section, /setting\?\.allow_unit_relationships !== true\) return null/);
});

test("relationship UI explains scoped semantics and shows real saved results", () => {
  assert.match(panel, /Relationships &amp; responsibilities/);
  assert.match(panel, /Related units stay independent/);
  assert.match(panel, /not automatically residents/);
  assert.match(panel, /Search people by name, email or UUID/);
  assert.match(panel, /related .*?unit/);
  assert.match(panel, /responsible .*?person/);
  assert.match(panel, /Change saved/);
  assert.match(panel, /window\.confirm\(/);
  assert.match(panel, /details className/);
  assert.doesNotMatch(panel, /Search by account UUID/);
});

test("name and email search considers cross-community profiles but only returns actual community members", async () => {
  const { createRequire } = await import("node:module");
  const { runInNewContext } = await import("node:vm");
  const ts = createRequire(import.meta.url)("typescript");
  const communityId = "10000000-0000-0000-0000-000000000001";
  const current = "00000000-0000-4000-8000-000000000001";
  const crossProfile = "00000000-0000-4000-8000-000000000002";
  const outside = "00000000-0000-4000-8000-000000000003";
  const calls = [];

  class MembershipQuery {
    select() { return this; }
    eq(column, value) { assert.equal(column, "community_id"); assert.equal(value, communityId); return this; }
    in(column, ids) { assert.equal(column, "user_id"); calls.push(["candidates", ids]); return this; }
    order() { return this; }
    limit() { return this; }
    then(resolve, reject) {
      return Promise.resolve({ data: [
        { user_id: current, role: "RESIDENT", is_active: true },
        { user_id: crossProfile, role: "ADMIN", is_active: true },
      ], error: null }).then(resolve, reject);
    }
  }

  const mod = { exports: {} };
  const compiled = ts.transpileModule(actions, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(compiled, {
    module: mod,
    exports: mod.exports,
    require(name) {
      if (name === "next/cache") return { revalidatePath() {} };
      if (name.includes("requireSuperadmin")) return { requireSuperadmin: async () => ({}) };
      if (name.includes("deploymentBoundary")) return { getEntryPreviewReadOnlyError: () => null };
      if (name.includes("supabase/admin")) return {
        createAdminClient: () => ({ from(table) { assert.equal(table, "community_members"); return new MembershipQuery(); } }),
      };
      if (name.includes("supabase/server")) return {
        createClient: async () => ({
          rpc(name, params) {
            assert.equal(name, "sa_list_users");
            assert.equal(params.p_search, "rodolfo@example.com");
            calls.push(["rpc", params.p_community_id]);
            return Promise.resolve({ data: params.p_community_id
              ? [{ user_id: current, full_name: "Rodolfo in current community", email: "rodolfo@example.com" }]
              : [
                { user_id: crossProfile, full_name: "Rodolfo with another profile community", email: "rodolfo@example.com" },
                { user_id: outside, full_name: "Rodolfo outside membership", email: "rodolfo@example.com" },
              ], error: null });
          },
        }),
      };
      return {};
    },
  });
  const result = JSON.parse(JSON.stringify(await mod.exports.searchCommunityMemberOptions(communityId, "rodolfo@example.com")));
  assert.equal(result.error, null);
  assert.equal(result.options.length, 2);
  assert.ok(result.options.some((item) => item.id === current));
  assert.ok(result.options.some((item) => item.id === crossProfile));
  assert.ok(!result.options.some((item) => item.id === outside));
  assert.deepEqual(JSON.parse(JSON.stringify(calls.filter((call) => call[0] === "rpc"))), [["rpc", communityId], ["rpc", null]]);
  assert.ok(calls.some((call) => call[0] === "candidates" && call[1].includes(outside)));
});
