import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Field header exposes Quick QR beside the timer as an operator utility", () => {
  const shell = read("components/field/FieldShell.tsx");
  const entry = read("app/(field)/field/entry/page.tsx");

  assert.match(shell, /href="\/field\/entry\/qr"/);
  assert.match(shell, /<QrCode/);
  assert.match(shell, />QR<\/span>/);
  assert.match(shell, /FieldActiveWorkTimerIndicator/);
  assert.doesNotMatch(entry, /href="\/field\/entry\/qr"/);
});

test("Quick QR uses official ENTRY store links without an external QR service", () => {
  const workspace = read("features/entry/field/FieldQuickQrWorkspace.tsx");

  assert.match(
    workspace,
    /https:\/\/apps\.apple\.com\/us\/app\/entry-acess-control\/id6763486133/,
  );
  assert.match(
    workspace,
    /https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.minervatechnologies\.entry/,
  );
  assert.match(workspace, /QRCodeSVG/);
  assert.doesNotMatch(
    workspace,
    /api\.qrserver|chart\.googleapis|quickchart|qrcode\.monkey/i,
  );
});

test("Registration QR only lists active communities with an open recoverable campaign", () => {
  const data = read("features/entry/field/quickQrData.ts");

  assert.match(data, /requireSuperadmin\(\)/);
  assert.match(data, /\.from\("communities"\)/);
  assert.match(data, /\.eq\("is_active", true\)/);
  assert.match(data, /\.from\("community_registration_campaigns"\)/);
  assert.match(data, /\.eq\("status", "open"\)/);
  assert.match(data, /\.from\("community_registration_access_tokens"\)/);
  assert.match(data, /encrypted_token_payload/);
  assert.match(data, /shareableTokenCountByCampaign\.get\(campaign\.id\) !== 1/);
});

test("Registration QR recovers the current secure link at selection time", () => {
  const workspace = read("features/entry/field/FieldQuickQrWorkspace.tsx");

  assert.match(workspace, /recoverCommunityRegistrationLink/);
  assert.match(workspace, /campaignId: option\.campaignId/);
  assert.match(workspace, /communityId: option\.communityId/);
  assert.match(workspace, /url: result\.data\.registrationUrl/);
  assert.match(workspace, /Field recupera el\s+enlace activo/);
});

test("Quick QR stays inside authenticated Field and does not expose registration tokens in page data", () => {
  const page = read("app/(field)/field/entry/qr/page.tsx");
  const data = read("features/entry/field/quickQrData.ts");

  assert.match(page, /getFieldQuickQrRegistrationOptions/);
  assert.match(data, /campaignId: string/);
  assert.match(data, /communityId: string/);
  assert.doesNotMatch(data, /registrationUrl:/);
  assert.doesNotMatch(data, /plaintextToken/);
});
