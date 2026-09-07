import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("ENTRY Operations restores the pre-Outrider dashboard composition", () => {
  const operations = read("app/(console)/products/entry/page.tsx");

  assert.match(operations, /label="Messages \(24h\)"/);
  assert.match(operations, /Setup priorities across ENTRY/);
  assert.match(operations, />City</);
  assert.match(operations, />Status</);
  assert.match(operations, />Onboarding</);
  assert.match(operations, />Units</);
  assert.match(operations, /Pending[\s\S]*activations/);
  assert.match(operations, /getOnboardingNextStepLabel/);
  assert.match(operations, /community\.completedTasks/);
  assert.match(operations, /community\.totalTasks/);
  assert.match(operations, /community\.totalUnits/);
  assert.match(operations, /community\.activationPendingCount/);
  assert.match(operations, /OperationalActivityFeed/);
});

test("Outrider is intentionally narrow on Operations", () => {
  const operations = read("app/(console)/products/entry/page.tsx");

  assert.match(operations, /Open Activation Queue/);
  assert.match(operations, /Open Outrider/);
  assert.match(operations, /Setup Overview/);
  assert.match(operations, /Ready for review/);
  assert.match(operations, /Needs information/);
  assert.match(operations, /Approved/);
  assert.doesNotMatch(operations, /label="Outrider"/);
  assert.doesNotMatch(operations, />Outrider<\/th>/);
  assert.doesNotMatch(operations, /Recent Outrider activity/i);
  assert.doesNotMatch(operations, /listRecentOutriderActivity/);
  assert.doesNotMatch(operations, /title="Outrider operations"/);
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
