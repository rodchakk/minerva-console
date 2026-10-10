export type CostKind = "company" | "product";

export type CostFormPayload = {
  kind: CostKind;
  payload: Record<string, string | boolean | null>;
  companyFields: {
    require_full_allocation: boolean;
    supersedes_company_cost_id: string | null;
  };
  productFields: {
    product_key: string;
    scope: string;
    client_id: string | null;
    supersedes_cost_id: string | null;
  };
};

type FormReader = Pick<FormData, "get">;

export function cleanFormValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function decimalInput(value: FormDataEntryValue | null) {
  const text = cleanFormValue(value);
  if (text === null) return null;
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error("Enter decimal values without currency symbols.");
  return text;
}

export function requiredDecimalInput(value: FormDataEntryValue | null, label: string) {
  const text = decimalInput(value);
  if (text === null) throw new Error(`${label} is required.`);
  return text;
}

export function requiredPositiveDecimalNumber(value: FormDataEntryValue | null, label: string) {
  const text = requiredDecimalInput(value, label);
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be above zero.`);
  return { text, value: parsed };
}

export function dateMonthValue(value: FormDataEntryValue | null, fallbackMonth: string) {
  const text = String(value ?? fallbackMonth).trim() || fallbackMonth;
  return text.length === 7 ? `${text}-01` : text;
}

export function buildCostFormPayload(form: FormReader, options: { ownerId: string; today: string }): CostFormPayload {
  const kind = String(form.get("kind") ?? "company") as CostKind;
  const costMode = String(form.get("cost_mode") ?? "fixed_amount");
  const payload = {
    owner_id: options.ownerId,
    name: String(form.get("name") ?? "").trim(),
    vendor: cleanFormValue(form.get("vendor")),
    layer: String(form.get("layer") ?? "technical"),
    cost_type: String(form.get("cost_type") ?? "infrastructure"),
    cost_mode: costMode,
    currency: String(cleanFormValue(form.get("currency")) ?? "USD").toUpperCase(),
    frequency: String(form.get("frequency") ?? "monthly"),
    amount: costMode === "fixed_amount" ? requiredDecimalInput(form.get("amount"), "Amount") : null,
    unit_cost: costMode === "usage"
      ? kind === "product"
        ? requiredDecimalInput(form.get("unit_cost"), "Unit cost")
        : decimalInput(form.get("unit_cost"))
      : null,
    unit_label: costMode === "usage" ? cleanFormValue(form.get("unit_label")) : null,
    monthly_quantity: costMode === "usage" ? requiredDecimalInput(form.get("monthly_quantity"), "Monthly quantity") : null,
    evidence_level: String(form.get("evidence_level") ?? "estimated"),
    evidence_note: cleanFormValue(form.get("evidence_note")),
    evidence_date: cleanFormValue(form.get("evidence_date")),
    start_date: String(cleanFormValue(form.get("start_date")) ?? options.today),
    end_date: cleanFormValue(form.get("end_date")),
    include_in_analysis: form.get("include_in_analysis") === "on",
    is_active: form.get("is_active") === "on",
    source_expense_id: cleanFormValue(form.get("source_expense_id")),
    notes: cleanFormValue(form.get("notes")),
  };

  if (!payload.name) throw new Error("Cost name is required.");
  if (costMode === "usage" && !payload.unit_label) throw new Error("Unit label is required for usage costs.");

  const scope = String(form.get("scope") ?? "shared_product");
  const productKey = String(form.get("product_key") ?? "").trim().toUpperCase();
  if (kind === "product" && !productKey) throw new Error("Product key is required for product and client costs.");

  return {
    kind,
    payload,
    companyFields: {
      require_full_allocation: form.get("require_full_allocation") === "on",
      supersedes_company_cost_id: cleanFormValue(form.get("supersedes_id")),
    },
    productFields: {
      product_key: productKey,
      scope,
      client_id: scope === "client_direct" ? cleanFormValue(form.get("client_id")) : null,
      supersedes_cost_id: cleanFormValue(form.get("supersedes_id")),
    },
  };
}

export function buildActualFormPayload(
  form: FormReader,
  options: { ownerId: string; today: string; periodMonth: string },
) {
  const scope = String(form.get("destination_scope") ?? "product");
  const amountKnown = form.get("amount_known") === "on";
  const payload = {
    owner_id: options.ownerId,
    period_month: dateMonthValue(form.get("period_month"), options.periodMonth),
    observed_date: String(cleanFormValue(form.get("observed_date")) ?? options.today),
    destination_scope: scope,
    product_key: scope === "company" ? null : String(form.get("product_key") ?? "").trim().toUpperCase(),
    client_id: scope === "client" ? cleanFormValue(form.get("client_id")) : null,
    company_cost_id: scope === "company" ? cleanFormValue(form.get("company_cost_id")) : null,
    name: String(form.get("name") ?? "").trim(),
    vendor: cleanFormValue(form.get("vendor")),
    observation_type: String(form.get("observation_type") ?? "vendor_cost"),
    layer: String(form.get("layer") ?? "technical"),
    currency: String(cleanFormValue(form.get("currency")) ?? "USD").toUpperCase(),
    amount: amountKnown ? requiredDecimalInput(form.get("amount"), "Amount") : null,
    amount_known: amountKnown,
    quantity: decimalInput(form.get("quantity")),
    unit_label: cleanFormValue(form.get("unit_label")),
    evidence_level: String(form.get("evidence_level") ?? "verified"),
    evidence_note: cleanFormValue(form.get("evidence_note")),
    evidence_date: cleanFormValue(form.get("evidence_date")),
    include_in_economics: form.get("include_in_economics") === "on",
    include_in_client_economics: form.get("include_in_client_economics") === "on",
    economic_treatment: String(form.get("economic_treatment") ?? "recurring"),
    source_expense_id: cleanFormValue(form.get("source_expense_id")),
    notes: cleanFormValue(form.get("notes")),
  };

  if (!payload.name) throw new Error("Observation name is required.");
  if (scope !== "company" && !payload.product_key) {
    throw new Error("Product key is required for product and client observations.");
  }
  if (payload.observation_type === "usage" && !payload.unit_label) {
    throw new Error("Unit label is required for usage observations.");
  }
  if (payload.observation_type === "usage" && payload.quantity === null) {
    throw new Error("Quantity is required for usage observations.");
  }

  return payload;
}
