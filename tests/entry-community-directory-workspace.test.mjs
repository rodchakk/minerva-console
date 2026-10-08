import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("Community Directory replaces the legacy Units page shell", () => {
  const page = read("app/(console)/products/entry/communities/[communityId]/units/page.tsx");
  const workspace = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");

  assert.match(page, /CommunityDirectoryWorkspace/);
  assert.match(workspace, /Community Directory/);
  assert.match(workspace, /ENTRY DIRECTORY/);
  assert.match(workspace, /Units & households/);
  assert.doesNotMatch(workspace, />Units<\/h1>/);
});

test("Community Directory keeps table-first discovery with a fixed drawer", () => {
  const source = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");

  assert.match(source, /select a row for details/);
  assert.match(source, /fixed bottom-5 right-5 top-\[76px\]/);
  assert.match(source, /w-\[440px\]/);
  assert.match(source, /Unit overview/);
  assert.match(source, /Household/);
  assert.match(source, /Operational context/);
  assert.match(source, /Recommended next action/);
  assert.match(source, /Open unit details/);
  assert.match(source, /Activation queue/);
});

test("Community Directory preserves operational actions and moves secondary actions into More", () => {
  const source = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");

  assert.match(source, /Back to community/);
  assert.match(source, /ResidentQuickCreate/);
  assert.match(source, /MoreHorizontal/);
  assert.match(source, /Activation queue/);
  assert.match(source, /Add unit/);
  assert.match(source, /Manage \/ delete units/);
  assert.match(source, /UnitBulkDeleteManager/);
});

test("Community Directory uses compact filters and Escape dismissal", () => {
  const source = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");

  assert.match(source, /Filter directory/);
  assert.match(source, /Pending activation/);
  assert.match(source, /event\.key !== "Escape"/);
  assert.match(source, /setFilterOpen\(false\)/);
  assert.match(source, /setMoreOpen\(false\)/);
  assert.match(source, /setSelectedId\(null\)/);
});

test("Community Directory uses the approved full-bleed ENTRY visual system", () => {
  const source = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");

  assert.match(source, /-mx-4 -my-4/);
  assert.match(source, /bg-\[#2E2936\]/);
  assert.match(source, /bg-\[#24202B\]/);
  assert.match(source, /bg-\[#1F1B26\]/);
  assert.match(source, /border-\[#141119\]/);
  assert.match(source, /bg-\[#7553FF\]/);
  assert.match(source, /bg-\[#120539\]/);
  assert.match(source, /focus:shadow-\[inset_0_1px_0_#141119,0_0_0_2px_#7553FF\]/);
});

test("Unit manager supports reusable menu trigger without removing delete protections", () => {
  const source = read("features/entry/communities/UnitBulkDeleteManager.tsx");

  assert.match(source, /triggerClassName\?: string/);
  assert.match(source, /triggerLabel\?: string/);
  assert.match(source, /wrapperClassName\?: string/);
  assert.match(source, /deleteCommunityUnitsAction/);
  assert.match(source, /Only empty units can be deleted/);
  assert.match(source, /event\.key === "Escape"/);
});

test("Community Directory marks the titular as Primary resident in the drawer", () => {
  const source = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");

  assert.match(source, /Primary resident/);
  assert.match(source, /resident\.userId === selectedUnit\.primaryResidentId/);
  assert.match(source, /selectedUnit\.primaryResidentName/);
});
