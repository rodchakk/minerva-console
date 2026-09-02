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

test("ticket detail is a PWA-friendly chat with a sticky composer above Field navigation", () => {
  const chat = read("features/entry/field/FieldTicketChat.tsx");

  assert.match(chat, /Ticket conversation/);
  assert.match(chat, /Reply to this ticket/);
  assert.match(chat, /100dvh/);
  assert.match(chat, /safe-area-inset-bottom/);
  assert.match(chat, /sticky bottom-/);
  assert.match(chat, /max-h-32/);
  assert.match(chat, /scrollIntoView/);
  assert.match(chat, /Send message/);
});

test("ticket quick actions reuse ENTRY recovery and people surfaces", () => {
  const chat = read("features/entry/field/FieldTicketChat.tsx");

  assert.match(chat, /resetFieldResidentAccess/);
  assert.match(chat, /Reset access/);
  assert.match(chat, /Open user/);
  assert.match(chat, /support/i);
  assert.match(chat, /Confirm reset/);
  assert.match(chat, /Temporary recovery code/);
  assert.match(chat, /Resolve/);
  assert.match(chat, /Reopen/);
});

test("ticket work does not add schema, polling, Brain, or Console membership coupling", () => {
  const actions = read("features/entry/field/ticketActions.ts");
  const data = read("features/entry/field/ticketData.ts");
  const chat = read("features/entry/field/FieldTicketChat.tsx");
  const combined = `${actions}\n${data}\n${chat}`;

  assert.doesNotMatch(combined, /console_members/);
  assert.doesNotMatch(combined, /features\/brain|content\/brain/);
  assert.doesNotMatch(combined, /setInterval|WebSocket|RealtimeChannel/);
  assert.doesNotMatch(combined, /create table|alter table/i);
});
