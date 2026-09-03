import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("ENTRY Field home exposes Tickets without adding a new navigation system", () => {
  const page = read("app/(field)/field/entry/page.tsx");

  assert.match(page, /href="\/field\/entry\/tickets"/);
  assert.match(page, />\s*Tickets\s*</);
  assert.match(page, /Support conversations and quick actions/);
  assert.match(page, /min-h-20/);
});

test("Field tickets reuse the existing support backend contracts", () => {
  const data = read("features/entry/field/ticketData.ts");
  const actions = read("features/entry/field/ticketActions.ts");

  assert.match(data, /support_admin_list_tickets/);
  assert.match(data, /support_admin_get_ticket/);
  assert.match(data, /support_ticket_messages/);
  assert.match(actions, /support_add_message/);
  assert.match(actions, /support_update_status/);
  assert.match(actions, /requireSuperadmin\(\)/);
  assert.doesNotMatch(actions, /auth\.admin\.deleteUser/);
  assert.doesNotMatch(actions, /setInterval|setTimeout\([^)]*fetch|cron/i);
});

test("ticket chat subscribes to existing Supabase realtime tables instead of polling", () => {
  const chat = read("features/entry/field/FieldTicketChat.tsx");

  assert.match(chat, /createBrowserSupabaseClient/);
  assert.match(chat, /\.channel\(`field-ticket-/);
  assert.match(chat, /"postgres_changes"/);
  assert.match(chat, /table: "support_ticket_messages"/);
  assert.match(chat, /filter: `ticket_id=eq\.\$\{ticketId\}`/);
  assert.match(chat, /table: "support_tickets"/);
  assert.match(chat, /filter: `id=eq\.\$\{ticketId\}`/);
  assert.match(chat, /removeChannel/);
  assert.doesNotMatch(chat, /setInterval/);
});

test("ticket detail becomes a focused PWA composer when the keyboard opens", () => {
  const chat = read("features/entry/field/FieldTicketChat.tsx");
  const nav = read("components/field/FieldNav.tsx");

  assert.match(chat, /window\.visualViewport/);
  assert.match(chat, /composerMode/);
  assert.match(chat, /fixed inset-x-0 z-50/);
  assert.match(chat, /overflow-y-auto overscroll-contain/);
  assert.match(chat, /minerva-field-composer-mode/);
  assert.match(chat, /!composerMode \? \(/);
  assert.match(chat, /Reply to this ticket/);
  assert.match(chat, /max-h-32/);
  assert.match(chat, /Send message/);
  assert.match(nav, /minerva-field-composer-mode/);
  assert.match(nav, /if \(composerOpen\) return null/);
});

test("new realtime messages preserve reading position and expose a jump action", () => {
  const chat = read("features/entry/field/FieldTicketChat.tsx");

  assert.match(chat, /isNearBottomRef/);
  assert.match(chat, /distanceFromBottom < 96/);
  assert.match(chat, /setHasNewMessage\(true\)/);
  assert.match(chat, />\s*New message\s*</);
  assert.match(chat, /scrollConversationToBottom\("smooth"\)/);
});

test("ticket quick actions reuse ENTRY recovery and people surfaces", () => {
  const chat = read("features/entry/field/FieldTicketChat.tsx");

  assert.match(chat, /resetFieldResidentAccess/);
  assert.match(chat, /Reset access/);
  assert.match(chat, /Open user/);
  assert.match(chat, /Confirm reset/);
  assert.match(chat, /Temporary recovery code/);
  assert.match(chat, /Resolve/);
  assert.match(chat, /Reopen/);
});

test("ticket fixes do not add schema, Brain, or Console membership coupling", () => {
  const actions = read("features/entry/field/ticketActions.ts");
  const data = read("features/entry/field/ticketData.ts");
  const chat = read("features/entry/field/FieldTicketChat.tsx");
  const combined = `${actions}\n${data}\n${chat}`;

  assert.doesNotMatch(combined, /console_members/);
  assert.doesNotMatch(combined, /features\/brain|content\/brain/);
  assert.doesNotMatch(combined, /create table|alter table/i);
  assert.doesNotMatch(combined, /setInterval/);
});
