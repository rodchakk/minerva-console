import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const actionPath = "features/entry/field/quickResidentActions.ts";
const formPath = "features/entry/field/FieldQuickResidentForm.tsx";
const statusPath = "features/entry/field/FieldResidentStatusAction.tsx";
const unitPath =
  "app/(field)/field/entry/communities/[communityId]/people/units/[unitId]/page.tsx";
const residentPath =
  "app/(field)/field/entry/communities/[communityId]/people/residents/[userId]/page.tsx";
const createPagePath =
  "app/(field)/field/entry/communities/[communityId]/people/units/[unitId]/residents/new/page.tsx";

test("unit detail exposes linked resident state and quick-create route", () => {
  const source = read(unitPath);

  assert.match(source, /resident\.role === "RESIDENT"/);
  assert.match(source, /resident\.accountState/);
  assert.match(source, /Add resident/);
  assert.match(source, /\/residents\/new/);
  assert.doesNotMatch(source, /createGuardAction|ADMIN|GUARD/);
});

test("resident detail exposes status controls only through the Field resident action", () => {
  const page = read(residentPath);
  const status = read(statusPath);

  assert.match(page, /FieldResidentStatusAction/);
  assert.match(page, /data\.resident\.role === "RESIDENT"/);
  assert.match(status, /Deactivate resident/);
  assert.match(status, /Reactivate resident/);
  assert.match(status, /setFieldResidentActiveStatus/);
  assert.match(status, /confirm/i);
  assert.match(status, /isReadOnlyPreview/);
  assert.doesNotMatch(status, /deleteUser|remove.*membership/i);
});

test("resident status action validates canonical resident before reusing existing backend action", () => {
  const source = read(actionPath);

  assert.match(source, /getCommunityUsersPage/);
  assert.match(source, /role\.trim\(\)\.toUpperCase\(\) !== "RESIDENT"/);
  assert.match(source, /setCommunityUserActiveStatusAction/);
  assert.match(source, /getEntryPreviewReadOnlyError/);
  assert.match(source, /requireSuperadmin/);
});

test("quick create is server-forced resident and validates unit-community boundary", () => {
  const source = read(actionPath);

  assert.match(source, /\.from\("houses"\)/);
  assert.match(source, /\.eq\("community_id", communityId\)/);
  assert.match(source, /\.eq\("id", unitId\)/);
  assert.match(source, /p_role: "RESIDENT"/);
  assert.match(source, /entry_role: "RESIDENT"/);
  assert.match(source, /sa_setup_user_profile/);
  assert.match(source, /Residents cannot be created in an inactive unit/);
  assert.doesNotMatch(source, /p_role: input\.|role: input\./);
});

test("quick create reuses canonical username identity and cleans up partial failures", () => {
  const source = read(actionPath);

  assert.match(source, /resident-\$\{username\}@entry\.internal/);
  assert.match(source, /auth_type: authType/);
  assert.match(source, /synthetic_email: syntheticEmail/);
  assert.match(source, /username_login_enabled: authType === "username"/);
  assert.match(source, /\.ilike\("username", username\)/);
  assert.match(source, /cleanupCreatedResident/);
  assert.match(source, /auth\.admin\.deleteUser/);
  assert.match(source, /house_residents/);
  assert.match(source, /community_members/);
  assert.match(source, /profiles/);
});

test("quick create keeps password transient and requires confirmation", () => {
  const form = read(formPath);
  const page = read(createPagePath);

  assert.match(form, /Minimum 8 characters/);
  assert.match(form, /phase === "form"/);
  assert.match(form, /setPhase\("confirm"\)/);
  assert.match(form, /Create resident/);
  assert.match(form, /Save or share these credentials now/);
  assert.match(form, /navigator\.clipboard/);
  assert.match(form, /navigator\.share/);
  assert.match(form, /crypto\.getRandomValues/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(form, /URLSearchParams|searchParams.*password|password.*searchParams/);
  assert.match(page, /FieldQuickResidentForm/);
  assert.match(page, /isEntryPreviewReadOnly/);
});

test("quick create does not broaden into admin, guard, or destructive account management", () => {
  for (const path of [actionPath, formPath, statusPath, createPagePath]) {
    const source = read(path);

    assert.doesNotMatch(source, /createGuardAction|promoteResidentAdminAction|sa_change_user_role/);
    assert.doesNotMatch(source, /delete community|delete unit|delete resident/i);
    assert.doesNotMatch(source, /localStorage|sessionStorage/);
  }
});
