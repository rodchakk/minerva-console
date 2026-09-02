import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("Field user detail exposes account status management for every ENTRY role", () => {
  const page = read(
    "app/(field)/field/entry/communities/[communityId]/people/residents/[userId]/page.tsx",
  );

  assert.match(page, /FieldUserStatusAction/);
  assert.match(page, /isCurrentUser=\{isCurrentUser\}/);
  assert.match(page, /user=\{data\.resident\}/);
  assert.match(page, /Account status can still be managed below/);

  const statusIndex = page.lastIndexOf("<FieldUserStatusAction");
  const residentOnlyIndex = page.indexOf("{isResident ? (");
  assert.ok(statusIndex > residentOnlyIndex);
});

test("Field account status control uses the generic community-user action", () => {
  const component = read("features/entry/field/FieldUserStatusAction.tsx");

  assert.match(component, /setCommunityUserActiveStatusAction/);
  assert.doesNotMatch(component, /setFieldResidentActiveStatus/);
  assert.match(component, /Deactivate account/);
  assert.match(component, /Reactivate account/);
  assert.match(component, /\$\{user\.role\}/);
});

test("current Field operator cannot deactivate their own account from the UI", () => {
  const page = read(
    "app/(field)/field/entry/communities/[communityId]/people/residents/[userId]/page.tsx",
  );
  const component = read("features/entry/field/FieldUserStatusAction.tsx");

  assert.match(page, /requireSuperadmin\(\)/);
  assert.match(page, /operator\.user\.id === data\.resident\.userId/);
  assert.match(component, /if \(isCurrentUser\)/);
  assert.match(component, /Your own Field account is protected and cannot be deactivated here/);
  assert.match(component, /cannot_disable_self/);
});

test("resident-only profile and recovery actions remain resident-only", () => {
  const page = read(
    "app/(field)/field/entry/communities/[communityId]/people/residents/[userId]/page.tsx",
  );

  assert.match(page, /const isResident = data\.resident\.role === "RESIDENT"/);
  assert.match(page, /FieldResidentProfileEditor/);
  assert.match(page, /FieldResidentActions/);
  assert.match(
    page,
    /Resident-only profile, unit, and recovery actions are not available/,
  );
});
