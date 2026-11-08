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
const relationshipActions = readFileSync(
  new URL("../features/entry/communities/unitRelationshipActions.ts", import.meta.url),
  "utf8",
);
const relationshipSection = readFileSync(
  new URL("../features/entry/communities/UnitRelationshipsSection.tsx", import.meta.url),
  "utf8",
);
const ciWorkflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");


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
  assert.match(migration, /before update of house_label on public\.houses/i);
  assert.match(migration, /after update of house_label on public\.houses/i);
  assert.match(migration, /revoke all on function public\.enforce_entry_house_label_update_v1\(\) from public, anon, authenticated, service_role/i);
  assert.doesNotMatch(migration, /update public\.house_residents/i);
  assert.doesNotMatch(migration, /update public\.profiles/i);
});

test("CI executes the PostgreSQL fixture with inherited rename routes and test-only grants", () => {
  for (const phrase of ["legacy label bypassed pending activation", "legacy profile bypassed open campaign", "direct update bypassed pending activation", "RPC audit duplicated", "entry-unit-relationships fixture PASS"]) {
    assert.ok(fixture.includes(phrase), `Missing fixture assertion: ${phrase}`);
  }
  assert.match(fixture, /grant select on public\.community_settings[\s\S]*to authenticated/i);
  assert.match(ciWorkflow, /ENTRY unit relationships PostgreSQL fixture/);
  assert.match(ciWorkflow, /psql -X -v ON_ERROR_STOP=1[\s\S]*-f \/tmp\/fixture\.sql/);
});

test("stored relationships resolve by UUID and retain missing descriptive identities", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const { runInNewContext } = await import("node:vm");
  const communityId = "10000000-0000-0000-0000-000000000001";
  const unitId = "20000000-0000-0000-0000-000000000001";
  const linkedId = "20000000-0000-0000-0000-000000009999";
  const crossCommunityUser = "00000000-0000-0000-0000-000000000010";
  const missingProfileUser = "00000000-0000-0000-0000-000000000011";

  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select() { return this; }
    eq(column, value) { this.filters.push(["eq", column, value]); return this; }
    is() { return this; }
    or() { return this; }
    in(column, value) { this.filters.push(["in", column, value]); return this; }
    maybeSingle() { return Promise.resolve(this.result(true)); }
    then(resolve, reject) { return Promise.resolve(this.result(false)).then(resolve, reject); }
    result(single) {
      if (this.table === "community_settings") return { data: { allow_unit_relationships: true }, error: null };
      if (this.table === "entry_unit_links") return { data: [{ id: "link-1", unit_a_id: unitId, unit_b_id: linkedId }], error: null };
      if (this.table === "entry_unit_responsibilities") return { data: [{ id: "responsibility-1", user_id: crossCommunityUser }, { id: "responsibility-2", user_id: missingProfileUser }], error: null };
      if (this.table === "houses") return { data: [{ id: linkedId, house_label: "Unit outside initial page", public_reference: null, unit_reference: "REF-9999" }], error: null };
      if (this.table === "community_members") return { data: [
        { user_id: crossCommunityUser, role: "ADMIN", is_active: true },
        { user_id: missingProfileUser, role: "RESIDENT", is_active: true },
      ], error: null };
      if (this.table === "profiles") {
        assert.equal(this.filters.some((filter) => filter[1] === "community_id"), false, "profile lookup must not be scoped to the profile's other community");
        return { data: [{ user_id: crossCommunityUser, full_name: "Cross-community account", community_id: "another-community" }], error: null };
      }
      return { data: single ? null : [], error: null };
    }
  }

  const testModule = { exports: {} };
  const code = ts.transpileModule(relationshipSection, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  runInNewContext(code, {
    exports: testModule.exports,
    module: testModule,
    require(name) {
      if (name === "react/jsx-runtime") return {
        jsx(type, props) { return typeof type === "function" ? type(props) : { type, props }; },
        jsxs(type, props) { return typeof type === "function" ? type(props) : { type, props }; },
      };
      if (name === "server-only") return {};
      if (name.includes("requireSuperadmin")) return { requireSuperadmin: async () => ({}) };
      if (name.includes("UnitRelationshipsPanel")) return { UnitRelationshipsPanel: (props) => ({ panel: props }) };
      if (name.includes("unitRelationshipActions")) return {
        searchRelationshipUnits: async () => ({ options: [{ id: unitId, label: "Initial unit" }], error: null }),
        searchCommunityMemberOptions: async () => ({ options: [], error: null }),
      };
      if (name.includes("supabase/admin")) return { createAdminClient: () => ({ from: (table) => new Query(table) }) };
      return {};
    },
  });
  const rendered = await testModule.exports.UnitRelationshipsSection({ communityId, unitId, unitLabel: "Current" });
  const panel = JSON.parse(JSON.stringify(rendered.panel));
  assert.equal(panel.links.length, 1);
  assert.equal(panel.links[0].unitId, linkedId);
  assert.match(panel.links[0].label, /outside initial page/);
  assert.equal(panel.responsibilities.length, 2);
  assert.equal(panel.responsibilities[0].label, "Cross-community account");
  assert.equal(panel.responsibilities[0].warning, null);
  assert.equal(panel.responsibilities[1].userId, missingProfileUser);
  assert.match(panel.responsibilities[1].label, new RegExp(missingProfileUser));
  assert.match(panel.responsibilities[1].warning, /Profile details are unavailable/);
});

test("person detail keeps assigned units outside the selector page and supports cross-community profiles", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const { runInNewContext } = await import("node:vm");
  const communityId = "10000000-0000-0000-0000-000000000001";
  const userId = "00000000-0000-4000-8000-000000000010";
  const initialHouse = "20000000-0000-0000-0000-000000000001";
  const assignedHouse = "20000000-0000-0000-0000-000000009999";
  const missingDetailsHouse = "20000000-0000-0000-0000-000000008888";

  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select(value) { this.selection = value; return this; }
    eq(column, value) { this.filters.push(["eq", column, value]); return this; }
    is() { return this; }
    in(column, value) { this.filters.push(["in", column, value]); return this; }
    ilike() { return this; }
    order() { return this; }
    limit() { return this; }
    maybeSingle() { return Promise.resolve(this.result(true)); }
    then(resolve, reject) { return Promise.resolve(this.result(false)).then(resolve, reject); }
    result(single) {
      if (this.table === "community_settings") return { data: { allow_unit_relationships: true }, error: null };
      if (this.table === "entry_unit_responsibilities") return { data: [
        { id: "responsibility-1", house_id: assignedHouse, ended_at: null },
        { id: "responsibility-2", house_id: missingDetailsHouse, ended_at: null },
      ], error: null };
      if (this.table === "houses" && this.filters.some((filter) => filter[0] === "in")) return { data: [{ id: assignedHouse, house_label: "Assigned outside page", public_reference: null, unit_reference: "REF-9999" }], error: null };
      if (this.table === "houses") return { data: [{ id: initialHouse, house_label: "Initial selector option", public_reference: null, unit_reference: "REF-1" }], error: null };
      if (this.table === "community_members") return { data: { user_id: userId, role: "ADMIN", is_active: true }, error: null };
      if (this.table === "profiles") return { data: { user_id: userId, full_name: "Profile from another community", community_id: "another-community" }, error: null };
      return { data: single ? null : [], error: null };
    }
  }

  const testModule = { exports: {} };
  const code = ts.transpileModule(relationshipActions, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, {
    exports: testModule.exports,
    module: testModule,
    require(name) {
      if (name === "next/cache") return { revalidatePath() {} };
      if (name.includes("requireSuperadmin")) return { requireSuperadmin: async () => ({}) };
      if (name.includes("deploymentBoundary")) return { getEntryPreviewReadOnlyError: () => null };
      if (name.includes("supabase/admin")) return { createAdminClient: () => ({ from: (table) => new Query(table) }) };
      if (name.includes("supabase/server")) return { createClient: async () => ({}) };
      return {};
    },
  });
  const result = JSON.parse(JSON.stringify(await testModule.exports.getUserResponsibleUnits(communityId, userId)));
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].houseId, assignedHouse);
  assert.match(result.items[0].label, /Assigned outside page/);
  assert.equal(result.items[1].houseId, missingDetailsHouse);
  assert.match(result.items[1].warning, /stored responsibility is still active/);
  assert.deepEqual(result.units.map((unit) => unit.id), [initialHouse]);
  const memberSearch = JSON.parse(JSON.stringify(await testModule.exports.searchCommunityMemberOptions(communityId, userId)));
  assert.equal(memberSearch.options.length, 1);
  assert.match(memberSearch.options[0].label, /Profile from another community/);
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
