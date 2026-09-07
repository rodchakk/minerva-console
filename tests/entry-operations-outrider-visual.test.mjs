import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("ENTRY Operations keeps the general setup table and adds Outrider as context instead of replacing it", () => {
  const operations = read("app/(console)/products/entry/page.tsx");

  assert.match(operations, /Setup priorities across ENTRY/);
  assert.match(operations, />City</);
  assert.match(operations, />Status</);
  assert.match(operations, />Outrider</);
  assert.match(operations, />Units</);
  assert.match(operations, /Pending[\s\S]*activations/);
  assert.match(operations, /getOnboardingNextStepLabel/);
  assert.match(operations, /community\.totalUnits/);
  assert.match(operations, /community\.activationPendingCount/);
  assert.doesNotMatch(operations, /title="Outrider operations"/);
});

test("ENTRY Operations preserves global activity while showing real Outrider overview and recent activity", () => {
  const operations = read("app/(console)/products/entry/page.tsx");
  const recentActivity = read("features/entry/outrider/recentActivity.ts");

  assert.match(operations, /Setup Overview/);
  assert.match(operations, /Recent Outrider activity/);
  assert.match(operations, /OperationalActivityFeed/);
  assert.match(operations, /listRecentOutriderActivity\(6\)/);
  assert.match(recentActivity, /community_outrider_events/);
  assert.match(recentActivity, /community_outrider_sessions/);
  assert.match(recentActivity, /Unknown community/);
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
  assert.match(route, /OutriderWorkspace/);
  assert.ok(statSync(artworkPath).size > 1000);
});
