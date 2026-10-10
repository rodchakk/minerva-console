import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDecimalAmount, formatFinancialAmount } from "../features/seshat/financialFormat.ts";

test("Seshat financial formatter rounds deterministic decimal displays", () => {
  assert.equal(formatFinancialAmount("25", { currency: "USD" }), "$25.00");
  assert.equal(formatFinancialAmount("25.125", { currency: "USD" }), "$25.13");
  assert.equal(formatFinancialAmount("25.124", { currency: "USD" }), "$25.12");
  assert.equal(formatFinancialAmount("-25.125", { currency: "USD" }), "-$25.13");
  assert.equal(formatFinancialAmount("0.00113850", { currency: "USD" }), "$0.00113850");
  assert.equal(formatFinancialAmount("-0.00113850", { currency: "USD" }), "-$0.00113850");
  assert.equal(formatFinancialAmount(0, { currency: "USD" }), "$0.00");
  assert.equal(formatFinancialAmount(null, { currency: "USD" }), "Unknown");
  assert.equal(formatFinancialAmount("25", { currency: "USD", missingFx: true }), "FX unavailable");
  assert.equal(formatFinancialAmount("1250.5", { currency: "HNL" }), "L 1,250.50");
});

test("Seshat financial formatter keeps tiny nonzero values visibly nonzero", () => {
  assert.equal(formatFinancialAmount("0.000000004", { currency: "USD" }), "<$0.00000001");
  assert.equal(formatFinancialAmount("-0.000000004", { currency: "USD" }), ">-$0.00000001");
  assert.equal(formatFinancialAmount("0.000000005", { currency: "USD" }), "$0.00000001");
  assert.equal(formatDecimalAmount("1.005", 2), "1.01");
});
