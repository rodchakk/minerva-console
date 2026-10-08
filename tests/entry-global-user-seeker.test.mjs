import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("global ENTRY user seeker searches across operational identity fields", () => {
  const migration = read(
    "supabase/migrations/20261008213000_entry_global_user_seeker_search.sql",
  );
  const actions = read("features/entry/users/actions.ts");

  assert.match(migration, /p\.full_name ilike/);
  assert.match(migration, /au\.email ilike/);
  assert.match(migration, /p\.username/);
  assert.match(migration, /p\.phone/);
  assert.match(migration, /h\.house_label/);
  assert.match(migration, /c\.name/);
  assert.match(migration, /c\.city/);
  assert.match(migration, /regexp_replace\(coalesce\(p\.phone/);

  assert.match(actions, /phone: string/);
  assert.match(actions, /houseId: string/);
  assert.match(actions, /lastSignIn: string/);
  assert.match(actions, /isPrimary: boolean/);
});

test("global ENTRY Users is a table-first seeker with a fixed management drawer", () => {
  const source = read("features/entry/users/UserSearch.tsx");
  const page = read("app/(console)/products/entry/users/page.tsx");

  assert.match(
    page,
    /Find any ENTRY account and manage access, identity, role, and unit/,
  );
  assert.match(
    source,
    /Search name, email, username, phone, unit or community/,
  );
  assert.match(source, /table-fixed/);
  assert.match(source, /Last sign-in/);
  assert.match(source, /fixed inset-0 z-50/);
  assert.match(source, /w-\[560px\]/);
  assert.match(source, /User management/);
  assert.match(source, /Account details/);
  assert.match(source, /Account actions/);
  assert.match(source, /Navigation/);
  assert.doesNotMatch(source, /FloatingActionMenu/);
});

test("seeker account drawer supports quick identity, role, unit, password, and status operations", () => {
  const source = read("features/entry/users/UserSearch.tsx");
  const actions = read("features/entry/users/actions.ts");

  assert.match(source, /Edit account/);
  assert.match(source, /Change role/);
  assert.match(source, /Change unit/);
  assert.match(source, /Reset password/);
  assert.match(source, /Deactivate account/);
  assert.match(source, /Open unit/);
  assert.match(source, /Open community/);

  assert.match(source, /updateGlobalUserIdentityAction/);
  assert.match(source, /setCommunityUserRoleAction/);
  assert.match(source, /setCommunityUserUnitAction/);
  assert.match(source, /setCommunityUserPasswordAction/);
  assert.match(source, /setCommunityUserActiveStatusAction/);

  assert.match(actions, /export async function updateGlobalUserIdentityAction/);
  assert.match(actions, /export async function setCommunityUserUnitAction/);
  assert.match(actions, /COMMUNITY_USER_UNIT_CHANGED/);
  assert.match(actions, /community_user\.unit_change/);
});

test("unit reassignment preserves primary status only when safe", () => {
  const actions = read("features/entry/users/actions.ts");

  assert.match(actions, /previousWasPrimary/);
  assert.match(actions, /targetPrimary/);
  assert.match(actions, /shouldRemainPrimary = previousWasPrimary && !targetPrimary/);
  assert.match(actions, /is_primary: shouldRemainPrimary/);
  assert.match(actions, /is_primary_contact: shouldRemainPrimary/);
});
