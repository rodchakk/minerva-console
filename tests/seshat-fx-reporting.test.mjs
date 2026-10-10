import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const tsText = readFileSync(new URL("../features/seshat/fxReporting.ts", import.meta.url), "utf8");
const js = ts.transpileModule(tsText, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, strict: true,
} }).outputText;
const fx = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const rates = [
  { effective_date: "2026-08-11", rate: 26.8, source: "BCH", source_indicator: "EC-TCR-01" },
  { effective_date: "2026-10-09", rate: 27, source: "BCH", source_indicator: "EC-TCR-01" },
];

test("never sums USD and HNL without conversion; retains exact document values", () => {
  const result = fx.buildFxOverview({
    invoices: [
      { id: "1", invoice_number: "INV-USD", issue_date: "2026-08-11", currency: "USD", total: 110, status: "paid" },
      { id: "2", invoice_number: "INV-HNL", issue_date: "2026-10-08", currency: "HNL", total: 2917, status: "sent" },
    ],
    payments: [], expenses: [], paymentRates: [], officialRates: rates,
    target: "HNL", asOfDate: "2026-10-09",
  });
  assert.equal(result.knownRevenue.value, 110 * 26.8 + 2917);
  assert.equal(result.invoiced.value, 2917);
  assert.equal(result.collected.value, 0);
});
test("missing historical rate hides total rather than quietly using today's exchange rate", () => {
  const result = fx.buildFxOverview({
    invoices: [{ id: "1", invoice_number: "OLD", issue_date: "2026-06-05", currency: "USD", total: 110, status: "paid" }],
    payments: [], expenses: [], paymentRates: [], officialRates: [rates[1]],
    target: "HNL", asOfDate: "2026-10-09",
  });
  assert.equal(result.knownRevenue.value, null);
  assert.deepEqual(result.knownRevenue.missing, ["Invoice OLD (USD)"]);
  assert.equal(fx.officialRateAt(rates, "2026-11-01"), null);
});
test("cash uses payment date and actual bank rate over BCH reference", () => {
  const result = fx.buildFxOverview({
    invoices: [{ id: "1", invoice_number: "PAID", issue_date: "2026-06-05", currency: "USD", total: 110, status: "paid" }],
    payments: [{ id: "p", amount: 110, currency: "USD", payment_date: "2026-08-11" }],
    expenses: [], officialRates: rates,
    paymentRates: [{ payment_id: "p", owner_id: "u", rate: 26.55, source_note: "Bank" }],
    target: "HNL", asOfDate: "2026-10-09",
  });
  assert.equal(result.collected.value, 0);
  const aug = fx.buildFxOverview({
    invoices: [], payments: [{ id: "p", amount: 110, currency: "USD", payment_date: "2026-08-11" }],
    expenses: [], officialRates: rates,
    paymentRates: [{ payment_id: "p", owner_id: "u", rate: 26.55, source_note: "Bank" }],
    target: "HNL", asOfDate: "2026-08-11",
  });
  assert.equal(aug.collected.value, 110 * 26.55);
  assert.ok(aug.missing.length === 0);
});
test("drafts are excluded and USD denominated costs cannot be shown as HNL without FX", () => {
  const result = fx.buildFxOverview({
    invoices: [{ id: "d", invoice_number: "DRAFT", issue_date: "2026-10-09", currency: "HNL", total: 2917, status: "draft" }],
    payments: [], paymentRates: [], officialRates: [],
    expenses: [{ id: "e", name: "Domain", currency: "USD", amount: 12,
      monthly_amount: 1, frequency: "yearly", start_date: "2026-01-01", end_date: null, is_active: true }],
    target: "HNL", asOfDate: "2026-10-09",
  });
  assert.equal(result.invoiced.value, 0);
  assert.equal(result.monthlyCosts.value, null);
  assert.equal(result.netCashAfterForecastCosts, null);
});
test("HND is normalized to ISO HNL", () => {
  assert.equal(fx.normalizeCurrency("HND"), "HNL");
  assert.equal(fx.convertMoney(29, "HND", "HNL", "2026-10-09", []), 29);
  assert.equal(fx.convertMoney(27, "HNL", "USD", "2026-10-09", rates), 1);
});

test("Honduras reporting day uses YYYY-MM-DD across UTC midnight", () => {
  assert.equal(fx.reportingDate(new Date("2026-10-10T02:30:00.000Z")), "2026-10-09");
  assert.equal(fx.reportingDate(new Date("2026-10-09T13:00:00.000Z")), "2026-10-09");
});

test("real Seshat legacy invoice converted with June BCH rate, draft excluded", () => {
  const officialRates = [
    { effective_date: "2026-06-05", rate: 26.6690, source: "BCH", source_indicator: "EC-TCR-01" },
    { effective_date: "2026-08-11", rate: 26.8108, source: "BCH", source_indicator: "EC-TCR-01" },
    { effective_date: "2026-10-07", rate: 26.8883, source: "BCH", source_indicator: "EC-TCR-01" },
  ];
  const overview = fx.buildFxOverview({
    target: "HNL", asOfDate: "2026-10-09", officialRates, paymentRates: [],
    invoices: [
      { id: "v", invoice_number: "INV-2606-577", issue_date: "2026-06-05", currency: "USD", total: 110, status: "paid" },
      { id: "a", invoice_number: "INV-2610-001", issue_date: "2026-10-08", currency: "HNL", total: 2917, status: "draft" },
    ],
    payments: [{ id: "p", amount: 110, currency: "USD", payment_date: "2026-08-11" }],
    expenses: [],
  });
  assert.ok(Math.abs(overview.knownRevenue.value - 2933.59) < 0.00001);
  assert.equal(overview.invoiced.value, 0);
  assert.equal(overview.collected.value, 0);
  assert.equal(overview.rate.effective_date, "2026-10-07");
  const august = fx.buildFxOverview({
    target: "HNL", asOfDate: "2026-08-11", officialRates, paymentRates: [],
    invoices: [], expenses: [],
    payments: [{ id: "p", amount: 110, currency: "USD", payment_date: "2026-08-11" }],
  });
  assert.ok(Math.abs(august.collected.value - 2949.188) < 0.00001);
});

test("Andalucía what-if payment changes overview without mutating original invoice or payment data", () => {
  const rateHistory = [
    { effective_date: "2026-06-05", rate: 26.6690, source: "BCH", source_indicator: "EC-TCR-01" },
    { effective_date: "2026-08-11", rate: 26.8108, source: "BCH", source_indicator: "EC-TCR-01" },
    { effective_date: "2026-10-07", rate: 26.8883, source: "BCH", source_indicator: "EC-TCR-01" },
  ];
  const invoices = [
    { id: "victor", invoice_number: "INV-2606-577", issue_date: "2026-06-05",
      currency: "USD", total: 110, amount_paid: 110, status: "paid" },
    { id: "andalucia", invoice_number: "INV-2610-001", issue_date: "2026-10-08",
      currency: "HNL", total: 2917, amount_paid: 0, status: "draft" },
  ];
  const payments = [{ id: "victor-payment", amount: 110, currency: "USD", payment_date: "2026-08-11" }];
  const originalInvoices = JSON.stringify(invoices);
  const originalPayments = JSON.stringify(payments);
  const expenses = [{ id: "cost", name: "Monthly expenses", currency: "USD", amount: 14.57,
    monthly_amount: 14.57, frequency: "monthly", start_date: "2026-01-01", end_date: null, is_active: true }];

  const report = (ins, pay) => fx.buildFxOverview({
    invoices: ins, payments: pay, expenses, paymentRates: [], officialRates: rateHistory,
    target: "HNL", asOfDate: "2026-10-09",
  });
  const actual = report(invoices, payments);
  const scenario = fx.simulateDraftPayment(invoices, payments, "andalucia", "2026-10-09");
  assert.ok(scenario);
  const projected = report(scenario.invoices, scenario.payments);

  assert.ok(Math.abs(actual.knownRevenue.value - 2933.59) < 1e-8);
  assert.equal(actual.collected.value, 0);
  assert.ok(Math.abs(projected.knownRevenue.value - 5850.59) < 1e-8);
  assert.equal(projected.invoiced.value, 2917);
  assert.equal(projected.collected.value, 2917);
  assert.ok(Math.abs(projected.monthlyCosts.value - 391.762531) < 1e-6);
  assert.ok(Math.abs(projected.netCashAfterForecastCosts - 2525.237469) < 1e-6);
  assert.equal(scenario.invoices[1].status, "paid");
  assert.equal(scenario.payments[1].payment_date, "2026-10-09");
  assert.equal(scenario.payments[1].amount, 2917);
  assert.equal(JSON.stringify(invoices), originalInvoices);
  assert.equal(JSON.stringify(payments), originalPayments);
});

test("a previously paid, cancelled or missing invoice is not eligible for read-only preview", () => {
  const base = { id: "a", invoice_number: "INV-2610-001", issue_date: "2026-10-08",
    currency: "HNL", total: 2917, amount_paid: 0 };
  for (const status of ["sent", "paid", "cancelled"]) {
    assert.equal(fx.simulateDraftPayment([{ ...base, status }], [], base.id, "2026-10-09"), null);
  }
  assert.equal(fx.simulateDraftPayment([{ ...base, status: "draft" }], [], "missing", "2026-10-09"), null);
  assert.equal(fx.simulateDraftPayment([{ ...base, status: "draft" }], [], base.id, "2026-10-07"), null);
});

test("Andalucía preview UI is explicit, reversible and makes no ledger writes", () => {
  const src = readFileSync(new URL("../features/seshat/SeshatWorkspace.tsx", import.meta.url), "utf8");
  const first = src.indexOf("function Overview(");
  const last = src.indexOf("function Metric(", first);
  const overview = src.slice(first, last);
  assert.match(overview, /simulateDraftPayment\(invoices, payments, andaluciaDraft\.id, asOfDate\)/);
  assert.match(overview, /setPreviewEnabled\(\(value\) => !value\)/);
  assert.match(overview, /Return to real numbers/);
  assert.match(overview, /SIMULATION — not real income or a recorded payment/);
  assert.doesNotMatch(overview, /\.insert\(|\.update\(|\.delete\(|\.rpc\(|recordPayment\(/);
});
