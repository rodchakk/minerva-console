import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("dashboard is the Minerva Control Center landing surface", () => {
  const dashboard = read("app/(console)/dashboard/page.tsx");
  const controlCenter = read("features/control-center/ControlCenterDashboard.tsx");

  assert.match(dashboard, /ControlCenterDashboard/);
  assert.match(controlCenter, /Minerva Control Center/);
  assert.match(controlCenter, /productModules/);
  assert.doesNotMatch(dashboard, /ENTRY Operations/);
});

test("ENTRY operations remain available inside the ENTRY product module", () => {
  const entryPage = read("app/(console)/products/entry/page.tsx");

  assert.match(entryPage, /ENTRY Operations/);
  assert.match(entryPage, /listCommunitiesWithProgress/);
  assert.match(entryPage, /OperationalActivityFeed/);
  assert.doesNotMatch(entryPage, /redirect\("\/dashboard"\)/);
});

test("product registry represents current, future, and locked module states", () => {
  const registry = read("features/control-center/productRegistry.ts");

  assert.match(registry, /id: "entry"/);
  assert.match(registry, /status: "operational"/);
  assert.match(registry, /href: "\/products\/entry"/);
  assert.match(registry, /id: "seshat"/);
  assert.match(registry, /status: "development"/);
  assert.match(registry, /availability: "coming_later"/);
  assert.match(registry, /status: "locked"/);
  assert.match(registry, /availability: "restricted"/);
});

test("Add Product is a manual guided setup, not automatic provisioning", () => {
  const addProduct = read("features/control-center/AddProductFlow.tsx");
  const actions = read("features/control-center/actions.ts");

  assert.match(addProduct, /Manual V1 setup/);
  assert.match(addProduct, /Copy AI Instructions/);
  assert.match(addProduct, /Download Integration Kit/);
  assert.match(actions, /method: "GET"/);
  assert.match(actions, /isBlockedHost/);
  assert.doesNotMatch(actions, /method: "POST"|\.insert\(|\.upsert\(|\.update\(/);
  assert.doesNotMatch(actions, /features\/brain/);
});
