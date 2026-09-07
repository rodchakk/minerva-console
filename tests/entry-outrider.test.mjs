import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const migration = read("supabase/migrations/20260907010000_entry_outrider_v1.sql");
const model = read("features/entry/outrider/model.ts");
const operationsPage = read("app/(console)/products/entry/page.tsx");
const publicGateway = read("features/entry/outrider/public/gateway.ts");
const publicSaveRoute = read("app/(public)/entry/outrider/[token]/save/route.ts");
const publicSubmitRoute = read("app/(public)/entry/outrider/[token]/submit/route.ts");
const uploadStartRoute = read("app/(public)/entry/outrider/[token]/upload/start/route.ts");
const exportBuilder = read("features/entry/outrider/export.ts");
const actions = read("features/entry/outrider/actions.ts");
const middleware = read("lib/supabase/middleware.ts");

test("Outrider has deterministic five-section progress semantics", () => {
  assert.match(model, /OUTRIDER_SECTIONS\s*=\s*\[/);
  for (const section of [
    "units",
    "destinations",
    "inactive_units",
    "available_information",
    "contact",
  ]) {
    assert.match(model, new RegExp(`"${section}"`));
    assert.match(migration, new RegExp(`'${section}'`));
  }
  assert.match(model, /completedCount \/ OUTRIDER_SECTIONS\.length/);
  assert.match(migration, /cardinality\(v_outrider\.completed_sections\) \* 20/);
});

test("Outrider status transitions are explicit and terminal approval is read-only", () => {
  for (const status of [
    "not_started",
    "in_progress",
    "ready_for_review",
    "needs_information",
    "approved",
  ]) {
    assert.match(migration, new RegExp(`'${status}'`));
    assert.match(model, new RegExp(`"${status}"`));
  }
  assert.match(migration, /status = 'ready_for_review'/);
  assert.match(migration, /status = 'needs_information'/);
  assert.match(migration, /status = 'approved'/);
  assert.match(migration, /v_outrider\.status in \('ready_for_review', 'approved'\)/);
  assert.match(model, /"not_started", "in_progress", "needs_information"/);
});

test("public routes reject invalid tokens and protect mutations", () => {
  assert.match(middleware, /pathname\.startsWith\("\/entry\/outrider\/"\)/);
  assert.match(publicGateway, /return \{ available: false \}/);
  assert.match(publicSaveRoute, /hasOutriderSameOriginBoundary/);
  assert.match(publicSubmitRoute, /hasOutriderSameOriginBoundary/);
  assert.match(uploadStartRoute, /hasOutriderSameOriginBoundary/);
  assert.match(publicSaveRoute, /enforceOutriderRateLimit/);
  assert.match(publicSubmitRoute, /enforceOutriderRateLimit/);
  assert.match(uploadStartRoute, /enforceOutriderRateLimit/);
});

test("token material is hashed or encrypted and not exported", () => {
  assert.match(actions, /hashOutriderToken/);
  assert.match(actions, /encryptOutriderToken/);
  assert.doesNotMatch(exportBuilder, /token_hash|encrypted_token_payload|service_role/i);
  assert.match(exportBuilder, /entry-outrider-export-v1/);
});

test("payload normalization and attachment category validation are centralized", () => {
  assert.match(model, /normalizeOutriderSavePayload/);
  assert.match(model, /sanitizeOutriderFilename/);
  assert.match(model, /buildOutriderStoragePath/);
  for (const category of ["units", "residents", "security_staff", "common_areas"]) {
    assert.match(model, new RegExp(`"${category}"`));
    assert.match(migration, new RegExp(`'${category}'`));
  }
  assert.match(model, /OUTRIDER_ALLOWED_FILE_TYPES/);
  assert.match(model, /OUTRIDER_MAX_FILE_BYTES/);
});

test("Operations page uses Outrider as the fourth KPI and primary panel", () => {
  assert.match(operationsPage, /label="Outrider"/);
  assert.match(operationsPage, /getOutriderAttentionCount/);
  assert.doesNotMatch(operationsPage, /Messages \(24h\)/);
  assert.match(operationsPage, /title="Outrider operations"/);
  assert.doesNotMatch(operationsPage, /Recent Outrider Activity/i);
  assert.match(operationsPage, /Setup Overview/);
});

test("Outrider events feed the existing global operational activity RPC", () => {
  assert.match(migration, /create or replace function public\.list_entry_operational_activity_v1/);
  assert.match(migration, /from public\.community_outrider_events e/);
  for (const event of [
    "outrider_started",
    "outrider_saved",
    "file_uploaded",
    "outrider_submitted",
    "information_requested",
    "outrider_approved",
  ]) {
    assert.match(migration, new RegExp(`'${event}'`));
  }
  assert.match(migration, /'Outrider'::text/);
  assert.match(migration, /'outrider'::text/);
});

test("migration security posture keeps Outrider narrow and service-role mediated", () => {
  assert.match(migration, /alter table public\.community_outrider_sessions enable row level security/);
  assert.match(migration, /alter table public\.community_outrider_files enable row level security/);
  assert.match(migration, /alter table public\.community_outrider_events enable row level security/);
  assert.match(migration, /revoke all on table public\.community_outrider_sessions from public, anon, authenticated/);
  assert.match(migration, /create or replace function public\._outrider_service_role_only_v1/);
  assert.match(migration, /grant execute on function public\.resolve_community_outrider_v1\(text\) to service_role/);
  assert.match(migration, /'entry-outrider'/);
  assert.match(migration, /public = false/);
});

test("Outrider has no live ENTRY import write path", () => {
  const writableSources = [migration, actions, publicGateway, exportBuilder].join("\n");
  for (const table of [
    "houses",
    "community_users",
    "guards",
    "community_destinations",
    "activation_queue",
  ]) {
    assert.doesNotMatch(
      writableSources,
      new RegExp(`\\b(insert into|update|delete from)\\s+public\\.${table}\\b`, "i"),
    );
  }
  assert.match(
    writableSources,
    /No live ENTRY operational records are automatically imported by Outrider\./,
  );
});
