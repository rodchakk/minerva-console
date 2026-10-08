import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("community overview separates physical directory from user access administration", () => {
  const page = read(
    "app/(console)/products/entry/communities/[communityId]/page.tsx",
  );
  const workspace = read(
    "features/entry/communities/CommunityDetailWorkspace.tsx",
  );

  assert.match(page, /getCommunityUsersPage/);
  assert.match(page, />\s*Directory\s*</);
  assert.match(page, />\s*Users & access\s*</);
  assert.match(page, /userAccountCount/);
  assert.match(page, /activeUserAccountCount/);

  assert.match(workspace, /title="Community Directory"/);
  assert.match(workspace, /Physical directory and household context/);
  assert.match(workspace, /title="Users & access"/);
  assert.match(workspace, /login identities, roles, credentials/);
  assert.match(workspace, /Manage users/);
});

test("community directory drawer no longer calls account management View members", () => {
  const source = read("features/entry/communities/CommunityList.tsx");

  assert.doesNotMatch(source, /View members/);
  assert.match(source, /Manage users/);
  assert.match(source, /\["users", "Users"\]/);
  assert.match(source, /label="Residents"/);
  assert.match(source, /label: "Residents"/);
  assert.match(source, /Users & access/);
  assert.match(source, /Most residents/);
});

test("Users & Access is a table-first identity and access workspace", () => {
  const source = read("features/entry/users/CommunityUsersClient.tsx");

  assert.match(source, />\s*Users & Access\s*</);
  assert.match(
    source,
    /Manage login identities, roles, unit assignment, credentials, and account access/,
  );
  assert.match(source, /Search name, email, username, phone, unit, role or status/);
  assert.match(source, /Filter accounts/);
  assert.match(source, /type RoleFilter[\s\S]*"OPERATOR"/);
  assert.match(source, /min-w-\[1180px\] table-fixed/);
  assert.match(source, /scrollbar-gutter:stable/);
  assert.match(source, /fixed inset-0 z-50/);
  assert.match(source, /w-\[560px\]/);
  assert.match(source, /Account details/);
  assert.match(source, /Account actions/);
  assert.match(source, /Edit account/);
  assert.match(source, /Reset password/);
  assert.match(source, /Deactivate account/);
  assert.match(source, /Back to community/);
});

test("Users & Access summary exposes accounts, residents, and operators without six dashboard cards", () => {
  const source = read("features/entry/users/CommunityUsersClient.tsx");

  assert.match(source, /label="Accounts"/);
  assert.match(source, /label="Active access"/);
  assert.match(source, /label="Residents"/);
  assert.match(source, /label="Operators"/);
  assert.match(source, /privilegedCount = adminCount \+ guardCount/);
  assert.doesNotMatch(source, /xl:grid-cols-6/);
});
