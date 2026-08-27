import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  DEFAULT_POST_LOGIN_DESTINATION,
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
    "/dashboard",
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

test("login flow preserves existing unauthorized behavior", () => {
  const action = read("features/auth/actions.ts");
  const loginPage = read("app/login/page.tsx");

  assert.match(action, /redirect\(data === true \? postLoginDestination : "\/unauthorized"\)/);
  assert.match(action, /redirect\("\/unauthorized\?reason=authorization_error"\)/);
  assert.match(loginPage, /redirect\("\/unauthorized"\)/);
  assert.match(loginPage, /redirect\("\/unauthorized\?reason=authorization_error"\)/);
});

test("normal Console login remains dashboard without a safe Field next", () => {
  const action = read("features/auth/actions.ts");
  const loginPage = read("app/login/page.tsx");
  const loginForm = read("features/auth/LoginForm.tsx");

  assert.equal(getSafePostLoginDestination(undefined), "/dashboard");
  assert.match(action, /getSafePostLoginDestination\(formData\.get\("next"\)\)/);
  assert.match(loginPage, /redirect\(postLoginDestination\)/);
  assert.match(loginForm, /name="next" value=\{postLoginDestination\}/);
});
