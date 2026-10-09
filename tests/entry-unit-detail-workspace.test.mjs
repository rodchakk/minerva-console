import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("Unit Details uses the approved operational workspace shell", () => {
  const page = read("app/(console)/products/entry/communities/[communityId]/units/[unitId]/page.tsx");
  const workspace = read("features/entry/communities/CommunityUnitDetailWorkspace.tsx");

  assert.match(page, /CommunityUnitDetailWorkspace/);
  assert.match(workspace, /ENTRY · UNIT DETAILS/);
  assert.match(workspace, />\s*Unit Details\s*</);
  assert.match(workspace, /Back to directory/);
  assert.match(workspace, /Add resident/);
  assert.match(workspace, /More/);
  assert.match(workspace, /CommunityUnitQuickActions/);
});

test("Unit Details keeps data work inside a fixed-height table-first workspace", () => {
  const source = read("features/entry/communities/CommunityUnitDetailWorkspace.tsx");

  assert.match(source, /desktopWorkspaceHeight/);
  assert.match(source, /window\.innerHeight - top - 16/);
  assert.match(source, /lg:overflow-hidden/);
  assert.match(source, /overflow-auto overscroll-contain/);
  assert.match(source, /sticky top-0/);
  assert.match(source, /Residents/);
  assert.match(source, /Access/);
  assert.match(source, /Passes/);
});

test("Unit Details opens resident and pending activation drawers", () => {
  const source = read("features/entry/communities/CommunityUnitDetailWorkspace.tsx");

  assert.match(source, /selectedResident/);
  assert.match(source, /selectedPending/);
  assert.match(source, /fixed bottom-5 right-5 top-\[76px\]/);
  assert.match(source, /w-\[440px\]/);
  assert.match(source, /Resident account/);
  assert.match(source, /Primary resident/);
  assert.match(source, /Manage resident/);
  assert.match(source, /Open Activation Queue/);
});

test("Unit Details preserves resident, unit, activation and pass functionality", () => {
  const source = read("features/entry/communities/CommunityUnitDetailWorkspace.tsx");

  assert.match(source, /ResidentQuickCreate/);
  assert.match(source, /UnitResidentActions/);
  assert.match(source, /CommunityUnitQuickActions/);
  assert.match(source, /Activation queue/);
  assert.match(source, /activePassItems/);
  assert.match(source, /lastSignInByUserId/);
});

test("Unit Details filters close with Escape and outside click", () => {
  const source = read("features/entry/communities/CommunityUnitDetailWorkspace.tsx");

  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /setFilterOpen\(false\)/);
  assert.match(source, /setMoreOpen\(false\)/);
  assert.match(source, /document\.addEventListener\("mousedown", onPointerDown\)/);
});

test("Unit action and resident action components support compact workspace triggers", () => {
  const unitActions = read("features/entry/communities/CommunityUnitQuickActions.tsx");
  const residentActions = read("features/entry/communities/UnitResidentActions.tsx");

  assert.match(unitActions, /displayMode\?: "default" \| "menu"/);
  assert.match(unitActions, /displayMode === "menu"/);
  assert.match(residentActions, /triggerClassName\?: string/);
  assert.match(residentActions, /triggerLabel\?: string/);
});
