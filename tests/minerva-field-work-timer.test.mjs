import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  buildFieldWorkMonthlySummary,
  buildFieldWorkSummaryText,
  formatTimerDuration,
  formatWorkDuration,
  getCompletedDurationSeconds,
  getElapsedSeconds,
} from "../features/entry/field/workTimerModel.ts";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function session(overrides = {}) {
  return {
    activityCategory: "ONBOARDING",
    communityId: "11111111-1111-4111-8111-111111111111",
    communityNameSnapshot: "Residencial Andalucia",
    createdAt: "2026-09-09T10:00:00.000Z",
    durationSeconds: 3600,
    endedAt: "2026-09-09T11:00:00.000Z",
    id: "22222222-2222-4222-8222-222222222222",
    note: null,
    productKey: "ENTRY",
    startedAt: "2026-09-09T10:00:00.000Z",
    status: "COMPLETED",
    targetScope: "CLIENT",
    updatedAt: "2026-09-09T11:00:00.000Z",
    userId: "33333333-3333-4333-8333-333333333333",
    workMode: "ONSITE",
    ...overrides,
  };
}

test("timer display derives elapsed duration from started_at", () => {
  assert.equal(
    getElapsedSeconds(
      "2026-09-09T10:00:00.000Z",
      new Date("2026-09-09T11:42:17.000Z"),
    ),
    6137,
  );
  assert.equal(formatTimerDuration(6137), "01:42:17");
  assert.equal(
    getCompletedDurationSeconds(
      "2026-09-09T10:00:00.000Z",
      "2026-09-09T12:17:00.000Z",
    ),
    8220,
  );
  assert.equal(formatWorkDuration(8220), "2h 17m");
  assert.equal(
    getCompletedDurationSeconds(
      "2026-09-09T10:00:00.000Z",
      "2026-09-09T09:59:00.000Z",
    ),
    0,
  );
});

test("monthly summary groups completed client and ENTRY general work", () => {
  const summary = buildFieldWorkMonthlySummary(
    [
      session({ durationSeconds: 8220 }),
      session({
        activityCategory: "SUPPORT",
        durationSeconds: 2580,
        workMode: "REMOTE",
      }),
      session({
        activityCategory: "PRODUCT_MAINTENANCE",
        communityId: null,
        communityNameSnapshot: null,
        durationSeconds: 5100,
        targetScope: "PRODUCT",
        workMode: "REMOTE",
      }),
      session({
        activityCategory: "PRODUCT_DEVELOPMENT_RND",
        communityId: null,
        communityNameSnapshot: null,
        durationSeconds: 3600,
        status: "CANCELLED",
        targetScope: "PRODUCT",
      }),
    ],
    "2026-09",
  );

  assert.equal(summary.monthTitle, "Septiembre 2026");
  assert.equal(summary.totalSeconds, 15900);
  assert.deepEqual(
    summary.sections.map((section) => section.targetLabel),
    ["Residencial Andalucia", "ENTRY general"],
  );

  const text = buildFieldWorkSummaryText(summary);
  assert.match(text, /ENTRY - Septiembre 2026/);
  assert.match(text, /Residencial Andalucia/);
  assert.match(text, /Onboarding: 2h 17m/);
  assert.match(text, /Soporte: 43m/);
  assert.match(text, /ENTRY general/);
  assert.match(text, /Mantenimiento: 1h 25m/);
  assert.doesNotMatch(text, /R&D/);
});

test("migration enforces durable timer invariants and RLS boundary", () => {
  const migration = read(
    "supabase/migrations/20260909093000_field_work_timer_v1.sql",
  );

  assert.match(migration, /create table if not exists public\.field_work_sessions/);
  assert.match(migration, /started_at timestamptz not null default now\(\)/);
  assert.match(migration, /ended_at timestamptz/);
  assert.match(migration, /field_work_sessions_one_active_per_user_idx/);
  assert.match(migration, /where status = 'ACTIVE'/);
  assert.match(migration, /field_work_sessions_non_negative_duration_check/);
  assert.match(migration, /alter table public\.field_work_sessions enable row level security/);
  assert.match(migration, /grant select on table public\.field_work_sessions to authenticated/);
  assert.match(migration, /revoke all privileges on table public\.field_work_sessions/);
  assert.match(migration, /public\.field_work_start_session_v1/);
  assert.match(migration, /public\.field_work_stop_session_v1/);
  assert.match(migration, /public\.field_work_cancel_session_v1/);
  assert.match(migration, /public\.is_superadmin\(v_user_id\)/);
  assert.match(migration, /community_name_snapshot/);
  assert.doesNotMatch(migration, /seshat|hourly|rate|cost|invoice|payroll/i);
});

test("Field timer is reachable from ENTRY and globally recovers active timer", () => {
  const entryPage = read("app/(field)/field/entry/page.tsx");
  const layout = read("app/(field)/field/layout.tsx");
  const shell = read("components/field/FieldShell.tsx");
  const client = read("features/entry/field/FieldWorkTimerClient.tsx");
  const queries = read("features/entry/field/workTimerQueries.ts");
  const actions = read("features/entry/field/workTimerActions.ts");

  assert.match(entryPage, /href="\/field\/entry\/time"/);
  assert.match(entryPage, /Tiempo/);
  assert.match(layout, /getActiveFieldWorkSession/);
  assert.match(shell, /ActiveWorkTimerBanner/);
  assert.match(client, /getElapsedSeconds\(session\.startedAt, now\)/);
  assert.doesNotMatch(client, /setElapsed|elapsed \+ 1|durationSeconds \+ 1/);
  assert.match(queries, /\.eq\("status", "ACTIVE"\)/);
  assert.match(queries, /\.gte\("ended_at", month\.startIso\)/);
  assert.match(actions, /getEntryPreviewReadOnlyError/);
  assert.match(actions, /revalidatePath\("\/field", "layout"\)/);
});
