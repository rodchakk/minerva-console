import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("ENTRY user password drawer offers both quick reset and self-service email", () => {
  const client = read("features/entry/users/CommunityUsersClient.tsx");

  assert.match(client, /type PasswordResetMode = "quick" \| "email"/);
  assert.match(client, /aria-label="Password reset method"/);
  assert.match(client, /Quick change/);
  assert.match(client, /Send email/);
  assert.match(client, /passwordResetMode === "quick"/);
  assert.match(client, /Send reset email/);
  assert.match(client, /setCommunityUserPasswordAction/);
  assert.match(client, /sendCommunityUserPasswordResetEmailAction/);
  assert.match(client, /disabled=\{isPending \|\| isSyntheticEmail\(selectedUser\.email\)\}/);
  assert.match(client, /Their existing password remains valid/);
  assert.match(client, /Password reset email requested/);
});

test("ENTRY email recovery validates community membership and canonical Auth email", () => {
  const actions = read("features/entry/users/communityUserActions.ts");
  const start = actions.indexOf("export async function sendCommunityUserPasswordResetEmailAction");
  const emailAction = actions.slice(start);
  assert.ok(start >= 0);

  assert.match(emailAction, /await requireSuperadmin\(\)/);
  assert.match(emailAction, /getEntryPreviewReadOnlyError\(\)/);
  assert.match(emailAction, /ensureUserInCommunity\(communityId, userId\)/);
  assert.match(emailAction, /adminSupabase\.auth\.admin\.getUserById\(userId\)/);
  assert.match(emailAction, /data\.user\.email\?\.trim\(\)\.toLowerCase\(\)/);
  assert.match(emailAction, /@entry\.local/);
  assert.match(emailAction, /@entry\.internal/);
  assert.match(emailAction, /getPasswordResetRedirectTo\(\)/);
  assert.match(emailAction, /resetPasswordForEmail\(email, \{ redirectTo \}\)/);
  assert.match(emailAction, /persistSession: false/);
  assert.match(emailAction, /community_user\.password_reset_email/);
  assert.doesNotMatch(emailAction, /updateUserById|generateLink|inviteUserByEmail|sendEmail/);
  assert.doesNotMatch(emailAction, /input\.email|formData\.get\("email"\)/);
  assert.doesNotMatch(emailAction, /access_token|refresh_token|token_hash/);
});

test("quick reset remains a separate verified community admin operation", () => {
  const actions = read("features/entry/users/communityUserActions.ts");
  const quickStart = actions.indexOf("export async function setCommunityUserPasswordAction");
  const quickEnd = actions.indexOf("export async function sendCommunityUserPasswordResetEmailAction", quickStart);
  assert.ok(quickStart >= 0 && quickEnd > quickStart);
  const quickAction = actions.slice(quickStart, quickEnd);

  assert.match(quickAction, /ensureUserInCommunity\(communityId, userId\)/);
  assert.match(quickAction, /updateUserById\(userId, \{ password \}\)/);
  assert.doesNotMatch(quickAction, /resetPasswordForEmail/);
});
