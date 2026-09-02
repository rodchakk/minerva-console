import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("ENTRY Field home keeps Access as one compact task card", () => {
  const page = read("app/(field)/field/entry/page.tsx");

  assert.match(page, /href="\/field\/entry\/access"/);
  assert.match(page, />\s*Access\s*</);
  assert.match(page, /Roles and guard accounts/);
  assert.match(page, /min-h-28/);
});

test("Access keeps guard creation above the recycled global user search", () => {
  const page = read("app/(field)/field/entry/access/page.tsx");

  const createGuardIndex = page.indexOf("/field/entry/access/guards/new");
  const searchIndex = page.indexOf("searchAllFieldPeople");
  assert.ok(createGuardIndex > 0);
  assert.ok(searchIndex > 0);
  assert.match(page, /Create guard/);
  assert.match(page, /Find account to change role/);
  assert.match(page, /result\.kind === "user"/);
});

test("role changes use existing ENTRY role RPCs and protect the Field operator", () => {
  const actions = read("features/entry/field/accessActions.ts");

  assert.match(actions, /requireSuperadmin\(\)/);
  assert.match(actions, /userId === actor\.id/);
  assert.match(actions, /is_superadmin/);
  assert.match(actions, /sa_change_user_role/);
  assert.match(actions, /sa_update_community_user/);
  assert.match(actions, /p_new_role: requestedRole/);
  assert.doesNotMatch(actions, /auth\.admin\.deleteUser/);
});

test("Guard role removes unit through the existing backend and Resident requires unit when missing", () => {
  const form = read("features/entry/field/FieldAccessRoleForm.tsx");
  const actions = read("features/entry/field/accessActions.ts");

  assert.match(form, /Changing this account to Guard removes its current unit assignment/);
  assert.match(form, /Residents require a unit\. Guard accounts do not/);
  assert.match(actions, /requestedRole === "RESIDENT" && !residentHouseId/);
  assert.match(actions, /Select a unit before changing this account to Resident/);
});

test("Field guard creation reuses the established guard action without a unit", () => {
  const actions = read("features/entry/field/accessActions.ts");
  const form = read("features/entry/field/FieldCreateGuardForm.tsx");

  assert.match(actions, /createGuardAction/);
  assert.match(form, /name="communityId"/);
  assert.match(form, /name="fullName"/);
  assert.match(form, /name="username"/);
  assert.match(form, /name="password"/);
  assert.match(form, /Guard accounts are created without a unit assignment/);
  assert.doesNotMatch(form, /name="houseId"/);
});

test("role workspace stays focused on role management and does not broaden resident actions", () => {
  const rolePage = read(
    "app/(field)/field/entry/access/roles/[communityId]/[userId]/page.tsx",
  );

  assert.match(rolePage, /FieldAccessRoleForm/);
  assert.doesNotMatch(rolePage, /FieldResidentActions/);
  assert.doesNotMatch(rolePage, /FieldResidentProfileEditor/);
  assert.doesNotMatch(rolePage, /FieldUserStatusAction/);
});
