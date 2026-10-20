import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";

const root = process.cwd();
const source = readFileSync(join(root, "features/entry/activation/whatsappFollowUp.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

// The pure helper has no runtime imports. Execute its real compiled implementation,
// not a duplicate approximation of the phone or threshold rules.
const {
  WHATSAPP_FOLLOWUP_INVITATION_THRESHOLD,
  normalizeWhatsAppPhone,
  shouldOfferWhatsAppFollowUp,
  buildWhatsAppFollowUpMessage,
  buildWhatsAppFollowUpUrl,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("WhatsApp follow-up starts at five lifetime invites only for unactivated states", () => {
  assert.equal(WHATSAPP_FOLLOWUP_INVITATION_THRESHOLD, 5);
  for (const status of ["pending", "pin_generated", "invited"]) {
    assert.equal(shouldOfferWhatsAppFollowUp({ status, invitationAttemptCount: 4 }), false);
    assert.equal(shouldOfferWhatsAppFollowUp({ status, invitationAttemptCount: 5 }), true);
    assert.equal(shouldOfferWhatsAppFollowUp({ status, invitationAttemptCount: 8 }), true);
  }
  for (const status of ["activated", "skipped", "failed"]) {
    assert.equal(shouldOfferWhatsAppFollowUp({ status, invitationAttemptCount: 9 }), false);
  }
});

test("Honduras mobile numbers accept local, +504, and 00504 with spacing", () => {
  assert.equal(normalizeWhatsAppPhone("9988-7766"), "50499887766");
  assert.equal(normalizeWhatsAppPhone(" 3 123 4567 "), "50431234567");
  assert.equal(normalizeWhatsAppPhone("+504 (9988) 7766"), "50499887766");
  assert.equal(normalizeWhatsAppPhone("00504 9988 7766"), "50499887766");
  assert.equal(normalizeWhatsAppPhone("50499887766"), "50499887766");
  assert.equal(normalizeWhatsAppPhone("+504 2345 6789"), null);
});

test("International numbers require unambiguous country code and safe syntax", () => {
  assert.equal(normalizeWhatsAppPhone("+1 (202) 555-0169"), "12025550169");
  assert.equal(normalizeWhatsAppPhone("0044 7700 900123"), "447700900123");
  for (const input of [
    "", "—", "unknown", "12345", "12345678", "2025550169",
    "2222-3333", "++50499887766", "504+99887766",
    "99887766 ext. 1", "+00012345678", "0000 0000",
    "+1234567890123456",
  ]) {
    assert.equal(normalizeWhatsAppPhone(input), null, input);
  }
});

test("Follow-up is a draft link without credentials or delivery assertions", () => {
  const message = buildWhatsAppFollowUpMessage("Residencial Andalucía");
  const url = buildWhatsAppFollowUpUrl("99887766", "Residencial Andalucía");
  assert.equal(url?.startsWith("https://wa.me/50499887766?text="), true);
  assert.equal(decodeURIComponent(url.split("?text=")[1]), message);
  assert.match(message, /ayudarle a completar la activación/i);
  assert.doesNotMatch(message, /PIN|contraseña|password|token|código|QR|enviado|entregado/i);
  assert.equal(buildWhatsAppFollowUpUrl("invalid", "Andalucía"), null);
});

test("Resident drawer elevates WhatsApp while retaining safe phone correction", () => {
  const table = readFileSync(
    join(root, "features/entry/activation/ActivationQueueTable.tsx"),
    "utf8",
  );
  assert.match(table, /shouldOfferWhatsAppFollowUp\(row\)/);
  assert.match(table, /getResidentRecommendation\(row:/);
  assert.match(table, /action: "whatsapp"/);
  assert.match(table, /action: "edit_phone"/);
  assert.match(table, /buildWhatsAppFollowUpUrl\(activeRow.phone, communityName\)/);
  assert.match(table, /setPhoneEditorRowId\(activeRow.id\)/);
  assert.match(table, /href=\{activeWhatsAppUrl\}/);
  assert.match(table, /target="_blank"/);
  assert.match(table, /noopener noreferrer/);
  assert.match(table, /Opening the draft does not send a message or mark the resident as contacted/);
  assert.doesNotMatch(table, /invitationAttemptCount\s*>=\s*5/);
});
