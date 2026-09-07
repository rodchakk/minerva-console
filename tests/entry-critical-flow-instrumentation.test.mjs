import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260907193000_entry_critical_flow_instrumentation.sql",
  ),
  "utf8",
);

test("pass creation emits the exact event Observability already classifies", () => {
  assert.match(migration, /after insert on public\.visit_passes/i);
  assert.match(migration, /'PASS_CREATED'/);
  assert.match(migration, /'status', 'success'/);
  assert.match(migration, /'pass_type', NEW\.pass_type::text/);
  assert.doesNotMatch(migration, /NEW\.pin_code/);
  assert.doesNotMatch(migration, /NEW\.qr_token/);
  assert.doesNotMatch(migration, /NEW\.visitor_name/);
});

test("QR health measures validator execution, not whether the credential was accepted", () => {
  assert.match(migration, /NEW\.event_type = 'RESOLVE_ACCESS_CREDENTIAL'/);
  assert.match(migration, /NEW\.metadata->>'method'[\s\S]*'QR'/);
  assert.match(migration, /'QR_VALIDATED'/);
  assert.match(migration, /'status', 'success'/);
  assert.match(migration, /'result', v_result/);
  assert.match(migration, /then 'accepted' else 'rejected'/);
  assert.doesNotMatch(migration, /QR_VALIDATION_FAILED/);
  assert.doesNotMatch(migration, /NEW\.identifier/);
});

test("resident login telemetry comes from Supabase Auth sign-in state and only resident-capable memberships", () => {
  assert.match(migration, /after update of last_sign_in_at on auth\.users/i);
  assert.match(migration, /NEW\.last_sign_in_at is distinct from OLD\.last_sign_in_at/);
  assert.match(migration, /join public\.house_residents hr/);
  assert.match(migration, /cm\.role in \('RESIDENT', 'ADMIN'\)/);
  assert.match(migration, /'RESIDENT_LOGIN'/);
  assert.match(migration, /'status', 'success'/);
  assert.doesNotMatch(migration, /NEW\.email/);
});

test("community push outcomes feed Notifications without copying message content", () => {
  assert.match(migration, /public\.community_message_push_queue/);
  assert.match(migration, /'NOTIFICATION_FAILED'/);
  assert.match(migration, /'NOTIFICATION_SENT'/);
  assert.match(migration, /lower\(coalesce\(NEW\.status, ''\)\) in \('sent', 'failed'\)/);
  assert.match(migration, /'PUSH_DELIVERY_FAILED'/);
  assert.match(migration, /'PUSH_NO_ACTIVE_TOKENS'/);
  assert.match(migration, /v_no_active_tokens[\s\S]*then 'skipped'/);
  assert.doesNotMatch(migration, /NEW\.push_title/);
  assert.doesNotMatch(migration, /NEW\.push_body/);
  assert.doesNotMatch(migration, /NEW\.provider_response/);
  assert.doesNotMatch(migration, /'last_error'\s*,/);
});

test("all runtime telemetry hooks fail open so Observability cannot break ENTRY", () => {
  const failOpenCount = (migration.match(/exception when others then/g) ?? []).length;
  assert.ok(failOpenCount >= 5, `expected fail-open guards, got ${failOpenCount}`);
  assert.match(migration, /Observability must never block pass creation/);
  assert.match(migration, /Auth must remain available/);
  assert.match(migration, /Push completion\/failure state is the source of truth/);
});

test("the migration preserves no-traffic-is-Unknown semantics and forbids sensitive payload copies", () => {
  assert.match(migration, /Missing traffic remains Unknown/);
  assert.match(migration, /No heartbeat is invented/);
  assert.match(migration, /No pass PIN\/QR token, email, push body\/title, image/);
});
