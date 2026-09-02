import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const detailPage = fs.readFileSync(
  "app/(field)/field/entry/communities/[communityId]/people/residents/[userId]/page.tsx",
  "utf8",
);
const actions = fs.readFileSync(
  "features/entry/field/adminProfileActions.ts",
  "utf8",
);
const profileEditor = fs.readFileSync(
  "features/entry/field/FieldAdminProfileEditor.tsx",
  "utf8",
);
const unitAssignment = fs.readFileSync(
  "features/entry/field/FieldAdminUnitAssignment.tsx",
  "utf8",
);

test("Field People exposes profile and unit controls for ADMIN accounts", () => {
  assert.match(detailPage, /const isAdmin = data\.resident\.role === "ADMIN"/);
  assert.match(detailPage, /<FieldAdminProfileEditor/);
  assert.match(detailPage, /<FieldAdminUnitAssignment/);
  assert.match(detailPage, /Resident-only recovery actions remain unavailable/);
});

test("admin profile editing changes name and phone only", () => {
  assert.match(actions, /updateFieldAdminProfile/);
  assert.match(actions, /full_name: fullName, phone: phone \|\| null/);
  assert.doesNotMatch(actions, /auth\.admin\.updateUserById/);
  assert.match(profileEditor, /Edit name and phone without changing login identity, role, or account status/);
});

test("admin unit assignment keeps the ADMIN role and uses the canonical community update RPC", () => {
  assert.match(actions, /user\.role\.trim\(\)\.toUpperCase\(\) !== "ADMIN"/);
  assert.match(actions, /sa_update_community_user/);
  assert.doesNotMatch(actions, /sa_change_user_role/);
  assert.match(unitAssignment, /The account remains ADMIN/);
  assert.match(unitAssignment, /Assign unit/);
});

test("admin Field writes stay superadmin-only and Preview read-only", () => {
  assert.match(actions, /requireSuperadmin\(\)/);
  assert.match(actions, /getEntryPreviewReadOnlyError\(\)/);
  assert.match(actions, /Another Minerva system owner cannot be edited from Field/);
});
