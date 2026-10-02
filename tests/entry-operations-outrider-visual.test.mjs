import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("ENTRY Operations is an action-focused workspace", () => {
  const operations = read("app/(console)/products/entry/page.tsx");

  assert.match(operations, /Action-focused workspace for issues/);
  assert.match(operations, /label="Needs attention"/);
  assert.match(operations, /label="Pending activations"/);
  assert.match(operations, /label="Open tickets"/);
  assert.match(operations, /label="Alerts \/ incidents"/);
  assert.match(operations, /Operational priorities/);
  assert.match(operations, />Item</);
  assert.match(operations, />Type</);
  assert.match(operations, />Status</);
  assert.match(operations, />Impact</);
  assert.match(operations, /Nothing needs attention/);
  assert.match(operations, /ENTRY is operating normally/);
  assert.doesNotMatch(operations, /label="Active communities"/);
  assert.doesNotMatch(operations, /Setup priorities across ENTRY/);
  assert.match(operations, /getOnboardingNextStepLabel/);
  assert.match(operations, /getEntrySupportTickets/);
  assert.match(operations, /getEntryObservability/);
  assert.match(operations, /isCommunityPendingSetup/);
  assert.match(operations, /isCommunityFullyActive/);
  assert.match(operations, /OperationalActivityFeed/);
});

test("Outrider is intentionally narrow on Operations", () => {
  const operations = read("app/(console)/products/entry/page.tsx");

  assert.match(operations, /Open Activation Queue/);
  assert.match(operations, /Open Outrider/);
  assert.match(operations, /Operational Summary/);
  assert.doesNotMatch(operations, /label="Outrider"/);
  assert.doesNotMatch(operations, />Outrider<\/th>/);
  assert.doesNotMatch(operations, /listOutriderSessions/);
  assert.doesNotMatch(operations, /Ready for review/);
  assert.doesNotMatch(operations, /Needs information/);
  assert.doesNotMatch(operations, /Approved/);
  assert.doesNotMatch(operations, /Recent Outrider activity/i);
  assert.doesNotMatch(operations, /listRecentOutriderActivity/);
  assert.doesNotMatch(operations, /title="Outrider operations"/);
});

test("ENTRY Communities owns directory lifecycle semantics", () => {
  const page = read("app/(console)/products/entry/communities/page.tsx");
  const list = read("features/entry/communities/CommunityList.tsx");
  const lifecycle = read("features/entry/communities/lifecycle.ts");

  assert.match(page, /ENTRY Communities/);
  assert.match(page, /Directory and lifecycle management for all ENTRY communities/);
  assert.match(page, /label: "Fully active"/);
  assert.match(page, /rawFilter === "active"/);
  assert.match(page, /: "all"/);
  assert.match(page, /label: "All communities"[\s\S]*href: "\/products\/entry\/communities"/);
  assert.match(page, /label: "Active"[\s\S]*href: "\/products\/entry\/communities\?filter=active"/);
  assert.match(page, /communities\.filter\(isCommunityFullyActive\)/);
  assert.match(page, /communities\.filter\(isCommunityPendingSetup\)/);
  assert.match(page, /return communities\.filter\(isCommunityPendingSetup\)/);
  assert.match(list, /getCommunityLifecycleLabel\(lifecycleState\)/);
  assert.match(lifecycle, /isCommunityFullyActive/);
  assert.match(lifecycle, /isCommunityPendingSetup/);
  assert.match(lifecycle, /communityNeedsSetupAttention/);
  assert.match(lifecycle, /Fully active/);
  assert.match(lifecycle, /Pending setup/);
});

test("Outrider remains a separate branded workspace using the approved artwork and copy", () => {
  const workspace = read(
    "features/entry/outrider/internal/OutriderWorkspace.tsx",
  );
  const route = read("app/(console)/products/entry/outrider/page.tsx");
  const artworkPath = join(
    root,
    "public/entry/outrider/outrider-mountains.webp",
  );

  assert.match(workspace, /OUTRIDER/);
  assert.match(workspace, /Collect\. Structure\. Prepare\./);
  assert.match(workspace, /outrider-mountains\.webp/);
  assert.match(workspace, /Start Outrider/);
  assert.match(workspace, /Outrider sessions/);
  assert.match(workspace, /Community name/);
  assert.match(workspace, /Already exists in ENTRY\? Link existing community/);
  assert.match(workspace, /Pre-ENTRY/);
  assert.match(route, /OutriderWorkspace/);
  assert.ok(statSync(artworkPath).size > 1000);
});
