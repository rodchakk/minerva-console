import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("support ticket queue follows the approved table-first ENTRY pattern", () => {
  const source = read("app/(console)/products/entry/tickets/page.tsx");

  assert.match(source, /All tickets/);
  assert.match(source, /Received/);
  assert.match(source, /In progress/);
  assert.match(source, /Resolved/);
  assert.match(source, /Ticket queue/);
  assert.match(source, /table-fixed/);
  assert.match(source, /entryButtonClass/);
});

test("support ticket detail keeps conversation primary and context secondary", () => {
  const source = read(
    "app/(console)/products/entry/tickets/[ticketId]/page.tsx",
  );

  assert.match(source, /Support request from/);
  assert.match(source, /Requester/);
  assert.match(source, /Community/);
  assert.match(source, /Source/);
  assert.match(source, /Last updated/);
  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.match(source, /Quick actions/);
  assert.match(source, /Technical context/);
  assert.match(source, /entryButtonClass\("primary", "min-w-\[108px\]"\)/);
});

test("support conversation and quick tools reuse approved ENTRY controls", () => {
  const conversation = read(
    "features/entry/support/SupportConversation.tsx",
  );
  const tools = read("features/entry/support/SupportQuickTools.tsx");

  assert.match(conversation, /entryButtonClass\("primary", "min-w-\[92px\]"\)/);
  assert.match(conversation, /h-\[clamp\(590px,72vh,760px\)\]/);
  assert.match(conversation, /bg-\[#24202B\]/);

  assert.match(tools, /entryButtonClass/);
  assert.match(tools, /Reset password/);
  assert.match(tools, /View resident/);
  assert.match(tools, /View community/);
  assert.match(tools, /Copy diagnostics/);
});
