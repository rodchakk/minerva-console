import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

test("invitation email can optionally return the exact same PIN used to build the email, and never a regenerated PIN", () => {
  const send = read("features/entry/activation/emailActions.ts");
  const consoleAction = read("features/entry/activation/consoleResidentAccessActions.ts");
  const fieldAction = read("features/entry/field/quickResidentInviteActions.ts");
  assert.match(send, /includePinForSharing\?: boolean/);
  assert.match(send, /input\.includePinForSharing === true && queueIds\.length === 1/);
  assert.match(send, /sharePinForQueue === item\.queue_id \? item\.pin : undefined/);
  assert.match(send, /buildActivationInviteEmail\(\{[\s\S]*pin: item\.pin/);
  assert.match(send, /pinForSharing: sharePin/);
  assert.match(send, /status: "sent",\s*pinForSharing: sharePin/);
  assert.doesNotMatch(send, /console\.log\([^)]*pinForSharing/);

  assert.match(consoleAction, /includePinForSharing: true/);
  assert.match(consoleAction, /emailedPin = item\?\.pinForSharing/);
  assert.match(consoleAction, /pin: emailedPin/);
  assert.doesNotMatch(consoleAction.slice(consoleAction.indexOf('if (input.mode === "email") {')), /generateActivationPins\(\{/);

  assert.match(fieldAction, /if \(data\.created\) \{/);
  assert.match(fieldAction, /includePinForSharing: true/);
  assert.match(fieldAction, /pin = item\?\.pinForSharing/);
  assert.doesNotMatch(fieldAction, /generateActivationPins\(\{/);
});

test("both Console and Field display and copy original emailed PIN, not generate a new one", () => {
  const consoleUI = read("features/entry/communities/ResidentQuickCreate.tsx");
  const fieldUI = read("features/entry/field/FieldQuickResidentForm.tsx");
  const fieldServer = read("features/entry/field/quickResidentInviteActions.ts");

  assert.match(consoleUI, /result\.kind === "prepared" && result\.value\.pin/);
  assert.match(consoleUI, /Same PIN used in the email invitation/);
  assert.match(consoleUI, /Copy for WhatsApp/);
  assert.match(consoleUI, /buildActivationWhatsAppMessage/);

  assert.match(fieldUI, /inviteResult\.pin/);
  assert.match(fieldUI, /Same activation PIN used for the email/);
  assert.match(fieldUI, /Copy for WhatsApp/);
  assert.match(fieldUI, /navigator\.share\(/);
  assert.match(fieldUI, /buildActivationWhatsAppMessage/);
  assert.match(fieldServer, /pin\?: string/);

  const routes = read("features/entry/communities/CommunityDirectoryWorkspace.tsx");
  const unit = read("features/entry/communities/CommunityUnitDetailWorkspace.tsx");
  assert.match(routes, /ResidentQuickCreate/);
  assert.match(unit, /ResidentQuickCreate/);
});

test("WhatsApp message uses the given PIN verbatim and contains no PIN-bearing URLs", () => {
  const src = read("features/entry/activation/activationWhatsAppMessage.ts");
  const compiled = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const testModule = { exports: {} };
  vm.runInNewContext(compiled, { module: testModule, exports: testModule.exports });
  const text = testModule.exports.buildActivationWhatsAppMessage({
    communityName: "Andalucía",
    residentName: "Residente Ejemplo",
    unitLabel: "Casa 12",
    pin: "001234",
  });
  assert.match(text, /Andalucía/);
  assert.match(text, /Residente Ejemplo/);
  assert.match(text, /Casa 12/);
  assert.match(text, /001234/);
  assert.match(text, /7 días/);
  assert.doesNotMatch(text, /https?:|wa\.me|\?pin=/);
});

test("bulk email action callers cannot reveal PINs without explicit single creation opt-in", () => {
  const send = read("features/entry/activation/emailActions.ts");
  const queue = read("features/entry/activation/ActivationQueueTable.tsx");
  assert.match(send, /includePinForSharing === true && queueIds\.length === 1/);
  assert.match(queue, /sendActivationEmails\(/);
  assert.doesNotMatch(queue, /includePinForSharing: true/);
});

test("quick account creation remains password-based and is not mislabeled as PIN activation", () => {
  const ui = read("features/entry/communities/ResidentQuickCreate.tsx");
  assert.match(ui, /result\.kind === "quick" && result\.value\.credentials/);
  assert.match(ui, /Copy details/);
});
