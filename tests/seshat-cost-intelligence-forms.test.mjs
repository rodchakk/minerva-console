import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildActualFormPayload,
  buildCostFormPayload,
  requiredPositiveDecimalNumber,
} from "../features/seshat/costIntelligenceForms.ts";

const ownerId = "11111111-1111-1111-1111-111111111111";
const today = "2026-10-10";

function form(fields = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) data.set(key, value);
  }
  return data;
}

function baseCost(fields = {}) {
  return form({
    kind: "company",
    name: "Synthetic cost",
    cost_mode: "fixed_amount",
    currency: "USD",
    frequency: "monthly",
    include_in_analysis: "on",
    is_active: "on",
    ...fields,
  });
}

function baseActual(fields = {}) {
  return form({
    name: "Synthetic actual",
    destination_scope: "product",
    product_key: "ENTRY",
    observation_type: "vendor_cost",
    currency: "USD",
    amount_known: "on",
    ...fields,
  });
}

test("Cost Intelligence rejects missing fixed cost amount without inventing zero", () => {
  assert.throws(
    () => buildCostFormPayload(baseCost({ amount: "" }), { ownerId, today }),
    /Amount is required/,
  );
});

test("Cost Intelligence accepts explicit zero and nonzero fixed cost amounts", () => {
  const zero = buildCostFormPayload(baseCost({ amount: "0" }), { ownerId, today });
  const amount = buildCostFormPayload(baseCost({ amount: "25.00" }), { ownerId, today });

  assert.equal(zero.payload.amount, "0");
  assert.equal(amount.payload.amount, "25.00");
});

test("Cost Intelligence requires usage monthly quantity instead of defaulting quantity to zero", () => {
  assert.throws(
    () => buildCostFormPayload(baseCost({
      cost_mode: "usage",
      unit_cost: "",
      unit_label: "request",
      monthly_quantity: "",
    }), { ownerId, today }),
    /Monthly quantity is required/,
  );

  const payload = buildCostFormPayload(baseCost({
    cost_mode: "usage",
    unit_cost: "",
    unit_label: "request",
    monthly_quantity: "0",
  }), { ownerId, today });

  assert.equal(payload.payload.unit_cost, null);
  assert.equal(payload.payload.monthly_quantity, "0");
});

test("Cost Intelligence requires product usage unit cost where the backend requires it", () => {
  assert.throws(
    () => buildCostFormPayload(baseCost({
      kind: "product",
      product_key: "ENTRY",
      cost_mode: "usage",
      unit_cost: "",
      unit_label: "request",
      monthly_quantity: "1",
    }), { ownerId, today }),
    /Unit cost is required/,
  );
});

test("Cost Intelligence rejects known actuals without an amount", () => {
  assert.throws(
    () => buildActualFormPayload(baseActual({ amount: "" }), { ownerId, today, periodMonth: "2026-10" }),
    /Amount is required/,
  );
});

test("Cost Intelligence preserves explicit zero and subcent known actual amounts", () => {
  const zero = buildActualFormPayload(baseActual({ amount: "0" }), { ownerId, today, periodMonth: "2026-10" });
  const subcent = buildActualFormPayload(baseActual({ amount: "0.00113850" }), { ownerId, today, periodMonth: "2026-10" });

  assert.equal(zero.amount_known, true);
  assert.equal(zero.amount, "0");
  assert.equal(subcent.amount, "0.00113850");
});

test("Cost Intelligence keeps unknown actuals unknown even when the amount field is empty", () => {
  const payload = buildActualFormPayload(baseActual({ amount_known: undefined, amount: "" }), {
    ownerId,
    today,
    periodMonth: "2026-10",
  });

  assert.equal(payload.amount_known, false);
  assert.equal(payload.amount, null);
});

test("Cost Intelligence shows invalid decimal input before sending a payload", () => {
  assert.throws(
    () => buildActualFormPayload(baseActual({ amount: "25 USD" }), { ownerId, today, periodMonth: "2026-10" }),
    /Enter decimal values without currency symbols/,
  );
  assert.throws(
    () => requiredPositiveDecimalNumber(null, "Duration"),
    /Duration is required/,
  );
});
