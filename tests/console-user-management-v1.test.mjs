import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function before(source, firstNeedle, secondNeedle) {
  const first = source.indexOf(firstNeedle);
  const second = source.indexOf(secondNeedle);

  assert.ok(first >= 0, `${firstNeedle} must exist`);
  assert.ok(second >= 0, `${secondNeedle} must exist`);
  assert.ok(first < second, `${firstNeedle} must appear before ${secondNeedle}`);
}

test("(console), Brain, ENTRY admin routes, and /users are owner-only through layout", () => {
  const layout = read("app/(console)/layout.tsx");
  const brain = read("app/(console)/brain/page.tsx");
  const entry = read("app/(console)/products/entry/page.tsx");
  const users = read("app/(console)/users/page.tsx");

  assert.match(layout, /requireConsoleOwner/);
  assert.match(layout, /await requireConsoleOwner\(\)/);
  assert.match(brain, /BrainOverview/);
  assert.match(entry, /ENTRY Operations/);
  assert.match(users, /getConsoleUsersPageData/);
});

test("Console access helper preserves superadmin owner behavior and denies disabled or missing members", () => {
  const helper = read("features/auth/consoleAccess.ts");

  assert.match(helper, /row\?\.is_superadmin === true/);
  assert.match(helper, /role: "owner"/);
  assert.match(helper, /source: "superadmin"/);
  assert.match(helper, /memberStatus === "active"/);
  assert.match(helper, /status: "forbidden"/);
  assert.doesNotMatch(helper, /memberStatus !== "disabled"/);
});

test("Builder and Viewer can enter only the safe workspace", () => {
  const workspace = read("app/workspace/page.tsx");
  const destinations = read("features/auth/postLoginDestination.ts");

  assert.match(workspace, /requireConsoleMember/);
  assert.match(workspace, /No product modules have been assigned yet/);
  assert.doesNotMatch(workspace, /ENTRY|Brain|Recent Activity|finance|logs|createAdminClient/);
  assert.match(destinations, /MEMBER_POST_LOGIN_DESTINATION = "\/workspace"/);
  assert.match(destinations, /role === "owner"/);
  assert.match(destinations, /return MEMBER_POST_LOGIN_DESTINATION/);
});

test("login and root routing use Console context rather than direct superadmin-only logic", () => {
  const action = read("features/auth/actions.ts");
  const loginPage = read("app/login/page.tsx");
  const homePage = read("app/page.tsx");

  assert.match(action, /getConsoleAccessContext/);
  assert.match(loginPage, /getConsoleAccessContext/);
  assert.match(homePage, /getConsoleAccessContext/);
  assert.doesNotMatch(action, /rpc\("is_superadmin"\)/);
  assert.match(action, /redirect\(getConsolePostLoginDestination\(context\.role, formData\.get\("next"\)\)\)/);
  assert.match(homePage, /context\.role === "owner" \? "\/dashboard" : "\/workspace"/);
});

test("Add User is enabled for owners and defaults invitations to Builder", () => {
  const controlCenter = read("features/control-center/ControlCenterDashboard.tsx");
  const usersPage = read("app/(console)/users/page.tsx");
  const model = read("features/console-users/model.ts");

  assert.match(controlCenter, /href="\/users\?invite=1"/);
  assert.doesNotMatch(controlCenter, /cursor-not-allowed|title="User creation is not available/);
  assert.match(usersPage, /Invite Console User/);
  assert.match(usersPage, /defaultValue=\{INVITE_DEFAULT_ROLE\}/);
  assert.match(model, /INVITE_DEFAULT_ROLE: ConsoleRole = "builder"/);
});

test("invitation actions authorize before Admin client and reject invalid roles server-side", () => {
  const actions = read("features/console-users/actions.ts");
  const inviteAction = actions.slice(
    actions.indexOf("export async function inviteConsoleUserAction"),
    actions.indexOf("export async function updateConsoleMemberRoleAction"),
  );

  before(inviteAction, "const currentOwner = await requireConsoleOwner()", "const adminSupabase = createAdminClient()");
  assert.match(actions, /parseConsoleRole\(formData\.get\("role"\)\)/);
  assert.match(actions, /Choose a valid Console role/);
  assert.match(actions, /normalizeConsoleEmail/);
  assert.match(actions, /normalizeDisplayName/);
});

test("invitation handles existing auth users exactly and cleans up only newly invited identities", () => {
  const actions = read("features/console-users/actions.ts");

  assert.match(actions, /findAuthUserByExactEmail/);
  assert.match(actions, /user\.email\?\.toLowerCase\(\) === email/);
  assert.match(actions, /if \(existingAuthUser\)/);
  assert.match(actions, /inviteUserByEmail/);
  assert.match(actions, /let invitedUserId: string \| null = null/);
  assert.match(actions, /if \(invitedUserId\)/);
  assert.match(actions, /deleteUser\(invitedUserId, true\)/);
});

test("role and status management changes console_members only and protects system owners", () => {
  const actions = read("features/console-users/actions.ts");

  assert.match(actions, /updateConsoleMemberRoleAction/);
  assert.match(actions, /updateConsoleMemberStatusAction/);
  assert.match(actions, /\.from\("console_members"\)[\s\S]*\.update\(\{ role \}\)/);
  assert.doesNotMatch(actions, /ban_duration|updateUserById\([^)]*ban|deleteUser\(userId/);
  assert.match(actions, /isCompatibilitySuperadmin\(userId\)/);
  assert.match(actions, /rpc\("is_superadmin", \{ p_user_id: userId \}\)/);
  assert.doesNotMatch(actions, /rpc\("is_superadmin", \{ user_id: userId \}\)/);
  assert.match(actions, /System owner compatibility users cannot be edited here/);
  assert.match(actions, /You cannot remove the final effective Console owner/);
});

test("hasOtherActiveConsoleOwner considers active superadmin_users as effective owners", () => {
  const actions = read("features/console-users/actions.ts");
  
  assert.match(actions, /\.from\("superadmin_users"\)/);
  assert.match(actions, /\.eq\("is_active", true\)/);
});

test("Console users page maps target superadmins to non-editable System owners and fails closed on error", () => {
  const dataFile = read("features/console-users/data.ts");
  
  assert.match(dataFile, /rpc\("is_superadmin", \{ p_user_id: userId \}\)/);
  assert.doesNotMatch(dataFile, /rpc\("is_superadmin", \{ user_id: userId \}\)/);
  assert.match(dataFile, /if \(error\)/);
  assert.match(dataFile, /throw new Error\("Target user compatibility could not be verified safely."\)/);
  assert.match(dataFile, /superadminMap\.get\(member\.user_id\)/);
  assert.match(dataFile, /isEditable: false/);
  assert.match(dataFile, /source: "System owner"/);
  assert.match(dataFile, /role: "owner"/);
});

test("service-role and auth users stay server-only", () => {
  const clientSources = [
    "app/(console)/users/page.tsx",
    "app/workspace/page.tsx",
    "app/console-invite/setup/page.tsx",
    "features/control-center/ControlCenterDashboard.tsx",
    "components/layout/AppSidebar.tsx",
  ].map(read).join("\n");
  const serverActions = read("features/console-users/actions.ts");
  const serverData = read("features/console-users/data.ts");

  assert.doesNotMatch(clientSources, /SUPABASE_SERVICE_ROLE_KEY|createAdminClient|auth\.admin/);
  assert.match(serverActions, /createAdminClient/);
  assert.match(serverData, /createAdminClient/);
});

test("Console invitation acceptance has its own callback strictly for invite token_hash", () => {
  const callback = read("app/auth/callback/route.ts");
  const setup = read("app/console-invite/setup/page.tsx");
  const form = read("features/auth/ConsolePasswordSetupForm.tsx");
  const actions = read("features/auth/actions.ts");
  const bridge = read("app/reset-password/page.tsx");

  assert.match(callback, /type === "invite"/);
  assert.doesNotMatch(callback, /exchangeCodeForSession/);
  assert.doesNotMatch(callback, /recovery|email/);
  assert.match(callback, /verifyOtp/);
  assert.match(callback, /\/console-invite\/setup/);
  assert.match(setup, /requireConsoleMember/);
  assert.match(actions, /updateConsolePasswordAction/);
  assert.match(actions, /await requireConsoleMember\(\)/);
  assert.match(bridge, /Opening ENTRY password reset/);
  assert.doesNotMatch(callback, /reset-password|ENTRY/);
});

test("no ENTRY authorization or Brain content/model files are changed by this branch", async () => {
  const { execFileSync } = await import("node:child_process");
  const files = execFileSync("git", ["diff", "--name-only", "origin/master...HEAD"], {
    cwd: root,
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));

  assert.equal(files.some((file) => file.startsWith("features/entry/")), false);
  assert.equal(files.some((file) => file.startsWith("supabase/migrations/")), false);
  assert.equal(files.some((file) => file.startsWith("features/brain/")), false);
  assert.equal(files.some((file) => file.startsWith("content/brain/")), false);
});
