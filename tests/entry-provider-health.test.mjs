import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("ENTRY provider health probes Supabase independently from operational RPCs", () => {
  const providerHealth = read(
    "features/entry/observability/providerHealth.ts",
  );

  assert.match(providerHealth, /server-only/);
  assert.match(providerHealth, /\/auth\/v1\/health/);
  assert.match(providerHealth, /fetchWithTimeout/);
  assert.match(providerHealth, /status >= 500/);
  assert.match(providerHealth, /state: "down"/);
  assert.match(providerHealth, /failureKind: "http_5xx"/);
  assert.match(providerHealth, /failureKind: result\.failureKind/);
  assert.match(providerHealth, /primary_provider/);
  assert.doesNotMatch(providerHealth, /SERVICE_ROLE/);
});

test("ENTRY provider health treats continuity as independent and fail-open", () => {
  const providerHealth = read(
    "features/entry/observability/providerHealth.ts",
  );

  assert.match(providerHealth, /ENTRY_CONTINUITY_URL/);
  assert.match(providerHealth, /NEXT_PUBLIC_ENTRY_CONTINUITY_URL/);
  assert.match(providerHealth, /\/health/);
  assert.match(providerHealth, /not_configured/);
  assert.match(providerHealth, /writes_enabled/);
  assert.match(providerHealth, /reconciliation_enabled/);
  assert.match(providerHealth, /state: ready \? "ready"/);
});

test("Field health renders provider attribution even when Supabase observability is unavailable", () => {
  const page = read("app/(field)/field/entry/health/page.tsx");
  const workspace = read(
    "features/entry/field/FieldEntryHealthWorkspace.tsx",
  );

  assert.match(page, /getEntryProviderHealth/);
  assert.match(page, /providerHealth=\{providerHealth\}/);
  assert.match(page, /observability\.state !== "ready"/);

  assert.match(workspace, /Infrastructure providers/);
  assert.match(workspace, /Independent probes/);
  assert.match(workspace, /Primary/);
  assert.match(workspace, /Continuity/);
  assert.match(workspace, /providerHealth\.attribution\.title/);
  assert.match(workspace, /providerHealth\.attribution\.explanation/);
  assert.match(workspace, /providerHealth\?\.primary\.state === "down"/);
});

test("ENTRY diagnostic bundle captures provider health without credentials or URLs", () => {
  const route = read("app/api/entry/observability/diagnostic/route.ts");
  const workspace = read(
    "features/entry/field/FieldEntryHealthWorkspace.tsx",
  );
  const diagnostic = read(
    "features/entry/observability/DiagnosticBundleControl.tsx",
  );

  assert.match(route, /getEntryProviderHealth/);
  assert.match(route, /provider_health/);
  assert.match(route, /failure_kind/);
  assert.match(route, /reconciliation_enabled/);
  assert.match(route, /writes_enabled/);
  assert.doesNotMatch(route, /anonKey|serviceRole|SUPABASE_SERVICE_ROLE/);

  assert.match(workspace, /"provider_health"/);
  assert.match(diagnostic, /bundle\.provider_health/);
  assert.match(diagnostic, /Infrastructure providers:/);
  assert.match(diagnostic, /Attribution:/);
});
