import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import { NextRequest } from "next/server.js";

const nodeRequire = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const testModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module: testModule, exports: testModule.exports, console,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : nodeRequire(name),
  }, { filename: path });
  return testModule.exports;
}
const classification = load("features/auth/authErrorClassification.ts");

function middleware({ user = null, error = null, renew = false } = {}) {
  return load("lib/supabase/middleware.ts", {
    "@/features/auth/authErrorClassification": classification,
    "@/lib/supabase/utils": { getSupabaseEnv: () => ({ url: "https://fixture.invalid", anonKey: "fixture" }) },
    "@supabase/ssr": {
      createServerClient: (_url, _key, options) => ({ auth: { getUser: async () => {
        if (renew) options.cookies.setAll([{ name: "sb-fixture-auth-token", value: "renewed", options: { path: "/" } }]);
        return { data: { user }, error };
      } } }),
    },
  }).updateSession;
}
function request(path = "/products") {
  return new NextRequest(`https://console.example.test${path}`, { headers: { cookie: "sb-fixture-auth-token=existing" } });
}

test("security: signed-out protected requests redirect to login and clear invalid cookies", async () => {
  const response = await middleware({ error: { message: "Auth session missing!" } })(request());
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")).pathname, "/login");
  assert.equal(response.cookies.get("sb-fixture-auth-token").value, "");
});

test("security: transient auth failures preserve refreshed cookies and fail closed", async () => {
  const response = await middleware({ error: { status: 503, message: "Fixture outage" }, renew: true })(request());
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")).pathname, "/temporarily-unavailable");
  assert.equal(response.cookies.get("sb-fixture-auth-token").value, "renewed");
});

test("security: public registration retains no-store and no-referrer headers", async () => {
  const response = await middleware()(request("/entry/register/synthetic-token"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

function access(row, rpcError = null) {
  return load("features/auth/consoleAccess.ts", {
    "server-only": {}, react: { cache: fn => fn },
    "next/navigation": { redirect: path => { throw new Error(`REDIRECT:${path}`); } },
    "@/features/auth/authErrorClassification": classification,
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "fixture-user", email: "fixture@example.test" } }, error: null }) },
      rpc: async name => { assert.equal(name, "get_console_access_context_v1"); return { data: row, error: rpcError }; },
    }) },
  });
}

test("security: active Superadmin maps to Console owner and viewer cannot pass owner guard", async () => {
  const owner = access({ is_superadmin: true, role: "owner", status: "active", source: "superadmin" });
  assert.equal((await owner.requireConsoleOwner()).role, "owner");
  const viewer = access({ role: "viewer", status: "active", source: "console_members" });
  assert.equal((await viewer.getConsoleAccessContext()).status, "authorized");
  await assert.rejects(viewer.requireConsoleOwner(), /REDIRECT:\/unauthorized/);
});

test("security: disabled and unknown Console roles fail closed", async () => {
  for (const row of [
    { role: "owner", status: "disabled", source: "console_members" },
    { role: "future-role", status: "active", source: "console_members" },
  ]) assert.equal((await access(row).getConsoleAccessContext()).status, "forbidden");
});

test("security: access RPC outage cannot grant Console membership", async () => {
  const context = await access(null, { code: "FIXTURE_OUTAGE" }).getConsoleAccessContext();
  assert.equal(context.status, "temporarily_unavailable");
  assert.equal(context.role, null);
});
