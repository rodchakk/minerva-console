import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const migration = read(
  "supabase/migrations/20260908090000_entry_notification_observability_drilldown.sql",
);
const queries = read("features/entry/observability/queries.ts");
const page = read("app/(console)/products/entry/observability/page.tsx");
const notificationsPage = read(
  "app/(console)/products/entry/observability/notifications/page.tsx",
);
const drilldown = read(
  "features/entry/observability/NotificationObservabilityDrilldown.tsx",
);
const docs = read("docs/entry-observability.md");
const ci = read(".github/workflows/ci.yml");

test("Notifications drill-down RPC is superadmin-only, bounded, and limit-clamped", () => {
  assert.match(
    migration,
    /create or replace function public\.sa_get_entry_notification_observability_v1/,
  );
  assert.match(migration, /if not public\.is_superadmin\(\)/);
  assert.match(migration, /v_end - v_start > interval '31 days'/);
  assert.match(
    migration,
    /v_limit integer := least\(greatest\(coalesce\(p_limit, 100\), 1\), 200\)/,
  );
  assert.match(migration, /returns jsonb/);
  assert.match(migration, /revoke all on function public\.sa_get_entry_notification_observability_v1/);
  assert.match(migration, /grant execute on function public\.sa_get_entry_notification_observability_v1/);
});

test("RPC aggregates existing notification evidence without exposing raw tables to the page", () => {
  assert.match(migration, /from public\.system_event_log s/);
  assert.match(migration, /from public\.community_message_push_queue q/);
  assert.match(migration, /public\.community_messages m/);
  assert.match(migration, /from public\.onboarding_campaign_messages m/);
  assert.match(queries, /supabase\.rpc\(\s*"sa_get_entry_notification_observability_v1"/);
  assert.doesNotMatch(notificationsPage, /\.from\("system_event_log"\)/);
  assert.doesNotMatch(notificationsPage, /\.from\("community_message_push_queue"\)/);
  assert.doesNotMatch(notificationsPage, /\.from\("onboarding_campaign_messages"\)/);
});

test("PUSH_CLAIM_RPC_ERROR does not fabricate impact and reports scheduled retry semantics", () => {
  assert.match(migration, /s\.event_type = 'PUSH_CLAIM_RPC_ERROR' then 'worker \/ queue claim'/);
  assert.match(
    migration,
    /when s\.event_type in \('PUSH_CLAIM_RPC_ERROR', 'SOS_PUSH_NO_GUARD_TOKENS'\) then false/,
  );
  assert.match(migration, /then 'scheduled_worker_retry'/);
  assert.match(
    migration,
    /Worker failed before identifying a queue item; impact to a specific community, message, or recipient cannot be proven\./,
  );
  assert.match(
    migration,
    /Scheduled worker invocation will run again because no queue row was claimed or terminally failed\./,
  );
  assert.match(drilldown, /No specific notification had been selected/);
  assert.match(drilldown, /Provider delivery was not\s*reached/);
});

test("targeted and community push audience labels use safe display values only", () => {
  assert.match(migration, /m\.target_user_id is not null then 'user'/);
  assert.match(migration, /coalesce\(target_profile\.full_name, 'user:' \|\| left\(m\.target_user_id::text, 8\)\)/);
  assert.match(migration, /when m\.id is not null then 'community'/);
  assert.match(migration, /'Community audience'/);
  assert.doesNotMatch(migration, /p\.email/);
  assert.doesNotMatch(migration, /p\.phone/);
  assert.doesNotMatch(migration, /p\.username/);
  assert.doesNotMatch(migration, /synthetic_email/);
});

test("no-active-token conditions are skipped deliverability evidence, not provider outages", () => {
  assert.match(migration, /like 'no active push tokens%'/i);
  assert.match(migration, /'No active push tokens \/ no deliverable audience'/);
  assert.match(migration, /then 'PUSH_NO_ACTIVE_TOKENS'/);
  assert.match(migration, /then 'no_provider_retry'/);
  assert.match(drilldown, /Skipped is not a provider outage/);
  assert.match(docs, /not as an Expo outage/);
});

test("terminal failed queue rows are not described as automatically retried", () => {
  assert.match(migration, /q\.status = 'failed' then 'terminal_no_auto_reclaim'/);
  assert.match(
    migration,
    /Terminal failed queue rows are not automatically reclaimed by the current claim RPC\./,
  );
  assert.match(docs, /must not describe failed queue rows as automatically retried/);
  assert.doesNotMatch(migration, /attempts < 5[\s\S]{0,120}retry/i);
});

test("onboarding email failures normalize without recipient email exposure", () => {
  assert.match(migration, /'onboarding_email'::text as channel/);
  assert.match(migration, /when m\.status = 'failed' then 'ONBOARDING_EMAIL_FAILED'/);
  assert.match(migration, /without exposing the recipient email/);
  assert.match(notificationsPage, /onboarding-email evidence/);
  assert.doesNotMatch(migration, /m\.recipient_email/);
  assert.doesNotMatch(migration, /m\.recipient_phone/);
});

test("returned contract excludes secrets, tokens, emails, bodies, URLs, and raw provider payloads", () => {
  assert.match(migration, /_entry_notification_observability_sanitize_text_v1/);
  assert.match(migration, /\[redacted-email\]/);
  assert.match(migration, /ExponentPushToken\[redacted\]/);
  assert.match(migration, /\[redacted-jwt\]/);
  assert.doesNotMatch(migration, /push_title[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /push_body[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /provider_response[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /recipient_email[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /body[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /image_url[\s\S]{0,500}jsonb_build_object/);
  assert.doesNotMatch(migration, /image_path[\s\S]{0,500}jsonb_build_object/);
  assert.match(drilldown, /Raw provider payloads,\s*push tokens,\s*emails, message bodies, and credentials are excluded/);
});

test("overview and drill-down UI preserve filters and avoid fake healthy empty states", () => {
  assert.match(page, /\/products\/entry\/observability\/notifications/);
  assert.match(page, /flow\.key === "notifications"/);
  assert.match(notificationsPage, /Back to observability/);
  assert.match(notificationsPage, /basePath="\/products\/entry\/observability\/notifications"/);
  assert.match(drilldown, /No events stays Unknown/);
  assert.match(drilldown, /This remains Unknown, not Healthy/);
  assert.match(drilldown, /Event detail/);
  assert.match(drilldown, /Provider reached/);
});

test("CI executes focused notification observability regressions", () => {
  assert.match(ci, /tests\/entry-notification-observability\.test\.mjs/);
});
