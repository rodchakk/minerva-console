import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const actionSource = read("features/entry/communities/singleUnitActions.ts");

function makeAction(options = {}) {
  const calls = { inserted: [], audited: [], revalidated: [], authChecked: 0, queried: [] };
  const existing = options.existing ?? [];
  const module = { exports: {} };
  const admin = {
    from(table) {
      if (table === "communities") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: options.communityNotFound ? null : { id: "community" },
                error: options.communityError ?? null,
              }),
            }),
          }),
        };
      }
      if (table === "houses") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                range: async (from, to) => {
                  calls.queried.push([from, to]);
                  return {
                    data: options.lookupError ? null : existing.slice(from, to + 1).map((house_label) => ({ house_label })),
                    error: options.lookupError ?? null,
                  };
                },
              }),
            }),
          }),
          insert: (row) => {
            calls.inserted.push(row);
            return {
              select: () => ({
                single: async () => ({
                  data: options.createError ? null : { id: "created-unit-id", house_label: row.house_label },
                  error: options.createError ?? null,
                }),
              }),
            };
          },
        };
      }
      if (table === "superadmin_audit_log") {
        return {
          insert: async (record) => {
            calls.audited.push(record);
            return { error: null };
          },
        };
      }
      throw Error("Unexpected table: " + table);
    },
  };
  const compiled = ts.transpileModule(actionSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    console,
    require(specifier) {
      if (specifier === "next/cache") {
        return { revalidatePath: (value) => calls.revalidated.push(value) };
      }
      if (specifier === "@/features/auth/requireSuperadmin") {
        return { requireSuperadmin: async () => {
          calls.authChecked++;
          return { user: { id: "admin-user-id" } };
        } };
      }
      if (specifier === "@/features/entry/deploymentBoundary") {
        return { getEntryPreviewReadOnlyError: () => options.preview ? "Preview read-only" : null };
      }
      if (specifier === "@/lib/supabase/admin") {
        return { createAdminClient: () => admin };
      }
      throw Error("Unexpected import: " + specifier);
    },
  });

  return { create: module.exports.createSingleCommunityUnitAction, calls };
}

const COMMUNITY_ID = "0a4f8bc1-a0a7-4000-a9ac-846a4d7a519a";
function input(unitLabel = "Casa 12", publicReference = "Calle 12, casa 12") {
  return { communityId: COMMUNITY_ID, unitLabel, publicReference };
}

test("Directory opens a compact create-one modal rather than sending Add unit to onboarding", () => {
  const directory = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");
  const dialog = read("features/entry/communities/CreateSingleUnitDialog.tsx");

  assert.match(directory, /CreateSingleUnitDialog/);
  assert.match(directory, /onClick=\{openCreateUnit\}/);
  assert.match(directory, />\s*Create unit\s*</);
  assert.match(directory, />\s*Add unit\s*</);
  assert.match(directory, /Import units \(bulk\)/);
  assert.match(directory, /onCreated=\{handleUnitCreated\}/);
  assert.match(directory, /setFilter\("all"\)/);
  assert.match(directory, /router\.refresh\(\)/);
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /dialog\.showModal\(\)/);
  assert.match(dialog, /Unit name/);
  assert.match(dialog, /Resident-facing reference/);
  assert.match(dialog, /maxLength=\{120\}/);
  assert.match(dialog, /maxLength=\{160\}/);
  assert.match(dialog, /createSingleCommunityUnitAction/);
  assert.doesNotMatch(dialog, /units_input|create_houses_bulk|Activation PIN/);
});

test("single unit creates exactly one house with optional resident-facing reference", async () => {
  const { create, calls } = makeAction();
  const result = await create(input("  Casa    12  ", "  Calle 12, casa 12  "));
  assert.equal(result.success, true);
  assert.equal(result.unitId, "created-unit-id");
  assert.equal(calls.authChecked, 1);
  assert.equal(calls.inserted.length, 1);
  assert.equal(calls.inserted[0].community_id, COMMUNITY_ID);
  assert.equal(calls.inserted[0].house_label, "Casa 12");
  assert.equal(calls.inserted[0].public_reference, "Calle 12, casa 12");
  assert.equal(calls.audited.length, 1);
  assert.equal(calls.audited[0].actor_user_id, "admin-user-id");
  assert.equal(calls.revalidated.some((path) => path.endsWith("/units")), true);
});

test("blank optional reference is persisted as null", async () => {
  const { create, calls } = makeAction();
  const result = await create(input("Casa 13", "  "));
  assert.equal(result.success, true);
  assert.equal(calls.inserted[0].public_reference, null);
});

test("duplicate names differing in case, whitespace, or punctuation do not modify existing houses", async () => {
  const { create, calls } = makeAction({ existing: ["Casa-12"] });
  const result = await create(input(" CASA 12 "));
  assert.equal(result.success, false);
  assert.match(result.error, /already exists/);
  assert.equal(calls.inserted.length, 0);
  assert.equal(calls.revalidated.length, 0);
});

test("duplicate detection checks subsequent pages of houses", async () => {
  const previous = Array.from({ length: 500 }, (_, index) => "Casa " + (index + 1));
  const { create, calls } = makeAction({ existing: [...previous, "Torre A 101"] });
  const result = await create(input("Torre-A101"));
  assert.equal(result.success, false);
  assert.equal(calls.queried.length, 2);
  assert.equal(calls.inserted.length, 0);
});

test("input validation blocks missing name, invalid name, and long reference before database use", async () => {
  for (const values of [input(""), input("!!!"), input("Casa 12", "R".repeat(161)), input("X".repeat(121))]) {
    const { create, calls } = makeAction();
    const result = await create(values);
    assert.equal(result.success, false);
    assert.equal(calls.inserted.length, 0);
  }
});

test("Preview read-only prevents all writes", async () => {
  const { create, calls } = makeAction({ preview: true });
  const result = await create(input());
  assert.equal(result.success, false);
  assert.match(result.error, /Preview/);
  assert.equal(calls.inserted.length, 0);
});

test("concurrent exact-name conflict from database is handled as a duplicate", async () => {
  const { create, calls } = makeAction({ createError: { code: "23505" } });
  const result = await create(input());
  assert.equal(result.success, false);
  assert.match(result.error, /already exists/);
  assert.equal(calls.audited.length, 0);
});

test("unknown community and lookup errors fail closed", async () => {
  for (const options of [{ communityNotFound: true }, { lookupError: { code: "42501" } }]) {
    const { create, calls } = makeAction(options);
    const result = await create(input());
    assert.equal(result.success, false);
    assert.equal(calls.inserted.length, 0);
  }
});
