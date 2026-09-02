import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  DEFAULT_POST_LOGIN_DESTINATION,
  MEMBER_POST_LOGIN_DESTINATION,
  getConsolePostLoginDestination,
  getSafeOwnerPostLoginDestination,
  getSafePostLoginDestination,
} from "../features/auth/postLoginDestination.ts";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Field post-login destinations are accepted and preserved", () => {
  assert.equal(getSafePostLoginDestination("/field"), "/field");
  assert.equal(getSafePostLoginDestination("/field/entry"), "/field/entry");
  assert.equal(
    getSafePostLoginDestination("/field/entry/communities/abc?tab=activity#latest"),
    "/field/entry/communities/abc?tab=activity#latest",
  );
});

test("missing or unsafe post-login destinations fall back to dashboard", () => {
  const unsafeValues = [
    undefined,
    null,
    "",
    "https://evil.example/field",
    "//evil.example/field",
    "javascript:alert(1)",
    "/products/entry/communities",
    "/fieldish",
    "/field/../dashboard",
    "/field\\evil",
    "/field\u0000/entry",
  ];

  for (const value of unsafeValues) {
    assert.equal(getSafePostLoginDestination(value), DEFAULT_POST_LOGIN_DESTINATION);
  }
});

test("owner post-login destinations include owner Console routes only", () => {
  assert.equal(getSafeOwnerPostLoginDestination("/dashboard"), "/dashboard");
  assert.equal(getSafeOwnerPostLoginDestination("/brain"), "/brain");
  assert.equal(getSafeOwnerPostLoginDestination("/products/entry"), "/products/entry");
  assert.equal(getSafeOwnerPostLoginDestination("/users?invite=1"), "/users?invite=1");
  assert.equal(getSafeOwnerPostLoginDestination("/workspace"), DEFAULT_POST_LOGIN_DESTINATION);
  assert.equal(getSafeOwnerPostLoginDestination("https://evil.example/brain"), DEFAULT_POST_LOGIN_DESTINATION);
});

test("role-aware post-login destinations keep Builder and Viewer in workspace", () => {
  assert.equal(getConsolePostLoginDestination("owner", "/brain"), "/brain");
  assert.equal(getConsolePostLoginDestination("builder", "/brain"), MEMBER_POST_LOGIN_DESTINATION);
  assert.equal(getConsolePostLoginDestination("viewer", "/products/entry"), MEMBER_POST_LOGIN_DESTINATION);
});

test("login flow uses Console access context and preserves unauthorized behavior", () => {
  const action = read("features/auth/actions.ts");
  const loginPage = read("app/login/page.tsx");

  assert.match(action, /getConsoleAccessContext/);
  assert.match(action, /getConsolePostLoginDestination\(context\.role, formData\.get\("next"\)\)/);
  assert.doesNotMatch(action, /supabase\.rpc\("is_superadmin"\)/);
  assert.match(action, /redirect\("\/unauthorized"\)/);
  assert.match(action, /redirect\("\/unauthorized\?reason=authorization_error"\)/);
  assert.match(loginPage, /getConsoleAccessContext/);
  assert.match(loginPage, /redirect\("\/unauthorized"\)/);
  assert.match(loginPage, /redirect\("\/unauthorized\?reason=authorization_error"\)/);
});

test("normal Console login remains dashboard without a safe Field next", () => {
  const action = read("features/auth/actions.ts");
  const loginPage = read("app/login/page.tsx");
  const loginForm = read("features/auth/LoginForm.tsx");

  assert.equal(getSafePostLoginDestination(undefined), "/dashboard");
  assert.match(action, /getConsolePostLoginDestination/);
  assert.match(loginPage, /getConsolePostLoginDestination\(context\.role, requestedDestination\)/);
  assert.match(loginForm, /name="next" value=\{postLoginDestination\}/);
});
