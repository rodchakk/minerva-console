import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("all three drawers reuse the same stable tab primitives and original dimensions", () => {
  const common = read("features/entry/components/EntryDrawerTabs.tsx");
  const queue = read("features/entry/activation/ActivationResidentDrawer.tsx");
  const directory = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");
  const users = read("features/entry/users/UserSearch.tsx");

  for (const file of [queue, directory, users]) {
    assert.match(file, /EntryDrawerTabs/);
    assert.match(file, /min-h-0.*overflow-y-auto/);
  }
  assert.match(common, /min-h-12/);
  assert.match(queue, /w-\[440px\]/);
  assert.match(queue, /w-\[560px\]/);
  assert.match(directory, /w-\[440px\]/);
  assert.match(users, /w-\[560px\]/);
  assert.match(queue, /grid-rows-\[auto_auto_minmax\(0,1fr\)_auto\]/);
  assert.match(directory, /grid-rows-\[auto_auto_minmax\(0,1fr\)_auto\]/);
  assert.match(users, /shrink-0 border-t/);
});

test("pending resident drawer is identical in Users and Activation Queue", () => {
  const search = read("features/entry/users/UserSearch.tsx");
  const queue = read("features/entry/activation/ActivationQueueTable.tsx");
  const drawer = read("features/entry/activation/ActivationResidentDrawer.tsx");
  const lookup = read("features/entry/activation/lookupActions.ts");
  assert.match(search, /getActivationResidentForUsersAction/);
  assert.match(search, /ActivationResidentDrawer/);
  assert.match(search, /variant="users"/);
  assert.match(queue, /ActivationResidentDrawer/);
  assert.match(drawer, /Resident details/);
  assert.match(drawer, /Invitation history/);
  assert.match(drawer, /EditActivationEmailModal/);
  assert.match(drawer, /EditActivationPhoneModal/);
  assert.match(lookup, /getActivationQueuePageData/);
});

test("all existing activation outcomes live in one dialog with safe PIN handling", () => {
  const drawer = read("features/entry/activation/ActivationResidentDrawer.tsx");
  const dialog = read("features/entry/activation/ManageResidentActivationDialog.tsx");
  assert.match(drawer, /Manage activation/);
  assert.doesNotMatch(drawer, /Create user/);
  assert.match(dialog, /createActivatedUsers/);
  assert.match(dialog, /mode === "quick"/);
  assert.match(dialog, /sendActivationEmails/);
  assert.match(dialog, /includePinForSharing: true/);
  assert.match(dialog, /item\?\.pinForSharing/);
  assert.match(dialog, /generateActivationPins/);
  assert.match(dialog, /Copy credentials/);
  assert.match(dialog, /buildActivationWhatsAppMessage/);
});

test("unit drawer separates overview household and operational without moving its footer", () => {
  const directory = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");
  assert.match(directory, /id: "overview", label: "Unit overview"/);
  assert.match(directory, /id: "household", label: "Household"/);
  assert.match(directory, /id: "operational", label: "Operational"/);
  assert.match(directory, /directoryTab === "overview"/);
  assert.match(directory, /directoryTab === "household"/);
  assert.match(directory, /directoryTab === "operational"/);
  assert.match(directory, /selectedUnit\.residents\.map/);
  assert.match(directory, /UnitResidentActions/);
  assert.match(directory, /selectedUnit\.pendingActivations > 0 \? \(/);
  assert.match(directory, /disabled/);
  assert.match(directory, /ResidentQuickCreate/);
});

test("active Users retains account management actions and loads real same-unit household", () => {
  const users = read("features/entry/users/UserSearch.tsx");
  const lookup = read("features/entry/users/householdActions.ts");
  assert.match(users, /id: "account", label: "Account"/);
  assert.match(users, /id: "household", label: "Household"/);
  assert.match(users, /id: "operational", label: "Operational"/);
  assert.match(users, /getGlobalHouseholdMembersAction/);
  assert.match(users, /householdMembers\.map/);
  assert.match(users, /Edit account/);
  assert.match(users, /Change role/);
  assert.match(users, /Change unit/);
  assert.match(users, /Reset password/);
  assert.match(users, /Deactivate account/);
  assert.match(users, /Open unit/);
  assert.match(users, /Open community/);
  assert.match(users, /Last sign-in/);
  assert.match(users, /Account created/);
  assert.match(lookup, /requireSuperadmin\(\)/);
  assert.match(lookup, /sa_list_community_users/);
  assert.match(lookup, /\.eq\("house_id", houseId\)/);
});
