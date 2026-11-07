import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(path, "utf8");
}

test("global Users searches real accounts and pending queue residents independently", () => {
  const source = read("features/entry/users/actions.ts");
  assert.match(source, /supabase\.rpc\("sa_list_users"/);
  assert.match(source, /adminSupabase\.from\("resident_activation_queue"\)/);
  assert.match(source, /\.in\("status", queueStatuses\)/);
  assert.match(source, /activated_user_id/);
  assert.match(source, /accountPeople/);
  assert.match(source, /results: \[\.\.\.results, \.\.\.queueResults\]/);
  assert.match(source, /requireSuperadmin\(\)/);
  assert.doesNotMatch(source, /select\(["'].*visible_code/);
});

test("pending Users results are distinguishable and expose the shared activation manager", () => {
  const source = read("features/entry/users/UserSearch.tsx");
  assert.match(source, /Pending activation/);
  assert.match(source, /user\.source === "activation_queue"/);
  assert.match(source, /selectedUser\?\.source === "activation_queue"/);
  assert.match(source, /ActivationResidentDrawer/);
  assert.match(source, /pendingResidentRow/);
  assert.match(source, /user\.source === "account" && !user\.isActive/);
});

test("queue and global Users use the exact same activation dialog", () => {
  const queue = read("features/entry/activation/ActivationQueueTable.tsx");
  const users = read("features/entry/users/UserSearch.tsx");
  const dialog = read("features/entry/activation/ManageResidentActivationDialog.tsx");
  const picker = read("features/entry/activation/ResidentAccessModePicker.tsx");
  assert.match(queue, /ActivationResidentDrawer/);
  assert.match(users, /ActivationResidentDrawer/);
  assert.match(read("features/entry/activation/ActivationResidentDrawer.tsx"), /ManageResidentActivationDialog/);
  assert.match(dialog, /ResidentAccessModePicker/);
  assert.match(dialog, /createActivatedUsers/);
  assert.doesNotMatch(dialog, /hideQuick\s*\/\>/);
  assert.match(picker, /hideQuick\?: boolean/);
});

test("email PIN is never regenerated after delivery and WhatsApp includes the ENTRY landing", () => {
  const dialog = read("features/entry/activation/ManageResidentActivationDialog.tsx");
  const message = read("features/entry/activation/activationWhatsAppMessage.ts");
  assert.match(dialog, /sendActivationEmails\(/);
  assert.match(dialog, /includePinForSharing: true/);
  assert.match(dialog, /item\?\.pinForSharing/);
  assert.match(dialog, /generateActivationPins\(/);
  assert.match(dialog, /buildActivationWhatsAppMessage/);
  assert.match(dialog, /navigator\.clipboard\.writeText\(credentials\)/);
  assert.match(message, /https:\/\/www\.minervatechs\.com\/entry/);
});
