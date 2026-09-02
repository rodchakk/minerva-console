import test from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

function read(file) {
  return readFileSync(file, "utf8");
}

test("unauthorized page is role-aware and does not redirect builders/viewers to dashboard", () => {
  const page = read("app/unauthorized/page.tsx");
  assert.match(
    page,
    /isOwner = context\.status === "authorized" && context\.role === "owner"/,
  );
  assert.match(
    page,
    /isMember = context\.status === "authorized" && context\.role !== "owner"/,
  );
  assert.match(page, /if \(isOwner && !isSignOutError\)/);
  assert.match(page, /redirect\(DEFAULT_POST_LOGIN_DESTINATION\)/);
  assert.match(page, /MEMBER_POST_LOGIN_DESTINATION/);
  assert.doesNotMatch(
    page,
    /if \(context\.status === "authorized" && !isSignOutError\)/,
  );
  assert.match(page, /This area requires Owner access/);
  assert.match(
    page,
    /Your Minerva Console account is active, but this area is restricted to Owners/,
  );
});

test("/workspace remains protected by requireConsoleMember", () => {
  const workspace = read("app/workspace/page.tsx");
  assert.match(workspace, /requireConsoleMember/);
  assert.doesNotMatch(workspace, /requireConsoleOwner/);
});

test("/dashboard remains protected by requireConsoleOwner", () => {
  const dashboard = read("app/(console)/layout.tsx");
  assert.match(dashboard, /requireConsoleOwner/);
});
