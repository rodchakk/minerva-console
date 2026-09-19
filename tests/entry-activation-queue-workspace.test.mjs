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
