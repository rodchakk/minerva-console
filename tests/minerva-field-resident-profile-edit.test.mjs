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
