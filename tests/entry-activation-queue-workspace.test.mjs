import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Activation Queue page loads the full community queue for client-side operations", () => {
  const page = read("app/(console)/products/entry/activation/page.tsx");

  assert.match(page, /getActivationQueuePageData\(\{[\s\S]*communityId: selectedCommunityId,[\s\S]*\}\)/);
  assert.doesNotMatch(page, /status: selectedStatus/);
  assert.doesNotMatch(page, /Setup overview/);
  assert.match(page, /max-w-\[2200px\]/);
});

test("Activation Queue exposes operational queue buckets and stage filters", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(source, /Ready now/);
  assert.match(source, /Pending PIN/);
  assert.match(source, /Pending invite/);
  assert.match(source, /Awaiting activation/);
  assert.match(source, /Activated/);
  assert.match(source, /Errors/);
  assert.match(source, /type QueueView/);
  assert.match(source, /matchesQueueView/);
  assert.match(source, /Activation queue filters/);
});


test("Activation Queue keeps pending invite distinct from awaiting activation", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(
    source,
    /case "pending_invite":[\s\S]*return row\.status === "pin_generated"/,
  );
  assert.match(
    source,
    /case "awaiting_activation":[\s\S]*return row\.status === "invited"/,
  );
  assert.match(
    source,
    /PIN is ready, but the invitation has not been sent yet\./,
  );
  assert.match(
    source,
    /Invitation sent; waiting for the resident to complete activation\./,
  );
});

test("Activation Queue keeps the table and resident detail as independent scroll regions", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(source, /100dvh/);
  assert.match(source, /overflow-auto overscroll-contain/);
  assert.match(source, /overflow-y-auto overscroll-contain/);
  assert.match(source, /scrollbar-gutter:stable/);
  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
});

test("Activation Queue preserves the existing activation actions and adds direct resident PIN action", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(source, /generateActivationPins/);
  assert.match(source, /sendActivationEmails/);
  assert.match(source, /createActivatedUsers/);
  assert.match(source, /function runResidentPin/);
  assert.match(source, /function runResidentEmail/);
  assert.match(source, /function runResidentCreateUser/);
  assert.match(source, /Generate PIN/);
  assert.match(source, /Send invite/);
  assert.match(source, /Create user/);
});

test("resident-side actions do not require an unrelated bulk selection", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(
    source,
    /runResidentEmail\(activeRow\.id\)[\s\S]*disabled=\{!communityId \|\| phase !== "idle"\}/,
  );
  assert.match(
    source,
    /runResidentPin\(activeRow\.id\)[\s\S]*disabled=\{!communityId \|\| phase !== "idle"\}/,
  );
});

test("resident email action preserves an existing multi-selection for batch invites", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(
    source,
    /function runResidentEmail\(rowId: string\) \{[\s\S]*if \(selectedIds\.length > 1\) \{[\s\S]*setPhase\("confirmingEmail"\);[\s\S]*return;[\s\S]*setSelectedIds\(\[rowId\]\)/,
  );
  assert.match(source, /selectedCount > 1[\s\S]*selectedCount} invites/);
  assert.match(source, /selectedCount > 1[\s\S]*selectedCount} selected/);
});

test("Activation Queue resident detail shows derived progress and queue blockers without backend changes", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(source, /Activation progress/);
  assert.match(source, /Queue checks/);
  assert.match(source, /No blockers detected/);
  assert.match(source, /getQueueBlockers/);
  assert.match(source, /getActivationStage/);
  assert.doesNotMatch(source, /supabase\.(?:from|rpc|insert|update|upsert)\(/);
});

test("queue review acknowledgement is compact and operational", () => {
  const source = read(
    "features/entry/activation/ActivationQueueReviewAcknowledge.tsx",
  );

  assert.match(source, /Queue review pending/);
  assert.match(source, /Mark queue reviewed/);
  assert.match(source, /pending activation/);
  assert.doesNotMatch(source, /rounded-\[26px\]/);
});


test("Activation Queue exposes safe pre-activation email correction", () => {
  const table = read("features/entry/activation/ActivationQueueTable.tsx");
  const action = read("features/entry/activation/emailEditActions.ts");
  const migration = read(
    "supabase/migrations/20260925021500_update_resident_activation_email_v1.sql",
  );

  assert.match(table, /Change activation email/);
  assert.match(table, /Edit email/);
  assert.match(table, /updateActivationEmail/);
  assert.match(action, /update_resident_activation_email_v1/);
  assert.match(migration, /status = 'expired'/);
  assert.match(migration, /status = 'pending'/);
  assert.match(migration, /campaign_send_in_progress/);
  assert.match(migration, /email_already_reserved/);
});

test("Console PIN generation serializes with activation email edits", () => {
  const source = read("features/entry/activation/pinActions.ts");
  const migration = read(
    "supabase/migrations/20260925021500_update_resident_activation_email_v1.sql",
  );

  assert.match(source, /generate_resident_activation_pins_locked_v1/);
  assert.match(migration, /generate_resident_activation_pins_locked_v1/);
  assert.match(
    migration,
    /resident_activation_pins[\s\S]*for update[\s\S]*resident_activation_queue[\s\S]*for update/,
  );
});


test("Activation Queue supports safe pre-activation phone correction", () => {
  const table = read("features/entry/activation/ActivationQueueTable.tsx");
  const action = read("features/entry/activation/phoneEditActions.ts");
  const migration = read(
    "supabase/migrations/20260925043000_activation_queue_phone_and_delivery_timestamps.sql",
  );

  assert.match(table, /Change activation phone/);
  assert.match(table, /Edit phone/);
  assert.match(table, /updateActivationPhone/);
  assert.match(action, /update_resident_activation_phone_v1/);
  assert.match(migration, /activation_reset/);
  assert.match(migration, /phone_send_in_progress/);
  assert.match(migration, /status = 'expired'/);
});

test("Activation Queue shows last email and PIN timing separately", () => {
  const table = read("features/entry/activation/ActivationQueueTable.tsx");
  const actions = read("features/entry/activation/actions.ts");
  const migration = read(
    "supabase/migrations/20260925043000_activation_queue_phone_and_delivery_timestamps.sql",
  );

  assert.match(table, /Last activation/);
  assert.match(table, /Last email sent/);
  assert.match(table, /Last PIN generated/);
  assert.match(actions, /lastActivationAt/);
  assert.match(actions, /invite_sent_at/);
  assert.match(actions, /last_pin_generated_at/);
  assert.match(actions, /list_resident_activation_queue_v2/);
  assert.match(migration, /max\(p\.created_at\) as last_pin_generated_at/);
});


test("activation phone/timestamp migration contains one complete definition of each RPC", () => {
  const migration = read(
    "supabase/migrations/20260925043000_activation_queue_phone_and_delivery_timestamps.sql",
  );

  assert.equal(
    (migration.match(/create or replace function public\.update_resident_activation_phone_v1/g) ?? []).length,
    1,
  );
  assert.equal(
    (migration.match(/create or replace function public\.list_resident_activation_queue_v2/g) ?? []).length,
    1,
  );
  assert.equal((migration.match(/\$function\$;/g) ?? []).length, 2);
  assert.match(
    migration,
    /v_new_method := v_queue\.activation_method;[\s\S]*v_requires_reset := v_new_method = 'phone_pin';/,
  );
});
