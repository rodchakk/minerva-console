import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("../features/seshat/SeshatWorkspace.tsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("../features/seshat/financialEngine.ts", import.meta.url), "utf8");

test("client service can inherit catalog text or override customer invoice copy", () => {
  assert.match(ui, /setSelectedServiceId\(serviceId\)/);
  assert.match(ui, /Invoice description override \(optional\)/);
  assert.match(ui, /Uses catalog description/);
  assert.match(ui, /Use catalog default/);
  assert.match(ui, /description: clean\(form\.get\("description"\)\)/);
});

test("a draft invoice description edit is guarded by a dedicated backend RPC", () => {
  assert.match(ui, /invoice\.status === "draft" \? \(/[\s\S]*?Edit draft line descriptions/);
  assert.match(ui, /updateDraftInvoiceItemDescription\(invoice\.id, itemId, description, expectedDescription\)/);
  assert.match(engine, /rpc\("update_draft_invoice_item_description",/);
  assert.match(engine, /p_expected_description: expectedDescription/);
  assert.doesNotMatch(ui, /from\("invoice_items"\)\.update\(/);
});
