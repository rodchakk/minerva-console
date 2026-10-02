"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CircleGauge,
  CreditCard,
  FilePlus2,
  LogOut,
  Printer,
  RefreshCw,
  Save,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/supabase/utils";
import {
  expectedAutomaticInvoiceCount,
  type ClientServiceBillingCurrency,
} from "./billingPreview";
import {
  generateInvoice,
  getDueClientServiceOccurrences,
  getPaymentProofSignedUrl,
  recordPayment,
  runAutomaticBilling,
  seshatErrorMessage,
} from "./financialEngine";
import { getSeshatConfig, getSeshatDataClient, getSeshatSupabase } from "./supabase";
import type {
  AutomaticBillingRunResult,
  BusinessProfile,
  Client,
  ClientOperationalProfitSummary,
  ClientService,
  DueClientServiceOccurrence,
  ExpenseCategory,
  ExpenseFrequency,
  ExpenseWithCategory,
  InvoiceDetail,
  InvoiceStatus,
  InvoiceWithClient,
  MonthlyProfitSummary,
  Service,
  ServiceFrequency,
} from "./types";

type View =
  | "overview"
  | "clients"
  | "client-new"
  | "client-detail"
  | "client-edit"
  | "services"
  | "service-new"
  | "service-detail"
  | "expenses"
  | "expense-new"
  | "expense-detail"
  | "invoices"
  | "invoice-new"
  | "invoice-detail"
  | "billing"
  | "settings";

type LineItemDraft = {
  tempId: string;
  service_id: string;
  name: string;
  description: string;
  quantity: string;
  unit_price: string;
};

const nav = [
  ["Overview", "/seshat"],
  ["Clients", "/seshat/clients"],
  ["Services", "/seshat/services"],
  ["Expenses", "/seshat/expenses"],
  ["Invoices", "/seshat/invoices"],
  ["Automatic Billing", "/seshat/billing"],
  ["Settings", "/seshat/settings"],
] as const;

const statusFilters: Array<InvoiceStatus | "all"> = [
  "all",
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
];

const clientStatuses = ["lead", "active", "paused", "inactive", "archived"] as const;
const serviceFrequencies: ServiceFrequency[] = [
  "weekly",
  "monthly",
  "quarterly",
  "semiannual",
  "yearly",
  "one_time",
];
const expenseFrequencies: ExpenseFrequency[] = ["weekly", "monthly", "quarterly", "yearly", "one_time"];

function parseView(pathname: string): { view: View; id: string | null } {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "seshat" || parts.length === 1) return { view: "overview", id: null };
  if (parts[1] === "clients") {
    if (parts[2] === "new") return { view: "client-new", id: null };
    if (parts[2] && parts[3] === "edit") return { view: "client-edit", id: parts[2] };
    if (parts[2]) return { view: "client-detail", id: parts[2] };
    return { view: "clients", id: null };
  }
  if (parts[1] === "services") {
    if (parts[2] === "new") return { view: "service-new", id: null };
    if (parts[2]) return { view: "service-detail", id: parts[2] };
    return { view: "services", id: null };
  }
  if (parts[1] === "expenses") {
    if (parts[2] === "new") return { view: "expense-new", id: null };
    if (parts[2]) return { view: "expense-detail", id: parts[2] };
    return { view: "expenses", id: null };
  }
  if (parts[1] === "invoices") {
    if (parts[2] === "new") return { view: "invoice-new", id: null };
    if (parts[2]) return { view: "invoice-detail", id: parts[2] };
    return { view: "invoices", id: null };
  }
  if (parts[1] === "billing") return { view: "billing", id: null };
  if (parts[1] === "settings") return { view: "settings", id: null };
  return { view: "overview", id: null };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysOut(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function money(value: number | null | undefined, currency = "USD") {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function numberFrom(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rowId(data: unknown) {
  if (data && typeof data === "object" && "id" in data && typeof data.id === "string") {
    return data.id;
  }
  throw new Error("Seshat saved the record, but did not return an id.");
}

function statusTone(status: InvoiceStatus) {
  if (status === "paid") return "success";
  if (status === "overdue") return "danger";
  if (status === "sent") return "warning";
  if (status === "cancelled") return "default";
  return "info";
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-white/[0.10] bg-[#10151b] p-4", className)}>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  as = "input",
  min,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  as?: "input" | "textarea";
  min?: number | string;
  step?: number | string;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      {as === "textarea" ? (
        <textarea
          name={name}
          defaultValue={defaultValue ?? ""}
          required={required}
          rows={3}
          className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white outline-none focus:border-violet-300/60"
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue ?? ""}
          required={required}
          min={min}
          step={step}
          className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white outline-none focus:border-violet-300/60"
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-md border border-white/[0.12] bg-[#151b22] px-3 py-2 text-white outline-none focus:border-violet-300/60"
      >
        {children}
      </select>
    </label>
  );
}

function Alert({ message, tone = "danger" }: { message: string | null; tone?: "danger" | "success" | "warning" }) {
  if (!message) return null;
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "success"
          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
          : tone === "warning"
            ? "border-amber-400/25 bg-amber-400/10 text-amber-100"
            : "border-rose-400/25 bg-rose-400/10 text-rose-100",
      )}
    >
      {message}
    </div>
  );
}

function AuthGate({ onSession }: { onSession: (session: Session) => void }) {
  const { configured } = getSeshatConfig();
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    getSeshatSupabase().auth.getSession().then(({ data }) => {
      if (data.session) onSession(data.session);
      setLoading(false);
    });
  }, [configured, onSession]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setLoading(true);
    const { data, error: signInError } = await getSeshatSupabase().auth.signInWithPassword({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setLoading(false);
    if (signInError || !data.session) {
      setError(signInError?.message ?? "Could not connect to Seshat.");
      return;
    }
    onSession(data.session);
  }

  if (!configured) {
    return (
      <Card>
        <h1 className="text-2xl font-semibold text-white">Connect Seshat</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
          This Preview needs `NEXT_PUBLIC_SESHAT_SUPABASE_URL` and
          `NEXT_PUBLIC_SESHAT_SUPABASE_ANON_KEY` configured before Seshat can connect.
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-violet-300/25 bg-violet-400/10 text-violet-200">
            <CircleGauge className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-white">Connect Seshat</h1>
            <p className="text-sm text-[var(--text-muted)]">Sign in to the separate Seshat Supabase project.</p>
          </div>
        </div>
        <form onSubmit={signIn} className="mt-5 space-y-4">
          <Field label="Email" name="email" type="email" required />
          <Field label="Password" name="password" type="password" required />
          <Alert message={error} />
          <Button disabled={loading}>{loading ? "Connecting..." : "Connect"}</Button>
        </form>
      </Card>
    </div>
  );
}

export function SeshatWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const { view, id } = parseView(pathname);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clientServices, setClientServices] = useState<ClientService[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyProfitSummary | null>(null);
  const [clientProfit, setClientProfit] = useState<ClientOperationalProfitSummary | null>(null);
  const [dueItems, setDueItems] = useState<DueClientServiceOccurrence[]>([]);
  const [billingResult, setBillingResult] = useState<AutomaticBillingRunResult | null>(null);
  const [billingCurrencies, setBillingCurrencies] = useState<ClientServiceBillingCurrency[]>([]);
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceStatus | "all">("all");

  const currentClient = clients.find((client) => client.id === id) ?? null;
  const currentService = services.find((service) => service.id === id) ?? null;
  const currentExpense = expenses.find((expense) => expense.id === id) ?? null;

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = getSeshatDataClient();
      const [
        clientsRes,
        servicesRes,
        invoicesRes,
        expensesRes,
        categoriesRes,
        profileRes,
        monthlyRes,
        billingCurrenciesRes,
      ] = await Promise.all([
        supabase.from("clients").select("*").order("name", { ascending: true }),
        supabase.from("services").select("*").order("name", { ascending: true }),
        supabase.from("invoices").select("*, clients(name, company_name, email)").order("issue_date", { ascending: false }).limit(100),
        supabase.from("expenses").select("*, expense_categories(name, color)").order("created_at", { ascending: false }).limit(100),
        supabase.from("expense_categories").select("*").order("name", { ascending: true }),
        supabase.from("business_profiles").select("*").maybeSingle(),
        supabase.from("monthly_profit_summary").select("*").order("month", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("client_services").select("id, agreed_currency"),
      ]);

      for (const result of [clientsRes, servicesRes, invoicesRes, expensesRes, categoriesRes, profileRes, monthlyRes, billingCurrenciesRes]) {
        if (result.error) throw result.error;
      }

      setClients((clientsRes.data as Client[]) ?? []);
      setServices((servicesRes.data as Service[]) ?? []);
      setInvoices((invoicesRes.data as InvoiceWithClient[]) ?? []);
      setExpenses((expensesRes.data as ExpenseWithCategory[]) ?? []);
      setCategories((categoriesRes.data as ExpenseCategory[]) ?? []);
      setProfile((profileRes.data as BusinessProfile | null) ?? null);
      setMonthlySummary((monthlyRes.data as MonthlyProfitSummary | null) ?? null);
      setBillingCurrencies((billingCurrenciesRes.data as ClientServiceBillingCurrency[]) ?? []);

      if (view === "billing" || view === "overview") {
        setDueItems(await getDueClientServiceOccurrences());
      }
    } catch (loadError) {
      setError(seshatErrorMessage(loadError, "Could not load Seshat data."));
    } finally {
      setLoading(false);
    }
  }, [session, view]);

  const loadDetail = useCallback(async () => {
    if (!session || !id) return;
    const supabase = getSeshatDataClient();
    try {
      if (view === "invoice-detail") {
        const { data, error: detailError } = await supabase
          .from("invoices")
          .select("*, clients(name, company_name, email), invoice_items(*), payments(*)")
          .eq("id", id)
          .single();
        if (detailError) throw detailError;
        setInvoice(data as InvoiceDetail);
      }
      if (view === "client-detail" || view === "client-edit") {
        const [servicesRes, profitRes] = await Promise.all([
          supabase
            .from("client_services")
            .select("*")
            .eq("client_id", id)
            .order("is_active", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase.from("client_operational_profit_summary").select("*").eq("client_id", id).maybeSingle(),
        ]);
        if (servicesRes.error) throw servicesRes.error;
        if (profitRes.error) throw profitRes.error;
        setClientServices((servicesRes.data as ClientService[]) ?? []);
        setClientProfit((profitRes.data as ClientOperationalProfitSummary | null) ?? null);
      }
    } catch (detailError) {
      setError(seshatErrorMessage(detailError, "Could not load this Seshat record."));
    }
  }, [id, session, view]);

  useEffect(() => {
    if (!session) return;
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load, session]);

  useEffect(() => {
    if (!session) return;
    const handle = window.setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadDetail, session]);

  async function disconnect() {
    await getSeshatSupabase().auth.signOut();
    setSession(null);
  }

  async function submitClient(event: FormEvent<HTMLFormElement>, clientId?: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const payload = {
        name: String(form.get("name") ?? "").trim(),
        company_name: clean(form.get("company_name")),
        contact_name: clean(form.get("contact_name")),
        email: clean(form.get("email")),
        phone: clean(form.get("phone")),
        mobile: clean(form.get("mobile")),
        website: clean(form.get("website")),
        address_line1: clean(form.get("address_line1")),
        address_line2: clean(form.get("address_line2")),
        city: clean(form.get("city")),
        state: clean(form.get("state")),
        postal_code: clean(form.get("postal_code")),
        country: String(clean(form.get("country")) ?? "Honduras"),
        status: String(form.get("status") ?? "active"),
        notes: clean(form.get("notes")),
      };
      if (!payload.name) throw new Error("Client name is required.");
      const supabase = getSeshatDataClient();
      if (clientId) {
        const { error: updateError } = await supabase.from("clients").update(payload).eq("id", clientId);
        if (updateError) throw updateError;
        setNotice("Client updated.");
        router.push(`/seshat/clients/${clientId}`);
      } else {
        const { data: userData } = await getSeshatSupabase().auth.getUser();
        const { data, error: insertError } = await supabase
          .from("clients")
          .insert({ ...payload, owner_id: userData.user?.id })
          .select("id")
          .single();
        if (insertError) throw insertError;
        router.push(`/seshat/clients/${rowId(data)}`);
      }
      await load();
    } catch (submitError) {
      setError(seshatErrorMessage(submitError, "Could not save client."));
    }
  }

  async function submitService(event: FormEvent<HTMLFormElement>, serviceId?: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const payload = {
        name: String(form.get("name") ?? "").trim(),
        description: clean(form.get("description")),
        default_price: numberFrom(form.get("default_price")),
        default_quantity: numberFrom(form.get("default_quantity"), 1),
        category: clean(form.get("category")),
        is_active: form.get("is_active") === "on",
      };
      if (!payload.name) throw new Error("Service name is required.");
      const supabase = getSeshatDataClient();
      if (serviceId) {
        const { error: updateError } = await supabase.from("services").update(payload).eq("id", serviceId);
        if (updateError) throw updateError;
        setNotice("Service updated.");
      } else {
        const { data: userData } = await getSeshatSupabase().auth.getUser();
        const { data, error: insertError } = await supabase
          .from("services")
          .insert({ ...payload, owner_id: userData.user?.id })
          .select("id")
          .single();
        if (insertError) throw insertError;
        router.push(`/seshat/services/${rowId(data)}`);
      }
      await load();
    } catch (submitError) {
      setError(seshatErrorMessage(submitError, "Could not save service."));
    }
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>, expenseId?: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const payload = {
        category_id: clean(form.get("category_id")),
        client_id: clean(form.get("client_id")),
        name: String(form.get("name") ?? "").trim(),
        vendor: clean(form.get("vendor")),
        amount: numberFrom(form.get("amount")),
        currency: String(clean(form.get("currency")) ?? "USD").toUpperCase(),
        frequency: String(form.get("frequency") ?? "monthly"),
        start_date: String(clean(form.get("start_date")) ?? today()),
        end_date: clean(form.get("end_date")),
        is_active: form.get("is_active") === "on",
        notes: clean(form.get("notes")),
        receipt_url: clean(form.get("receipt_url")),
      };
      if (!payload.name) throw new Error("Expense name is required.");
      const supabase = getSeshatDataClient();
      if (expenseId) {
        const { error: updateError } = await supabase.from("expenses").update(payload).eq("id", expenseId);
        if (updateError) throw updateError;
        setNotice("Expense updated.");
      } else {
        const { data: userData } = await getSeshatSupabase().auth.getUser();
        const { data, error: insertError } = await supabase
          .from("expenses")
          .insert({ ...payload, owner_id: userData.user?.id })
          .select("id")
          .single();
        if (insertError) throw insertError;
        router.push(`/seshat/expenses/${rowId(data)}`);
      }
      await load();
    } catch (submitError) {
      setError(seshatErrorMessage(submitError, "Could not save expense."));
    }
  }

  async function submitClientService(event: FormEvent<HTMLFormElement>, clientServiceId?: string) {
    event.preventDefault();
    if (!id) return;
    const form = new FormData(event.currentTarget);
    try {
      const payload = {
        client_id: id,
        service_id: clean(form.get("service_id")),
        name: String(form.get("name") ?? "").trim(),
        description: clean(form.get("description")),
        quantity: numberFrom(form.get("quantity"), 1),
        price: numberFrom(form.get("price")),
        frequency: String(form.get("frequency") ?? "monthly"),
        start_date: String(clean(form.get("start_date")) ?? today()),
        end_date: clean(form.get("end_date")),
        is_active: form.get("is_active") === "on",
        auto_invoice: form.get("auto_invoice") === "on",
        auto_invoice_start_date: clean(form.get("auto_invoice_start_date")),
        notes: clean(form.get("notes")),
      };
      if (!payload.name) throw new Error("Client service name is required.");
      const supabase = getSeshatDataClient();
      const response = clientServiceId
        ? await supabase.from("client_services").update(payload).eq("id", clientServiceId)
        : await supabase.from("client_services").insert(payload);
      if (response.error) throw response.error;
      setNotice(clientServiceId ? "Client service updated." : "Client service added.");
      await loadDetail();
    } catch (submitError) {
      setError(seshatErrorMessage(submitError, "Could not save client service."));
    }
  }

  async function submitInvoice(event: FormEvent<HTMLFormElement>, items: LineItemDraft[]) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const validItems = items
        .filter((item) => item.name.trim())
        .map((item, idx) => ({
          service_id: item.service_id || null,
          name: item.name,
          description: item.description || null,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          sort_order: idx,
        }));

      if (!clean(form.get("client_id"))) throw new Error("Select a client.");
      if (validItems.length === 0) throw new Error("Add at least one line item.");
      if (validItems.some((item) => !item.name || item.quantity <= 0 || item.unit_price < 0)) {
        throw new Error("Line items need a name, quantity above zero, and unit price of zero or more.");
      }

      const result = await generateInvoice({
        client_id: clean(form.get("client_id")),
        status: form.get("status") === "sent" ? "sent" : "draft",
        issue_date: clean(form.get("issue_date")),
        due_date: clean(form.get("due_date")),
        currency: String(clean(form.get("currency")) ?? "USD").toUpperCase(),
        notes: clean(form.get("notes")),
        internal_notes: clean(form.get("internal_notes")),
        items: validItems,
      });
      router.push(`/seshat/invoices/${result.invoice_id}`);
    } catch (submitError) {
      setError(seshatErrorMessage(submitError, "Could not create invoice."));
    }
  }

  async function updateInvoiceStatus(invoiceId: string, status: InvoiceStatus) {
    try {
      const { error: updateError } = await getSeshatDataClient().from("invoices").update({ status }).eq("id", invoiceId);
      if (updateError) throw updateError;
      await load();
      await loadDetail();
    } catch (updateError) {
      setError(seshatErrorMessage(updateError, "Could not update invoice."));
    }
  }

  async function deleteDraftInvoice(invoiceId: string) {
    try {
      const { error: deleteError } = await getSeshatDataClient().from("invoices").delete().eq("id", invoiceId);
      if (deleteError) throw deleteError;
      router.push("/seshat/invoices");
      await load();
    } catch (deleteError) {
      setError(seshatErrorMessage(deleteError, "Could not delete invoice."));
    }
  }

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoice) return;
    const paymentForm = event.currentTarget;
    const form = new FormData(paymentForm);
    setError(null);
    setNotice(null);
    setWarning(null);
    let result: Awaited<ReturnType<typeof recordPayment>>;
    try {
      result = await recordPayment({
        invoice_id: invoice.id,
        amount: numberFrom(form.get("amount")),
        payment_date: clean(form.get("payment_date")),
        payment_method: clean(form.get("payment_method")),
        reference: clean(form.get("reference")),
        notes: clean(form.get("notes")),
      });
    } catch (paymentError) {
      setError(seshatErrorMessage(paymentError, "Could not record payment."));
      return;
    }

    const proof = form.get("proof");
    if (proof instanceof File && proof.size > 0) {
      try {
        const ext = proof.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${session?.user.id}/${invoice.id}/${result.payment_id}/proof-${Date.now()}.${ext}`;
        const { error: uploadError } = await getSeshatSupabase()
          .storage
          .from("payment-proofs")
          .upload(path, proof, { contentType: proof.type || "application/octet-stream", upsert: false });
        if (uploadError) throw uploadError;
        const { error: updateProofError } = await getSeshatDataClient()
          .from("payments")
          .update({ proof_path: path })
          .eq("id", result.payment_id);
        if (updateProofError) throw updateProofError;
      } catch {
        setWarning("The payment was recorded, but proof attachment failed. You can retry proof attachment later.");
      }
    }

    setNotice("Payment recorded.");
    paymentForm.reset();
    await load();
    await loadDetail();
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = {
        business_name: String(clean(form.get("business_name")) ?? "My Business"),
        owner_name: clean(form.get("owner_name")),
        email: clean(form.get("email")),
        phone: clean(form.get("phone")),
        website: clean(form.get("website")),
        default_currency: String(clean(form.get("default_currency")) ?? "USD").toUpperCase(),
        default_payment_terms_days: numberFrom(form.get("default_payment_terms_days"), 15),
        invoice_prefix: String(clean(form.get("invoice_prefix")) ?? "INV"),
        invoice_footer: clean(form.get("invoice_footer")),
        invoice_accent_color: clean(form.get("invoice_accent_color")),
      };
      const supabase = getSeshatDataClient();
      if (profile) {
        const { error: updateError } = await supabase.from("business_profiles").update(payload).eq("id", profile.id);
        if (updateError) throw updateError;
      } else {
        const { data: userData } = await getSeshatSupabase().auth.getUser();
        const { error: insertError } = await supabase
          .from("business_profiles")
          .insert({ ...payload, owner_id: userData.user?.id });
        if (insertError) throw insertError;
      }
      setNotice("Business profile saved.");
      await load();
    } catch (profileError) {
      setError(seshatErrorMessage(profileError, "Could not save business profile."));
    }
  }

  if (!session) return <AuthGate onSession={setSession} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-lg border border-white/[0.10] bg-[#10151b] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-violet-300/25 bg-violet-400/10 text-violet-200">
              <CircleGauge className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold text-white">Seshat</h1>
              <p className="text-sm text-[var(--text-muted)]">Operational finance workspace using the existing Seshat backend.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => void load()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button type="button" variant="ghost" onClick={() => void disconnect()} className="gap-2">
            <LogOut className="h-4 w-4" /> Disconnect
          </Button>
        </div>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b border-white/[0.10] pb-2">
        {nav.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.05] hover:text-white",
              (href === "/seshat" ? pathname === href : pathname.startsWith(href)) && "bg-white/[0.08] text-white",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <Alert message={error} />
      <Alert message={notice} tone="success" />
      <Alert message={warning} tone="warning" />
      {loading ? <p className="text-sm text-[var(--text-muted)]">Loading...</p> : null}

      {view === "overview" ? (
        <Overview
          profile={profile}
          monthlySummary={monthlySummary}
          dueItems={dueItems}
          invoices={invoices}
          clients={clients}
          expenses={expenses}
        />
      ) : null}
      {view === "clients" ? <Clients clients={clients} /> : null}
      {view === "client-new" ? <ClientForm onSubmit={submitClient} /> : null}
      {view === "client-edit" && currentClient ? <ClientForm client={currentClient} onSubmit={(event) => submitClient(event, currentClient.id)} /> : null}
      {view === "client-detail" && currentClient ? (
        <ClientDetail
          client={currentClient}
          clientServices={clientServices}
          services={services}
          invoices={invoices.filter((item) => item.client_id === currentClient.id)}
          profit={clientProfit}
          onClientServiceSubmit={submitClientService}
        />
      ) : null}
      {view === "services" ? <Services services={services} /> : null}
      {view === "service-new" ? <ServiceForm onSubmit={submitService} /> : null}
      {view === "service-detail" && currentService ? <ServiceForm service={currentService} onSubmit={(event) => submitService(event, currentService.id)} /> : null}
      {view === "expenses" ? <Expenses expenses={expenses} /> : null}
      {view === "expense-new" ? <ExpenseForm clients={clients} categories={categories} onSubmit={submitExpense} /> : null}
      {view === "expense-detail" && currentExpense ? (
        <ExpenseForm expense={currentExpense} clients={clients} categories={categories} onSubmit={(event) => submitExpense(event, currentExpense.id)} />
      ) : null}
      {view === "invoices" ? (
        <Invoices invoices={invoices} filter={invoiceFilter} onFilter={setInvoiceFilter} />
      ) : null}
      {view === "invoice-new" ? (
        <InvoiceForm clients={clients} services={services} profile={profile} onSubmit={submitInvoice} />
      ) : null}
      {view === "invoice-detail" && invoice ? (
        <InvoiceDetail
          invoice={invoice}
          profile={profile}
          onPayment={submitPayment}
          onStatus={updateInvoiceStatus}
          onDelete={deleteDraftInvoice}
        />
      ) : null}
      {view === "billing" ? (
        <Billing
          dueItems={dueItems}
          billingCurrencies={billingCurrencies}
          defaultCurrency={profile?.default_currency}
          result={billingResult}
          onPreview={async (asOfDate) => setDueItems(await getDueClientServiceOccurrences(asOfDate))}
          onRun={async (asOfDate) => {
            if (!window.confirm("Generate invoices for due automatic billing items?")) return;
            const result = await runAutomaticBilling(asOfDate);
            setBillingResult(result);
            setDueItems(await getDueClientServiceOccurrences(asOfDate));
            await load();
          }}
        />
      ) : null}
      {view === "settings" ? <Settings profile={profile} onSubmit={saveProfile} /> : null}
    </div>
  );
}

function Overview({
  profile,
  monthlySummary,
  dueItems,
  invoices,
  clients,
  expenses,
}: {
  profile: BusinessProfile | null;
  monthlySummary: MonthlyProfitSummary | null;
  dueItems: DueClientServiceOccurrence[];
  invoices: InvoiceWithClient[];
  clients: Client[];
  expenses: ExpenseWithCategory[];
}) {
  const currency = profile?.default_currency ?? "USD";
  const invoicedThisMonth = monthlySummary?.invoiced_total ?? 0;
  const paidThisMonth = monthlySummary?.paid_total ?? 0;
  const costs = monthlySummary?.estimated_expenses ?? expenses.reduce((sum, item) => sum + (item.monthly_amount ?? 0), 0);
  const profit = monthlySummary?.estimated_profit ?? paidThisMonth - costs;
  const margin = monthlySummary?.profit_margin_percent ?? (paidThisMonth > 0 ? (profit / paidThisMonth) * 100 : 0);
  const knownRevenue = invoices.filter((item) => item.status !== "cancelled").reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Known revenue" value={money(knownRevenue, currency)} />
        <Metric label="Known monthly costs" value={money(costs, currency)} />
        <Metric label="Known monthly profit" value={money(profit, currency)} />
        <Metric label="Margin" value={`${margin.toFixed(1)}%`} />
        <Metric label="Collected this month" value={money(paidThisMonth, currency)} />
        <Metric label="Invoiced this month" value={money(invoicedThisMonth, currency)} />
        <Metric label="Due billing items" value={String(dueItems.length)} />
        <Metric label="Active clients" value={String(clients.filter((client) => client.status === "active").length)} />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2">
          <Link href="/seshat/invoices/new"><Button className="gap-2"><FilePlus2 className="h-4 w-4" /> New Invoice</Button></Link>
          <Link href="/seshat/clients"><Button variant="secondary">Clients</Button></Link>
          <Link href="/seshat/billing"><Button variant="secondary">Automatic Billing</Button></Link>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </Card>
  );
}

function Clients({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState("");
  const filtered = clients.filter((client) =>
    `${client.name} ${client.company_name ?? ""} ${client.email ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Card>
      <ListHeader title="Clients" href="/seshat/clients/new" action="New Client" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search clients..."
        className="mb-3 w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-sm text-white"
      />
      <Table
        headers={["Name", "Contact", "Status", "Billing"]}
        rows={filtered.map((client) => ({
          key: client.id,
          href: `/seshat/clients/${client.id}`,
          cells: [
            <strong key="name">{client.name}</strong>,
            client.email ?? client.phone ?? "—",
            <Badge key="status">{client.status}</Badge>,
            [client.city, client.country].filter(Boolean).join(", ") || "—",
          ],
        }))}
        empty="No clients yet."
      />
    </Card>
  );
}

function ClientForm({ client, onSubmit }: { client?: Client; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Card>
      <Back href={client ? `/seshat/clients/${client.id}` : "/seshat/clients"} />
      <h2 className="mb-4 text-xl font-semibold text-white">{client ? "Edit Client" : "New Client"}</h2>
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <Field label="Name" name="name" defaultValue={client?.name} required />
        <Field label="Company" name="company_name" defaultValue={client?.company_name} />
        <Field label="Contact name" name="contact_name" defaultValue={client?.contact_name} />
        <Field label="Email" name="email" type="email" defaultValue={client?.email} />
        <Field label="Phone" name="phone" defaultValue={client?.phone} />
        <Field label="Mobile" name="mobile" defaultValue={client?.mobile} />
        <Field label="Website" name="website" defaultValue={client?.website} />
        <SelectField label="Status" name="status" defaultValue={client?.status ?? "active"}>
          {clientStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </SelectField>
        <Field label="Address line 1" name="address_line1" defaultValue={client?.address_line1} />
        <Field label="Address line 2" name="address_line2" defaultValue={client?.address_line2} />
        <Field label="City" name="city" defaultValue={client?.city} />
        <Field label="State" name="state" defaultValue={client?.state} />
        <Field label="Postal code" name="postal_code" defaultValue={client?.postal_code} />
        <Field label="Country" name="country" defaultValue={client?.country ?? "Honduras"} />
        <div className="md:col-span-2"><Field label="Notes" name="notes" as="textarea" defaultValue={client?.notes} /></div>
        <div className="md:col-span-2"><Button className="gap-2"><Save className="h-4 w-4" /> Save Client</Button></div>
      </form>
    </Card>
  );
}

function ClientDetail({
  client,
  clientServices,
  services,
  invoices,
  profit,
  onClientServiceSubmit,
}: {
  client: Client;
  clientServices: ClientService[];
  services: Service[];
  invoices: InvoiceWithClient[];
  profit: ClientOperationalProfitSummary | null;
  onClientServiceSubmit: (event: FormEvent<HTMLFormElement>, id?: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <Back href="/seshat/clients" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">{client.name}</h2>
            <p className="text-sm text-[var(--text-muted)]">{client.company_name ?? client.email ?? "No company/contact email"}</p>
          </div>
          <Link href={`/seshat/clients/${client.id}/edit`}><Button variant="secondary">Edit</Button></Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Active monthly revenue" value={money(profit?.active_monthly_revenue ?? 0)} />
          <Metric label="Allocated expenses" value={money(profit?.allocated_monthly_expenses ?? 0)} />
          <Metric label="Estimated margin" value={`${(profit?.estimated_margin_percent ?? 0).toFixed(1)}%`} />
        </div>
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold text-white">Client Services</h3>
        <ClientServiceForm services={services} onSubmit={(event) => onClientServiceSubmit(event)} />
        <div className="mt-4 divide-y divide-white/[0.08]">
          {clientServices.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No client services yet.</p> : null}
          {clientServices.map((item) => (
            <details key={item.id} className="py-3">
              <summary className="cursor-pointer text-sm font-semibold text-white">
                {item.name} · {money(item.price * item.quantity)} · {item.frequency}
              </summary>
              <ClientServiceForm clientService={item} services={services} onSubmit={(event) => onClientServiceSubmit(event, item.id)} />
            </details>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold text-white">Invoice History</h3>
        <InvoiceTable invoices={invoices} />
      </Card>
    </div>
  );
}

function ClientServiceForm({
  clientService,
  services,
  onSubmit,
}: {
  clientService?: ClientService;
  services: Service[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-3 rounded-md border border-white/[0.08] bg-white/[0.025] p-3 md:grid-cols-4">
      <SelectField label="Catalog service" name="service_id" defaultValue={clientService?.service_id}>
        <option value="">Manual</option>
        {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
      </SelectField>
      <Field label="Name" name="name" defaultValue={clientService?.name} required />
      <Field label="Price" name="price" type="number" min={0} step="0.01" defaultValue={clientService?.price ?? 0} />
      <Field label="Quantity" name="quantity" type="number" min="0.01" step="0.01" defaultValue={clientService?.quantity ?? 1} />
      <SelectField label="Frequency" name="frequency" defaultValue={clientService?.frequency ?? "monthly"}>
        {serviceFrequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}
      </SelectField>
      <Field label="Start date" name="start_date" type="date" defaultValue={clientService?.start_date ?? today()} />
      <Field label="End date" name="end_date" type="date" defaultValue={clientService?.end_date} />
      <Field label="Auto invoice start" name="auto_invoice_start_date" type="date" defaultValue={clientService?.auto_invoice_start_date} />
      <div className="md:col-span-2"><Field label="Description" name="description" defaultValue={clientService?.description} /></div>
      <div className="md:col-span-2"><Field label="Notes" name="notes" defaultValue={clientService?.notes} /></div>
      <label className="flex items-center gap-2 text-sm text-slate-200"><input name="is_active" type="checkbox" defaultChecked={clientService?.is_active ?? true} /> Active</label>
      <label className="flex items-center gap-2 text-sm text-slate-200"><input name="auto_invoice" type="checkbox" defaultChecked={clientService?.auto_invoice ?? false} /> Auto Invoice</label>
      <div className="md:col-span-2"><Button variant="secondary">{clientService ? "Update Service Schedule" : "Add Service Schedule"}</Button></div>
    </form>
  );
}

function Services({ services }: { services: Service[] }) {
  return (
    <Card>
      <ListHeader title="Services" href="/seshat/services/new" action="New Service" />
      <Table
        headers={["Name", "Category", "Default price", "State"]}
        rows={services.map((service) => ({
          key: service.id,
          href: `/seshat/services/${service.id}`,
          cells: [service.name, service.category ?? "—", money(service.default_price), service.is_active ? "Active" : "Inactive"],
        }))}
        empty="No services yet."
      />
    </Card>
  );
}

function ServiceForm({ service, onSubmit }: { service?: Service; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Card>
      <Back href="/seshat/services" />
      <h2 className="mb-4 text-xl font-semibold text-white">{service ? "Edit Service" : "New Service"}</h2>
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <Field label="Name" name="name" defaultValue={service?.name} required />
        <Field label="Category" name="category" defaultValue={service?.category} />
        <Field label="Default price" name="default_price" type="number" min={0} step="0.01" defaultValue={service?.default_price ?? 0} />
        <Field label="Default quantity" name="default_quantity" type="number" min="0.01" step="0.01" defaultValue={service?.default_quantity ?? 1} />
        <div className="md:col-span-2"><Field label="Description" name="description" as="textarea" defaultValue={service?.description} /></div>
        <label className="flex items-center gap-2 text-sm text-slate-200"><input name="is_active" type="checkbox" defaultChecked={service?.is_active ?? true} /> Active</label>
        <div className="md:col-span-2"><Button className="gap-2"><Save className="h-4 w-4" /> Save Service</Button></div>
      </form>
    </Card>
  );
}

function Expenses({ expenses }: { expenses: ExpenseWithCategory[] }) {
  return (
    <Card>
      <ListHeader title="Expenses" href="/seshat/expenses/new" action="New Expense" />
      <Table
        headers={["Name", "Category", "Frequency", "Amount", "Monthly", "State"]}
        rows={expenses.map((expense) => ({
          key: expense.id,
          href: `/seshat/expenses/${expense.id}`,
          cells: [
            expense.name,
            expense.expense_categories?.name ?? "—",
            expense.frequency,
            money(expense.amount, expense.currency),
            money(expense.monthly_amount, expense.currency),
            expense.is_active ? "Active" : "Paused",
          ],
        }))}
        empty="No expenses yet."
      />
    </Card>
  );
}

function ExpenseForm({
  expense,
  clients,
  categories,
  onSubmit,
}: {
  expense?: ExpenseWithCategory;
  clients: Client[];
  categories: ExpenseCategory[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Card>
      <Back href="/seshat/expenses" />
      <h2 className="mb-4 text-xl font-semibold text-white">{expense ? "Edit Expense" : "New Expense"}</h2>
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <Field label="Name" name="name" defaultValue={expense?.name} required />
        <Field label="Vendor" name="vendor" defaultValue={expense?.vendor} />
        <Field label="Amount" name="amount" type="number" min={0} step="0.01" defaultValue={expense?.amount ?? 0} />
        <Field label="Currency" name="currency" defaultValue={expense?.currency ?? "USD"} />
        <SelectField label="Frequency" name="frequency" defaultValue={expense?.frequency ?? "monthly"}>
          {expenseFrequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}
        </SelectField>
        <SelectField label="Category" name="category_id" defaultValue={expense?.category_id}>
          <option value="">None</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </SelectField>
        <SelectField label="Client allocation" name="client_id" defaultValue={expense?.client_id}>
          <option value="">None</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </SelectField>
        <Field label="Start date" name="start_date" type="date" defaultValue={expense?.start_date ?? today()} />
        <Field label="End date" name="end_date" type="date" defaultValue={expense?.end_date} />
        <Field label="Receipt URL" name="receipt_url" defaultValue={expense?.receipt_url} />
        <div className="md:col-span-2"><Field label="Notes" name="notes" as="textarea" defaultValue={expense?.notes} /></div>
        <label className="flex items-center gap-2 text-sm text-slate-200"><input name="is_active" type="checkbox" defaultChecked={expense?.is_active ?? true} /> Active</label>
        <div className="md:col-span-2"><Button className="gap-2"><Save className="h-4 w-4" /> Save Expense</Button></div>
      </form>
    </Card>
  );
}

function Invoices({
  invoices,
  filter,
  onFilter,
}: {
  invoices: InvoiceWithClient[];
  filter: InvoiceStatus | "all";
  onFilter: (filter: InvoiceStatus | "all") => void;
}) {
  const filtered = filter === "all" ? invoices : invoices.filter((invoice) => invoice.status === filter);
  return (
    <Card>
      <ListHeader title="Invoices" href="/seshat/invoices/new" action="New Invoice" />
      <div className="mb-3 flex flex-wrap gap-2">
        {statusFilters.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onFilter(status)}
            className={cn("rounded-md px-3 py-1.5 text-sm", filter === status ? "bg-white/[0.12] text-white" : "text-slate-300 hover:bg-white/[0.06]")}
          >
            {status}
          </button>
        ))}
      </div>
      <InvoiceTable invoices={filtered} />
    </Card>
  );
}

function InvoiceTable({ invoices }: { invoices: InvoiceWithClient[] }) {
  return (
    <Table
      headers={["Invoice", "Client", "Issue", "Due", "Status", "Currency", "Total", "Paid", "Balance", "Source"]}
      rows={invoices.map((invoice) => ({
        key: invoice.id,
        href: `/seshat/invoices/${invoice.id}`,
        cells: [
          invoice.invoice_number,
          invoice.clients?.name ?? "—",
          dateLabel(invoice.issue_date),
          dateLabel(invoice.due_date),
          <Badge key="status" tone={statusTone(invoice.status)}>{invoice.status}</Badge>,
          invoice.currency,
          money(invoice.total, invoice.currency),
          money(invoice.amount_paid, invoice.currency),
          money(invoice.balance_due, invoice.currency),
          invoice.auto_generated ? "Auto" : "Manual",
        ],
      }))}
      empty="No invoices yet."
    />
  );
}

function InvoiceForm({
  clients,
  services,
  profile,
  onSubmit,
}: {
  clients: Client[];
  services: Service[];
  profile: BusinessProfile | null;
  onSubmit: (event: FormEvent<HTMLFormElement>, items: LineItemDraft[]) => void;
}) {
  const [items, setItems] = useState<LineItemDraft[]>([
    { tempId: "line-1", service_id: "", name: "", description: "", quantity: "1", unit_price: "0" },
  ]);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0),
    [items],
  );

  function updateItem(tempId: string, patch: Partial<LineItemDraft>) {
    setItems((prev) => prev.map((item) => item.tempId === tempId ? { ...item, ...patch } : item));
  }

  function applyService(tempId: string, serviceId: string) {
    const service = services.find((item) => item.id === serviceId);
    updateItem(tempId, service ? {
      service_id: service.id,
      name: service.name,
      description: service.description ?? "",
      quantity: String(service.default_quantity),
      unit_price: String(service.default_price),
    } : { service_id: "" });
  }

  return (
    <Card>
      <Back href="/seshat/invoices" />
      <h2 className="mb-4 text-xl font-semibold text-white">New Invoice</h2>
      <form onSubmit={(event) => onSubmit(event, items)} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField label="Client" name="client_id">
            <option value="">Select client...</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </SelectField>
          <SelectField label="Status" name="status" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
          </SelectField>
          <Field label="Currency" name="currency" defaultValue={profile?.default_currency ?? "USD"} />
          <Field label="Issue date" name="issue_date" type="date" defaultValue={today()} />
          <Field label="Due date" name="due_date" type="date" defaultValue={daysOut(profile?.default_payment_terms_days ?? 15)} />
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold text-white">Line Items</h3>
          {items.map((item) => (
            <div key={item.tempId} className="grid gap-3 rounded-md border border-white/[0.08] bg-white/[0.025] p-3 md:grid-cols-6">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-slate-200">Service</span>
                <select
                  value={item.service_id}
                  onChange={(event) => applyService(item.tempId, event.target.value)}
                  className="w-full rounded-md border border-white/[0.12] bg-[#151b22] px-3 py-2 text-white outline-none focus:border-violet-300/60"
                >
                  <option value="">Manual</option>
                  {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </select>
              </label>
              <div className="md:col-span-2">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium text-slate-200">Name</span>
                  <input
                    value={item.name}
                    onChange={(event) => updateItem(item.tempId, { name: event.target.value })}
                    className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white"
                  />
                </label>
              </div>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-slate-200">Qty</span>
                <input value={item.quantity} type="number" min="0.01" step="0.01" onChange={(event) => updateItem(item.tempId, { quantity: event.target.value })} className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white" />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium text-slate-200">Unit price</span>
                <input value={item.unit_price} type="number" min="0" step="0.01" onChange={(event) => updateItem(item.tempId, { unit_price: event.target.value })} className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white" />
              </label>
              <div className="flex items-end justify-between gap-2">
                <p className="pb-2 text-sm font-semibold text-white">{money((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}</p>
                <button type="button" onClick={() => setItems((prev) => prev.filter((line) => line.tempId !== item.tempId))} className="pb-2 text-sm text-rose-300">Remove</button>
              </div>
              <div className="md:col-span-6">
                <input value={item.description} placeholder="Description" onChange={(event) => updateItem(item.tempId, { description: event.target.value })} className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-sm text-white" />
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setItems((prev) => [...prev, { tempId: `line-${Date.now()}`, service_id: "", name: "", description: "", quantity: "1", unit_price: "0" }])}>
            Add Item
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Client notes" name="notes" as="textarea" />
          <Field label="Internal notes" name="internal_notes" as="textarea" />
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.10] pt-4">
          <p className="text-lg font-semibold text-white">Estimated total: {money(total, profile?.default_currency ?? "USD")}</p>
          <Button className="gap-2"><FilePlus2 className="h-4 w-4" /> Create Invoice</Button>
        </div>
      </form>
    </Card>
  );
}

function InvoiceDetail({
  invoice,
  profile,
  onPayment,
  onStatus,
  onDelete,
}: {
  invoice: InvoiceDetail;
  profile: BusinessProfile | null;
  onPayment: (event: FormEvent<HTMLFormElement>) => void;
  onStatus: (id: string, status: InvoiceStatus) => void;
  onDelete: (id: string) => void;
}) {
  const balance = invoice.balance_due ?? Math.max(invoice.total - invoice.amount_paid, 0);
  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <Back href="/seshat/invoices" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">{invoice.invoice_number}</h2>
            <p className="text-sm text-[var(--text-muted)]">{invoice.clients?.name ?? "No client"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Print / Save PDF</Button>
            {invoice.status === "draft" ? <Button type="button" onClick={() => onStatus(invoice.id, "sent")}>Mark as Sent</Button> : null}
            {invoice.status === "draft" ? <Button type="button" variant="danger" onClick={() => onDelete(invoice.id)}>Delete Draft</Button> : null}
            {invoice.status !== "paid" && invoice.status !== "cancelled" ? <Button type="button" variant="danger" onClick={() => onStatus(invoice.id, "cancelled")}>Cancel</Button> : null}
          </div>
        </div>
      </Card>
      <section className="rounded-lg border border-white/[0.10] bg-white p-8 text-slate-950 print:border-0 print:p-0">
        <div className="flex justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold">{profile?.business_name ?? "Minerva Technologies"}</h2>
            <p className="text-sm text-slate-600">{profile?.email ?? ""}</p>
            <p className="text-sm text-slate-600">{profile?.phone ?? ""}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">Invoice</p>
            <p className="font-semibold">{invoice.invoice_number}</p>
            <p className="text-sm capitalize text-slate-600">{invoice.status}</p>
          </div>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Bill to</p>
            <p className="mt-1 font-semibold">{invoice.clients?.company_name ?? invoice.clients?.name ?? "—"}</p>
            <p className="text-sm text-slate-600">{invoice.clients?.email ?? ""}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-slate-500">Issue date</span><span className="text-right">{dateLabel(invoice.issue_date)}</span>
            <span className="text-slate-500">Due date</span><span className="text-right">{dateLabel(invoice.due_date)}</span>
            <span className="text-slate-500">Currency</span><span className="text-right">{invoice.currency}</span>
            {invoice.paid_date ? <><span className="text-slate-500">Paid date</span><span className="text-right">{dateLabel(invoice.paid_date)}</span></> : null}
          </div>
        </div>
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.invoice_items.map((item) => (
              <tr key={item.id} className="border-b border-slate-200">
                <td className="py-3">
                  <p className="font-medium">{item.name}</p>
                  {item.description ? <p className="text-slate-500">{item.description}</p> : null}
                </td>
                <td className="py-3 text-right">{item.quantity}</td>
                <td className="py-3 text-right">{money(item.unit_price, invoice.currency)}</td>
                <td className="py-3 text-right">{money(item.line_total, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-5 w-full max-w-sm space-y-2 text-sm">
          <Total label="Subtotal" value={money(invoice.subtotal, invoice.currency)} />
          {invoice.discount_total > 0 ? <Total label="Discount" value={`-${money(invoice.discount_total, invoice.currency)}`} /> : null}
          {invoice.tax_total > 0 ? <Total label="Tax" value={money(invoice.tax_total, invoice.currency)} /> : null}
          <Total label="Total" value={money(invoice.total, invoice.currency)} strong />
          <Total label="Paid" value={money(invoice.amount_paid, invoice.currency)} />
          <Total label="Balance due" value={money(balance, invoice.currency)} strong />
        </div>
        {invoice.notes ? <p className="mt-8 whitespace-pre-wrap text-sm text-slate-700">{invoice.notes}</p> : null}
        {profile?.invoice_footer ? <p className="mt-8 text-xs text-slate-500">{profile.invoice_footer}</p> : null}
      </section>
      <Card className="print:hidden">
        <h3 className="mb-3 font-semibold text-white">Payments</h3>
        <div className="divide-y divide-white/[0.08]">
          {invoice.payments.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No payments recorded.</p> : null}
          {invoice.payments.map((payment) => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>{dateLabel(payment.payment_date)} · {payment.payment_method ?? "payment"} · {payment.reference ?? "no reference"}</span>
              <span className="font-semibold text-white">{money(payment.amount, payment.currency)}</span>
              {payment.proof_path ? <button type="button" onClick={async () => window.open(await getPaymentProofSignedUrl(payment.proof_path!), "_blank")} className="text-violet-200">Open proof</button> : null}
            </div>
          ))}
        </div>
        {(invoice.status === "sent" || invoice.status === "overdue") && balance > 0 ? (
          <form onSubmit={onPayment} className="mt-5 grid gap-3 border-t border-white/[0.10] pt-4 md:grid-cols-3">
            <Field label="Amount" name="amount" type="number" min="0.01" step="0.01" defaultValue={balance} required />
            <Field label="Payment date" name="payment_date" type="date" defaultValue={today()} required />
            <SelectField label="Method" name="payment_method" defaultValue="bank_transfer">
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="check">Check</option>
              <option value="other">Other</option>
            </SelectField>
            <Field label="Reference" name="reference" />
            <Field label="Notes" name="notes" />
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-200">Proof</span>
              <input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="w-full text-sm text-slate-200" />
            </label>
            <div className="md:col-span-3"><Button className="gap-2"><CreditCard className="h-4 w-4" /> Record Payment</Button></div>
          </form>
        ) : null}
      </Card>
    </div>
  );
}

function Billing({
  dueItems,
  billingCurrencies,
  defaultCurrency,
  result,
  onPreview,
  onRun,
}: {
  dueItems: DueClientServiceOccurrence[];
  billingCurrencies: ClientServiceBillingCurrency[];
  defaultCurrency: string | null | undefined;
  result: AutomaticBillingRunResult | null;
  onPreview: (asOfDate: string) => void;
  onRun: (asOfDate: string) => void;
}) {
  const [asOfDate, setAsOfDate] = useState(today());
  const total = dueItems.reduce((sum, item) => sum + item.amount, 0);
  const currenciesByClientService = new Map(
    billingCurrencies.map((item) => [item.id, item.agreed_currency]),
  );
  const expectedInvoiceCount = expectedAutomaticInvoiceCount(
    dueItems,
    currenciesByClientService,
    defaultCurrency,
  );
  return (
    <Card>
      <h2 className="mb-4 text-xl font-semibold text-white">Automatic Billing</h2>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1.5 text-sm">
          <span className="block font-medium text-slate-200">As-of date</span>
          <input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} className="rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white" />
        </label>
        <Button type="button" variant="secondary" onClick={() => onPreview(asOfDate)}>Preview</Button>
        <Button type="button" onClick={() => onRun(asOfDate)}>Generate Invoices</Button>
      </div>
      {result ? (
        <Alert tone="success" message={`Run complete: ${result.created_count} created, ${result.existing_count} existing, ${money(result.created_total)} created total.`} />
      ) : null}
      <div className="my-4 grid gap-3 md:grid-cols-3">
        <Metric label="Due service items" value={String(dueItems.length)} />
        <Metric label="Expected invoice count" value={String(expectedInvoiceCount)} />
        <Metric label="Expected total" value={money(total)} />
      </div>
      <Table
        headers={["Client", "Service", "Occurrence", "Frequency", "Amount"]}
        rows={dueItems.map((item) => ({
          key: item.external_reference,
          cells: [item.client_name, item.service_name, dateLabel(item.occurrence_date), item.frequency, money(item.amount)],
        }))}
        empty="Nothing due."
      />
    </Card>
  );
}

function Settings({ profile, onSubmit }: { profile: BusinessProfile | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <Card>
      <h2 className="mb-4 text-xl font-semibold text-white">Business Profile</h2>
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <Field label="Business name" name="business_name" defaultValue={profile?.business_name} required />
        <Field label="Owner name" name="owner_name" defaultValue={profile?.owner_name} />
        <Field label="Email" name="email" type="email" defaultValue={profile?.email} />
        <Field label="Phone" name="phone" defaultValue={profile?.phone} />
        <Field label="Website" name="website" defaultValue={profile?.website} />
        <Field label="Default currency" name="default_currency" defaultValue={profile?.default_currency ?? "USD"} />
        <Field label="Invoice prefix" name="invoice_prefix" defaultValue={profile?.invoice_prefix ?? "INV"} />
        <Field label="Default payment terms days" name="default_payment_terms_days" type="number" min={0} step={1} defaultValue={profile?.default_payment_terms_days ?? 15} />
        <Field label="Invoice accent color" name="invoice_accent_color" defaultValue={profile?.invoice_accent_color} />
        <div className="md:col-span-2"><Field label="Invoice footer" name="invoice_footer" as="textarea" defaultValue={profile?.invoice_footer} /></div>
        <div className="md:col-span-2"><Button className="gap-2"><Save className="h-4 w-4" /> Save Settings</Button></div>
      </form>
    </Card>
  );
}

function ListHeader({ title, href, action }: { title: string; href: string; action: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <Link href={href}><Button>{action}</Button></Link>
    </div>
  );
}

function Back({ href }: { href: string }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white">
      <ArrowLeft className="h-4 w-4" /> Back
    </Link>
  );
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<{ key: string; href?: string; cells: React.ReactNode[] }>;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-[var(--text-muted)]">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-slate-400">
          <tr>{headers.map((header) => <th key={header} className="border-b border-white/[0.10] px-3 py-2 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-white/[0.08]">
          {rows.map((row) => (
            <tr key={row.key} className="text-slate-200 hover:bg-white/[0.03]">
              {row.cells.map((cell, idx) => (
                <td key={`${row.key}-${idx}`} className="whitespace-nowrap px-3 py-3">
                  {row.href && idx === 0 ? <Link href={row.href} className="text-white hover:text-violet-200">{cell}</Link> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t border-slate-300 pt-2 text-lg font-bold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
