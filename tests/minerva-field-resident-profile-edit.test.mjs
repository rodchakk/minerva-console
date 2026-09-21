import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const actionPath = "features/entry/field/residentProfileActions.ts";
const editorPath = "features/entry/field/FieldResidentProfileEditor.tsx";
const quickActionsPath = "features/entry/field/FieldResidentActions.tsx";
const accessActionPath = "features/entry/field/residentAccessActions.ts";
const roleActionPath = "features/entry/field/accessActions.ts";
const residentPagePath =
  "app/(field)/field/entry/communities/[communityId]/people/residents/[userId]/page.tsx";

test("resident profile editing is limited to name and phone", () => {
  const action = read(actionPath);

  assert.match(action, /full_name: fullName/);
  assert.match(action, /phone: phone \|\| null/);
  assert.match(action, /\.from\("profiles"\)/);
  assert.doesNotMatch(action, /auth\.admin|updateUserById|username:|auth_type:|synthetic_email:|role:|house_id:|is_active:|password:/);
});

test("resident profile action preserves authorization and Preview boundaries", () => {
  const action = read(actionPath);

  assert.match(action, /requireSuperadmin/);
  assert.match(action, /getEntryPreviewReadOnlyError/);
  assert.match(action, /getCommunityUsersPage/);
  assert.match(action, /role\.trim\(\)\.toUpperCase\(\) !== "RESIDENT"/);
  assert.match(action, /\.eq\("community_id", communityId\)/);
  assert.match(action, /\.eq\("user_id", userId\)/);
});

test("mobile editor exposes only Full name and Phone", () => {
  const editor = read(editorPath);

  assert.match(editor, /Edit resident/);
  assert.match(editor, /Full name/);
  assert.match(editor, /Phone/);
  assert.match(editor, /Save changes/);
  assert.match(editor, /Username, email, password, unit and account status stay unchanged/);
  assert.match(editor, /isReadOnlyPreview/);
  assert.doesNotMatch(editor, /setUsername|setEmail|name="username"|name="email"|type="email"/);
});

test("resident detail renders the profile editor only for residents", () => {
  const page = read(residentPagePath);

  assert.match(page, /FieldResidentProfileEditor/);
  assert.match(page, /data\.resident\.role === "RESIDENT"/);
  assert.match(page, /resident=\{data\.resident\}/);
  assert.match(page, /isReadOnlyPreview=\{isReadOnlyPreview\}/);
});


test("resident quick actions expose direct password, unit, profile, and role management", () => {
  const actions = read(quickActionsPath);

  assert.match(actions, /grid grid-cols-2 gap-2/);
  assert.match(actions, /Edit profile/);
  assert.match(actions, /Reset password/);
  assert.match(actions, /Change unit/);
  assert.match(actions, /Set role/);
  assert.match(actions, /setFieldResidentPassword/);
  assert.match(actions, /changeFieldUserRoleAction/);
  assert.match(actions, /Generate temporary PIN/);
});

test("direct Field password reset preserves admin authorization and shared six-character policy", () => {
  const action = read(accessActionPath);

  assert.match(action, /setFieldResidentPassword/);
  assert.match(action, /requireSuperadmin/);
  assert.match(action, /getEntryPreviewReadOnlyError/);
  assert.match(action, /ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH/);
  assert.match(action, /loadCanonicalResident/);
  assert.match(action, /resident\.role !== "RESIDENT"/);
  assert.match(action, /createAdminClient/);
  assert.match(action, /auth\.admin\.updateUserById/);
});

test("inline role change reuses the protected Field role action", () => {
  const actions = read(quickActionsPath);
  const roleAction = read(roleActionPath);

  assert.match(actions, /formData\.set\("role", selectedRole\)/);
  assert.match(actions, /Confirm role change/);
  assert.match(actions, /Changing this resident to Guard removes the current unit assignment/);
  assert.match(roleAction, /userId === actor\.id/);
  assert.match(roleAction, /is_superadmin/);
  assert.match(roleAction, /sa_change_user_role/);
});
