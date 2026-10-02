import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Console middleware preserves sessions on transient Auth failures", () => {
  const middleware = read("lib/supabase/middleware.ts");
  const classifier = read("features/auth/authErrorClassification.ts");

  assert.match(middleware, /error: authError/);
  assert.match(middleware, /isVerifiedInvalidSession\(authError\)/);
  assert.match(middleware, /redirectToTemporaryUnavailable\(request, response\)/);
  assert.match(middleware, /pathname === "\/temporarily-unavailable"/);
  assert.match(middleware, /copyCookies\(response, NextResponse\.redirect/);
  assert.match(classifier, /refresh_token_not_found/);
  assert.match(classifier, /authError\.status !== 401/);
  assert.doesNotMatch(
    middleware,
    /if \(authError\)[\s\S]{0,200}redirectToLoginAndClearBrokenSession/,
  );
});

test("Console and Field authorization RPC failures fail closed as temporary unavailability", () => {
  const consoleAccess = read("features/auth/consoleAccess.ts");
  const fieldAccess = read("features/auth/requireSuperadmin.ts");

  assert.match(consoleAccess, /status: "temporarily_unavailable"/);
  assert.match(consoleAccess, /supabase\.rpc\("get_console_access_context_v1"\)/);
  assert.match(
    consoleAccess,
    /if \(error\)[\s\S]*status: "temporarily_unavailable"/,
  );
  assert.match(fieldAccess, /status: "temporarily_unavailable"/);
  assert.match(fieldAccess, /supabase\.rpc\("is_superadmin"\)/);
  assert.match(
    fieldAccess,
    /if \(error\)[\s\S]*status: "temporarily_unavailable"/,
  );
});

test("temporary-unavailable page retries without asking the user to sign out", () => {
  const page = read("app/temporarily-unavailable/page.tsx");

  assert.match(page, /RETRY_DELAY_MS = 15_000/);
  assert.match(page, /window\.location\.replace\(safeNextPath\)/);
  assert.match(page, /Try again now/);
  assert.match(page, /candidate\.startsWith\("\/\/"\)/);
  assert.doesNotMatch(page, /signOutAction|Sign out/);
});
