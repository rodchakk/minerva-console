import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const diagnostic = read("features/entry/push/EntryPushLocalDiagnostic.tsx");
const fieldTickets = read("app/(field)/field/entry/tickets/page.tsx");
const badgePath = path.join(root, "public/icons/minerva-field-notification-badge.png");

test("Field exposes a local notification diagnostic that bypasses the push provider", () => {
  assert.match(fieldTickets, /EntryPushLocalDiagnostic/);
  assert.match(diagnostic, /navigator\.serviceWorker\.getRegistration\("\/"\)/);
  assert.match(diagnostic, /Notification\.permission !== "granted"/);
  assert.match(diagnostic, /registration\.showNotification\("Minerva Field test"/);
  assert.match(diagnostic, /icon: FIELD_NOTIFICATION_ICON/);
  assert.match(diagnostic, /badge: FIELD_NOTIFICATION_BADGE/);
  assert.ok(fs.existsSync(badgePath));
  assert.ok(fs.statSync(badgePath).size > 0);
  assert.doesNotMatch(diagnostic, /fetch\("\/api\/entry\/push/);
});
