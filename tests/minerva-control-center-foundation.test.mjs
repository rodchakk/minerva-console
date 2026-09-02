import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { isItemActive } from "../components/layout/sidebarRouteState.ts";

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
  const dashboardMetrics = between(controlCenter, "const dashboardProducts", "const eventCount");
  const productsSection = between(controlCenter, 'title="Products"', "<RecentActivityPanel");

  assert.match(dashboard, /ControlCenterDashboard/);
  assert.match(controlCenter, /Minerva Control Center/);
  assert.match(controlCenter, /productModules/);
  assert.match(controlCenter, /Add User/);
  assert.match(controlCenter, /disabled/);
  assert.doesNotMatch(controlCenter, /addUserAction|createUser|insert\(|upsert\(/);
  assert.doesNotMatch(controlCenter, /getBrainCounts/);
  assert.doesNotMatch(controlCenter, /Brain Overview/);
  assert.doesNotMatch(dashboard, /ENTRY Operations/);
  assert.match(dashboardMetrics, /product\.id === "entry"/);
  assert.match(dashboardMetrics, /activeProducts = dashboardProducts\.filter/);
  assert.match(dashboardMetrics, /operationalProducts = dashboardProducts\.filter/);
  assert.match(dashboardMetrics, /needsAttention = dashboardProducts\.filter/);
  assert.doesNotMatch(dashboardMetrics, /status === "development"/);
  assert.match(dashboardMetrics, /status === "disconnected"/);
  assert.match(dashboardMetrics, /status === "error"/);
  assert.match(productsSection, /dashboardProducts\.map/);
  assert.match(productsSection, /<AddProductCard \/>/);
  assert.doesNotMatch(productsSection, /Seshat|seshat/);
  assert.match(controlCenter, /border-t-violet-400\/80/);
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
  const controlItems = between(sidebar, "const controlNavItems", "const financeNavItems");
  const financeItems = between(sidebar, "const financeNavItems", "const entryNavItems");
  const entryItems = between(sidebar, "const entryNavItems", "const systemNavGroup");
  const systemGroup = between(sidebar, "const systemNavGroup", "const minervaNavGroups");

  assert.match(sidebar, /isEntryContext\(pathname\) \? entryNavGroups : minervaNavGroups/);
  assert.match(sidebar, /<Link\s+href="\/dashboard"\s+onClick=\{onClose\}/);
  assert.match(sidebar, /Minerva Console/);
  assert.match(sidebar, /label: "CONTROL"/);
  assert.match(sidebar, /label: "FINANCE"/);
  assert.match(sidebar, /label: "SYSTEM"/);
  assert.match(controlItems, /Control Center/);
  assert.match(controlItems, /Reminders/);
  assert.match(controlItems, /Logs/);
  assert.match(financeItems, /Seshat/);
  assert.match(systemGroup, /SYSTEM/);
  assert.match(systemGroup, /Settings/);
  assert.doesNotMatch(controlItems, /Products|ENTRY|Brain|Seshat/);
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

test("ENTRY sidebar active state selects only the most specific section", () => {
  const entryHref = "/products/entry";
  const communitiesHref = "/products/entry/communities";
  const usersHref = "/products/entry/users";
  const messagesHref = "/products/entry/messages";
  const ticketsHref = "/products/entry/tickets";
  const settingsHref = "/products/entry/settings";

  assert.equal(isItemActive("/products/entry", entryHref), true);
  assert.equal(isItemActive("/products/entry", communitiesHref), false);
  assert.equal(isItemActive("/products/entry/tickets", entryHref), false);
  assert.equal(isItemActive("/products/entry/tickets", ticketsHref), true);
  assert.equal(isItemActive("/products/entry/users", entryHref), false);
  assert.equal(isItemActive("/products/entry/users", usersHref), true);
  assert.equal(isItemActive("/products/entry/users", messagesHref), false);
  assert.equal(isItemActive("/products/entry/users", ticketsHref), false);
  assert.equal(isItemActive("/products/entry/users", settingsHref), false);
  assert.equal(isItemActive("/products/entry/communities/abc", entryHref), false);
  assert.equal(isItemActive("/products/entry/communities/abc", communitiesHref), true);
});

test("Seshat, Logs, and Reminders routes are honest Minerva placeholders", () => {
  const seshatPage = read("app/(console)/seshat/page.tsx");
  const logsPage = read("app/(console)/logs/page.tsx");
  const remindersPage = read("app/(console)/reminders/page.tsx");
  const topbar = read("components/layout/Topbar.tsx");

  assert.match(seshatPage, /Seshat/);
  assert.match(seshatPage, /Coming soon/);
  assert.match(seshatPage, /finance workspace inside Minerva Console/);
  assert.match(seshatPage, /Cost tracking/);
  assert.doesNotMatch(seshatPage, /createClient|insert\(|upsert\(|cron|scheduleAction/i);
  assert.match(logsPage, /Logs/);
  assert.match(logsPage, /Operational logs and system history will live here/);
  assert.match(logsPage, /No logs available yet/);
  assert.doesNotMatch(logsPage, /createClient|insert\(|upsert\(|monitor|cron|scheduleAction/i);
  assert.match(remindersPage, /Reminders/);
  assert.match(remindersPage, /Console reminders and operational follow-ups will live here/);
  assert.match(remindersPage, /No reminders yet/);
  assert.doesNotMatch(remindersPage, /createClient|insert\(|upsert\(|cron|scheduleAction/i);
  assert.match(topbar, /pathname === "\/seshat"/);
  assert.match(topbar, /pathname === "\/reminders"/);
  assert.match(topbar, /pathname === "\/logs"/);
  assert.match(topbar, /\["Minerva Console", "ENTRY", "Operations"\]/);
});
