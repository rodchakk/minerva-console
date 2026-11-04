import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

test("web invoice lifecycle distinguishes draft, issued, sent, and paid", () => {
  const types = read("features/seshat/types.ts");
  const workspace = read("features/seshat/SeshatWorkspace.tsx");

  assert.match(types, /InvoiceStatus = "draft" \| "issued" \| "sent" \| "paid"/);
  assert.match(workspace, /"draft",\s+"issued",\s+"sent",\s+"paid"/);
  assert.match(workspace, /issued: "Issued"/);
  assert.match(workspace, /invoice\.status === "draft"[\s\S]*Issue Invoice/);
  assert.match(workspace, /invoice\.status === "issued"[\s\S]*Mark as Sent/);
  assert.match(workspace, /invoice\.status === "issued" \|\| invoice\.status === "sent" \|\| invoice\.status === "overdue"/);
});

test("operator workflow uses the owner-scoped status RPC", () => {
  const engine = read("features/seshat/financialEngine.ts");
  const workspace = read("features/seshat/SeshatWorkspace.tsx");

  assert.match(engine, /export async function setInvoiceStatus/);
  assert.match(engine, /\.rpc\("set_invoice_status"/);
  assert.match(workspace, /await setInvoiceStatus\(invoiceId, status\)/);
  assert.doesNotMatch(workspace, /from\("invoices"\)\.update\(\{ status \}\)/);
  assert.match(workspace, /form\.get\("status"\) === "issued" \? "issued" : "draft"/);
  assert.doesNotMatch(workspace, /<option value="sent">Sent<\/option>/);
});

test("English and Spanish customer documents never render internal workflow status", async () => {
  const document = read("features/seshat/InvoiceDocument.tsx");
  const presentation = await import("../features/seshat/invoicePresentation.ts");

  assert.equal(presentation.invoiceDocumentCopy["es-HN"].invoice, "Factura");
  assert.equal(presentation.invoiceDocumentCopy["en-US"].invoice, "Invoice");
  assert.equal("statuses" in presentation.invoiceDocumentCopy["es-HN"], false);
  assert.equal("statuses" in presentation.invoiceDocumentCopy["en-US"], false);
  assert.doesNotMatch(document, /copy\.statuses|invoice\.status|Borrador|Emitida|Enviada|Draft|Issued|Sent|Cancelled/);
  assert.match(document, /invoice\.invoice_number/);
  assert.match(document, /invoice\.amount_paid/);
  assert.match(document, /balance_due/);
  assert.match(document, /paymentInstructionPresentation/);
});

test("financial overview counts issued invoices once and excludes drafts", async () => {
  const { buildFxOverview } = await import("../features/seshat/fxReporting.ts");
  const base = {
    invoice_number: "INV-2611-001",
    currency: "HNL",
    total: 2997,
    issue_date: "2026-11-01",
  };
  const overview = buildFxOverview({
    invoices: [
      { ...base, id: "issued", status: "issued" },
      { ...base, id: "draft", invoice_number: "DRAFT", status: "draft" },
      { ...base, id: "cancelled", invoice_number: "CANCELLED", status: "cancelled" },
    ],
    payments: [],
    expenses: [],
    paymentRates: [],
    officialRates: [],
    target: "HNL",
    asOfDate: "2026-11-03",
  });

  assert.equal(overview.knownRevenue.value, 2997);
  assert.equal(overview.knownRevenue.count, 1);
  assert.equal(overview.invoiced.value, 2997);
  assert.equal(overview.invoiced.count, 1);
});

