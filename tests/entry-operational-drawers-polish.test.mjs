import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("ENTRY approved button styling is centralized for operational workspaces", () => {
  const source = read("components/ui/entryButtonStyles.ts");

  assert.match(source, /bg-\[#7553FF\]/);
  assert.match(source, /shadow-\[0_2px_0_#120539\]/);
  assert.match(source, /bg-\[#2E2936\]/);
  assert.match(source, /shadow-\[0_2px_0_#141119\]/);
  assert.match(source, /rounded-\[7px\]/);
});

test("Users & Access drawer uses standard buttons for account actions", () => {
  const source = read("features/entry/users/CommunityUsersClient.tsx");

  assert.match(source, /Account actions/);
  assert.match(source, /entryButtonClass\("secondary", "w-full justify-between px-3\.5"\)/);
  assert.match(source, /entryButtonClass\(\s*selectedUser\.isActive \? "danger" : "secondary"/);
  assert.match(source, /Edit account/);
  assert.match(source, /Change role/);
  assert.match(source, /Reset password/);
  assert.match(source, /Deactivate account/);
});

test("registration household drawer uses approved primary and secondary buttons", () => {
  const source = read(
    "features/entry/communityRegistration/review/ReviewWorkspace.tsx",
  );

  assert.match(source, /entryButtonClass\("secondary", "gap-2"\)/);
  assert.match(source, /entryButtonClass\("secondary"\)/);
  assert.match(source, /entryButtonClass\("primary", "gap-2"\)/);
  assert.match(source, /Ready for Patronato/);
  assert.match(source, /Request correction/);
});

test("manual destinations can be reordered by drag and drop and persist their order", () => {
  const manager = read(
    "features/entry/communities/CommunityDestinationsManager.tsx",
  );
  const actions = read("features/entry/communities/actions.ts");

  assert.match(manager, /GripVertical/);
  assert.match(manager, /draggable/);
  assert.match(manager, /onDragStart/);
  assert.match(manager, /onDragOver/);
  assert.match(manager, /onDrop/);
  assert.match(manager, /reorderCommunityDestinationsAction/);
  assert.match(manager, /Saving destination order/);

  assert.match(actions, /export async function reorderCommunityDestinationsAction/);
  assert.match(actions, /orderedDestinationIds/);
  assert.match(actions, /sort_order: \(index \+ 1\) \* 10/);
});

test("facilities workspace uses approved buttons and a more compact toolbar", () => {
  const source = read(
    "features/entry/communities/CommunityFacilitiesDrawer.tsx",
  );

  assert.match(source, /entryButtonClass\("primary", "sm:w-\[150px\]"\)/);
  assert.match(source, /Search facilities/);
  assert.match(source, /Search facility name or price/);
  assert.match(source, /filter === item\.value \? "primary" : "secondary"/);
  assert.match(source, /entryButtonClass\(\s*"secondary",\s*"w-full justify-center text-\[#8F879D\]"/);
  assert.match(source, /Read-only/);
});
