import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const migration = read(
  "supabase/migrations/20260927054000_entry_activation_follow_up_buckets.sql",
);
const actions = read("features/entry/activation/actions.ts");
const table = read("features/entry/activation/ActivationQueueTable.tsx");
const diagnosticRoute = read("app/api/entry/observability/diagnostic/route.ts");

test("activation follow-up history is backfilled from accepted provider telemetry", () => {
  assert.match(migration, /first_invitation_sent_at/);
  assert.match(migration, /last_invitation_sent_at/);
  assert.match(migration, /invitation_attempt_count/);
  assert.match(migration, /ACTIVATION_EMAIL_SENT/);
  assert.match(migration, /details->>'status'.*success/s);
  assert.match(migration, /min\(s\.created_at\) as first_sent_at/);
  assert.match(migration, /max\(s\.created_at\) as last_sent_at/);
  assert.match(migration, /count\(\*\)::integer as attempt_count/);
});

test("future accepted invitations advance last-contact age without losing first-contact history", () => {
  assert.match(migration, /sync_resident_activation_invitation_tracking_v1/);
  assert.match(migration, /new\.invite_sent_at is distinct from old\.invite_sent_at/);
  assert.match(
    migration,
    /new\.first_invitation_sent_at := coalesce\([\s\S]*old\.first_invitation_sent_at/,
  );
  assert.match(migration, /new\.last_invitation_sent_at := new\.invite_sent_at/);
  assert.match(
    migration,
    /new\.invitation_attempt_count := coalesce\(old\.invitation_attempt_count, 0\) \+ 1/,
  );
  assert.match(
    migration,
    /if new\.invite_sent_at is null then[\s\S]*new\.last_invitation_sent_at := null/,
  );
});

test("server read model derives the approved follow-up buckets from last invitation time", () => {
  assert.match(migration, /list_resident_activation_queue_v3/);
  assert.match(migration, /'not_invited'/);
  assert.match(migration, /interval '3 days'/);
  assert.match(migration, /'recent'/);
  assert.match(migration, /interval '7 days'/);
  assert.match(migration, /'waiting'/);
  assert.match(migration, /'needs_follow_up'/);
  assert.match(migration, /days_since_last_invitation/);
  assert.match(actions, /deriveFollowUpStatus/);
});

test("Activation Queue exposes follow-up summary, quick filters and repeated-invite guidance", () => {
  assert.match(table, /Follow-up snapshot/);
  assert.match(table, /Activation follow-up filters/);
  assert.match(table, /needs_follow_up/);
  assert.match(table, /not_invited/);
  assert.match(table, /recent/);
  assert.match(table, /waiting/);
  assert.match(table, /14\+ days/);
  assert.match(table, /5\+ invitations/);
  assert.match(table, /contact the resident by WhatsApp before sending another reminder/);
});

test("diagnostic exports enrich Activation Queue totals with follow-up aging", () => {
  assert.match(migration, /sa_get_activation_follow_up_summary_v1/);
  assert.match(migration, /recently_invited_count/);
  assert.match(migration, /waiting_count/);
  assert.match(migration, /needs_follow_up_count/);
  assert.match(migration, /needs_follow_up_14d_count/);
  assert.match(migration, /high_attempt_count/);
  assert.match(diagnosticRoute, /sa_get_activation_follow_up_summary_v1/);
  assert.match(diagnosticRoute, /queue_health/);
  assert.match(diagnosticRoute, /activation/);
});
