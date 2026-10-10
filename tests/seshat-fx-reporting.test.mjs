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
