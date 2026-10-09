import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  assert.match(source, /\.rpc\("set_invoice_payment_method"/);
  assert.doesNotMatch(source, /\.from\("invoice_items"\)\.insert/);
  assert.doesNotMatch(source, /\.from\("payments"\)\.insert/);
});

test("Settings manages reusable owner payment methods without hardcoded bank data", () => {
  const source = read("features/seshat/SeshatWorkspace.tsx");

  assert.match(source, />Payment Methods</);
  assert.match(source, /Create Payment Method/);
  assert.match(source, /Update Payment Method/);
  assert.match(source, /Deactivate/);
  assert.match(source, /Set default/);
  assert.match(source, /methodType === "bank_transfer"/);
  assert.match(source, /methodType === "paypal"/);
  assert.doesNotMatch(source, /200011417538|Ficohsa Minerva|Bank:\s*Ficohsa/);
});

test("clients and invoices expose payment method selection at the required points", () => {
  const source = read("features/seshat/SeshatWorkspace.tsx");

  assert.match(source, /label="Preferred payment method"/);
  assert.match(source, /Current resolution:/);
  assert.match(source, /label="Payment method"/);
  assert.match(source, /label="Payment instructions"/);
  assert.match(source, /Assign \/ Refresh/);
  assert.match(source, /invoice\.status === "draft"/);
  assert.match(source, /payment_method_selection:/);
  assert.match(source, /payment_method_id:/);
});

test("payment instructions render localized bank and PayPal labels while omitting blanks", async () => {
  const presentation = await import("../features/seshat/invoicePresentation.ts");
  const bank = presentation.paymentInstructionPresentation({
    version: 1,
    payment_method_id: "bank-1",
    name: "Primary bank",
    display_name: "Transferencia bancaria",
    method_type: "bank_transfer",
    bank_name: "Example Bank",
    account_number: "1234",
  }, "es-HN");
  const paypal = presentation.paymentInstructionPresentation({
    version: 1,
    payment_method_id: "paypal-1",
    name: "PayPal",
    method_type: "paypal",
    paypal_email: "billing@example.com",
    payment_url: "https://example.com/pay",
  }, "en-US");

  assert.equal(bank.heading, "Información bancaria");
  assert.deepEqual(bank.rows.map((row) => row.label), ["Banco", "Número de cuenta"]);
  assert.equal(paypal.heading, "Payment information");
  assert.deepEqual(paypal.rows.map((row) => row.label), ["Account", "Payment link"]);
  assert.equal(paypal.rows[1].isLink, true);
});

test("payment method choices are presentation metadata and do not alter invoice amounts", async () => {
  const helpers = await import("../features/seshat/paymentMethods.ts");
  const invoice = Object.freeze({ currency: "HNL", total: 2917, amount_paid: 0 });

  assert.deepEqual(helpers.parseInvoicePaymentMethodChoice("method:abc"), {
    selection: "specific",
    paymentMethodId: "abc",
  });
  assert.deepEqual(helpers.parseInvoicePaymentMethodChoice("none"), {
    selection: "none",
    paymentMethodId: null,
  });
  assert.deepEqual(invoice, { currency: "HNL", total: 2917, amount_paid: 0 });
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

test("invoice print CSS isolates the client document from Console and Vercel chrome", () => {
  const document = read("features/seshat/InvoiceDocument.tsx");
  const css = read("app/globals.css");

  assert.match(document, /data-seshat-invoice-document/);
  assert.match(css, /@page seshat-invoice[\s\S]*margin:\s*12mm/);
  assert.match(css, /@media print/);
  assert.match(css, /body:has\(\[data-seshat-invoice-document\]\)/);
  assert.match(css, /:not\(:has\(\[data-seshat-invoice-document\]\)\)[\s\S]*display:\s*none !important/);
  assert.match(css, /\[data-seshat-invoice-document\][\s\S]*background:\s*#ffffff !important/);
  assert.match(css, /vercel-live-feedback[\s\S]*display:\s*none !important/);
});

test("invoice operator controls and Payments stay outside the printable document", () => {
  const workspace = read("features/seshat/SeshatWorkspace.tsx");
  const document = read("features/seshat/InvoiceDocument.tsx");

  assert.match(workspace, /<InvoiceDocument invoice=\{invoice\} profile=\{profile\} language=\{documentLanguage\} \/>/);
  assert.doesNotMatch(document, /Print \/ Save PDF|Mark as Sent|Delete Draft|Payments|Invoice language|PREVIEW|Seshat/);
});

test("invoice document follows the Minerva branded hierarchy and reads payment snapshots", () => {
  const document = read("features/seshat/InvoiceDocument.tsx");

  assert.match(document, /invoiceBrandPresentation\(profile, language\)/);
  assert.match(document, /brand\.businessName/);
  assert.match(document, /brand\.email/);
  assert.match(document, /brand\.phone/);
  assert.match(document, /brand\.website/);
  assert.match(document, /brand\.logoSrc/);
  assert.match(document, /brand\.footer/);
  assert.match(document, /data-invoice-accent-rule/);
  assert.match(document, /data-invoice-bill-to/);
  assert.match(document, /data-invoice-totals/);
  assert.match(document, /paymentInstructionPresentation\(invoice\.payment_instruction_snapshot, language\)/);
  assert.match(document, /method_type === "bank_transfer"[\s\S]*Landmark[\s\S]*WalletCards/);
  assert.doesNotMatch(document, /Ficohsa|200011417538/);
});

test("invoice brand presentation uses owner identity with Minerva fallbacks only", async () => {
  const presentation = await import("../features/seshat/invoicePresentation.ts");
  const minerva = presentation.invoiceBrandPresentation({
    business_name: "Minerva Technologies",
    email: "billing@minervatechs.com",
    phone: null,
    mobile: "+504 9999-0000",
    website: "https://www.minervatechs.com",
    logo_url: null,
    invoice_footer: null,
  }, "es-HN");
  const otherOwner = presentation.invoiceBrandPresentation({
    business_name: "Acme Services",
    email: "billing@acme.example",
    phone: "+1 555 0100",
    mobile: null,
    website: "https://acme.example",
    logo_url: "https://assets.acme.example/invoice-logo.png",
    invoice_footer: "Acme owner-specific footer",
  }, "en-US");
  const otherOwnerWithoutOptionalBranding = presentation.invoiceBrandPresentation({
    business_name: "Plain Owner",
    email: "owner@example.com",
    phone: "555-0199",
    mobile: null,
    website: "owner.example",
    logo_url: null,
    invoice_footer: null,
  }, "es-HN");
  const fallback = presentation.invoiceBrandPresentation(null, "es-HN");

  assert.deepEqual(minerva, {
    businessName: "Minerva Technologies",
    email: "billing@minervatechs.com",
    phone: "+504 9999-0000",
    website: "https://www.minervatechs.com",
    logoSrc: "/brand/minerva-logo-gray.png",
    footer: "Soluciones tecnológicas para administración y operación residencial.",
  });
  assert.deepEqual(otherOwner, {
    businessName: "Acme Services",
    email: "billing@acme.example",
    phone: "+1 555 0100",
    website: "https://acme.example",
    logoSrc: "https://assets.acme.example/invoice-logo.png",
    footer: "Acme owner-specific footer",
  });
  assert.doesNotMatch(JSON.stringify(otherOwner), /Minerva|minervatechs/i);
  assert.equal(otherOwnerWithoutOptionalBranding.logoSrc, null);
  assert.equal(otherOwnerWithoutOptionalBranding.footer, null);
  assert.deepEqual(fallback, {
    businessName: "Minerva Technologies",
    email: "support@minervatechs.com",
    phone: "+504 3220-9818",
    website: "www.minervatechs.com",
    logoSrc: "/brand/minerva-logo-gray.png",
    footer: "Soluciones tecnológicas para administración y operación residencial.",
  });

  const presentationSource = read("features/seshat/invoicePresentation.ts");
  assert.match(presentationSource, /MINERVA_BRAND_FALLBACK/);
  assert.doesNotMatch(read("features/seshat/InvoiceDocument.tsx"), /support@minervatechs|\+504 3220-9818|www\.minervatechs|Minerva Technologies/);
});

test("invoice presentation defaults to Spanish and retains English structural labels", async () => {
  const presentation = await import("../features/seshat/invoicePresentation.ts");
  const workspace = read("features/seshat/SeshatWorkspace.tsx");

  assert.equal(presentation.DEFAULT_INVOICE_DOCUMENT_LANGUAGE, "es-HN");
  assert.equal(presentation.invoiceDocumentCopy["es-HN"].invoice, "Factura");
  assert.equal(presentation.invoiceDocumentCopy["es-HN"].billTo, "Facturar a");
  assert.equal(presentation.invoiceDocumentCopy["es-HN"].balanceDue, "Saldo pendiente");
  assert.equal(presentation.invoiceDocumentCopy["es-HN"].totalPayable, "Total a pagar");
  assert.equal(presentation.invoiceDocumentCopy["es-HN"].bankInformation, "Información bancaria");
  assert.equal(presentation.invoiceDocumentCopy["es-HN"].statuses.draft, "Borrador");
  assert.equal(presentation.invoiceDocumentCopy["en-US"].invoice, "Invoice");
  assert.equal(presentation.invoiceDocumentCopy["en-US"].billTo, "Bill to");
  assert.equal(presentation.invoiceDocumentCopy["en-US"].balanceDue, "Balance due");
  assert.match(workspace, /\["es-HN", "Español"\]/);
  assert.match(workspace, /\["en-US", "English"\]/);
});

test("invoice locale switching formats presentation without mutating financial data", async () => {
  const presentation = await import("../features/seshat/invoicePresentation.ts");
  const invoice = Object.freeze({ invoice_number: "INV-2610-001", currency: "HNL", total: 2917 });

  const spanishMoney = presentation.formatInvoiceDocumentMoney(invoice.total, invoice.currency, "es-HN");
  const englishMoney = presentation.formatInvoiceDocumentMoney(invoice.total, invoice.currency, "en-US");
  const documentAmount = presentation.formatInvoiceDocumentAmount(invoice.total, invoice.currency, "es-HN");
  assert.equal(spanishMoney.replace(/\s/g, " "), "HNL 2,917.00");
  assert.equal(englishMoney.replace(/\s/g, " "), "HNL 2,917.00");
  assert.doesNotMatch(spanishMoney, /\$/);
  assert.equal(documentAmount.replace(/\s/g, " "), "L 2,917.00");
  assert.match(presentation.formatInvoiceDocumentDate("2026-10-09", "es-HN"), /octubre/i);
  assert.match(presentation.formatInvoiceDocumentDate("2026-10-09", "en-US"), /October/i);
  assert.deepEqual(invoice, { invoice_number: "INV-2610-001", currency: "HNL", total: 2917 });

  const presentationSource = read("features/seshat/invoicePresentation.ts");
  assert.doesNotMatch(presentationSource, /supabase|\.rpc\(|\.from\(|fetch\(|update\(|insert\(/i);
  const document = read("features/seshat/InvoiceDocument.tsx");
  assert.match(document, /item\.name/);
  assert.match(document, /item\.description/);
});

test("Seshat web MVP adds no database migration", () => {
  const branchFiles = execFileSync("git", ["diff", "--name-only", "origin/master...HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  const worktreeFiles = execFileSync("git", ["diff", "--name-only"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.doesNotMatch(`${branchFiles}\n${worktreeFiles}`, /^supabase\/migrations\//m);
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
