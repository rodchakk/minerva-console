import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Activation Queue standardizes selected-community return navigation", () => {
  const page = read("app/(console)/products/entry/activation/page.tsx");
  const headerActions = page.slice(
    page.indexOf("actions={"),
    page.indexOf("<div className=\"inline-flex"),
  );

  assert.match(page, /selectedCommunity \?/);
  assert.match(page, /products\/entry\/communities\/\$\{selectedCommunity\.id\}/);
  assert.match(headerActions, /Building2/);
  assert.match(headerActions, />\s*Back to community details\s*</);
  assert.doesNotMatch(headerActions, /Launch onboarding/);
  assert.match(page, /showLaunchCampaign/);
  assert.match(page, /LaunchCampaignButton/);
  assert.match(page, />Create community</);
  assert.match(page, /selectedCommunity[\s\S]*\? "Back to community details"[\s\S]*: "Back to communities"/);
  assert.match(page, /actionLabel="Back to communities"/);
});

test("Community Users uses canonical community-detail return action", () => {
  const client = read("features/entry/users/CommunityUsersClient.tsx");
  const headerActions = client.slice(
    client.indexOf("<div className=\"flex flex-wrap gap-2\">"),
    client.indexOf("<Button onClick={openCreate}>"),
  );

  assert.match(headerActions, /Building2/);
  assert.match(headerActions, /Back to community details/);
  assert.doesNotMatch(headerActions, /Back to communities/);
  assert.doesNotMatch(headerActions, /Community detail/);
  assert.match(client, /Create user/);
});

test("Community Operators uses canonical community-detail return action", () => {
  const page = read("app/(console)/products/entry/communities/[communityId]/staff/page.tsx");

  assert.match(page, /Building2/);
  assert.match(page, /Back to community details/);
  assert.match(page, /products\/entry\/communities\/\$\{community\.id\}/);
  assert.match(page, /Final review/);
  assert.doesNotMatch(page, /Back to community</);
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

test("Community Users keeps resident and admin creation structurally identical", () => {
  const client = read("features/entry/users/CommunityUsersClient.tsx");
  const actions = read("features/entry/users/communityUserActions.ts");

  assert.match(client, /<FieldLabel>Email \(optional\)<\/FieldLabel>/);
  assert.match(client, /placeholder="Leave blank for username login"/);
  assert.match(client, /createDraft\.role !== "GUARD" \? \(/);
  assert.match(client, /houseId: createDraft\.role === "GUARD" \? null : createDraft\.houseId/);
  assert.match(client, /createDraft\.role === "RESIDENT" \|\| createDraft\.role === "ADMIN"/);
  assert.doesNotMatch(client, /Email is required for admin accounts/);

  assert.match(actions, /\(role === "RESIDENT" \|\| role === "ADMIN"\) && !houseId/);
  assert.match(actions, /A unit is required for resident and admin accounts/);
  assert.match(actions, /p_house_id: role === "GUARD" \? null : houseId/);
  assert.match(actions, /authEmail = `\$\{role\.toLowerCase\(\)\}-\$\{username\}@entry\.internal`/);
  assert.doesNotMatch(actions, /Email is required for admin accounts/);
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

test("Community Operators actions menu manages guards without changing identity", () => {
  const panel = read("features/entry/staff/StaffOperatorsPanel.tsx");
  const actions = read("features/entry/staff/actions.ts");
  const editSource = actions.slice(
    actions.indexOf("export async function updateGuardOperatorAction"),
    actions.indexOf("export async function resetGuardPasswordAction"),
  );

  assert.match(panel, /FloatingActionMenu/);
  assert.match(panel, /Edit operator/);
  assert.match(panel, /Reset password/);
  assert.match(panel, /Copy username/);
  assert.match(panel, /Deactivate/);
  assert.match(panel, /Reactivate/);
  assert.match(panel, /operator\.username \|\| "Not available"/);
  assert.match(panel, /Username\s*\{" "\}/);

  assert.match(editSource, /export async function updateGuardOperatorAction/);
  assert.match(editSource, /guard_account_type: accountType/);
  assert.match(editSource, /guard_description: description \|\| null/);
  assert.match(editSource, /\.from\("profiles"\)[\s\S]*\.update\(\{ full_name: fullName, phone: phone \|\| null \}\)/);
  assert.doesNotMatch(editSource, /entry_username/);
  assert.doesNotMatch(editSource, /synthetic_email/);
});

test("Community Operators can reset and toggle guard access through existing paths", () => {
  const panel = read("features/entry/staff/StaffOperatorsPanel.tsx");
  const actions = read("features/entry/staff/actions.ts");
  const resetAndStatusSource = actions.slice(
    actions.indexOf("export async function resetGuardPasswordAction"),
    actions.indexOf("export async function removeResidentAdminAccessAction"),
  );

  assert.match(panel, /ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH/);
  assert.match(panel, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(panel, /aria-label="Copy password"/);
  assert.match(panel, /Saving a new password immediately replaces the current guard password/);

  assert.match(actions, /export async function resetGuardPasswordAction/);
  assert.match(actions, /ENTRY_ADMIN_TEMP_PASSWORD_MIN_LENGTH/);
  assert.match(actions, /auth\.admin\.updateUserById\(userId, \{\s*password,/);
  assert.match(actions, /export async function setGuardActiveStatusAction/);
  assert.match(actions, /sa_set_community_user_active_status/);
  assert.match(actions, /p_include_inactive: true/);
  assert.match(actions, /item\.role\.toUpperCase\(\) === "GUARD"/);
  assert.doesNotMatch(resetAndStatusSource, /auth\.admin\.deleteUser/);
});

test("Community Operators remove resident admin access without disabling residents", () => {
  const panel = read("features/entry/staff/StaffOperatorsPanel.tsx");
  const actions = read("features/entry/staff/actions.ts");

  assert.match(panel, /Remove admin access/);
  assert.match(panel, /remain an\s*active resident linked to/);
  assert.match(panel, /updateCommunityUserAction/);

  assert.match(actions, /export async function removeResidentAdminAccessAction/);
  assert.match(actions, /sa_change_user_role/);
  assert.match(actions, /p_new_role: "RESIDENT"/);
  assert.doesNotMatch(actions, /removeResidentAdminAccessAction[\s\S]*sa_set_community_user_active_status/);
  assert.doesNotMatch(actions, /removeResidentAdminAccessAction[\s\S]*deleteUser/);
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
