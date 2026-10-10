// Pure, conservative management-currency conversion for Seshat.
// Original ledger amounts/currencies are NEVER changed.
export type ReportingCurrency = "HNL" | "USD";
export type OfficialFxRate = {
  effective_date: string; rate: number; source: string; source_indicator: string; fetched_at?: string;
};
export type PaymentFxRate = {
  payment_id: string; owner_id: string; rate: number; source_note: string;
};
export type FxInvoice = { id: string; invoice_number: string; currency: string; total: number; issue_date: string; status: string };
export type FxPayment = { id: string; amount: number; currency: string; payment_date: string };
export type FxExpense = { id: string; name: string; currency: string; amount: number; monthly_amount: number | null; frequency: string; start_date: string; end_date: string | null; is_active: boolean };

export function normalizeCurrency(input: string | null | undefined): string {
  const currency = (input ?? "").trim().toUpperCase();
  return currency === "HND" ? "HNL" : currency;
}

export function daysBetween(start: string, end: string): number {
  return Math.floor((Date.parse(end + "T00:00:00Z") - Date.parse(start + "T00:00:00Z")) / 86400000);
}

// Same-day, or most recent preceding business date (max 7 days).
// Historical dates never silently revalue with today's rate.
export function officialRateAt(rates: OfficialFxRate[], date: string): OfficialFxRate | null {
  const eligible = rates.filter((r) => r.effective_date <= date && daysBetween(r.effective_date, date) >= 0
    && daysBetween(r.effective_date, date) <= 7 && Number.isFinite(Number(r.rate)) && Number(r.rate) > 0);
  return eligible.sort((a, b) => b.effective_date.localeCompare(a.effective_date))[0] ?? null;
}

export function convertMoney(
  amount: number, from: string, to: ReportingCurrency, date: string,
  rates: OfficialFxRate[], settlementRate?: number | null,
): number | null {
  const currency = normalizeCurrency(from);
  if (!Number.isFinite(Number(amount))) return null;
  if (currency === to) return Number(amount);
  if ((currency !== "USD" && currency !== "HNL")) return null;
  const rate = settlementRate != null ? Number(settlementRate) : Number(officialRateAt(rates, date)?.rate ?? NaN);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return currency === "USD" ? Number(amount) * rate : Number(amount) / rate;
}

export type FxTotal = { value: number | null; missing: string[]; count: number };
export function strictTotal(lines: Array<{ label: string; value: number | null }>): FxTotal {
  const missing = lines.filter((line) => line.value === null).map((line) => line.label);
  return {
    // Crucial: do not display a partial number pretending it is the full total.
    value: missing.length ? null : lines.reduce((sum, line) => sum + (line.value ?? 0), 0),
    missing, count: lines.length,
  };
}

export function reportingDate(now: Date = new Date()) {
  // Locale formatting differs between browser/Node ICU builds. Date-only
  // values must always be ISO YYYY-MM-DD for business day and month grouping.
  const pieces = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: "year" | "month" | "day") => pieces.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function buildFxOverview(input: {
  invoices: FxInvoice[]; payments: FxPayment[]; expenses: FxExpense[];
  paymentRates: PaymentFxRate[]; officialRates: OfficialFxRate[];
  target: ReportingCurrency; asOfDate: string;
}) {
  const { invoices, payments, expenses, paymentRates, officialRates: rates, target, asOfDate } = input;
  const month = asOfDate.slice(0, 7);
  const paidFx = new Map(paymentRates.map((p) => [p.payment_id, Number(p.rate)]));

  // Draft/cancelled invoices are not recognized as issued receivables.
  const issued = invoices.filter((i) => !["draft", "cancelled"].includes(i.status));
  const knownRevenue = strictTotal(issued.map((i) => ({
    label: `Invoice ${i.invoice_number} (${normalizeCurrency(i.currency)})`,
    value: convertMoney(i.total, i.currency, target, i.issue_date, rates),
  })));
  const invoiced = strictTotal(issued.filter((i) => i.issue_date.slice(0, 7) === month).map((i) => ({
    label: `Invoice ${i.invoice_number} (${normalizeCurrency(i.currency)})`,
    value: convertMoney(i.total, i.currency, target, i.issue_date, rates),
  })));

  // Payment cash is grouped by actual payment_date, not invoice issue_date.
  const paymentsThisMonth = payments.filter((p) => p.payment_date.slice(0, 7) === month);
  const collected = strictTotal(paymentsThisMonth.map((p) => ({
    label: `Payment ${p.id} (${normalizeCurrency(p.currency)})`,
    value: convertMoney(p.amount, p.currency, target, p.payment_date, rates, paidFx.get(p.id)),
  })));

  // Forecast expenses are current-rate estimates; do not reprice historical cash.
  const activeCosts = expenses.filter((e) =>
    e.is_active && e.start_date <= asOfDate && (!e.end_date || e.end_date >= asOfDate));
  const monthlyCosts = strictTotal(activeCosts.map((e) => ({
    label: `Expense ${e.name} (${normalizeCurrency(e.currency)})`,
    value: convertMoney(
      e.frequency === "one_time" ? (e.start_date.slice(0,7) === month ? e.amount : 0)
        : Number(e.monthly_amount ?? 0),
      e.currency, target, asOfDate, rates,
    ),
  })));
  const netCashAfterForecastCosts = collected.value === null || monthlyCosts.value === null
    ? null : collected.value - monthlyCosts.value;
  const margin = collected.value !== null && collected.value > 0 && netCashAfterForecastCosts !== null
    ? (netCashAfterForecastCosts / collected.value) * 100 : null;

  return { knownRevenue, invoiced, collected, monthlyCosts, netCashAfterForecastCosts, margin,
    missing: [...new Set([
      ...knownRevenue.missing, ...invoiced.missing, ...collected.missing, ...monthlyCosts.missing,
    ])],
    rate: officialRateAt(rates, asOfDate),
  };
}


/**
 * Read-only what-if preview. This function does not write to Supabase and
 * deliberately never mutates the original invoice/payment records.
 *
 * A draft invoice is treated as issued and fully paid on the selected report
 * date solely for the financial overview projection.
 */
export function simulateDraftPayment<TInvoice extends FxInvoice & { amount_paid: number | null }>(
  invoices: TInvoice[],
  payments: FxPayment[],
  invoiceId: string,
  paymentDate: string,
): { invoices: TInvoice[]; payments: FxPayment[]; amount: number } | null {
  const target = invoices.find((invoice) => invoice.id === invoiceId);
  if (!target || target.status !== "draft" || target.issue_date > paymentDate) return null;
  const amount = Number(target.total) - Number(target.amount_paid ?? 0);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(Number(target.total))) return null;
  if (!["HNL", "USD"].includes(normalizeCurrency(target.currency))) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return null;

  return {
    invoices: invoices.map((invoice) =>
      invoice.id === invoiceId ? { ...invoice, status: "paid" } : invoice),
    payments: [
      ...payments,
      {
        id: `preview-only-${invoiceId}`,
        amount,
        currency: target.currency,
        payment_date: paymentDate,
      },
    ],
    amount,
  };
}
