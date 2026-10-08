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
  assert.match(page, /-mx-4 -my-4/);
  assert.match(page, /lg:-mx-6 lg:-my-5/);
  assert.match(page, /bg-\[#2E2936\]/);
  assert.doesNotMatch(page, /max-w-\[2200px\]/);
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
  assert.match(source, /case "pending_invite":[\s\S]*return "Pending invite"/);
  assert.match(
    source,
    /case "awaiting_activation":[\s\S]*return "Awaiting activation"/,
  );
});

test("Activation Queue is table-first and opens resident details in a fixed drawer", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(source, /100dvh/);
  assert.match(source, /overflow-auto overscroll-contain/);
  assert.match(source, /overflow-y-auto overscroll-contain/);
  assert.match(source, /scrollbar-gutter:stable/);
  assert.match(source, /useState<string \| null>\(null\)/);
  assert.match(source, /fixed bottom-5 right-5 top-\[76px\]/);
  assert.match(source, /w-\[440px\]/);
  assert.doesNotMatch(source, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
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
    /runResidentEmail\(activeRow\.id\)[\s\S]*disabled=\{!activeRowActionable \|\| phase !== "idle"\}/,
  );
  assert.match(
    source,
    /runResidentPin\(activeRow\.id\)[\s\S]*disabled=\{!activeRowActionable \|\| phase !== "idle"\}/,
  );
  assert.doesNotMatch(
    source,
    /runResident(?:Email|Pin)\(activeRow\.id\)[\s\S]{0,180}selectedCount === 0/,
  );
});

test("resident email action preserves an existing multi-selection for batch invites", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(
    source,
    /function runResidentEmail\(rowId: string\) \{[\s\S]*if \(selectedIds\.length > 1\) \{[\s\S]*setPhase\("confirmingEmail"\);[\s\S]*return;[\s\S]*setSelectedIds\(\[rowId\]\)/,
  );
  assert.match(source, /function runResidentEmail\(rowId: string\)[\s\S]*selectedIds\.length > 1/);
  assert.match(source, /\{selectedCount\} resident\{selectedCount === 1 \? "" : "s"\} selected/);
});

test("Activation Queue resident detail shows derived progress and queue blockers without backend changes", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(source, /Activation progress/);
  assert.match(source, /Queue checks/);
  assert.match(source, /Queue checks clear/);
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

test("Activation Queue shows invitation history, follow-up age and PIN timing separately", () => {
  const table = read("features/entry/activation/ActivationQueueTable.tsx");
  const actions = read("features/entry/activation/actions.ts");
  const migration = read(
    "supabase/migrations/20260927054000_entry_activation_follow_up_buckets.sql",
  );

  assert.match(table, /Last action/);
  assert.match(table, /First invitation sent/);
  assert.match(table, /Last invitation sent/);
  assert.match(table, /Invitation attempts/);
  assert.match(table, /Last PIN generated/);
  assert.match(table, /Needs follow-up/);
  assert.match(table, /Not invited/);
  assert.match(table, /Recent/);
  assert.match(table, /Waiting/);
  assert.match(actions, /lastActivationAt/);
  assert.match(actions, /first_invitation_sent_at/);
  assert.match(actions, /last_invitation_sent_at/);
  assert.match(actions, /invitation_attempt_count/);
  assert.match(actions, /list_resident_activation_queue_v3/);
  assert.match(migration, /max\(p\.created_at\) as last_pin_generated_at/);
});


test("Activation Queue does not treat digits inside an email as a phone query", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.ok(
    source.includes("const isPhoneLikeQuery = /^[+\\d\\s().-]+$/.test(searchQuery.trim());"),
  );
  assert.match(
    source,
    /const normalizedDigits = isPhoneLikeQuery\s*\?\s*searchQuery\.replace\(\/\\D\+\/g, ""\)\s*:\s*"";/,
  );
});


test("Activation Queue filter menu closes with Escape", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(source, /useEffect\(\(\) => \{[\s\S]*filterOpen/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /setFilterOpen\(false\)/);
  assert.match(source, /document\.addEventListener\("keydown", handleEscape\)/);
  assert.match(source, /document\.removeEventListener\("keydown", handleEscape\)/);
});
