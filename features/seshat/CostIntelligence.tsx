"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Link2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/supabase/utils";
import { localDateValue } from "./localDate";
import { getSeshatDataClient } from "./supabase";

type JsonRecord = Record<string, unknown>;

type CompanyRealityDashboard = {
  as_of_date: string;
  currency: string;
  monthly_revenue: number | null;
  total_known_monthly_costs: number | null;
  known_monthly_profit: number | null;
  known_margin_percent: number | null;
  actual_observed_costs_this_month: number | null;
  work_hours_this_month: number | null;
  missing_fx_count: number | null;
  missing_labor_rate_count: number | null;
  economics_complete: boolean;
  needs_input: Array<{ kind: string; label: string; severity: string }> | null;
};

type ExpenseReconciliation = {
  expense_id: string;
  expense_name: string;
  expense_vendor: string | null;
  expense_currency: string;
  expense_frequency: string;
  expense_amount: number;
  expense_monthly_amount: number | null;
  company_cost_id: string | null;
  company_cost_name: string | null;
  product_cost_id: string | null;
  product_cost_product_key: string | null;
  product_cost_client_id: string | null;
  product_cost_name: string | null;
  actual_id: string | null;
  actual_period_month: string | null;
  actual_destination_scope: string | null;
  actual_name: string | null;
  analytic_link_count: number;
  reconciliation_status: "company_cost" | "product_or_client_cost" | "actual_observation" | "unlinked";
};

type CompanyAllocationSummary = {
  company_cost_id: string;
  name: string;
  vendor: string | null;
  layer: string;
  cost_type: string;
  currency: string;
  source_monthly_amount: number | null;
  allocated_percent: number;
  unallocated_percent: number;
  allocation_complete: boolean;
};

type ActualObservation = {
  id: string;
  period_month: string;
  observed_date: string;
  destination_scope: string;
  product_key: string | null;
  client_id: string | null;
  name: string;
  vendor: string | null;
  observation_type: string;
  currency: string;
  amount: number | null;
  amount_known: boolean;
  quantity: number | null;
  unit_label: string | null;
  source_expense_id?: string | null;
};

type CostIntelligenceState = {
  reality: CompanyRealityDashboard | null;
  modeledProduct: JsonRecord | null;
  actualProduct: JsonRecord | null;
  reconciliation: ExpenseReconciliation[];
  allocations: CompanyAllocationSummary[];
  actuals: ActualObservation[];
};

const emptyState: CostIntelligenceState = {
  reality: null,
  modeledProduct: null,
  actualProduct: null,
  reconciliation: [],
  allocations: [],
  actuals: [],
};

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function money(value: unknown, currency = "HNL") {
  const parsed = numberValue(value);
  if (parsed === null) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(parsed);
}

function decimal(value: unknown, digits = 2) {
  const parsed = numberValue(value);
  if (parsed === null) return "-";
  return parsed.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function percent(value: unknown) {
  const parsed = numberValue(value);
  if (parsed === null) return "-";
  return `${parsed.toFixed(1)}%`;
}

function monthStart(monthValue: string) {
  return `${monthValue || localDateValue().slice(0, 7)}-01`;
}

function firstError(results: Array<{ error: { message?: string } | null }>) {
  return results.find((result) => result.error)?.error ?? null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-white/[0.10] bg-[#10151b] p-4", className)}>
      {children}
    </section>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Panel>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-400">{detail}</p> : null}
    </Panel>
  );
}

function StatusPill({ complete }: { complete: boolean }) {
  return complete ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-100">
      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-100">
      <AlertTriangle className="h-3.5 w-3.5" /> Incomplete
    </span>
  );
}

function CompactTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<{ key: string; cells: React.ReactNode[] }>;
  empty: string;
}) {
  if (!rows.length) return <p className="text-sm text-[var(--text-muted)]">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-slate-400">
          <tr>{headers.map((header) => <th key={header} className="border-b border-white/[0.10] px-3 py-2 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-white/[0.08]">
          {rows.map((row) => (
            <tr key={row.key} className="text-slate-200">
              {row.cells.map((cell, index) => (
                <td key={`${row.key}-${index}`} className="whitespace-nowrap px-3 py-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CostIntelligence() {
  const today = localDateValue();
  const [asOfDate, setAsOfDate] = useState(today);
  const [periodMonth, setPeriodMonth] = useState(today.slice(0, 7));
  const [productKey, setProductKey] = useState("ENTRY");
  const [analysisCurrency, setAnalysisCurrency] = useState("HNL");
  const [state, setState] = useState<CostIntelligenceState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSeshatDataClient();
      const normalizedProduct = productKey.trim().toUpperCase() || "ENTRY";
      const normalizedCurrency = analysisCurrency.trim().toUpperCase() || "HNL";
      const actualPeriod = monthStart(periodMonth);
      const [
        realityRes,
        modeledProductRes,
        actualProductRes,
        reconciliationRes,
        allocationsRes,
        actualsRes,
      ] = await Promise.all([
        supabase.rpc<CompanyRealityDashboard[]>("company_reality_dashboard_v2", { p_as_of_date: asOfDate }),
        supabase.rpc<JsonRecord>("unit_economics_modeled_product_summary_v2_at", {
          p_product_key: normalizedProduct,
          p_as_of_date: asOfDate,
          p_analysis_currency: normalizedCurrency,
        }),
        supabase.rpc<JsonRecord>("unit_economics_actual_product_monthly_summary", {
          p_product_key: normalizedProduct,
          p_period_month: actualPeriod,
          p_analysis_currency: normalizedCurrency,
        }),
        supabase
          .from<ExpenseReconciliation[]>("unit_economics_expense_reconciliation")
          .select("*")
          .order("reconciliation_status")
          .limit(100),
        supabase
          .from<CompanyAllocationSummary[]>("unit_economics_company_cost_allocation_summary")
          .select("*")
          .order("name")
          .limit(100),
        supabase
          .from<ActualObservation[]>("unit_economics_actuals")
          .select("*")
          .order("period_month", { ascending: false })
          .limit(100),
      ]);

      const errorResult = firstError([
        realityRes,
        modeledProductRes,
        actualProductRes,
        reconciliationRes,
        allocationsRes,
        actualsRes,
      ]);
      if (errorResult) throw errorResult;

      setState({
        reality: asArray<CompanyRealityDashboard>(realityRes.data)[0] ?? null,
        modeledProduct: modeledProductRes.data ?? null,
        actualProduct: actualProductRes.data ?? null,
        reconciliation: asArray<ExpenseReconciliation>(reconciliationRes.data),
        allocations: asArray<CompanyAllocationSummary>(allocationsRes.data),
        actuals: asArray<ActualObservation>(actualsRes.data),
      });
    } catch (loadError) {
      setState(emptyState);
      setError(loadError instanceof Error ? loadError.message : "Could not load Cost Intelligence.");
    } finally {
      setLoading(false);
    }
  }, [analysisCurrency, asOfDate, periodMonth, productKey]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(handle);
  }, [load]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load();
  }

  const { reality, modeledProduct, actualProduct } = state;
  const displayCurrency = reality?.currency ?? analysisCurrency.toUpperCase();
  const openItems = state.reconciliation.filter((item) => item.reconciliation_status === "unlinked");

  return (
    <div className="space-y-4">
      <Panel>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end">
          <label className="space-y-1.5 text-sm">
            <span className="block font-medium text-slate-200">As-of date</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(event) => setAsOfDate(event.target.value)}
              className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block font-medium text-slate-200">Actual period</span>
            <input
              type="month"
              value={periodMonth}
              onChange={(event) => setPeriodMonth(event.target.value)}
              className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block font-medium text-slate-200">Product</span>
            <input
              value={productKey}
              onChange={(event) => setProductKey(event.target.value.toUpperCase())}
              className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white"
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="block font-medium text-slate-200">Currency</span>
            <input
              value={analysisCurrency}
              onChange={(event) => setAnalysisCurrency(event.target.value.toUpperCase())}
              className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white"
            />
          </label>
          <Button className="gap-2" disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        </form>
      </Panel>

      {error ? (
        <p role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-100">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="Monthly revenue" value={money(reality?.monthly_revenue, displayCurrency)} detail={asOfDate} />
        <MetricTile label="Known monthly costs" value={money(reality?.total_known_monthly_costs, displayCurrency)} detail={reality?.economics_complete ? "complete" : "inputs pending"} />
        <MetricTile label="Known monthly profit" value={money(reality?.known_monthly_profit, displayCurrency)} detail={percent(reality?.known_margin_percent)} />
        <MetricTile label="Observed costs" value={money(reality?.actual_observed_costs_this_month, displayCurrency)} detail={`${decimal(reality?.work_hours_this_month ?? 0, 1)} work hours`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-violet-200" />
              <h2 className="font-semibold text-white">Modeled Product Economics</h2>
            </div>
            <StatusPill complete={Boolean(modeledProduct?.economics_complete)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Profiles" value={textValue(modeledProduct?.profile_count)} />
            <MetricTile label="Monthly revenue" value={money(modeledProduct?.monthly_contract_revenue_total, analysisCurrency)} />
            <MetricTile label="Company allocation" value={money(modeledProduct?.company_allocated_monthly_cost_total, analysisCurrency)} />
            <MetricTile label="Fully loaded cost" value={money(modeledProduct?.fully_loaded_monthly_cost_total, analysisCurrency)} />
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-violet-200" />
              <h2 className="font-semibold text-white">Actual Product Economics</h2>
            </div>
            <StatusPill complete={Boolean(actualProduct?.economics_complete)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Actual revenue" value={money(actualProduct?.actual_revenue, analysisCurrency)} />
            <MetricTile label="Cost to serve" value={money(actualProduct?.client_cost_to_serve, analysisCurrency)} />
            <MetricTile label="R&D hours" value={decimal(actualProduct?.rnd_hours, 1)} />
            <MetricTile label="Profit after R&D" value={money(actualProduct?.profit_after_rnd, analysisCurrency)} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-white">Inputs</h2>
            <StatusPill complete={Boolean(reality?.economics_complete)} />
          </div>
          <div className="space-y-2">
            {(reality?.needs_input ?? []).length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No open items.</p>
            ) : (
              reality?.needs_input?.map((item) => (
                <div key={`${item.kind}-${item.label}`} className="flex items-center justify-between gap-3 rounded-md border border-white/[0.08] px-3 py-2 text-sm">
                  <span className="text-slate-200">{item.label}</span>
                  <Badge>{item.severity}</Badge>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <MetricTile label="Missing FX" value={String(reality?.missing_fx_count ?? 0)} />
            <MetricTile label="Missing rates" value={String(reality?.missing_labor_rate_count ?? 0)} />
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-violet-200" />
              <h2 className="font-semibold text-white">Expense Reconciliation</h2>
            </div>
            <Badge>{openItems.length} unlinked</Badge>
          </div>
          <CompactTable
            headers={["Expense", "Status", "Monthly", "Analytical record"]}
            rows={state.reconciliation.map((item) => ({
              key: item.expense_id,
              cells: [
                <span key="expense" className="font-medium text-white">{item.expense_name}</span>,
                <Badge key="status">{item.reconciliation_status.replaceAll("_", " ")}</Badge>,
                money(item.expense_monthly_amount, item.expense_currency),
                item.company_cost_name ?? item.product_cost_name ?? item.actual_name ?? "-",
              ],
            }))}
            empty="No active expenses."
          />
        </Panel>
      </div>

      <Panel>
        <h2 className="mb-3 font-semibold text-white">Company Allocations</h2>
        <CompactTable
          headers={["Cost", "Vendor", "Layer", "Allocated", "Unallocated", "Monthly source"]}
          rows={state.allocations.map((item) => ({
            key: item.company_cost_id,
            cells: [
              <span key="name" className="font-medium text-white">{item.name}</span>,
              item.vendor ?? "-",
              item.layer,
              percent(item.allocated_percent),
              percent(item.unallocated_percent),
              money(item.source_monthly_amount, item.currency),
            ],
          }))}
          empty="No company allocations."
        />
      </Panel>

      <Panel>
        <h2 className="mb-3 font-semibold text-white">Actual Observations</h2>
        <CompactTable
          headers={["Period", "Scope", "Name", "Amount", "Quantity", "Expense"]}
          rows={state.actuals.map((item) => ({
            key: item.id,
            cells: [
              item.period_month,
              [item.destination_scope, item.product_key].filter(Boolean).join(" / "),
              <span key="name" className="font-medium text-white">{item.name}</span>,
              item.amount_known ? money(item.amount, item.currency) : "unknown",
              item.quantity == null ? "-" : `${decimal(item.quantity, 4)} ${item.unit_label ?? ""}`.trim(),
              item.source_expense_id ? "linked" : "-",
            ],
          }))}
          empty="No actual observations."
        />
      </Panel>
    </div>
  );
}
