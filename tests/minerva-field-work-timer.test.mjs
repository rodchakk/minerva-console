import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

const migration = read(
  "supabase/migrations/20260909153000_entry_field_work_timer.sql",
);
const data = read("features/entry/field/workTimerData.ts");
const actions = read("features/entry/field/workTimerActions.ts");
const workspace = read("features/entry/field/FieldWorkTimerWorkspace.tsx");

test("ENTRY Field exposes a dedicated work timer without reopening onboarding", () => {
  const page = read("app/(field)/field/entry/page.tsx");
  const timerPage = read("app/(field)/field/entry/work-timer/page.tsx");

  assert.match(page, /href="\/field\/entry\/work-timer"/);
  assert.match(page, />\s*Work timer\s*</);
  assert.match(page, /Capture Field work time/);
  assert.match(timerPage, /FieldWorkTimerWorkspace/);
  assert.doesNotMatch(`${page}\n${timerPage}`, /registration\/start|FieldRegistrationCard/);
});

test("work timer schema is durable, ENTRY-scoped, and protected by RLS", () => {
  assert.match(migration, /create table if not exists public\.entry_field_work_sessions/);
  assert.match(migration, /staff_user_id uuid not null references auth\.users/);
  assert.match(migration, /community_id uuid references public\.communities/);
  assert.match(migration, /product_area text not null default 'entry'/);
  assert.match(migration, /classification in \('onboarding', 'support', 'maintenance', 'research_development'\)/);
  assert.match(migration, /work_location in \('onsite', 'remote'\)/);
  assert.match(migration, /where stopped_at is null/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /to authenticated/);
  assert.match(migration, /public\.is_superadmin\(auth\.uid\(\)\)/);
  assert.doesNotMatch(migration, /admin_toggle_house|admin_set_houses_active_status|registration_link/i);
});

test("work timer actions validate staff, preview boundary, and community attribution", () => {
  assert.match(actions, /requireSuperadmin\(\)/);
  assert.match(actions, /getEntryPreviewReadOnlyError/);
  assert.match(actions, /getCommunitiesWithProgressResult/);
  assert.match(actions, /entry_field_work_sessions/);
  assert.match(actions, /staff_user_id: user\.id/);
  assert.match(actions, /staff_user_id", user\.id/);
  assert.match(actions, /duration_seconds/);
  assert.doesNotMatch(actions, /admin_toggle_house|admin_set_houses_active_status|FieldRegistrationCard/);
});

test("work timer data returns history and monthly copy summary for manual entry", () => {
  assert.match(data, /getFieldWorkTimerPageData/);
  assert.match(data, /summarizeFieldWorkMonth/);
  assert.match(data, /buildCopySummary/);
  assert.match(data, /Manual|Minerva Field work summary/);
  assert.match(data, /By classification:/);
  assert.match(data, /By location:/);
  assert.match(data, /By community:/);
  assert.match(data, /entry_field_work_sessions/);
});

test("work timer UI captures classification, location, active timer, history, and copy", () => {
  assert.match(workspace, /FIELD_WORK_CLASSIFICATIONS/);
  assert.match(workspace, /FIELD_WORK_LOCATIONS/);
  assert.match(workspace, /useElapsedSeconds/);
  assert.match(workspace, /window\.setInterval/);
  assert.match(workspace, /startFieldWorkSession/);
  assert.match(workspace, /stopFieldWorkSession/);
  assert.match(workspace, /Manual Seshat entry/);
  assert.match(workspace, /navigator\.clipboard\.writeText/);
  assert.match(workspace, /History/);
  assert.doesNotMatch(workspace, /Deactivate unit|Reactivate unit|Registration Link/);
});
