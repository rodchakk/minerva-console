"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  Split,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/supabase/utils";
import { formatDecimalAmount, formatFinancialAmount } from "./financialFormat";
import { localDateValue } from "./localDate";
import { getSeshatDataClient, getSeshatSupabase } from "./supabase";
import type { Client, Expense } from "./types";

type ViewKey = "registry" | "allocations" | "actuals" | "labor" | "economics";
type JsonRecord = Record<string, unknown>;
type CostKind = "company" | "product";

type CompanyCost = {
  id: string;
  name: string;
  vendor: string | null;
  layer: string;
  cost_type: string;
  cost_mode: string;
  currency: string;
  frequency: string;
  amount: string | number | null;
  unit_cost: string | number | null;
  unit_label: string | null;
  monthly_quantity: string | number | null;
  evidence_level: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  include_in_analysis: boolean;
  supersedes_company_cost_id: string | null;
  source_expense_id: string | null;
  notes: string | null;
};

type ProductCost = {
  id: string;
  name: string;
  vendor: string | null;
  product_key: string;
  client_id: string | null;
  scope: "shared_product" | "client_direct";
  layer: string;
  cost_type: string;
  cost_mode: string;
  currency: string;
  frequency: string;
  amount: string | number | null;
  unit_cost: string | number | null;
  unit_label: string | null;
  monthly_quantity: string | number | null;
  evidence_level: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  include_in_analysis: boolean;
  supersedes_cost_id: string | null;
  source_expense_id: string | null;
  notes: string | null;
};

type Allocation = {
  id: string;
  company_cost_id: string;
  product_key: string;
  allocation_percent: string | number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  allocation_note: string | null;
};

type AllocationSummary = {
  company_cost_id: string;
  name: string;
  vendor: string | null;
  currency: string;
  source_monthly_amount: string | number | null;
  allocated_percent: string | number;
  unallocated_percent: string | number;
  allocation_complete: boolean;
};

type ActualObservation = {
  id: string;
  period_month: string;
  observed_date: string;
  destination_scope: "company" | "product" | "client";
  product_key: string | null;
  client_id: string | null;
  company_cost_id: string | null;
  name: string;
  vendor: string | null;
  observation_type: string;
  layer: string;
  currency: string;
  amount: string | number | null;
  amount_known: boolean;
  quantity: string | number | null;
  unit_label: string | null;
  evidence_level: string;
  include_in_economics: boolean;
  include_in_client_economics: boolean;
  economic_treatment: string;
  source_expense_id: string | null;
  notes: string | null;
};

type Worker = {
  id: string;
  name: string;
  is_active: boolean;
  notes: string | null;
};

type LaborRate = {
  id: string;
  worker_id: string;
  currency: string;
  hourly_rate: string | number;
  evidence_level: string;
  effective_start_date: string;
  effective_end_date: string | null;
};

type WorkLog = {
  id: string;
  worker_id: string;
  worker_name?: string;
  work_date: string;
  duration_minutes: number;
  duration_hours?: string | number | null;
  destination_scope: "company" | "product" | "client";
  product_key: string | null;
  client_id: string | null;
  activity_category: string;
  work_mode: string;
  economic_treatment: string;
  include_in_economics: boolean;
  include_in_client_economics: boolean;
  source_labor_cost?: string | number | null;
  labor_rate_currency?: string | null;
  labor_rate_missing?: boolean;
  note: string | null;
};

type EconomicsProfile = {
  id: string;
  client_id: string;
  product_key: string;
  analysis_currency: string;
  status: string;
  go_live_date: string | null;
  clients?: { name: string; company_name: string | null } | null;
};

type ExpenseReconciliation = {
  expense_id: string;
  expense_name: string;
  expense_vendor: string | null;
  expense_currency: string;
  expense_monthly_amount: string | number | null;
  company_cost_id: string | null;
  company_cost_name: string | null;
  product_cost_id: string | null;
  product_cost_name: string | null;
  actual_id: string | null;
  actual_name: string | null;
  legacy_allocation_count: number | null;
  analytic_link_count: number;
  reconciliation_status: string;
  financial_precedence: string | null;
};

type CostState = {
  companyCosts: CompanyCost[];
  productCosts: ProductCost[];
  allocations: Allocation[];
  allocationSummary: AllocationSummary[];
  actuals: ActualObservation[];
  workers: Worker[];
  laborRates: LaborRate[];
  workLogs: WorkLog[];
  profiles: EconomicsProfile[];
  clients: Client[];
  expenses: Expense[];
  reconciliation: ExpenseReconciliation[];
  modeledClient: JsonRecord | null;
  actualClient: JsonRecord | null;
};

const emptyState: CostState = {
  companyCosts: [],
  productCosts: [],
  allocations: [],
  allocationSummary: [],
  actuals: [],
  workers: [],
  laborRates: [],
  workLogs: [],
  profiles: [],
  clients: [],
  expenses: [],
  reconciliation: [],
  modeledClient: null,
  actualClient: null,
};

const views: Array<{ key: ViewKey; label: string; icon: typeof Layers3 }> = [
  { key: "registry", label: "Cost Registry", icon: Layers3 },
  { key: "allocations", label: "Allocations", icon: Split },
  { key: "actuals", label: "Usage & Actuals", icon: Activity },
  { key: "labor", label: "Work & Labor", icon: BriefcaseBusiness },
  { key: "economics", label: "Economics", icon: Calculator },
];

const layerOptions = ["technical", "operational", "overhead"];
const costTypes = ["platform", "infrastructure", "variable_usage", "support", "onboarding", "field_operation", "other"];
const frequencies = ["weekly", "monthly", "quarterly", "yearly", "one_time"];
const evidenceLevels = ["verified", "quoted", "estimated", "placeholder"];
const actualTypes = ["vendor_cost", "usage", "direct_operational", "onboarding", "other"];
const workCategories = ["onboarding", "support", "product_maintenance", "product_development_rnd", "other"];
const treatments = ["recurring", "one_time", "tracked_only"];

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function decimalInput(value: FormDataEntryValue | null, fallback: string | null = null) {
  const text = clean(value);
  if (text === null) return fallback;
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error("Enter decimal values without currency symbols.");
  return text;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scalarValue(value: unknown): string | number | null | undefined {
  return typeof value === "string" || typeof value === "number" || value === null || value === undefined
    ? value
    : undefined;
}

function dateMonth(value: string) {
  return `${value || localDateValue().slice(0, 7)}-01`;
}

function firstError(results: Array<{ error: { message?: string } | null }>) {
  return results.find((result) => result.error)?.error ?? null;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function displayClient(client: Client | undefined | null) {
  if (!client) return "No client";
  return client.company_name || client.name;
}

function profileLabel(profile: EconomicsProfile) {
  return `${profile.clients?.company_name || profile.clients?.name || profile.client_id} / ${profile.product_key}`;
}

function linkedExpenseLabel(expense: Expense | undefined) {
  if (!expense) return "No source expense";
  return `${expense.name} / ${formatFinancialAmount(expense.monthly_amount, { currency: expense.currency })}`;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-[#141119] bg-[#24202B] p-4", className)}>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="block font-medium text-slate-200">{label}</span>
      {children}
    </label>
  );
}

function inputClass() {
  return "w-full rounded-md border border-[#141119] bg-[#2E2936] px-3 py-2 text-sm text-white outline-none transition focus:border-[#7553FF]";
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass(), props.className)} />;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass(), props.className)} />;
}

function Checkbox({ name, defaultChecked, label }: { name: string; defaultChecked?: boolean; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-200">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-[#7553FF]" />
      {label}
    </label>
  );
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<{ key: string; selected?: boolean; onClick?: () => void; cells: ReactNode[] }>;
  empty: string;
}) {
  if (!rows.length) {
    return <p className="rounded-md border border-[#141119] bg-[#2E2936] p-4 text-sm text-slate-300">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#141119]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#141119] text-xs uppercase tracking-[0.14em] text-slate-400">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#141119]">
          {rows.map((row) => (
            <tr
              key={row.key}
              onClick={row.onClick}
              className={cn(
                "text-slate-200",
                row.onClick && "cursor-pointer hover:bg-[#2E2936]",
                row.selected && "bg-[#120539]",
              )}
            >
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

function Notice({ message, tone = "warning" }: { message: string | null; tone?: "warning" | "success" }) {
  if (!message) return null;
  return (
    <p
      role={tone === "warning" ? "alert" : "status"}
      className={cn(
        "rounded-md border p-3 text-sm",
        tone === "warning" ? "border-amber-500/30 bg-amber-500/5 text-amber-100" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-100",
      )}
    >
      {message}
    </p>
  );
}

function CompletenessBadge({ complete }: { complete: boolean }) {
  return complete ? <Badge tone="success">Complete</Badge> : <Badge tone="warning">Incomplete</Badge>;
}

export function CostIntelligence() {
  const today = localDateValue();
  const [view, setView] = useState<ViewKey>("registry");
  const [state, setState] = useState<CostState>(emptyState);
  const [query, setQuery] = useState("");
  const [selectedCost, setSelectedCost] = useState<{ kind: CostKind; id: string } | null>(null);
  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);
  const [selectedActualId, setSelectedActualId] = useState<string | null>(null);
  const [selectedWorkLogId, setSelectedWorkLogId] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(today);
  const [periodMonth, setPeriodMonth] = useState(today.slice(0, 7));
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedCompanyCost = state.companyCosts.find((item) => selectedCost?.kind === "company" && item.id === selectedCost.id);
  const selectedProductCost = state.productCosts.find((item) => selectedCost?.kind === "product" && item.id === selectedCost.id);
  const selectedAllocation = state.allocations.find((item) => item.id === selectedAllocationId);
  const selectedActual = state.actuals.find((item) => item.id === selectedActualId);
  const selectedWorkLog = state.workLogs.find((item) => item.id === selectedWorkLogId);
  const selectedProfile = state.profiles.find((item) => item.id === selectedProfileId) ?? state.profiles[0] ?? null;

  const filteredCompanyCosts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.companyCosts;
    return state.companyCosts.filter((item) => `${item.name} ${item.vendor ?? ""} ${item.layer} ${item.cost_type}`.toLowerCase().includes(needle));
  }, [query, state.companyCosts]);

  const filteredProductCosts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return state.productCosts;
    return state.productCosts.filter((item) => `${item.name} ${item.vendor ?? ""} ${item.product_key} ${item.scope}`.toLowerCase().includes(needle));
  }, [query, state.productCosts]);

  const ownerPayload = useCallback(async () => {
    const { data } = await getSeshatSupabase().auth.getUser();
    if (!data.user) throw new Error("Reconnect to Seshat before saving Cost Intelligence data.");
    return data.user.id;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSeshatDataClient();
      if (view === "registry") {
        const [companyRes, productRes, expensesRes, clientsRes, reconciliationRes] = await Promise.all([
          supabase.from<CompanyCost[]>("unit_economics_company_costs").select("*").order("start_date", { ascending: false }),
          supabase.from<ProductCost[]>("unit_economics_costs").select("*").order("start_date", { ascending: false }),
          supabase.from<Expense[]>("expenses").select("*").order("name"),
          supabase.from<Client[]>("clients").select("*").order("name"),
          supabase.from<ExpenseReconciliation[]>("unit_economics_expense_reconciliation").select("*").order("reconciliation_status"),
        ]);
        const problem = firstError([companyRes, productRes, expensesRes, clientsRes, reconciliationRes]);
        if (problem) throw problem;
        setState((current) => ({
          ...current,
          companyCosts: asArray<CompanyCost>(companyRes.data),
          productCosts: asArray<ProductCost>(productRes.data),
          expenses: asArray<Expense>(expensesRes.data),
          clients: asArray<Client>(clientsRes.data),
          reconciliation: asArray<ExpenseReconciliation>(reconciliationRes.data),
        }));
      }
      if (view === "allocations") {
        const [companyRes, allocationRes, summaryRes] = await Promise.all([
          supabase.from<CompanyCost[]>("unit_economics_company_costs").select("*").order("name"),
          supabase.from<Allocation[]>("unit_economics_company_allocations").select("*").order("start_date", { ascending: false }),
          supabase.from<AllocationSummary[]>("unit_economics_company_cost_allocation_summary").select("*").order("name"),
        ]);
        const problem = firstError([companyRes, allocationRes, summaryRes]);
        if (problem) throw problem;
        setState((current) => ({
          ...current,
          companyCosts: asArray<CompanyCost>(companyRes.data),
          allocations: asArray<Allocation>(allocationRes.data),
          allocationSummary: asArray<AllocationSummary>(summaryRes.data),
        }));
      }
      if (view === "actuals") {
        const [actualsRes, companyRes, clientsRes, expensesRes] = await Promise.all([
          supabase.from<ActualObservation[]>("unit_economics_actuals").select("*").order("period_month", { ascending: false }).limit(200),
          supabase.from<CompanyCost[]>("unit_economics_company_costs").select("*").order("name"),
          supabase.from<Client[]>("clients").select("*").order("name"),
          supabase.from<Expense[]>("expenses").select("*").order("name"),
        ]);
        const problem = firstError([actualsRes, companyRes, clientsRes, expensesRes]);
        if (problem) throw problem;
        setState((current) => ({
          ...current,
          actuals: asArray<ActualObservation>(actualsRes.data),
          companyCosts: asArray<CompanyCost>(companyRes.data),
          clients: asArray<Client>(clientsRes.data),
          expenses: asArray<Expense>(expensesRes.data),
        }));
      }
      if (view === "labor") {
        const [workersRes, ratesRes, logsRes, clientsRes] = await Promise.all([
          supabase.from<Worker[]>("unit_economics_workers").select("*").order("name"),
          supabase.from<LaborRate[]>("unit_economics_labor_rates").select("*").order("effective_start_date", { ascending: false }),
          supabase.from<WorkLog[]>("unit_economics_work_log_costed").select("*").order("work_date", { ascending: false }).limit(200),
          supabase.from<Client[]>("clients").select("*").order("name"),
        ]);
        const problem = firstError([workersRes, ratesRes, logsRes, clientsRes]);
        if (problem) throw problem;
        setState((current) => ({
          ...current,
          workers: asArray<Worker>(workersRes.data),
          laborRates: asArray<LaborRate>(ratesRes.data),
          workLogs: asArray<WorkLog>(logsRes.data),
          clients: asArray<Client>(clientsRes.data),
        }));
      }
      if (view === "economics") {
        const profileRes = await supabase
          .from<EconomicsProfile[]>("unit_economics_profiles")
          .select("*, clients(name, company_name)")
          .order("product_key");
        if (profileRes.error) throw profileRes.error;
        const profiles = asArray<EconomicsProfile>(profileRes.data);
        const profile = profiles.find((item) => item.id === selectedProfileId) ?? profiles[0] ?? null;
        let modeledClient: JsonRecord | null = null;
        let actualClient: JsonRecord | null = null;
        if (profile) {
          const [modeledRes, actualRes] = await Promise.all([
            supabase.rpc<JsonRecord>("unit_economics_modeled_client_summary_v2_at", {
              p_profile_id: profile.id,
              p_as_of_date: asOfDate,
            }),
            supabase.rpc<JsonRecord>("unit_economics_actual_client_monthly_summary", {
              p_profile_id: profile.id,
              p_period_month: dateMonth(periodMonth),
            }),
          ]);
          const problem = firstError([modeledRes, actualRes]);
          if (problem) throw problem;
          modeledClient = modeledRes.data ?? null;
          actualClient = actualRes.data ?? null;
          if (!selectedProfileId) setSelectedProfileId(profile.id);
        }
        setState((current) => ({ ...current, profiles, modeledClient, actualClient }));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Cost Intelligence.");
    } finally {
      setLoading(false);
    }
  }, [asOfDate, periodMonth, selectedProfileId, view]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function refreshWithNotice(message: string) {
    setNotice(message);
    await load();
  }

  async function createCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const form = new FormData(event.currentTarget);
      const owner_id = await ownerPayload();
      const kind = String(form.get("kind") ?? "company") as CostKind;
      const costMode = String(form.get("cost_mode") ?? "fixed_amount");
      const payload = {
        owner_id,
        name: String(form.get("name") ?? "").trim(),
        vendor: clean(form.get("vendor")),
        layer: String(form.get("layer") ?? "technical"),
        cost_type: String(form.get("cost_type") ?? "infrastructure"),
        cost_mode: costMode,
        currency: String(clean(form.get("currency")) ?? "USD").toUpperCase(),
        frequency: String(form.get("frequency") ?? "monthly"),
        amount: costMode === "fixed_amount" ? decimalInput(form.get("amount"), "0") : null,
        unit_cost: costMode === "usage" ? decimalInput(form.get("unit_cost")) : null,
        unit_label: costMode === "usage" ? clean(form.get("unit_label")) : null,
        monthly_quantity: costMode === "usage" ? decimalInput(form.get("monthly_quantity"), "0") : null,
        evidence_level: String(form.get("evidence_level") ?? "estimated"),
        evidence_note: clean(form.get("evidence_note")),
        evidence_date: clean(form.get("evidence_date")),
        start_date: String(clean(form.get("start_date")) ?? today),
        end_date: clean(form.get("end_date")),
        include_in_analysis: form.get("include_in_analysis") === "on",
        is_active: form.get("is_active") === "on",
        source_expense_id: clean(form.get("source_expense_id")),
        notes: clean(form.get("notes")),
      };
      if (!payload.name) throw new Error("Cost name is required.");
      const supabase = getSeshatDataClient();
      if (kind === "company") {
        const { error: insertError } = await supabase.from("unit_economics_company_costs").insert({
          ...payload,
          require_full_allocation: form.get("require_full_allocation") === "on",
          supersedes_company_cost_id: clean(form.get("supersedes_id")),
        });
        if (insertError) throw insertError;
      } else {
        const scope = String(form.get("scope") ?? "shared_product");
        const productKey = String(form.get("product_key") ?? "").trim().toUpperCase();
        if (!productKey) throw new Error("Product key is required for product and client costs.");
        const { error: insertError } = await supabase.from("unit_economics_costs").insert({
          ...payload,
          product_key: productKey,
          scope,
          client_id: scope === "client_direct" ? clean(form.get("client_id")) : null,
          supersedes_cost_id: clean(form.get("supersedes_id")),
        });
        if (insertError) throw insertError;
      }
      event.currentTarget.reset();
      await refreshWithNotice("Cost saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save cost.");
    }
  }

  async function saveCostMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCost) return;
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const patch = {
        end_date: clean(form.get("end_date")),
        include_in_analysis: form.get("include_in_analysis") === "on",
        is_active: form.get("is_active") === "on",
        source_expense_id: clean(form.get("source_expense_id")),
        notes: clean(form.get("notes")),
      };
      const table = selectedCost.kind === "company" ? "unit_economics_company_costs" : "unit_economics_costs";
      const { error: updateError } = await getSeshatDataClient().from(table).update(patch).eq("id", selectedCost.id);
      if (updateError) throw updateError;
      await refreshWithNotice("Cost metadata updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update cost.");
    }
  }

  async function deactivateSelectedCost() {
    if (!selectedCost) return;
    const table = selectedCost.kind === "company" ? "unit_economics_company_costs" : "unit_economics_costs";
    const { error: updateError } = await getSeshatDataClient().from(table).update({ is_active: false }).eq("id", selectedCost.id);
    if (updateError) {
      setError(updateError.message ?? "Could not deactivate cost.");
      return;
    }
    await refreshWithNotice("Cost deactivated.");
  }

  async function saveAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const companyCostId = String(form.get("company_cost_id") ?? "");
      const allocationPercent = numeric(form.get("allocation_percent"));
      if (!companyCostId) throw new Error("Select a company cost.");
      if (allocationPercent <= 0 || allocationPercent > 100) throw new Error("Allocation percent must be above 0 and at most 100.");
      const existingTotal = state.allocations
        .filter((item) => item.company_cost_id === companyCostId && item.is_active && item.id !== selectedAllocationId)
        .reduce((sum, item) => sum + numeric(item.allocation_percent), 0);
      if (existingTotal + allocationPercent > 100) throw new Error("Allocation total cannot exceed 100%.");

      const payload = {
        owner_id: await ownerPayload(),
        company_cost_id: companyCostId,
        product_key: String(form.get("product_key") ?? "").trim().toUpperCase(),
        allocation_method: "manual_percentage",
        allocation_percent: decimalInput(form.get("allocation_percent"), "0"),
        start_date: String(clean(form.get("start_date")) ?? today),
        end_date: clean(form.get("end_date")),
        is_active: form.get("is_active") === "on",
        allocation_note: clean(form.get("allocation_note")),
      };
      if (!payload.product_key) throw new Error("Product key is required.");
      const response = selectedAllocationId
        ? await getSeshatDataClient().from("unit_economics_company_allocations").update(payload).eq("id", selectedAllocationId)
        : await getSeshatDataClient().from("unit_economics_company_allocations").insert(payload);
      if (response.error) throw response.error;
      event.currentTarget.reset();
      setSelectedAllocationId(null);
      await refreshWithNotice(selectedAllocationId ? "Allocation updated." : "Allocation saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save allocation.");
    }
  }

  async function saveActual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const scope = String(form.get("destination_scope") ?? "product");
      const amountKnown = form.get("amount_known") === "on";
      const payload = {
        owner_id: await ownerPayload(),
        period_month: dateMonth(String(form.get("period_month") ?? periodMonth)),
        observed_date: String(clean(form.get("observed_date")) ?? today),
        destination_scope: scope,
        product_key: scope === "company" ? null : String(form.get("product_key") ?? "").trim().toUpperCase(),
        client_id: scope === "client" ? clean(form.get("client_id")) : null,
        company_cost_id: scope === "company" ? clean(form.get("company_cost_id")) : null,
        name: String(form.get("name") ?? "").trim(),
        vendor: clean(form.get("vendor")),
        observation_type: String(form.get("observation_type") ?? "vendor_cost"),
        layer: String(form.get("layer") ?? "technical"),
        currency: String(clean(form.get("currency")) ?? "USD").toUpperCase(),
        amount: amountKnown ? decimalInput(form.get("amount"), "0") : null,
        amount_known: amountKnown,
        quantity: decimalInput(form.get("quantity")),
        unit_label: clean(form.get("unit_label")),
        evidence_level: String(form.get("evidence_level") ?? "verified"),
        evidence_note: clean(form.get("evidence_note")),
        evidence_date: clean(form.get("evidence_date")),
        include_in_economics: form.get("include_in_economics") === "on",
        include_in_client_economics: form.get("include_in_client_economics") === "on",
        economic_treatment: String(form.get("economic_treatment") ?? "recurring"),
        source_expense_id: clean(form.get("source_expense_id")),
        notes: clean(form.get("notes")),
      };
      if (!payload.name) throw new Error("Observation name is required.");
      if (scope !== "company" && !payload.product_key) throw new Error("Product key is required for product and client observations.");
      const response = selectedActualId
        ? await getSeshatDataClient().from("unit_economics_actuals").update(payload).eq("id", selectedActualId)
        : await getSeshatDataClient().from("unit_economics_actuals").insert(payload);
      if (response.error) throw response.error;
      event.currentTarget.reset();
      setSelectedActualId(null);
      await refreshWithNotice(selectedActualId ? "Observation updated." : "Observation saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save observation.");
    }
  }

  async function createWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      if (!name) throw new Error("Worker name is required.");
      const { error: insertError } = await getSeshatDataClient().from("unit_economics_workers").insert({
        owner_id: await ownerPayload(),
        name,
        is_active: form.get("is_active") === "on",
        notes: clean(form.get("notes")),
      });
      if (insertError) throw insertError;
      event.currentTarget.reset();
      await refreshWithNotice("Worker saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not create worker.");
    }
  }

  async function createLaborRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const payload = {
        owner_id: await ownerPayload(),
        worker_id: String(form.get("worker_id") ?? ""),
        currency: String(clean(form.get("currency")) ?? "USD").toUpperCase(),
        hourly_rate: decimalInput(form.get("hourly_rate"), "0"),
        evidence_level: String(form.get("evidence_level") ?? "estimated"),
        evidence_note: clean(form.get("evidence_note")),
        effective_start_date: String(clean(form.get("effective_start_date")) ?? today),
        effective_end_date: clean(form.get("effective_end_date")),
        notes: clean(form.get("notes")),
      };
      if (!payload.worker_id) throw new Error("Select a worker.");
      const { error: insertError } = await getSeshatDataClient().from("unit_economics_labor_rates").insert(payload);
      if (insertError) throw insertError;
      event.currentTarget.reset();
      await refreshWithNotice("Labor rate saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save labor rate.");
    }
  }

  async function saveWorkLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const form = new FormData(event.currentTarget);
      const scope = String(form.get("destination_scope") ?? "client");
      const payload = {
        owner_id: await ownerPayload(),
        worker_id: String(form.get("worker_id") ?? ""),
        work_date: String(clean(form.get("work_date")) ?? today),
        duration_minutes: Math.round(numeric(form.get("duration_hours")) * 60),
        destination_scope: scope,
        product_key: scope === "company" ? null : String(form.get("product_key") ?? "").trim().toUpperCase(),
        client_id: scope === "client" ? clean(form.get("client_id")) : null,
        activity_category: String(form.get("activity_category") ?? "support"),
        work_mode: String(form.get("work_mode") ?? "remote"),
        include_in_economics: form.get("include_in_economics") === "on",
        include_in_client_economics: form.get("include_in_client_economics") === "on",
        economic_treatment: String(form.get("economic_treatment") ?? "recurring"),
        note: clean(form.get("note")),
      };
      if (!payload.worker_id) throw new Error("Select a worker.");
      if (payload.duration_minutes <= 0) throw new Error("Duration must be above zero.");
      if (scope !== "company" && !payload.product_key) throw new Error("Product key is required for product and client work.");
      const response = selectedWorkLogId
        ? await getSeshatDataClient().from("unit_economics_work_logs").update(payload).eq("id", selectedWorkLogId)
        : await getSeshatDataClient().from("unit_economics_work_logs").insert(payload);
      if (response.error) throw response.error;
      event.currentTarget.reset();
      setSelectedWorkLogId(null);
      await refreshWithNotice(selectedWorkLogId ? "Work log updated." : "Work log saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save work log.");
    }
  }

  return (
    <div className="space-y-4">
      <Panel className="bg-[#2E2936]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Cost Intelligence</h1>
            <p className="text-sm text-slate-300">
              Manage modeled costs, allocations, observed usage, labor, and client economics without changing historical facts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative block min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search active view"
                className="w-full rounded-md border border-[#141119] bg-[#24202B] py-2 pl-9 pr-3 text-sm text-white"
              />
            </label>
            <Button type="button" variant="secondary" onClick={() => void load()} className="gap-2" disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
          </div>
        </div>
      </Panel>

      <nav className="grid gap-2 md:grid-cols-5">
        {views.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-md border border-[#141119] px-3 py-2 text-sm font-semibold transition",
                view === item.key ? "bg-[#120539] text-white ring-1 ring-[#7553FF]" : "bg-[#24202B] text-slate-300 hover:bg-[#2E2936]",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <Notice message={error} />
      <Notice message={notice} tone="success" />
      {loading ? <p className="text-sm text-slate-300">Loading {views.find((item) => item.key === view)?.label}...</p> : null}

      {view === "registry" ? (
        <RegistryView
          companyCosts={filteredCompanyCosts}
          productCosts={filteredProductCosts}
          expenses={state.expenses}
          clients={state.clients}
          reconciliation={state.reconciliation}
          selectedCompanyCost={selectedCompanyCost}
          selectedProductCost={selectedProductCost}
          selectedCost={selectedCost}
          onSelectCost={setSelectedCost}
          onCreateCost={createCost}
          onSaveMetadata={saveCostMetadata}
          onDeactivate={() => void deactivateSelectedCost()}
        />
      ) : null}

      {view === "allocations" ? (
        <AllocationsView
          companyCosts={state.companyCosts}
          allocations={state.allocations}
          summary={state.allocationSummary}
          selectedAllocationId={selectedAllocationId}
          selectedAllocation={selectedAllocation}
          onSelectAllocation={setSelectedAllocationId}
          onSaveAllocation={saveAllocation}
        />
      ) : null}

      {view === "actuals" ? (
        <ActualsView
          actuals={state.actuals}
          expenses={state.expenses}
          clients={state.clients}
          companyCosts={state.companyCosts}
          selectedActualId={selectedActualId}
          selectedActual={selectedActual}
          onSelectActual={setSelectedActualId}
          onSaveActual={saveActual}
          periodMonth={periodMonth}
          onPeriodMonth={setPeriodMonth}
        />
      ) : null}

      {view === "labor" ? (
        <LaborView
          workers={state.workers}
          laborRates={state.laborRates}
          workLogs={state.workLogs}
          clients={state.clients}
          selectedWorkLogId={selectedWorkLogId}
          selectedWorkLog={selectedWorkLog}
          onSelectWorkLog={setSelectedWorkLogId}
          onCreateWorker={createWorker}
          onCreateLaborRate={createLaborRate}
          onSaveWorkLog={saveWorkLog}
        />
      ) : null}

      {view === "economics" ? (
        <EconomicsView
          profiles={state.profiles}
          selectedProfile={selectedProfile}
          selectedProfileId={selectedProfileId}
          modeledClient={state.modeledClient}
          actualClient={state.actualClient}
          asOfDate={asOfDate}
          periodMonth={periodMonth}
          onAsOfDate={setAsOfDate}
          onPeriodMonth={setPeriodMonth}
          onProfile={setSelectedProfileId}
        />
      ) : null}
    </div>
  );
}

function RegistryView({
  companyCosts,
  productCosts,
  expenses,
  clients,
  reconciliation,
  selectedCompanyCost,
  selectedProductCost,
  selectedCost,
  onSelectCost,
  onCreateCost,
  onSaveMetadata,
  onDeactivate,
}: {
  companyCosts: CompanyCost[];
  productCosts: ProductCost[];
  expenses: Expense[];
  clients: Client[];
  reconciliation: ExpenseReconciliation[];
  selectedCompanyCost?: CompanyCost;
  selectedProductCost?: ProductCost;
  selectedCost: { kind: CostKind; id: string } | null;
  onSelectCost: (value: { kind: CostKind; id: string }) => void;
  onCreateCost: (event: FormEvent<HTMLFormElement>) => void;
  onSaveMetadata: (event: FormEvent<HTMLFormElement>) => void;
  onDeactivate: () => void;
}) {
  const selected = selectedCompanyCost ?? selectedProductCost;
  const unlinked = reconciliation.filter((item) => item.reconciliation_status === "unlinked");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-white">Company Costs</h2>
            <Badge tone={unlinked.length ? "warning" : "success"}>{unlinked.length} unlinked expenses</Badge>
          </div>
          <DataTable
            headers={["Name", "Vendor", "Layer", "Mode", "Amount", "Source", "State"]}
            rows={companyCosts.map((item) => ({
              key: item.id,
              selected: selectedCost?.kind === "company" && selectedCost.id === item.id,
              onClick: () => onSelectCost({ kind: "company", id: item.id }),
              cells: [
                <span key="name" className="font-medium text-white">{item.name}</span>,
                item.vendor ?? "-",
                item.layer,
                item.cost_mode,
                item.cost_mode === "usage"
                  ? `${formatFinancialAmount(item.unit_cost, { currency: item.currency })} / ${item.unit_label ?? "unit"}`
                  : formatFinancialAmount(item.amount, { currency: item.currency }),
                item.source_expense_id ? <Badge key="linked" tone="success">Linked</Badge> : <Badge key="open" tone="warning">Open</Badge>,
                item.is_active ? <Badge key="active" tone="success">Active</Badge> : <Badge key="inactive">Inactive</Badge>,
              ],
            }))}
            empty="No company costs."
          />
        </Panel>

        <Panel>
          <h2 className="mb-3 font-semibold text-white">Product and Client Direct Costs</h2>
          <DataTable
            headers={["Name", "Product", "Scope", "Client", "Amount", "Source", "State"]}
            rows={productCosts.map((item) => ({
              key: item.id,
              selected: selectedCost?.kind === "product" && selectedCost.id === item.id,
              onClick: () => onSelectCost({ kind: "product", id: item.id }),
              cells: [
                <span key="name" className="font-medium text-white">{item.name}</span>,
                item.product_key,
                item.scope.replaceAll("_", " "),
                item.client_id ? displayClient(clients.find((client) => client.id === item.client_id)) : "-",
                item.cost_mode === "usage"
                  ? `${formatFinancialAmount(item.unit_cost, { currency: item.currency })} / ${item.unit_label ?? "unit"}`
                  : formatFinancialAmount(item.amount, { currency: item.currency }),
                item.source_expense_id ? <Badge key="linked" tone="success">Linked</Badge> : <Badge key="open" tone="warning">Open</Badge>,
                item.is_active ? <Badge key="active" tone="success">Active</Badge> : <Badge key="inactive">Inactive</Badge>,
              ],
            }))}
            empty="No product or client costs."
          />
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4 text-violet-200" />
            <h2 className="font-semibold text-white">Create Cost or Version</h2>
          </div>
          <CostForm
            companyCosts={companyCosts}
            productCosts={productCosts}
            expenses={expenses}
            clients={clients}
            onSubmit={onCreateCost}
          />
        </Panel>

        <Panel>
          <h2 className="mb-3 font-semibold text-white">Details Pane</h2>
          {selected ? (
            <form key={`${selectedCost?.kind}:${selected.id}`} onSubmit={onSaveMetadata} className="space-y-3">
              <div className="rounded-md border border-[#141119] bg-[#2E2936] p-3 text-sm">
                <p className="font-semibold text-white">{selected.name}</p>
                <p className="mt-1 text-slate-300">
                  {selected.cost_mode === "usage"
                    ? `${formatFinancialAmount(selected.unit_cost, { currency: selected.currency })} / ${selected.unit_label ?? "unit"}`
                    : formatFinancialAmount(selected.amount, { currency: selected.currency })}
                </p>
                <p className="mt-1 text-xs text-slate-400">Use a new version for price changes; metadata edits do not rewrite historical prices.</p>
              </div>
              <Field label="End date">
                <TextInput type="date" name="end_date" defaultValue={selected.end_date ?? ""} />
              </Field>
              <Field label="Source Expense">
                <SelectInput name="source_expense_id" defaultValue={selected.source_expense_id ?? ""}>
                  <option value="">No source expense</option>
                  {expenses.map((expense) => (
                    <option key={expense.id} value={expense.id}>{linkedExpenseLabel(expense)}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Notes">
                <textarea name="notes" defaultValue={selected.notes ?? ""} className={cn(inputClass(), "min-h-20")} />
              </Field>
              <div className="grid gap-2">
                <Checkbox name="include_in_analysis" defaultChecked={selected.include_in_analysis} label="Include in analysis" />
                <Checkbox name="is_active" defaultChecked={selected.is_active} label="Active" />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Save Metadata</Button>
                <Button type="button" variant="danger" onClick={onDeactivate}>Deactivate</Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-300">Select a cost to inspect details, link an Expense, or deactivate it.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function CostForm({
  companyCosts,
  productCosts,
  expenses,
  clients,
  onSubmit,
}: {
  companyCosts: CompanyCost[];
  productCosts: ProductCost[];
  expenses: Expense[];
  clients: Client[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cost kind">
          <SelectInput name="kind" defaultValue="company">
            <option value="company">Company Cost</option>
            <option value="product">Product / Client Cost</option>
          </SelectInput>
        </Field>
        <Field label="Cost mode">
          <SelectInput name="cost_mode" defaultValue="fixed_amount">
            <option value="fixed_amount">Fixed amount</option>
            <option value="usage">Usage</option>
          </SelectInput>
        </Field>
      </div>
      <Field label="Name"><TextInput name="name" required /></Field>
      <Field label="Vendor"><TextInput name="vendor" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount"><TextInput name="amount" inputMode="decimal" placeholder="25.00" /></Field>
        <Field label="Currency"><TextInput name="currency" defaultValue="USD" maxLength={3} /></Field>
        <Field label="Unit cost"><TextInput name="unit_cost" inputMode="decimal" placeholder="0.00113850" /></Field>
        <Field label="Monthly quantity"><TextInput name="monthly_quantity" inputMode="decimal" /></Field>
        <Field label="Unit label"><TextInput name="unit_label" placeholder="request" /></Field>
        <Field label="Frequency">
          <SelectInput name="frequency" defaultValue="monthly">
            {frequencies.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </SelectInput>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Layer">
          <SelectInput name="layer">{layerOptions.map((item) => <option key={item} value={item}>{item}</option>)}</SelectInput>
        </Field>
        <Field label="Category">
          <SelectInput name="cost_type">{costTypes.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</SelectInput>
        </Field>
        <Field label="Scope">
          <SelectInput name="scope" defaultValue="shared_product">
            <option value="shared_product">Shared product</option>
            <option value="client_direct">Client direct</option>
          </SelectInput>
        </Field>
        <Field label="Product"><TextInput name="product_key" placeholder="ENTRY" /></Field>
        <Field label="Client">
          <SelectInput name="client_id" defaultValue="">
            <option value="">No client</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{displayClient(client)}</option>)}
          </SelectInput>
        </Field>
        <Field label="Evidence">
          <SelectInput name="evidence_level" defaultValue="estimated">
            {evidenceLevels.map((item) => <option key={item} value={item}>{item}</option>)}
          </SelectInput>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date"><TextInput type="date" name="start_date" defaultValue={localDateValue()} /></Field>
        <Field label="End date"><TextInput type="date" name="end_date" /></Field>
      </div>
      <Field label="Source Expense">
        <SelectInput name="source_expense_id" defaultValue="">
          <option value="">No source expense</option>
          {expenses.map((expense) => <option key={expense.id} value={expense.id}>{linkedExpenseLabel(expense)}</option>)}
        </SelectInput>
      </Field>
      <Field label="Supersedes existing cost">
        <SelectInput name="supersedes_id" defaultValue="">
          <option value="">New cost, not a version</option>
          <optgroup label="Company costs">
            {companyCosts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </optgroup>
          <optgroup label="Product costs">
            {productCosts.map((item) => <option key={item.id} value={item.id}>{item.name} / {item.product_key}</option>)}
          </optgroup>
        </SelectInput>
      </Field>
      <Field label="Notes"><textarea name="notes" className={cn(inputClass(), "min-h-20")} /></Field>
      <div className="grid gap-2">
        <Checkbox name="include_in_analysis" defaultChecked label="Include in analysis" />
        <Checkbox name="is_active" defaultChecked label="Active" />
        <Checkbox name="require_full_allocation" label="Require full allocation" />
      </div>
      <Button type="submit" className="w-full gap-2"><Plus className="h-4 w-4" /> Save Cost</Button>
    </form>
  );
}

function AllocationsView({
  companyCosts,
  allocations,
  summary,
  selectedAllocationId,
  selectedAllocation,
  onSelectAllocation,
  onSaveAllocation,
}: {
  companyCosts: CompanyCost[];
  allocations: Allocation[];
  summary: AllocationSummary[];
  selectedAllocationId: string | null;
  selectedAllocation?: Allocation;
  onSelectAllocation: (id: string | null) => void;
  onSaveAllocation: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <Panel>
          <h2 className="mb-3 font-semibold text-white">Allocation Summary</h2>
          <DataTable
            headers={["Cost", "Vendor", "Monthly", "Allocated", "Unallocated", "Status"]}
            rows={summary.map((item) => ({
              key: item.company_cost_id,
              cells: [
                <span key="name" className="font-medium text-white">{item.name}</span>,
                item.vendor ?? "-",
                formatFinancialAmount(item.source_monthly_amount, { currency: item.currency }),
                `${formatDecimalAmount(item.allocated_percent, 2)}%`,
                `${formatDecimalAmount(item.unallocated_percent, 2)}%`,
                <CompletenessBadge key="complete" complete={item.allocation_complete} />,
              ],
            }))}
            empty="No allocation summary."
          />
        </Panel>

        <Panel>
          <h2 className="mb-3 font-semibold text-white">Allocation Records</h2>
          <DataTable
            headers={["Company Cost", "Product", "Percent", "Start", "End", "State"]}
            rows={allocations.map((item) => ({
              key: item.id,
              selected: selectedAllocationId === item.id,
              onClick: () => onSelectAllocation(item.id),
              cells: [
                companyCosts.find((cost) => cost.id === item.company_cost_id)?.name ?? item.company_cost_id,
                item.product_key,
                `${formatDecimalAmount(item.allocation_percent, 2)}%`,
                item.start_date,
                item.end_date ?? "-",
                item.is_active ? <Badge key="active" tone="success">Active</Badge> : <Badge key="inactive">Inactive</Badge>,
              ],
            }))}
            empty="No allocations."
          />
        </Panel>
      </div>

      <Panel>
        <h2 className="mb-3 font-semibold text-white">{selectedAllocation ? "Edit Allocation" : "Create Allocation"}</h2>
        <form key={selectedAllocation?.id ?? "new-allocation"} onSubmit={onSaveAllocation} className="space-y-3">
          <Field label="Company cost">
            <SelectInput name="company_cost_id" defaultValue={selectedAllocation?.company_cost_id ?? ""}>
              <option value="">Select cost</option>
              {companyCosts.map((item) => (
                <option key={item.id} value={item.id}>{item.name} / {formatFinancialAmount(item.amount, { currency: item.currency })}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Product"><TextInput name="product_key" defaultValue={selectedAllocation?.product_key ?? "ENTRY"} /></Field>
          <Field label="Allocation percent"><TextInput name="allocation_percent" inputMode="decimal" defaultValue={selectedAllocation?.allocation_percent ?? ""} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date"><TextInput type="date" name="start_date" defaultValue={selectedAllocation?.start_date ?? localDateValue()} /></Field>
            <Field label="End date"><TextInput type="date" name="end_date" defaultValue={selectedAllocation?.end_date ?? ""} /></Field>
          </div>
          <Field label="Note"><textarea name="allocation_note" defaultValue={selectedAllocation?.allocation_note ?? ""} className={cn(inputClass(), "min-h-20")} /></Field>
          <Checkbox name="is_active" defaultChecked={selectedAllocation?.is_active ?? true} label="Active" />
          <div className="flex gap-2">
            <Button type="submit">{selectedAllocation ? "Update Allocation" : "Save Allocation"}</Button>
            {selectedAllocation ? <Button type="button" variant="ghost" onClick={() => onSelectAllocation(null)}>Clear</Button> : null}
          </div>
        </form>
      </Panel>
    </div>
  );
}

function ActualsView({
  actuals,
  expenses,
  clients,
  companyCosts,
  selectedActualId,
  selectedActual,
  onSelectActual,
  onSaveActual,
  periodMonth,
  onPeriodMonth,
}: {
  actuals: ActualObservation[];
  expenses: Expense[];
  clients: Client[];
  companyCosts: CompanyCost[];
  selectedActualId: string | null;
  selectedActual?: ActualObservation;
  onSelectActual: (id: string | null) => void;
  onSaveActual: (event: FormEvent<HTMLFormElement>) => void;
  periodMonth: string;
  onPeriodMonth: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-white">Actual Observations</h2>
          <Field label="Period filter">
            <TextInput type="month" value={periodMonth} onChange={(event) => onPeriodMonth(event.target.value)} />
          </Field>
        </div>
        <DataTable
          headers={["Period", "Scope", "Name", "Amount", "Quantity", "Treatment", "Source"]}
          rows={actuals.map((item) => ({
            key: item.id,
            selected: selectedActualId === item.id,
            onClick: () => onSelectActual(item.id),
            cells: [
              item.period_month,
              [item.destination_scope, item.product_key].filter(Boolean).join(" / "),
              <span key="name" className="font-medium text-white">{item.name}</span>,
              item.amount_known ? formatFinancialAmount(item.amount, { currency: item.currency }) : "Unknown",
              item.quantity == null ? "-" : `${formatDecimalAmount(item.quantity, 4)} ${item.unit_label ?? ""}`.trim(),
              item.economic_treatment,
              item.source_expense_id ? <Badge key="linked" tone="success">Linked</Badge> : <Badge key="open" tone="warning">Open</Badge>,
            ],
          }))}
          empty="No actual observations."
        />
      </Panel>

      <Panel>
        <h2 className="mb-3 font-semibold text-white">{selectedActual ? "Edit Observation" : "Create Observation"}</h2>
        <form key={selectedActual?.id ?? `new-observation-${periodMonth}`} onSubmit={onSaveActual} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Period"><TextInput type="month" name="period_month" defaultValue={(selectedActual?.period_month ?? dateMonth(periodMonth)).slice(0, 7)} /></Field>
            <Field label="Observed date"><TextInput type="date" name="observed_date" defaultValue={selectedActual?.observed_date ?? localDateValue()} /></Field>
          </div>
          <Field label="Name"><TextInput name="name" defaultValue={selectedActual?.name ?? ""} required /></Field>
          <Field label="Vendor"><TextInput name="vendor" defaultValue={selectedActual?.vendor ?? ""} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Scope">
              <SelectInput name="destination_scope" defaultValue={selectedActual?.destination_scope ?? "product"}>
                <option value="company">Company</option>
                <option value="product">Product</option>
                <option value="client">Client</option>
              </SelectInput>
            </Field>
            <Field label="Product"><TextInput name="product_key" defaultValue={selectedActual?.product_key ?? "ENTRY"} /></Field>
            <Field label="Client">
              <SelectInput name="client_id" defaultValue={selectedActual?.client_id ?? ""}>
                <option value="">No client</option>
                {clients.map((client) => <option key={client.id} value={client.id}>{displayClient(client)}</option>)}
              </SelectInput>
            </Field>
            <Field label="Company cost">
              <SelectInput name="company_cost_id" defaultValue={selectedActual?.company_cost_id ?? ""}>
                <option value="">No company cost</option>
                {companyCosts.map((cost) => <option key={cost.id} value={cost.id}>{cost.name}</option>)}
              </SelectInput>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Observation type">
              <SelectInput name="observation_type" defaultValue={selectedActual?.observation_type ?? "usage"}>
                {actualTypes.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
              </SelectInput>
            </Field>
            <Field label="Layer">
              <SelectInput name="layer" defaultValue={selectedActual?.layer ?? "technical"}>
                {layerOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectInput>
            </Field>
            <Field label="Amount"><TextInput name="amount" inputMode="decimal" defaultValue={selectedActual?.amount ?? ""} placeholder="0.00113850" /></Field>
            <Field label="Currency"><TextInput name="currency" defaultValue={selectedActual?.currency ?? "USD"} maxLength={3} /></Field>
            <Field label="Quantity"><TextInput name="quantity" inputMode="decimal" defaultValue={selectedActual?.quantity ?? ""} /></Field>
            <Field label="Unit"><TextInput name="unit_label" defaultValue={selectedActual?.unit_label ?? ""} /></Field>
          </div>
          <Field label="Source Expense">
            <SelectInput name="source_expense_id" defaultValue={selectedActual?.source_expense_id ?? ""}>
              <option value="">No source expense</option>
              {expenses.map((expense) => <option key={expense.id} value={expense.id}>{linkedExpenseLabel(expense)}</option>)}
            </SelectInput>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Evidence">
              <SelectInput name="evidence_level" defaultValue={selectedActual?.evidence_level ?? "verified"}>
                {evidenceLevels.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectInput>
            </Field>
            <Field label="Treatment">
              <SelectInput name="economic_treatment" defaultValue={selectedActual?.economic_treatment ?? "recurring"}>
                {treatments.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
              </SelectInput>
            </Field>
          </div>
          <Field label="Notes"><textarea name="notes" defaultValue={selectedActual?.notes ?? ""} className={cn(inputClass(), "min-h-20")} /></Field>
          <div className="grid gap-2">
            <Checkbox name="amount_known" defaultChecked={selectedActual?.amount_known ?? true} label="Amount is known" />
            <Checkbox name="include_in_economics" defaultChecked={selectedActual?.include_in_economics ?? true} label="Include in product economics" />
            <Checkbox name="include_in_client_economics" defaultChecked={selectedActual?.include_in_client_economics ?? true} label="Include in client economics" />
          </div>
          <div className="flex gap-2">
            <Button type="submit">{selectedActual ? "Update Observation" : "Save Observation"}</Button>
            {selectedActual ? <Button type="button" variant="ghost" onClick={() => onSelectActual(null)}>Clear</Button> : null}
          </div>
        </form>
      </Panel>
    </div>
  );
}

function LaborView({
  workers,
  laborRates,
  workLogs,
  clients,
  selectedWorkLogId,
  selectedWorkLog,
  onSelectWorkLog,
  onCreateWorker,
  onCreateLaborRate,
  onSaveWorkLog,
}: {
  workers: Worker[];
  laborRates: LaborRate[];
  workLogs: WorkLog[];
  clients: Client[];
  selectedWorkLogId: string | null;
  selectedWorkLog?: WorkLog;
  onSelectWorkLog: (id: string | null) => void;
  onCreateWorker: (event: FormEvent<HTMLFormElement>) => void;
  onCreateLaborRate: (event: FormEvent<HTMLFormElement>) => void;
  onSaveWorkLog: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-4">
        <Panel>
          <h2 className="mb-3 font-semibold text-white">Work Logs</h2>
          <DataTable
            headers={["Date", "Worker", "Scope", "Activity", "Hours", "Cost", "Treatment"]}
            rows={workLogs.map((item) => ({
              key: item.id,
              selected: selectedWorkLogId === item.id,
              onClick: () => onSelectWorkLog(item.id),
              cells: [
                item.work_date,
                item.worker_name ?? workers.find((worker) => worker.id === item.worker_id)?.name ?? item.worker_id,
                [item.destination_scope, item.product_key].filter(Boolean).join(" / "),
                item.activity_category.replaceAll("_", " "),
                formatDecimalAmount(item.duration_hours ?? item.duration_minutes / 60, 2),
                item.labor_rate_missing ? "Unknown" : formatFinancialAmount(item.source_labor_cost, { currency: item.labor_rate_currency }),
                item.economic_treatment,
              ],
            }))}
            empty="No work logs."
          />
        </Panel>

        <Panel>
          <h2 className="mb-3 font-semibold text-white">Workers and Rates</h2>
          <DataTable
            headers={["Worker", "Active", "Known rates"]}
            rows={workers.map((worker) => ({
              key: worker.id,
              cells: [
                <span key="name" className="font-medium text-white">{worker.name}</span>,
                worker.is_active ? <Badge key="active" tone="success">Active</Badge> : <Badge key="inactive">Inactive</Badge>,
                String(laborRates.filter((rate) => rate.worker_id === worker.id).length),
              ],
            }))}
            empty="No workers."
          />
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel>
          <h2 className="mb-3 font-semibold text-white">Register Work</h2>
          <form key={selectedWorkLog?.id ?? "new-work-log"} onSubmit={onSaveWorkLog} className="space-y-3">
            <Field label="Worker">
              <SelectInput name="worker_id" defaultValue={selectedWorkLog?.worker_id ?? ""}>
                <option value="">Select worker</option>
                {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
              </SelectInput>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date"><TextInput type="date" name="work_date" defaultValue={selectedWorkLog?.work_date ?? localDateValue()} /></Field>
              <Field label="Hours"><TextInput name="duration_hours" inputMode="decimal" defaultValue={selectedWorkLog ? numeric(selectedWorkLog.duration_minutes) / 60 : ""} placeholder="4" /></Field>
              <Field label="Scope">
                <SelectInput name="destination_scope" defaultValue={selectedWorkLog?.destination_scope ?? "client"}>
                  <option value="company">Company</option>
                  <option value="product">Product</option>
                  <option value="client">Client</option>
                </SelectInput>
              </Field>
              <Field label="Product"><TextInput name="product_key" defaultValue={selectedWorkLog?.product_key ?? "ENTRY"} /></Field>
              <Field label="Client">
                <SelectInput name="client_id" defaultValue={selectedWorkLog?.client_id ?? ""}>
                  <option value="">No client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{displayClient(client)}</option>)}
                </SelectInput>
              </Field>
              <Field label="Activity">
                <SelectInput name="activity_category" defaultValue={selectedWorkLog?.activity_category ?? "support"}>
                  {workCategories.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
                </SelectInput>
              </Field>
              <Field label="Mode">
                <SelectInput name="work_mode" defaultValue={selectedWorkLog?.work_mode ?? "remote"}>
                  <option value="remote">Remote</option>
                  <option value="onsite">Onsite</option>
                  <option value="unspecified">Unspecified</option>
                </SelectInput>
              </Field>
              <Field label="Treatment">
                <SelectInput name="economic_treatment" defaultValue={selectedWorkLog?.economic_treatment ?? "recurring"}>
                  {treatments.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
                </SelectInput>
              </Field>
            </div>
            <Field label="Evidence note"><textarea name="note" defaultValue={selectedWorkLog?.note ?? ""} className={cn(inputClass(), "min-h-20")} /></Field>
            <div className="grid gap-2">
              <Checkbox name="include_in_economics" defaultChecked={selectedWorkLog?.include_in_economics ?? true} label="Include in product economics" />
              <Checkbox name="include_in_client_economics" defaultChecked={selectedWorkLog?.include_in_client_economics ?? true} label="Include in client economics" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">{selectedWorkLog ? "Update Work Log" : "Save Work Log"}</Button>
              {selectedWorkLog ? <Button type="button" variant="ghost" onClick={() => onSelectWorkLog(null)}>Clear</Button> : null}
            </div>
          </form>
        </Panel>

        <Panel>
          <h2 className="mb-3 font-semibold text-white">Workers and Rates</h2>
          <form onSubmit={onCreateWorker} className="mb-4 grid gap-2">
            <Field label="New worker"><TextInput name="name" placeholder="Worker name" /></Field>
            <Field label="Notes"><TextInput name="notes" /></Field>
            <Checkbox name="is_active" defaultChecked label="Active" />
            <Button type="submit" variant="secondary">Create Worker</Button>
          </form>
          <form onSubmit={onCreateLaborRate} className="grid gap-2">
            <Field label="Worker">
              <SelectInput name="worker_id">
                <option value="">Select worker</option>
                {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
              </SelectInput>
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Hourly rate"><TextInput name="hourly_rate" inputMode="decimal" /></Field>
              <Field label="Currency"><TextInput name="currency" defaultValue="USD" maxLength={3} /></Field>
              <Field label="Start"><TextInput type="date" name="effective_start_date" defaultValue={localDateValue()} /></Field>
              <Field label="End"><TextInput type="date" name="effective_end_date" /></Field>
            </div>
            <Field label="Evidence">
              <SelectInput name="evidence_level" defaultValue="estimated">
                {evidenceLevels.map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectInput>
            </Field>
            <Button type="submit" variant="secondary">Add Labor Rate</Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

function EconomicsView({
  profiles,
  selectedProfile,
  selectedProfileId,
  modeledClient,
  actualClient,
  asOfDate,
  periodMonth,
  onAsOfDate,
  onPeriodMonth,
  onProfile,
}: {
  profiles: EconomicsProfile[];
  selectedProfile: EconomicsProfile | null;
  selectedProfileId: string;
  modeledClient: JsonRecord | null;
  actualClient: JsonRecord | null;
  asOfDate: string;
  periodMonth: string;
  onAsOfDate: (value: string) => void;
  onPeriodMonth: (value: string) => void;
  onProfile: (value: string) => void;
}) {
  const currency = String(modeledClient?.analysis_currency ?? actualClient?.analysis_currency ?? selectedProfile?.analysis_currency ?? "USD");
  const incompleteReason = String(modeledClient?.incomplete_reason || actualClient?.incomplete_reason || "");
  const modeledMetrics: Array<[string, ReactNode]> = [
    ["Product", selectedProfile?.product_key ?? "Unknown"],
    ["Contract source", String(modeledClient?.contract_source ?? "Unknown")],
    ["Shared product cost", formatFinancialAmount(scalarValue(modeledClient?.shared_product_monthly_cost), { currency })],
    ["Company allocated cost", formatFinancialAmount(scalarValue(modeledClient?.company_allocated_monthly_cost), { currency })],
    ["Direct marginal cost", formatFinancialAmount(scalarValue(modeledClient?.marginal_monthly_cost), { currency })],
    ["Fully allocated cost", formatFinancialAmount(scalarValue(modeledClient?.fully_loaded_monthly_cost), { currency })],
    ["Modeled result", formatFinancialAmount(scalarValue(modeledClient?.first_year_profit), { currency })],
  ];
  const observedMetrics: Array<[string, ReactNode]> = [
    ["Direct usage cost", formatFinancialAmount(scalarValue(actualClient?.direct_usage_cost), { currency })],
    ["Direct usage quantity", formatDecimalAmount(scalarValue(actualClient?.direct_usage_quantity), 4)],
    ["Support hours", formatDecimalAmount(scalarValue(actualClient?.support_labor_hours), 2)],
    ["Support labor cost", formatFinancialAmount(scalarValue(actualClient?.support_labor_cost), { currency })],
    ["Onboarding total", formatFinancialAmount(scalarValue(actualClient?.onboarding_total_cost), { currency })],
    ["Cost to serve", formatFinancialAmount(scalarValue(actualClient?.actual_total_cost), { currency })],
    ["Observed result", formatFinancialAmount(scalarValue(actualClient?.actual_profit), { currency })],
  ];

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <Field label="Client profile">
            <SelectInput value={selectedProfileId || selectedProfile?.id || ""} onChange={(event) => onProfile(event.target.value)}>
              {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profileLabel(profile)}</option>)}
            </SelectInput>
          </Field>
          <Field label="Modeled as-of"><TextInput type="date" value={asOfDate} onChange={(event) => onAsOfDate(event.target.value)} /></Field>
          <Field label="Actual period"><TextInput type="month" value={periodMonth} onChange={(event) => onPeriodMonth(event.target.value)} /></Field>
        </div>
      </Panel>

      {!selectedProfile ? (
        <Panel><p className="text-sm text-slate-300">No Unit Economics profiles are available.</p></Panel>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Panel>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Contracted Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatFinancialAmount(scalarValue(modeledClient?.monthly_contract_revenue), { currency })}</p>
              <p className="mt-1 text-xs text-slate-400">Modeled monthly contract value, not cash collected.</p>
            </Panel>
            <Panel>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Invoiced Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatFinancialAmount(scalarValue(actualClient?.actual_invoiced_revenue), { currency })}</p>
              <p className="mt-1 text-xs text-slate-400">{String(actualClient?.actual_invoice_count ?? 0)} invoice(s) in period.</p>
            </Panel>
            <Panel>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Collected Cash</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatFinancialAmount(scalarValue(actualClient?.actual_paid_cash), { currency })}</p>
              <p className="mt-1 text-xs text-slate-400">Cash received, separate from contracted revenue.</p>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-white">Modeled Economics</h2>
                <CompletenessBadge complete={Boolean(modeledClient?.economics_complete)} />
              </div>
              <DataTable
                headers={["Metric", "Value"]}
                rows={modeledMetrics.map(([label, value]) => ({
                  key: String(label),
                  cells: [label, String(value ?? "Unknown")],
                }))}
                empty="No modeled economics."
              />
            </Panel>

            <Panel>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-white">Observed Economics</h2>
                <CompletenessBadge complete={Boolean(actualClient?.economics_complete)} />
              </div>
              <DataTable
                headers={["Metric", "Value"]}
                rows={observedMetrics.map(([label, value]) => ({
                  key: String(label),
                  cells: [label, String(value ?? "Unknown")],
                }))}
                empty="No observed economics."
              />
            </Panel>
          </div>

          <Panel>
            <div className="flex items-start gap-3">
              {incompleteReason ? <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />}
              <div>
                <h2 className="font-semibold text-white">Information Limits</h2>
                <p className="mt-1 text-sm text-slate-300">
                  {incompleteReason || "No missing economics inputs reported for this selected profile and period."}
                </p>
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
