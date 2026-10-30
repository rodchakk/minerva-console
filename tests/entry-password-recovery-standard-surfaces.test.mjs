import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

for (const [surface, path, account] of [
  ["global Users search", "features/entry/users/UserSearch.tsx", "selectedUser"],
  ["Community Directory unit resident actions", "features/entry/communities/UnitResidentActions.tsx", "resident"],
]) {
  test(`${surface} offers the two standard ENTRY password recovery methods`, () => {
    const client = read(path);

    assert.match(client, /type PasswordResetMode = "quick" \| "email"/);
    assert.match(client, /aria-label="Password reset method"/);
    assert.match(client, /Quick change/);
    assert.match(client, /Send email/);
    assert.match(client, /Send reset email/);
    assert.match(client, /passwordResetMode === "quick"/);
    assert.match(client, /passwordResetMode === "email"/);
    assert.match(client, /sendCommunityUserPasswordResetEmailAction/);
    assert.match(client, /setPasswordResetMode\("quick"\)/);
    assert.match(client, /setPasswordResetMode\("email"\)/);
    assert.match(client, /Their existing password remains valid/);
    assert.match(client, /Password reset email requested/);
    assert.match(client, new RegExp(`isSyntheticEmail\\(${account}\\.email\\)`));
    assert.match(client, new RegExp(`userId: ${account === "resident" ? "resident.userId" : "selectedUser.id"}`));
    assert.doesNotMatch(client, /auth\.admin\.updateUserById|auth\.resetPasswordForEmail/);
  });
}

test("global Users keeps the existing manual reset and uses canonical community-scoped recovery", () => {
  const client = read("features/entry/users/UserSearch.tsx");
  assert.match(client, /setCommunityUserPasswordAction/);
  assert.match(client, /communityId: selectedUser\.communityId/);
  assert.match(client, /userId: selectedUser\.id/);
  assert.match(client, /disabled=\{isPending \|\| isSyntheticEmail\(selectedUser\.email\)\}/);
});

test("unit resident management preserves manual password reset and other actions", () => {
  const client = read("features/entry/communities/UnitResidentActions.tsx");
  assert.match(client, /setResidentPasswordAction/);
  assert.match(client, /submitPasswordResetEmail/);
  assert.match(client, /passwordResetMode === "email"[\s\S]*submitPasswordResetEmail/);
  assert.match(client, /disabled=\{isPending \|\| isSyntheticEmail\(resident\.email\)\}/);
  assert.match(client, /moveResidentToUnitAction/);
  assert.match(client, /setCommunityUserActiveStatusAction/);
});

test("all password recovery surfaces reuse the same authorized server action", () => {
  const actions = read("features/entry/users/communityUserActions.ts");
  const original = read("features/entry/users/CommunityUsersClient.tsx");
  assert.match(original, /sendCommunityUserPasswordResetEmailAction/);
  assert.match(actions, /await requireSuperadmin\(\)/);
  assert.match(actions, /ensureUserInCommunity\(communityId, userId\)/);
  assert.match(actions, /auth\.admin\.getUserById\(userId\)/);
  assert.match(actions, /resetPasswordForEmail\(email, \{ redirectTo \}\)/);
  assert.match(actions, /community_user\.password_reset_email/);
});

test("Community Directory offers direct resident management without navigating away", () => {
  const directory = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");
  const unitDetail = read("features/entry/communities/CommunityUnitDetailWorkspace.tsx");
  assert.match(directory, /UnitResidentActions/);
  assert.match(directory, /resident=\{resident\}/);
  assert.match(directory, /communityId=\{communityId\}/);
  assert.match(unitDetail, /UnitResidentActions/);
});
