import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Seshat uses a dedicated public Supabase browser configuration", () => {
  const source = read("features/seshat/supabase.ts");

  assert.match(source, /NEXT_PUBLIC_SESHAT_SUPABASE_URL/);
  assert.match(source, /NEXT_PUBLIC_SESHAT_SUPABASE_ANON_KEY/);
  assert.match(source, /storageKey:\s*"minerva-console-seshat-auth"/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE|service_role/i);
  assert.doesNotMatch(source, /@\/lib\/supabase\/client|@\/lib\/supabase\/server/);
});

test("Seshat financial writes go through the existing database RPCs", () => {
  const source = read("features/seshat/financialEngine.ts");

  assert.match(source, /\.rpc\("generate_invoice"/);
  assert.match(source, /\.rpc\("record_payment"/);
  assert.match(source, /\.rpc\("get_due_client_service_occurrences"/);
  assert.match(source, /\.rpc\("run_client_service_billing"/);
  assert.doesNotMatch(source, /\.from\("invoice_items"\)\.insert/);
  assert.doesNotMatch(source, /\.from\("payments"\)\.insert/);
});

test("a recorded payment remains successful when proof attachment fails", () => {
  const source = read("features/seshat/SeshatWorkspace.tsx");
  const paymentStart = source.indexOf("async function submitPayment");
  const paymentEnd = source.indexOf("async function saveProfile", paymentStart);
  const paymentSource = source.slice(paymentStart, paymentEnd);

  assert.match(paymentSource, /result = await recordPayment/);
  assert.match(paymentSource, /catch \(paymentError\)[\s\S]*Could not record payment\.[\s\S]*return;/);
  assert.match(paymentSource, /if \(proof instanceof File[\s\S]*try \{[\s\S]*\.upload\([\s\S]*proof_path:[\s\S]*catch \{/);
  assert.match(paymentSource, /The payment was recorded, but proof attachment failed\./);
  assert.match(paymentSource, /setNotice\("Payment recorded\."\)/);
});

test("Seshat monetary and quantity inputs accept positive decimals", () => {
  const source = read("features/seshat/SeshatWorkspace.tsx");

  for (const name of ["price", "quantity", "default_price", "default_quantity", "amount"]) {
    assert.match(
      source,
      new RegExp(`name="${name}"[^>]*type="number"[^>]*min=[^>]*step="0\\.01"`),
      `${name} should declare decimal number constraints`,
    );
  }
  const amountFields = [...source.matchAll(/<Field label="Amount" name="amount"[^>]*>/g)];
  assert.equal(amountFields.length, 2, "expense and payment amount fields should both be constrained");
  for (const [field] of amountFields) {
    assert.match(field, /min=\{?"?0(?:\.01)?"?\}?/);
    assert.match(field, /step="0\.01"/);
  }
  assert.match(source, /item\.quantity[^>]*type="number" min="0\.01" step="0\.01"/);
  assert.match(source, /item\.unit_price[^>]*type="number" min="0" step="0\.01"/);
});

test("automatic billing preview counts backend client, currency and occurrence batches", async () => {
  const { expectedAutomaticInvoiceCount } = await import("../features/seshat/billingPreview.ts");
  const due = [
    { client_service_id: "service-a", client_id: "client-a", occurrence_date: "2026-09-01" },
    { client_service_id: "service-b", client_id: "client-a", occurrence_date: "2026-09-01" },
    { client_service_id: "service-c", client_id: "client-a", occurrence_date: "2026-09-01" },
    { client_service_id: "service-a", client_id: "client-a", occurrence_date: "2026-10-01" },
    { client_service_id: "service-d", client_id: "client-b", occurrence_date: "2026-09-01" },
  ];
  const currencies = new Map([
    ["service-a", "HNL"],
    ["service-b", " hnl "],
    ["service-c", "USD"],
    ["service-d", null],
  ]);

  assert.equal(expectedAutomaticInvoiceCount(due, currencies, "HNL"), 4);
});

test("primary Seshat web routes exist", () => {
  for (const route of [
    "app/(console)/seshat/page.tsx",
    "app/(console)/seshat/clients/page.tsx",
    "app/(console)/seshat/clients/new/page.tsx",
    "app/(console)/seshat/services/page.tsx",
    "app/(console)/seshat/expenses/page.tsx",
    "app/(console)/seshat/invoices/page.tsx",
    "app/(console)/seshat/invoices/new/page.tsx",
    "app/(console)/seshat/billing/page.tsx",
    "app/(console)/seshat/settings/page.tsx",
  ]) {
    assert.equal(existsSync(join(root, route)), true, `${route} should exist`);
  }
});

test("Control Center opens Seshat at the native route", () => {
  const source = read("features/control-center/productRegistry.ts");

  assert.match(source, /id:\s*"seshat"/);
  assert.match(source, /href:\s*"\/seshat"/);
  assert.match(source, /adminUrl:\s*"\/seshat"/);
  assert.doesNotMatch(source, /Route", value: "Reserved"/);
});
