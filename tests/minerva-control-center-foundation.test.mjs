import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);

  assert.ok(startIndex >= 0, `${start} must exist`);
  assert.ok(endIndex > startIndex, `${end} must exist after ${start}`);

  return source.slice(startIndex, endIndex);
}

test("dashboard is the Minerva Control Center landing surface", () => {
  const dashboard = read("app/(console)/dashboard/page.tsx");
  const controlCenter = read("features/control-center/ControlCenterDashboard.tsx");

  assert.match(dashboard, /ControlCenterDashboard/);
  assert.match(controlCenter, /Minerva Control Center/);
  assert.match(controlCenter, /productModules/);
  assert.match(controlCenter, /Add User/);
  assert.match(controlCenter, /disabled/);
  assert.doesNotMatch(controlCenter, /addUserAction|createUser|insert\(|upsert\(/);
  assert.doesNotMatch(controlCenter, /getBrainCounts/);
  assert.doesNotMatch(controlCenter, /Brain Overview/);
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
  const productsPage = read("app/(console)/products/page.tsx");
  const sidebar = read("components/layout/AppSidebar.tsx");

  assert.match(registry, /id: "entry"/);
  assert.match(registry, /status: "operational"/);
  assert.match(registry, /href: "\/products\/entry"/);
  assert.match(registry, /id: "seshat"/);
  assert.match(registry, /status: "development"/);
  assert.match(registry, /availability: "coming_later"/);
  assert.match(registry, /restrictedProductStateExample/);
  assert.match(registry, /status: "locked"/);
  assert.match(registry, /availability: "restricted"/);
  assert.doesNotMatch(productsPage, /Restricted Module|restrictedProductStateExample/);
  assert.doesNotMatch(sidebar, /Restricted Module/);
});

test("Add Product is a manual guided setup, not automatic provisioning", () => {
  const addProduct = read("features/control-center/AddProductFlow.tsx");
  const actions = read("features/control-center/actions.ts");

  assert.match(addProduct, /Manual V1 setup/);
  assert.match(addProduct, /Copy AI Instructions/);
  assert.match(addProduct, /Download Connector Instructions/);
  assert.match(actions, /validateConfiguredHttpUrl/);
  assert.doesNotMatch(actions, /fetch\s*\(/);
  assert.doesNotMatch(actions, /method: "POST"|\.insert\(|\.upsert\(|\.update\(/);
  assert.doesNotMatch(actions, /features\/brain/);
});

test("global sidebar keeps ENTRY navigation on the ENTRY accent boundary", () => {
  const sidebar = read("components/layout/AppSidebar.tsx");
  const minervaItems = between(sidebar, "const minervaNavItems", "const entryNavItems");
  const entryItems = between(sidebar, "const entryNavItems", "const systemNavGroup");
  const systemGroup = between(sidebar, "const systemNavGroup", "const minervaNavGroups");

  assert.match(sidebar, /isEntryContext\(pathname\) \? entryNavGroups : minervaNavGroups/);
  assert.match(minervaItems, /Control Center/);
  assert.match(minervaItems, /Seshat/);
  assert.match(minervaItems, /Reminders/);
  assert.match(systemGroup, /SYSTEM/);
  assert.doesNotMatch(minervaItems, /Products|ENTRY|Brain/);
  assert.match(entryItems, /Operations/);
  assert.match(entryItems, /Communities/);
  assert.match(entryItems, /Users/);
  assert.match(entryItems, /Messages/);
  assert.match(entryItems, /Tickets/);
  assert.match(entryItems, /Settings/);
  assert.match(sidebar, /groupId === "entry"/);
  assert.match(sidebar, /href\?\.startsWith\("\/products\/entry"\)/);
  assert.match(sidebar, /rail: "bg-\[var\(--console-accent\)\]"/);
  assert.match(sidebar, /rail: "bg-\[#ff4d4d\]"/);
});

test("Seshat and Reminders routes are honest Minerva placeholders", () => {
  const seshatPage = read("app/(console)/seshat/page.tsx");
  const remindersPage = read("app/(console)/reminders/page.tsx");
  const topbar = read("components/layout/Topbar.tsx");

  assert.match(seshatPage, /Seshat/);
  assert.match(seshatPage, /Coming soon/);
  assert.match(seshatPage, /Seshat web workspace will live here/);
  assert.doesNotMatch(seshatPage, /createClient|insert\(|upsert\(|cron|scheduleAction/i);
  assert.match(remindersPage, /Reminders/);
  assert.match(remindersPage, /Console reminders and operational follow-ups will live here/);
  assert.match(remindersPage, /No reminders yet/);
  assert.doesNotMatch(remindersPage, /createClient|insert\(|upsert\(|cron|scheduleAction/i);
  assert.match(topbar, /pathname === "\/seshat"/);
  assert.match(topbar, /pathname === "\/reminders"/);
  assert.match(topbar, /\["Minerva Console", "ENTRY", "Operations"\]/);
});
