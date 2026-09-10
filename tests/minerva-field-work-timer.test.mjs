import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function read(path) {
  return readFileSync(path, "utf8");
}

function loadTsModule(path) {
  const source = read(path);
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(output, {
    Date,
    Intl,
    Math,
    module: compiledModule,
    exports: compiledModule.exports,
    require,
  });
  return compiledModule.exports;
}

const migration = read(
  "supabase/migrations/20260909153000_entry_field_work_timer.sql",
);
const data = read("features/entry/field/workTimerData.ts");
const actions = read("features/entry/field/workTimerActions.ts");
const workspace = read("features/entry/field/FieldWorkTimerWorkspace.tsx");
const model = loadTsModule("features/entry/field/workTimerModel.ts");

function session(overrides = {}) {
  return {
    classification: "ONBOARDING",
    communityId: "community-andalucia",
    communityIdSnapshot: "community-andalucia",
    communityName: "Residencial Andalucia",
    durationSeconds: 60,
    id: `session-${Math.random()}`,
    notes: "",
    productKey: "ENTRY",
    startedAt: "2026-09-10T15:00:00.000Z",
    status: "COMPLETED",
    stoppedAt: "2026-09-10T15:01:00.000Z",
    targetScope: "CLIENT",
    workLocation: "onsite",
    ...overrides,
  };
}

test("ENTRY Field exposes a dedicated work timer without reopening onboarding", () => {
  const page = read("app/(field)/field/entry/page.tsx");
  const timerPage = read("app/(field)/field/entry/work-timer/page.tsx");

  assert.match(page, /href="\/field\/entry\/work-timer"/);
  assert.match(page, />\s*Work timer\s*</);
  assert.match(page, /Capture Field work time/);
  assert.match(timerPage, /FieldWorkTimerWorkspace/);
  assert.match(timerPage, /requireSuperadmin/);
  assert.doesNotMatch(`${page}\n${timerPage}`, /registration\/start|FieldRegistrationCard/);
});

test("work timer schema has explicit target, status, ENTRY product, and RLS", () => {
  assert.match(migration, /create table if not exists public\.entry_field_work_sessions/);
  assert.match(migration, /staff_user_id uuid not null references auth\.users\(id\) on delete restrict/);
  assert.doesNotMatch(
    migration,
    /staff_user_id uuid not null references auth\.users\(id\) on delete cascade/i,
  );
  assert.match(migration, /product_key text not null default 'ENTRY'/);
  assert.match(migration, /target_scope text not null/);
  assert.match(migration, /community_id uuid references public\.communities\(id\) on delete set null/);
  assert.match(migration, /community_id_snapshot uuid/);
  assert.match(migration, /community_name_snapshot text/);
  assert.match(migration, /product_key = 'ENTRY'/);
  assert.match(migration, /target_scope in \('PRODUCT', 'CLIENT'\)/);
  assert.match(migration, /target_scope = 'PRODUCT'[\s\S]*community_id is null[\s\S]*target_scope = 'CLIENT'[\s\S]*community_id_snapshot is not null/);
  assert.match(migration, /classification in \([\s\S]*'ONBOARDING'[\s\S]*'SUPPORT'[\s\S]*'PRODUCT_MAINTENANCE'[\s\S]*'PRODUCT_DEVELOPMENT_RND'[\s\S]*'OTHER'/);
  assert.match(migration, /status text not null default 'ACTIVE'/);
  assert.match(migration, /status in \('ACTIVE', 'COMPLETED', 'CANCELLED'\)/);
  assert.match(migration, /where status = 'ACTIVE'/);
  assert.match(migration, /CLIENT field work sessions require a community at creation/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant select, insert, update/);
  assert.doesNotMatch(migration, /grant delete/i);
  assert.doesNotMatch(migration, /admin_toggle_house|admin_set_houses_active_status|registration_link/i);
});

test("work timer actions validate target attribution and lifecycle transitions", () => {
  assert.match(actions, /requireSuperadmin\(\)/);
  assert.match(actions, /getEntryPreviewReadOnlyError/);
  assert.match(actions, /FIELD_WORK_PRODUCT_KEY/);
  assert.match(actions, /isFieldWorkTargetScope/);
  assert.match(actions, /targetScope: FieldWorkTargetScope/);
  assert.match(actions, /Choose a community for client work/);
  assert.match(actions, /community_id_snapshot: target\.communityIdSnapshot/);
  assert.match(actions, /product_key: FIELD_WORK_PRODUCT_KEY/);
  assert.match(actions, /status: "ACTIVE"/);
  assert.match(actions, /\.eq\("status", "ACTIVE"\)/);
  assert.match(actions, /status: "COMPLETED"/);
  assert.match(actions, /status: "CANCELLED"/);
  assert.match(actions, /duration_seconds: null/);
  assert.match(actions, /Math\.max\(0/);
  assert.match(actions, /cancelFieldWorkSession/);
  assert.doesNotMatch(actions, /admin_toggle_house|admin_set_houses_active_status|FieldRegistrationCard/);
});

test("work timer data paginates monthly summaries and formats Seshat target groups", () => {
  assert.match(data, /FIELD_WORK_OPERATING_TIME_ZONE/);
  assert.match(data, /getFieldOperatingMonthRange/);
  assert.match(data, /loadAllFieldWorkSessionsForMonth/);
  assert.match(data, /\.range\(from, from \+ FIELD_WORK_MONTH_PAGE_SIZE - 1\)/);
  assert.doesNotMatch(data, /\.limit\(100\)/);
  assert.match(data, /historyLimit/);
  assert.match(data, /historyTruncated/);
  assert.match(data, /buildFieldWorkCopySummary/);
  assert.match(data, /byTarget/);
  assert.match(data, /Operating timezone/);
  assert.match(data, /getFieldActiveWorkTimer/);
  assert.match(data, /\.eq\("status", "ACTIVE"\)/);
});

test("work timer UI captures target, categories, cancellation, history, and copy", () => {
  assert.match(workspace, /FIELD_WORK_TARGET_SCOPES/);
  assert.match(workspace, /FIELD_WORK_CLASSIFICATIONS/);
  assert.match(workspace, /FIELD_WORK_LOCATIONS/);
  assert.match(workspace, /targetScope/);
  assert.match(workspace, /Client community/);
  assert.match(workspace, /Confirm cancel/);
  assert.match(workspace, /cancelFieldWorkSession/);
  assert.match(workspace, /Manual Seshat entry/);
  assert.match(workspace, /navigator\.clipboard\.writeText/);
  assert.match(workspace, /TargetSummaryGroup/);
  assert.match(workspace, /History/);
  assert.doesNotMatch(workspace, /Deactivate unit|Reactivate unit|Registration Link/);
});

test("active Field indicator links back to the durable timer without local storage", () => {
  const layout = read("app/(field)/field/layout.tsx");
  const shell = read("components/field/FieldShell.tsx");
  const indicator = read("features/entry/field/FieldActiveWorkTimerIndicator.tsx");

  assert.match(layout, /getFieldActiveWorkTimer\(user\.id\)/);
  assert.match(layout, /activeWorkTimer=\{activeWorkTimer\}/);
  assert.match(shell, /FieldActiveWorkTimerIndicator/);
  assert.match(shell, /activeWorkTimer/);
  assert.match(indicator, /href="\/field\/entry\/work-timer"/);
  assert.match(indicator, /formatFieldWorkClock/);
  assert.match(indicator, /session\.startedAt/);
  assert.doesNotMatch(indicator, /localStorage|sessionStorage|supabase|poll/i);
});

test("summary groups PRODUCT and CLIENT work by target and category", () => {
  const summary = model.summarizeFieldWorkMonth(
    [
      session({ durationSeconds: 4 * 3600 + 35 * 60 }),
      session({
        classification: "SUPPORT",
        durationSeconds: 80 * 60,
      }),
      session({
        classification: "PRODUCT_MAINTENANCE",
        communityId: null,
        communityIdSnapshot: null,
        communityName: "ENTRY general",
        durationSeconds: 130 * 60,
        targetScope: "PRODUCT",
      }),
      session({
        classification: "PRODUCT_DEVELOPMENT_RND",
        communityId: null,
        communityIdSnapshot: null,
        communityName: "ENTRY general",
        durationSeconds: 220 * 60,
        targetScope: "PRODUCT",
      }),
    ],
    "September 2026",
  );

  assert.equal(summary.completedSessions, 4);
  assert.equal(summary.totalSeconds, 705 * 60);
  assert.equal(summary.byTarget.length, 2);
  assert.equal(summary.byTarget[0].label, "Residencial Andalucia");
  assert.equal(
    JSON.stringify(summary.byTarget[0].lines.map((line) => line.label)),
    JSON.stringify(["Onboarding", "Support"]),
  );
  assert.equal(summary.byTarget[1].label, "ENTRY general");
  assert.equal(
    JSON.stringify(summary.byTarget[1].lines.map((line) => line.label)),
    JSON.stringify(["R&D", "Maintenance"]),
  );
});

test("historical CLIENT attribution survives a missing community FK", () => {
  const summary = model.summarizeFieldWorkMonth(
    [
      session({
        communityId: null,
        communityIdSnapshot: "community-andalucia",
        communityName: "Residencial Andalucia",
        durationSeconds: 45 * 60,
        targetScope: "CLIENT",
      }),
    ],
    "September 2026",
  );

  assert.equal(summary.byTarget[0].label, "Residencial Andalucia");
  assert.equal(summary.byTarget[0].targetScope, "CLIENT");
});

test("OTHER and cancelled sessions behave correctly in summaries", () => {
  const summary = model.summarizeFieldWorkMonth(
    [
      session({
        classification: "OTHER",
        durationSeconds: 15 * 60,
      }),
      session({
        classification: "SUPPORT",
        durationSeconds: null,
        status: "CANCELLED",
        stoppedAt: "2026-09-10T15:10:00.000Z",
      }),
      session({
        durationSeconds: null,
        status: "ACTIVE",
        stoppedAt: null,
      }),
    ],
    "September 2026",
  );

  assert.equal(summary.completedSessions, 1);
  assert.equal(summary.totalSeconds, 15 * 60);
  assert.equal(summary.byClassification[0].label, "Other");
});

test("Honduras operating month keeps late September work in September", () => {
  assert.equal(model.FIELD_WORK_OPERATING_TIME_ZONE, "America/Tegucigalpa");
  assert.equal(
    model.getFieldOperatingMonth(new Date("2026-10-01T04:30:00.000Z")),
    "2026-09",
  );

  const range = model.getFieldOperatingMonthRange("2026-09");
  assert.equal(range.startIso, "2026-09-01T06:00:00.000Z");
  assert.equal(range.endIso, "2026-10-01T06:00:00.000Z");
});

test("more than 100 completed sessions are summarized without silent truncation", () => {
  const sessions = Array.from({ length: 101 }, (_, index) =>
    session({
      durationSeconds: 60,
      id: `completed-${index}`,
    }),
  );
  const summary = model.summarizeFieldWorkMonth(sessions, "September 2026");

  assert.equal(summary.completedSessions, 101);
  assert.equal(summary.totalSeconds, 101 * 60);
  assert.match(data, /FIELD_WORK_MONTH_PAGE_SIZE = 1000/);
  assert.match(data, /summarySessionCount: monthlyResult\.sessions\.length/);
});
