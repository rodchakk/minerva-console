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

test("Activation Queue remains table-first and uses the shared stable-width drawer", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");
  const drawer = read("features/entry/activation/ActivationResidentDrawer.tsx");
  const tabs = read("features/entry/components/EntryDrawerTabs.tsx");
  assert.match(source, /100dvh/);
  assert.match(source, /ActivationResidentDrawer/);
  assert.match(drawer, /fixed bottom-5 right-5 top-\[76px\]/);
  assert.match(drawer, /w-\[440px\]/);
  assert.match(drawer, /w-\[560px\]/);
  assert.match(drawer, /grid-rows-\[auto_auto_minmax\(0,1fr\)_auto\]/);
  assert.match(drawer, /overflow-y-auto overscroll-contain/);
  assert.match(drawer, /EntryDrawerTabs/);
  assert.match(tabs, /role="tablist"/);
  assert.match(drawer, /Resident details/);
  assert.match(drawer, /Invitation history/);
});

test("Activation Queue retains existing batch operations and one resident activation button", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");
  const drawer = read("features/entry/activation/ActivationResidentDrawer.tsx");
  const dialog = read("features/entry/activation/ManageResidentActivationDialog.tsx");

  assert.match(source, /generateActivationPins/);
  assert.match(source, /sendActivationEmails/);
  assert.match(source, /createActivatedUsers/);
  assert.match(source, /async function handleConfirmSendEmail/);
  assert.match(source, /queueIds: selectedIds/);
  assert.match(drawer, /Manage activation/);
  assert.doesNotMatch(drawer, /Create user/);
  assert.match(dialog, /createActivatedUsers/);
  assert.match(dialog, /mode === "quick"/);
  assert.match(dialog, /includePinForSharing: true/);
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


test("shared pending drawer retains safe pre-activation email correction", () => {
  const drawer = read("features/entry/activation/ActivationResidentDrawer.tsx");
  const editor = read("features/entry/activation/ActivationResidentEditors.tsx");
  const action = read("features/entry/activation/emailEditActions.ts");
  const migration = read("supabase/migrations/20260925021500_update_resident_activation_email_v1.sql");
  assert.match(drawer, /Edit email/);
  assert.match(editor, /Change activation email/);
  assert.match(editor, /updateActivationEmail/);
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


test("shared pending drawer keeps phone correction and invitation history", () => {
  const drawer = read("features/entry/activation/ActivationResidentDrawer.tsx");
  const editor = read("features/entry/activation/ActivationResidentEditors.tsx");
  const actions = read("features/entry/activation/actions.ts");
  const migration = read("supabase/migrations/20260925043000_activation_queue_phone_and_delivery_timestamps.sql");
  assert.match(drawer, /Edit phone/);
  assert.match(drawer, /Invitation history/);
  assert.match(drawer, /row\.lastPinGeneratedAt/);
  assert.match(drawer, /row\.invitationAttemptCount/);
  assert.match(drawer, /Needs follow-up/);
  assert.match(editor, /updateActivationPhone/);
  assert.match(migration, /activation_reset/);
  assert.match(actions, /list_resident_activation_queue_v3/);
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


test("Activation Queue filter menu closes when clicking outside", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(source, /useRef<HTMLDivElement>\(null\)/);
  assert.match(source, /handlePointerDown/);
  assert.match(source, /filterMenuRef\.current\?\.contains\(target\)/);
  assert.match(source, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(source, /document\.removeEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(source, /ref=\{filterMenuRef\}/);
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
