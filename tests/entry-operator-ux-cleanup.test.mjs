import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Activation Queue exposes Back to community for the selected community", () => {
  const page = read("app/(console)/products/entry/activation/page.tsx");

  assert.match(page, /selectedCommunity \?/);
  assert.match(page, /products\/entry\/communities\/\$\{selectedCommunity\.id\}/);
  assert.match(page, />Back to community</);
  assert.match(page, /actionLabel=\{selectedCommunity \? "Back to community" : "Back to communities"\}/);
});

test("Community Users guard creation is username-first and hides email", () => {
  const client = read("features/entry/users/CommunityUsersClient.tsx");
  const actions = read("features/entry/users/communityUserActions.ts");

  assert.match(client, /username: string/);
  assert.match(client, /createDraft\.role === "GUARD" && !createDraft\.username\.trim\(\)/);
  assert.match(client, /Username is required for guard accounts/);
  assert.match(client, /entry-community-user-guard-username/);
  assert.match(client, /createDraft\.role === "GUARD" \? \(/);
  assert.doesNotMatch(client, /Email is required for admin and guard accounts/);

  assert.match(actions, /function buildGuardSyntheticEmail\(username: string\)/);
  assert.match(actions, /return `guard-\$\{username\}@entry\.internal`;/);
  assert.match(actions, /role === "GUARD" && !requestedUsername/);
  assert.match(actions, /Username "\$\{username\}" is already in use/);
  assert.match(actions, /authEmail = buildGuardSyntheticEmail\(username\)/);
  assert.doesNotMatch(actions, /Email is required for admin and guard accounts/);
});

test("Community Operators guard form preserves account type and removes email workflow", () => {
  const panel = read("features/entry/staff/StaffOperatorsPanel.tsx");
  const guardForm = panel.slice(
    panel.indexOf("<form action={guardAction}"),
    panel.indexOf("<StatusMessage message={guardState.message}"),
  );
  const actions = read("features/entry/staff/actions.ts");

  assert.match(guardForm, /name="accountType" value=\{guardAccountType\}/);
  assert.match(guardForm, /Individual/);
  assert.match(guardForm, /Shared/);
  assert.match(guardForm, /name="username"/);
  assert.match(guardForm, /type=\{showGuardPassword \? "text" : "password"\}/);
  assert.match(guardForm, /aria-label="Copy password"/);
  assert.match(guardForm, /placeholder=\{ENTRY_ADMIN_TEMP_PASSWORD_HELPER\}/);
  assert.match(guardForm, /Description \/ note/);
  assert.doesNotMatch(guardForm, /name="email"/);

  assert.match(actions, /guard_account_type: accountType/);
  assert.match(actions, /entry_username: username/);
  assert.match(actions, /Guard name, username, and temporary password are required/);
  assert.match(actions, /password\.length < ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH/);
  assert.match(actions, /\$\{ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH\} characters/);
  assert.match(actions, /Shared guard account created successfully/);
  assert.match(actions, /Individual guard account created successfully/);
});

test("Console login remains email-only while guard creation stores username identity", () => {
  const actions = read("features/auth/actions.ts");
  const loginForm = read("features/auth/LoginForm.tsx");
  const staffActions = read("features/entry/staff/actions.ts");
  const communityUserActions = read("features/entry/users/communityUserActions.ts");

  assert.doesNotMatch(actions, /resolveLoginEmail/);
  assert.doesNotMatch(actions, /\.from\("profiles"\)/);
  assert.doesNotMatch(actions, /synthetic_email/);
  assert.match(actions, /signInWithPassword\(\{ email, password \}\)/);
  assert.match(loginForm, />\s*Email\s*</);
  assert.match(loginForm, /type="email"/);
  assert.match(loginForm, /autoComplete="email"/);

  for (const source of [staffActions, communityUserActions]) {
    assert.match(source, /synthetic_email/);
    assert.match(source, /username_login_enabled/);
    assert.match(source, /username/);
  }
});
