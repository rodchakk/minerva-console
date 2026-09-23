import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Console resident creation exposes one shared access-method vocabulary", () => {
  const picker = read("features/entry/activation/ResidentAccessModePicker.tsx");

  assert.match(picker, /ResidentAccessMode = "email" \| "pin" \| "quick"/);
  assert.match(picker, /Quick create active user/);
  assert.match(picker, /Send activation invite/);
  assert.match(picker, /Email invitation/);
  assert.match(picker, /Activation PIN/);
  assert.match(picker, /Recommended/);
});

test("Console resident add flow reuses canonical invitation and PIN activation services", () => {
  const action = read(
    "features/entry/activation/consoleResidentAccessActions.ts",
  );

  assert.match(action, /prepare_resident_activation_invite_v1/);
  assert.match(action, /sendActivationEmails/);
  assert.match(action, /confirm_resident_bulk_import_v1/);
  assert.match(action, /generateActivationPins/);
  assert.match(action, /requested_mode: "pin"/);
  assert.doesNotMatch(action, /createAdminClient/);
  assert.doesNotMatch(action, /auth\.admin\.createUser/);
});

test("unit resident creation asks how access should be delivered before creating anything", () => {
  const source = read("features/entry/communities/ResidentQuickCreate.tsx");

  assert.match(source, /ResidentAccessModePicker/);
  assert.match(source, /How should this resident get access\?/);
  assert.match(source, /prepareConsoleResidentAccess/);
  assert.match(source, /accessMode === "email"/);
  assert.match(source, /accessMode === "pin"/);
  assert.match(source, /accessMode === "quick"/);
  assert.match(source, /createQuickResidentAction/);
});

test("community Create user uses the same resident access picker while preserving non-resident quick creation", () => {
  const source = read("features/entry/users/CommunityUsersClient.tsx");

  assert.match(source, /ResidentAccessModePicker/);
  assert.match(
    source,
    /residentUsesActivationFlow[\s\S]*createDraft\.role === "RESIDENT"[\s\S]*createDraft\.accessMode !== "quick"/,
  );
  assert.match(source, /prepareConsoleResidentAccess/);
  assert.match(source, /createCommunityUserAction/);
  assert.match(
    source,
    /createDraft\.role === "RESIDENT" \? current\.accessMode : "quick"/,
  );
  assert.match(
    source,
    /Email invitation is currently available for resident onboarding only/,
  );
  assert.match(
    source,
    /Activation PIN is currently available for resident onboarding only/,
  );
});

test("Activation Queue Create user never targets all visible rows implicitly and opens the shared chooser", () => {
  const source = read("features/entry/activation/ActivationQueueTable.tsx");

  assert.match(source, /ResidentAccessModePicker/);
  assert.match(source, /"choosingAccess"/);
  assert.match(source, /const createUserTargetIds = selectedIds;/);
  assert.match(source, /const canCreateUsers = selectedCount > 0/);
  assert.match(source, /function continueAccessChoice/);
  assert.doesNotMatch(
    source,
    /selectedCount > 0 \? selectedIds : visibleRowIds/,
  );
  assert.doesNotMatch(
    source,
    /No rows are selected, so this will use all visible residents/,
  );
});

test("the unified Console flow does not import or depend on Minerva Field implementation", () => {
  const sources = [
    read("features/entry/activation/ResidentAccessModePicker.tsx"),
    read("features/entry/activation/consoleResidentAccessActions.ts"),
    read("features/entry/communities/ResidentQuickCreate.tsx"),
    read("features/entry/users/CommunityUsersClient.tsx"),
    read("features/entry/activation/ActivationQueueTable.tsx"),
  ].join("\n");

  assert.doesNotMatch(sources, /@\/features\/entry\/field\//);
  assert.doesNotMatch(sources, /\/field\/entry\/communities/);
});
