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

  assert.match(workspace, /title="Residents & units"/);
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

test("community users screen is named Users & Access and explains its scope", () => {
  const source = read("features/entry/users/CommunityUsersClient.tsx");

  assert.match(source, />Users & Access</);
  assert.match(
    source,
    /Manage user accounts, login identities, roles, unit assignment, and access status/,
  );
  assert.match(source, /label="Total accounts"/);
  assert.match(source, /Back to community/);
});
