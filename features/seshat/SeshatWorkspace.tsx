"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CircleDollarSign,
  CircleGauge,
  CreditCard,
  Download,
  FilePlus2,
  LogOut,
  Pencil,
  Plus,
  Power,
  Printer,
  RefreshCw,
  Save,
  Star,
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
  DEFAULT_INVOICE_DOCUMENT_LANGUAGE,
  type InvoiceDocumentLanguage,
} from "./invoicePresentation";
import { InvoiceDocument } from "./InvoiceDocument";
import { downloadInvoicePdf } from "./invoicePdf";
import { formatInvoiceDraftTotal, normalizeInvoiceCurrency } from "./invoiceDraft";
import { localDateDaysOut, localDateValue } from "./localDate";
import {
  buildFxOverview, normalizeCurrency, reportingDate,
  type OfficialFxRate, type PaymentFxRate, type ReportingCurrency,
} from "./fxReporting";
import {
  attachPaymentProof,
  generateInvoice,
  getDueClientServiceOccurrences,
  getPaymentProofSignedUrl,
  recordPayment,
  runAutomaticBilling,
  setInvoicePaymentMethod,
  seshatErrorMessage,
} from "./financialEngine";
import {
  clientPaymentMethodChoice,
  invoicePaymentMethodChoice,
  parseClientPaymentMethodChoice,
  parseInvoicePaymentMethodChoice,
  paymentMethodLabel,
  resolveClientPaymentMethod,
} from "./paymentMethods";
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
  Payment,
  PaymentMethod,
  PaymentMethodType,
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
  return localDateValue();
}

function daysOut(days: number) {
  return localDateDaysOut(days);
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

function paymentMethodPayload(form: FormData) {
  const methodType = String(form.get("method_type") ?? "other") as PaymentMethodType;
  return {
    name: String(form.get("name") ?? "").trim(),
    display_name: clean(form.get("display_name")),
    method_type: methodType,
    bank_name: methodType === "bank_transfer" ? clean(form.get("bank_name")) : null,
    account_holder: methodType === "bank_transfer" ? clean(form.get("account_holder")) : null,
    account_number: methodType === "bank_transfer" ? clean(form.get("account_number")) : null,
    account_type: methodType === "bank_transfer" ? clean(form.get("account_type")) : null,
    paypal_email: methodType === "paypal" ? clean(form.get("paypal_email")) : null,
    payment_url: methodType === "paypal" || methodType === "other" ? clean(form.get("payment_url")) : null,
    currency: methodType === "bank_transfer" || methodType === "paypal" || methodType === "other"
      ? clean(form.get("currency"))?.toUpperCase() ?? null
      : null,
    instructions: clean(form.get("instructions")),
    is_active: form.get("is_active") === "on",
    is_default: form.get("is_default") === "on",
  };
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
  value,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  children: React.ReactNode;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      <select
        name={name}
        {...(value === undefined ? { defaultValue: defaultValue ?? "" } : { value })}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="w-full rounded-md border border-white/[0.12] bg-[#151b22] px-3 py-2 text-white outline-none focus:border-violet-300/60"
      >
        {children}
      </select>
    </label>
  );
}

function PaymentMethodSelect({
  label,
  name,
  methods,
  defaultValue,
  includeAutomatic,
  automaticLabel = "Client preference / owner default",
}: {
  label: string;
  name: string;
  methods: PaymentMethod[];
  defaultValue: string;
  includeAutomatic: boolean;
  automaticLabel?: string;
}) {
  return (
    <SelectField label={label} name={name} defaultValue={defaultValue}>
      {includeAutomatic ? <option value="auto">{automaticLabel}</option> : null}
      <option value="default">Owner default</option>
      <option value="none">None</option>
      {methods.map((method) => (
        <option key={method.id} value={`method:${method.id}`}>
          {paymentMethodLabel(method)}{method.is_default ? " (default)" : ""}
        </option>
      ))}
    </SelectField>
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clientServices, setClientServices] = useState<ClientService[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [officialFx, setOfficialFx] = useState<OfficialFxRate[]>([]);
  const [paymentFx, setPaymentFx] = useState<PaymentFxRate[]>([]);
  const [fxLoadingError, setFxLoadingError] = useState<string | null>(null);
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
        paymentsRes,
        ratesRes,
        paymentFxRes,
        billingCurrenciesRes,
        paymentMethodsRes,
      ] = await Promise.all([
        supabase.from("clients").select("*").order("name", { ascending: true }),
        supabase.from("services").select("*").order("name", { ascending: true }),
        supabase.from("invoices").select("*, clients(name, company_name, email)").order("issue_date", { ascending: false }).limit(100),
        supabase.from("expenses").select("*, expense_categories(name, color)").order("created_at", { ascending: false }).limit(100),
        supabase.from("expense_categories").select("*").order("name", { ascending: true }),
        supabase.from("business_profiles").select("*").maybeSingle(),
        supabase.from("payments").select("*").limit(5000),
        supabase.from("seshat_fx_daily_rates").select("effective_date, rate, source, source_indicator, fetched_at").order("effective_date", { ascending: false }).limit(1500),
        supabase.from("seshat_payment_fx_rates").select("payment_id, owner_id, rate, source_note").limit(5000),
        supabase.from("client_services").select("id, agreed_currency"),
        supabase.from("payment_methods").select("*").order("name", { ascending: true }),
      ]);

      for (const result of [clientsRes, servicesRes, invoicesRes, expensesRes, categoriesRes, profileRes, paymentsRes, billingCurrenciesRes]) {
        if (result.error) throw result.error;
      }
      if (paymentMethodsRes.error) {
        const code = paymentMethodsRes.error.code;
        if (code !== "42P01" && code !== "PGRST205") throw paymentMethodsRes.error;
        setWarning("Payment Methods will become available after the Seshat backend migration is deployed.");
      }

      setClients((clientsRes.data as Client[]) ?? []);
      setServices((servicesRes.data as Service[]) ?? []);
      setInvoices((invoicesRes.data as InvoiceWithClient[]) ?? []);
      setExpenses((expensesRes.data as ExpenseWithCategory[]) ?? []);
      setCategories((categoriesRes.data as ExpenseCategory[]) ?? []);
      setProfile((profileRes.data as BusinessProfile | null) ?? null);
      setPayments((paymentsRes.data as Payment[]) ?? []);
      setOfficialFx((ratesRes.data as OfficialFxRate[]) ?? []);
      setPaymentFx((paymentFxRes.data as PaymentFxRate[]) ?? []);
      setFxLoadingError(ratesRes.error?.message ?? paymentFxRes.error?.message ?? null);
      setBillingCurrencies((billingCurrenciesRes.data as ClientServiceBillingCurrency[]) ?? []);
      setPaymentMethods((paymentMethodsRes.data as PaymentMethod[]) ?? []);

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
      const paymentPreference = parseClientPaymentMethodChoice(String(form.get("preferred_payment_method") ?? "default"));
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
        payment_method_preference: paymentPreference.selection,
        preferred_payment_method_id: paymentPreference.paymentMethodId,
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

  async function submitInvoice(
    event: FormEvent<HTMLFormElement>,
    items: LineItemDraft[],
    selectedCurrency: string,
  ) {
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

      const paymentChoice = parseInvoicePaymentMethodChoice(String(form.get("payment_method") ?? "auto"));
      const result = await generateInvoice({
        client_id: clean(form.get("client_id")),
        status: form.get("status") === "sent" ? "sent" : "draft",
        issue_date: clean(form.get("issue_date")),
        due_date: clean(form.get("due_date")),
        currency: normalizeInvoiceCurrency(selectedCurrency, profile?.default_currency ?? "USD"),
        notes: clean(form.get("notes")),
        internal_notes: clean(form.get("internal_notes")),
        payment_method_selection: paymentChoice.selection,
        payment_method_id: paymentChoice.paymentMethodId,
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
        if (!session) throw new Error("Reconnect to Seshat before attaching a payment proof.");
        await attachPaymentProof({
          paymentId: result.payment_id,
          invoiceId: invoice.id,
          ownerId: session.user.id,
          file: proof,
        });
      } catch (proofError) {
        setWarning(`Payment recorded, but proof was not attached: ${seshatErrorMessage(proofError, "Try again using Attach proof below.")}`);
      }
    }

    setNotice("Payment recorded.");
    paymentForm.reset();
    await load();
    await loadDetail();
  }

  async function submitExistingPaymentProof(file: File, paymentId: string) {
    if (!invoice || !session) throw new Error("Reconnect to Seshat before attaching a payment proof.");
    setError(null);
    setNotice(null);
    setWarning(null);
    await attachPaymentProof({
      paymentId,
      invoiceId: invoice.id,
      ownerId: session.user.id,
      file,
    });
    // Only update the UI after the proof path has actually been saved.
    await loadDetail();
    setNotice("Payment proof attached successfully. The payment amount and date were not changed.");
  }


  async function savePaymentFxRate(paymentId: string, rate: number, sourceNote: string) {
    if (!session || !invoice?.payments.some((p) => p.id === paymentId && normalizeCurrency(p.currency) === "USD")) {
      throw new Error("You can only attach a bank FX rate to your own USD payment.");
    }
    if (!Number.isFinite(rate) || rate < 10 || rate > 100) {
      throw new Error("Enter a plausible HNL-per-USD rate between 10 and 100.");
    }
    const existing = paymentFx.some((p) => p.payment_id === paymentId);
    const payload = {
      payment_id: paymentId,
      owner_id: session.user.id,
      rate,
      source_note: sourceNote.trim() || "Bank settlement",
    };
    const db = getSeshatDataClient();
    const response = existing
      ? await db.from("seshat_payment_fx_rates").update(payload).eq("payment_id", paymentId).eq("owner_id", session.user.id)
      : await db.from("seshat_payment_fx_rates").insert(payload);
    if (response.error) throw response.error;
    setPaymentFx((current) => [
      ...current.filter((p) => p.payment_id !== paymentId), payload,
    ]);
  }

  async function savePaymentMethod(event: FormEvent<HTMLFormElement>, paymentMethodId?: string) {
    event.preventDefault();
    const payload = paymentMethodPayload(new FormData(event.currentTarget));
    setError(null);
    try {
      if (!session) throw new Error("Please reconnect to Seshat.");
      if (!payload.name) throw new Error("Payment method name is required.");
      const supabase = getSeshatDataClient();
      const response = paymentMethodId
        ? await supabase.from("payment_methods").update(payload).eq("id", paymentMethodId)
        : await supabase.from("payment_methods").insert({ ...payload, owner_id: session.user.id });
      if (response.error) throw response.error;
      setNotice(paymentMethodId ? "Payment method updated." : "Payment method created.");
      await load();
    } catch (saveError) {
      setError(seshatErrorMessage(saveError, "Could not save payment method."));
    }
  }

  async function updatePaymentMethod(paymentMethodId: string, patch: Partial<PaymentMethod>) {
    setError(null);
    try {
      const { error: updateError } = await getSeshatDataClient()
        .from("payment_methods")
        .update(patch)
        .eq("id", paymentMethodId);
      if (updateError) throw updateError;
      setNotice("Payment method updated.");
      await load();
    } catch (updateError) {
      setError(seshatErrorMessage(updateError, "Could not update payment method."));
    }
  }

  async function updateClientPaymentMethod(event: FormEvent<HTMLFormElement>, clientId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const preference = parseClientPaymentMethodChoice(String(form.get("preferred_payment_method") ?? "default"));
    setError(null);
    try {
      const { error: updateError } = await getSeshatDataClient()
        .from("clients")
        .update({
          payment_method_preference: preference.selection,
          preferred_payment_method_id: preference.paymentMethodId,
        })
        .eq("id", clientId);
      if (updateError) throw updateError;
      setNotice("Client payment preference updated.");
      await load();
    } catch (updateError) {
      setError(seshatErrorMessage(updateError, "Could not update client payment preference."));
    }
  }

  async function updateDraftPaymentMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoice) return;
    const form = new FormData(event.currentTarget);
    const choice = parseInvoicePaymentMethodChoice(String(form.get("payment_method") ?? "auto"));
    setError(null);
    try {
      await setInvoicePaymentMethod(invoice.id, choice.selection, choice.paymentMethodId);
      setNotice("Draft payment instructions refreshed.");
      await load();
      await loadDetail();
    } catch (updateError) {
      setError(seshatErrorMessage(updateError, "Could not update invoice payment instructions."));
    }
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
        default_currency: normalizeCurrency(String(clean(form.get("default_currency")) ?? "USD")),
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
          payments={payments}
          officialFx={officialFx}
          paymentFx={paymentFx}
          fxLoadingError={fxLoadingError}
          dueItems={dueItems}
          invoices={invoices}
          clients={clients}
          expenses={expenses}
        />
      ) : null}
      {view === "clients" ? <Clients clients={clients} /> : null}
      {view === "client-new" ? <ClientForm paymentMethods={paymentMethods} onSubmit={submitClient} /> : null}
      {view === "client-edit" && currentClient ? <ClientForm client={currentClient} paymentMethods={paymentMethods} onSubmit={(event) => submitClient(event, currentClient.id)} /> : null}
      {view === "client-detail" && currentClient ? (
        <ClientDetail
          client={currentClient}
          clientServices={clientServices}
          services={services}
          invoices={invoices.filter((item) => item.client_id === currentClient.id)}
          profit={clientProfit}
          paymentMethods={paymentMethods}
          onClientServiceSubmit={submitClientService}
          onPaymentMethodSubmit={(event) => updateClientPaymentMethod(event, currentClient.id)}
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
        <InvoiceForm clients={clients} services={services} profile={profile} paymentMethods={paymentMethods} onSubmit={submitInvoice} />
      ) : null}
      {view === "invoice-detail" && invoice ? (
        <InvoiceDetail
          invoice={invoice}
          profile={profile}
          paymentMethods={paymentMethods}
          onPayment={submitPayment}
          onAttachProof={submitExistingPaymentProof}
          onPaymentFx={savePaymentFxRate}
          paymentFxRates={paymentFx}
          onPaymentMethod={updateDraftPaymentMethod}
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
      {view === "settings" ? (
        <Settings
          profile={profile}
          paymentMethods={paymentMethods}
          officialFx={officialFx}
          fxLoadingError={fxLoadingError}
          onSubmit={saveProfile}
          onPaymentMethodSubmit={savePaymentMethod}
          onPaymentMethodUpdate={updatePaymentMethod}
        />
      ) : null}
    </div>
  );
}

function Overview({
  profile, payments, officialFx, paymentFx, fxLoadingError, dueItems, invoices, clients, expenses,
}: {
  profile: BusinessProfile | null;
  payments: Payment[];
  officialFx: OfficialFxRate[];
  paymentFx: PaymentFxRate[];
  fxLoadingError: string | null;
  dueItems: DueClientServiceOccurrence[];
  invoices: InvoiceWithClient[];
  clients: Client[];
  expenses: ExpenseWithCategory[];
}) {
  const base = normalizeCurrency(profile?.default_currency ?? "HNL");
  const [displayCurrency, setDisplayCurrency] = useState<ReportingCurrency>(
    base === "USD" ? "USD" : "HNL",
  );
  const asOfDate = reportingDate();
  const summary = buildFxOverview({
    invoices, payments, expenses, paymentRates: paymentFx,
    officialRates: officialFx, target: displayCurrency, asOfDate,
  });
  const currency = displayCurrency;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-300">Management report · {asOfDate}</p>
          <p className="text-xs text-slate-400">
            FX reference: {summary.rate ? `BCH · 1 USD = HNL ${Number(summary.rate.rate).toFixed(4)} · dated ${summary.rate.effective_date}`
              : "No verified current BCH rate; conversions are not estimated."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          Display values in
          <select aria-label="Reporting currency" value={displayCurrency}
            onChange={(event) => setDisplayCurrency(event.target.value as ReportingCurrency)}
            className="rounded-md border border-white/20 bg-[#151b22] px-3 py-2 text-white">
            <option value="HNL">HNL (L)</option>
            <option value="USD">USD ($)</option>
          </select>
        </label>
      </div>
      {fxLoadingError ? (
        <p role="alert" className="rounded-md border border-amber-500/30 p-3 text-sm text-amber-200">
          FX data unavailable: {fxLoadingError}. No unverified currency totals will be displayed.
        </p>
      ) : null}
      {summary.missing.length ? (
        <div role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
          <strong>Conversion incomplete:</strong> {summary.missing.length} record(s) lack a verified rate for their relevant dates.
          The affected totals are hidden rather than mixing USD with HNL.
          <p className="mt-1 text-xs">{summary.missing.slice(0, 5).join(" · ")}</p>
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Issued invoices · all time" value={money(summary.knownRevenue.value, currency)} />
        <Metric label="Monthly estimated costs" value={money(summary.monthlyCosts.value, currency)} />
        <Metric label="Cash less monthly cost estimate" value={money(summary.netCashAfterForecastCosts, currency)} />
        <Metric label="Cash / costs ratio" value={summary.margin === null ? "—" : `${summary.margin.toFixed(1)}%`} />
        <Metric label="Collected this month (payment dates)" value={money(summary.collected.value, currency)} />
        <Metric label="Issued this month (no drafts)" value={money(summary.invoiced.value, currency)} />
        <Metric label="Due billing items" value={String(dueItems.length)} />
        <Metric label="Active clients" value={String(clients.filter((client) => client.status === "active").length)} />
      </div>
      <p className="text-xs text-slate-400">
        Estimates: monthly recurring costs use the latest dated reference FX rate.
        Historical invoices use issuance-date FX; received payments use payment-date FX, or your actual bank rate when recorded.
        Draft invoices are excluded. Cash less estimated costs is not accrual profit.
      </p>
      <Card>
        <div className="flex flex-wrap gap-2">
          <Link href="/seshat/invoices/new"><Button className="gap-2"><FilePlus2 className="h-4 w-4" /> New Invoice</Button></Link>
          <Link href="/seshat/clients"><Button variant="secondary">Clients</Button></Link>
          <Link href="/seshat/billing"><Button variant="secondary">Automatic Billing</Button></Link>
          <Link href="/seshat/settings"><Button variant="secondary">Exchange Rates</Button></Link>
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
        headers={["Company Name", "Contact", "Status", "Billing"]}
        rows={filtered.map((client) => ({
          key: client.id,
          href: `/seshat/clients/${client.id}`,
          cells: [
            <strong key="company-name">{client.company_name?.trim() || "Company not set"}</strong>,
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

function ClientForm({
  client,
  paymentMethods,
  onSubmit,
}: {
  client?: Client;
  paymentMethods: PaymentMethod[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const activeMethods = paymentMethods.filter((method) => method.is_active);
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
        <PaymentMethodSelect
          label="Preferred payment method"
          name="preferred_payment_method"
          methods={activeMethods}
          defaultValue={clientPaymentMethodChoice(client)}
          includeAutomatic={false}
        />
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
  paymentMethods,
  onClientServiceSubmit,
  onPaymentMethodSubmit,
}: {
  client: Client;
  clientServices: ClientService[];
  services: Service[];
  invoices: InvoiceWithClient[];
  profit: ClientOperationalProfitSummary | null;
  paymentMethods: PaymentMethod[];
  onClientServiceSubmit: (event: FormEvent<HTMLFormElement>, id?: string) => void;
  onPaymentMethodSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const activeMethods = paymentMethods.filter((method) => method.is_active);
  const resolvedMethod = resolveClientPaymentMethod(client, paymentMethods);
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
        <form onSubmit={onPaymentMethodSubmit} className="mt-4 flex flex-col gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <PaymentMethodSelect
              label="Preferred payment method"
              name="preferred_payment_method"
              methods={activeMethods}
              defaultValue={clientPaymentMethodChoice(client)}
              includeAutomatic={false}
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Current resolution: {resolvedMethod ? paymentMethodLabel(resolvedMethod) : "None"}
            </p>
          </div>
          <Button variant="secondary" className="gap-2"><Save className="h-4 w-4" /> Save</Button>
        </form>
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
  paymentMethods,
  onSubmit,
}: {
  clients: Client[];
  services: Service[];
  profile: BusinessProfile | null;
  paymentMethods: PaymentMethod[];
  onSubmit: (event: FormEvent<HTMLFormElement>, items: LineItemDraft[], currency: string) => void;
}) {
  const [items, setItems] = useState<LineItemDraft[]>([
    { tempId: "line-1", service_id: "", name: "", description: "", quantity: "1", unit_price: "0" },
  ]);
  const [clientId, setClientId] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState(
    normalizeInvoiceCurrency(profile?.default_currency, "USD"),
  );
  const selectedClient = clients.find((client) => client.id === clientId) ?? null;
  const resolvedPaymentMethod = resolveClientPaymentMethod(selectedClient, paymentMethods);
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
      <form onSubmit={(event) => onSubmit(event, items, selectedCurrency)} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField label="Client" name="client_id" value={clientId} onChange={setClientId}>
            <option value="">Select client...</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </SelectField>
          <SelectField label="Status" name="status" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
          </SelectField>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-200">Currency</span>
            <input
              name="currency"
              value={selectedCurrency}
              onChange={(event) => setSelectedCurrency(event.target.value.toUpperCase())}
              className="w-full rounded-md border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-white outline-none focus:border-violet-300/60"
              required
            />
          </label>
          <Field label="Issue date" name="issue_date" type="date" defaultValue={today()} />
          <Field label="Due date" name="due_date" type="date" defaultValue={daysOut(profile?.default_payment_terms_days ?? 15)} />
          <PaymentMethodSelect
            label="Payment method"
            name="payment_method"
            methods={paymentMethods.filter((method) => method.is_active)}
            defaultValue="auto"
            includeAutomatic
            automaticLabel={`Automatic — ${resolvedPaymentMethod ? paymentMethodLabel(resolvedPaymentMethod) : "None"}`}
          />
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
          <p className="text-lg font-semibold text-white">
            Estimated total: {formatInvoiceDraftTotal(total, selectedCurrency)}
          </p>
          <Button className="gap-2"><FilePlus2 className="h-4 w-4" /> Create Invoice</Button>
        </div>
      </form>
    </Card>
  );
}

// File selection and errors live next to the payment, not at the top of a long invoice.
// A direct click avoids relying on browser form submission / implicit validation.
function ExistingPaymentProofUploader({
  paymentId,
  onAttachProof,
}: {
  paymentId: string;
  onAttachProof: (file: File, paymentId: string) => Promise<void>;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload() {
    if (isUploading) return;
    if (!selectedFile) {
      setUploadError("Choose a proof file before uploading.");
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      await onAttachProof(selectedFile, paymentId);
    } catch (error) {
      console.error("SESHAT_PAYMENT_PROOF_ATTACH_FAILED", {
        paymentId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      setUploadError(seshatErrorMessage(error, "Could not attach payment proof. Please try again."));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex min-w-0 max-w-md flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-300">
          <span>Attach proof (JPG, PNG, WebP, PDF; max 10 MB)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={isUploading}
            onChange={(event) => {
              setSelectedFile(event.currentTarget.files?.[0] ?? null);
              setUploadError(null);
            }}
            className="block max-w-xs text-xs text-slate-200"
          />
        </label>
        <Button type="button" variant="secondary" disabled={isUploading || !selectedFile} onClick={upload}>
          {isUploading ? "Uploading..." : "Attach proof"}
        </Button>
      </div>
      {uploadError ? (
        <p role="alert" className="text-xs text-rose-300">{uploadError}</p>
      ) : null}
    </div>
  );
}

function BankSettlementRate({
  paymentId, rate, onSave,
}: {
  paymentId: string;
  rate: number | null;
  onSave: (id: string, rate: number, note: string) => Promise<void>;
}) {
  const [entered, setEntered] = useState(rate ? String(rate) : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      setMessage(null);
      try {
        await onSave(paymentId, Number(entered), "Bank settlement (user-entered)");
        setMessage("Bank rate saved. Original USD payment unchanged.");
      } catch (error) {
        setMessage(seshatErrorMessage(error, "Could not save bank rate."));
      } finally { setBusy(false); }
    }}>
      <label className="flex flex-col gap-1 text-xs text-slate-300">
        Bank FX (HNL per USD) · optional
        <input aria-label="Actual bank FX rate" type="number" min="10" max="100" step="0.000001"
          required value={entered} disabled={busy} onChange={(event) => setEntered(event.target.value)}
          placeholder="Effective bank rate" className="w-40 rounded-md border border-white/15 bg-[#151b22] px-2 py-1.5 text-white"/>
      </label>
      <Button type="submit" variant="secondary" disabled={busy || !entered}>{busy ? "Saving..." : "Save rate"}</Button>
      {message ? <span role="status" className="text-xs text-amber-200">{message}</span> : null}
    </form>
  );
}

function InvoiceDetail({
  invoice,
  profile,
  paymentMethods,
  onPayment,
  onAttachProof,
  onPaymentFx,
  paymentFxRates,
  onPaymentMethod,
  onStatus,
  onDelete,
}: {
  invoice: InvoiceDetail;
  profile: BusinessProfile | null;
  paymentMethods: PaymentMethod[];
  onPayment: (event: FormEvent<HTMLFormElement>) => void;
  onAttachProof: (file: File, paymentId: string) => Promise<void>;
  onPaymentFx: (paymentId: string, rate: number, note: string) => Promise<void>;
  paymentFxRates: PaymentFxRate[];
  onPaymentMethod: (event: FormEvent<HTMLFormElement>) => void;
  onStatus: (id: string, status: InvoiceStatus) => void;
  onDelete: (id: string) => void;
}) {
  const balance = invoice.balance_due ?? Math.max(invoice.total - invoice.amount_paid, 0);
  const [documentLanguage, setDocumentLanguage] = useState<InvoiceDocumentLanguage>(
    DEFAULT_INVOICE_DOCUMENT_LANGUAGE,
  );
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function handleDownloadPdf() {
    const documentNode = document.querySelector<HTMLElement>("[data-seshat-invoice-document]");
    if (!documentNode) return;

    setPdfError(null);
    setIsDownloadingPdf(true);
    try {
      await downloadInvoicePdf({
        node: documentNode,
        invoiceNumber: invoice.invoice_number,
        language: documentLanguage,
      });
    } catch (error) {
      console.error("SESHAT_INVOICE_PDF_DOWNLOAD_FAILED", error);
      setPdfError("Could not generate the invoice PDF. Try again.");
    } finally {
      setIsDownloadingPdf(false);
    }
  }

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
            <Button type="button" onClick={handleDownloadPdf} disabled={isDownloadingPdf} className="gap-2">
              <Download className="h-4 w-4" /> {isDownloadingPdf ? "Generating PDF..." : "Download PDF"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => window.print()} className="gap-2" title="Browser print for debugging">
              <Printer className="h-4 w-4" /> Browser Print
            </Button>
            {invoice.status === "draft" ? <Button type="button" onClick={() => onStatus(invoice.id, "sent")}>Mark as Sent</Button> : null}
            {invoice.status === "draft" ? <Button type="button" variant="danger" onClick={() => onDelete(invoice.id)}>Delete Draft</Button> : null}
            {invoice.status !== "paid" && invoice.status !== "cancelled" ? <Button type="button" variant="danger" onClick={() => onStatus(invoice.id, "cancelled")}>Cancel</Button> : null}
          </div>
        </div>
        {pdfError ? <p className="mt-3 text-sm text-rose-300">{pdfError}</p> : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
          <span className="text-sm font-medium text-slate-300">Invoice language</span>
          <div role="group" aria-label="Invoice language" className="inline-flex rounded-md border border-white/[0.12] bg-white/[0.03] p-1">
            {([
              ["es-HN", "Español"],
              ["en-US", "English"],
            ] as const).map(([language, label]) => (
              <button
                key={language}
                type="button"
                aria-pressed={documentLanguage === language}
                onClick={() => setDocumentLanguage(language)}
                className={cn(
                  "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  documentLanguage === language
                    ? "bg-white/[0.12] text-white"
                    : "text-slate-400 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>
      {invoice.status === "draft" ? (
        <Card className="print:hidden">
          <form onSubmit={onPaymentMethod} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <PaymentMethodSelect
                label="Payment instructions"
                name="payment_method"
                methods={paymentMethods.filter((method) => method.is_active)}
                defaultValue={invoicePaymentMethodChoice(invoice.payment_method_selection, invoice.payment_method_id)}
                includeAutomatic
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {invoice.payment_instruction_snapshot
                  ? `Current snapshot: ${invoice.payment_instruction_snapshot.display_name || invoice.payment_instruction_snapshot.name}`
                  : "No payment instructions attached."}
              </p>
            </div>
            <Button variant="secondary" className="gap-2"><RefreshCw className="h-4 w-4" /> Assign / Refresh</Button>
          </form>
        </Card>
      ) : null}
      <InvoiceDocument invoice={invoice} profile={profile} language={documentLanguage} />
      <Card className="print:hidden">
        <h3 className="mb-3 font-semibold text-white">Payments</h3>
        <div className="divide-y divide-white/[0.08]">
          {invoice.payments.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No payments recorded.</p> : null}
          {invoice.payments.map((payment) => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>{dateLabel(payment.payment_date)} · {payment.payment_method ?? "payment"} · {payment.reference ?? "no reference"}</span>
              <span className="font-semibold text-white">{money(payment.amount, payment.currency)}</span>
              {normalizeCurrency(payment.currency) === "USD" ? (
                <BankSettlementRate
                  paymentId={payment.id}
                  rate={paymentFxRates.find((entry) => entry.payment_id === payment.id)?.rate ?? null}
                  onSave={onPaymentFx}
                />
              ) : null}
              {payment.proof_path ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      window.open(await getPaymentProofSignedUrl(payment.proof_path!), "_blank", "noopener,noreferrer");
                    } catch {
                      window.alert("Could not open payment proof. Please try again.");
                    }
                  }}
                  className="text-violet-200 hover:underline"
                >
                  Open proof
                </button>
              ) : (
                <ExistingPaymentProofUploader paymentId={payment.id} onAttachProof={onAttachProof} />
              )}
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

function Settings({
  profile,
  paymentMethods,
  officialFx,
  fxLoadingError,
  onSubmit,
  onPaymentMethodSubmit,
  onPaymentMethodUpdate,
}: {
  profile: BusinessProfile | null;
  paymentMethods: PaymentMethod[];
  officialFx: OfficialFxRate[];
  fxLoadingError: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPaymentMethodSubmit: (event: FormEvent<HTMLFormElement>, id?: string) => Promise<void>;
  onPaymentMethodUpdate: (id: string, patch: Partial<PaymentMethod>) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-4 text-xl font-semibold text-white">Business Profile</h2>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
          <Field label="Business name" name="business_name" defaultValue={profile?.business_name} required />
          <Field label="Owner name" name="owner_name" defaultValue={profile?.owner_name} />
          <Field label="Email" name="email" type="email" defaultValue={profile?.email} />
          <Field label="Phone" name="phone" defaultValue={profile?.phone} />
          <Field label="Website" name="website" defaultValue={profile?.website} />
          <SelectField label="Base currency" name="default_currency" defaultValue={normalizeCurrency(profile?.default_currency ?? "HNL")}>
            <option value="HNL">HNL (Honduran lempira)</option>
            <option value="USD">USD (US dollar)</option>
          </SelectField>
          <Field label="Invoice prefix" name="invoice_prefix" defaultValue={profile?.invoice_prefix ?? "INV"} />
          <Field label="Default payment terms days" name="default_payment_terms_days" type="number" min={0} step={1} defaultValue={profile?.default_payment_terms_days ?? 15} />
          <Field label="Invoice accent color" name="invoice_accent_color" defaultValue={profile?.invoice_accent_color} />
          <div className="md:col-span-2"><Field label="Invoice footer" name="invoice_footer" as="textarea" defaultValue={profile?.invoice_footer} /></div>
          <div className="md:col-span-2"><Button className="gap-2"><Save className="h-4 w-4" /> Save Settings</Button></div>
        </form>
      </Card>
      <Card>
        <h2 className="text-xl font-semibold text-white">Currencies &amp; Exchange Rates</h2>
        <p className="mt-2 text-sm text-slate-300">Official reference: Banco Central de Honduras (BCH). Rates are shared and updated once daily by the secure scheduler once the API credentials are activated.</p>
        {fxLoadingError ? <p className="mt-2 text-sm text-amber-200">{fxLoadingError}</p> : null}
        {officialFx.length === 0 ? (
          <p role="status" className="mt-3 text-sm text-amber-200">No verified BCH rates loaded. Cross-currency totals will remain unavailable until the official connection is configured.</p>
        ) : (
          <div className="mt-3 space-y-1">
            <p className="font-semibold text-white">
              1 USD = HNL {Number(officialFx[0].rate).toFixed(4)}
            </p>
            <p className="text-xs text-slate-400">BCH reference · effective date {officialFx[0].effective_date} · source {officialFx[0].source_indicator}</p>
            <p className="text-xs text-slate-400">If the rate is older than seven days, reports will not treat it as current.</p>
          </div>
        )}
        <a href="https://bchapi-am.developer.azure-api.net/signup" target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-block text-sm text-violet-200 hover:underline">
          BCH developer API registration (required to activate daily updates)
        </a>
        <p className="mt-2 text-xs text-slate-400">Historical invoice conversion uses its own date; paid invoices never get repriced in their original currency. Save the effective bank rate alongside any USD payment under Invoices.</p>
      </Card>
      <PaymentMethodsSettings
        methods={paymentMethods}
        onSubmit={onPaymentMethodSubmit}
        onUpdate={onPaymentMethodUpdate}
      />
    </div>
  );
}

function PaymentMethodsSettings({
  methods,
  onSubmit,
  onUpdate,
}: {
  methods: PaymentMethod[];
  onSubmit: (event: FormEvent<HTMLFormElement>, id?: string) => Promise<void>;
  onUpdate: (id: string, patch: Partial<PaymentMethod>) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const editingMethod = methods.find((method) => method.id === editingId);
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Payment Methods</h2>
          <p className="text-sm text-[var(--text-muted)]">Client-facing instructions used on invoice snapshots.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setEditingId("new")} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
        {methods.length === 0 ? <p className="py-4 text-sm text-[var(--text-muted)]">No payment methods configured.</p> : null}
        {methods.map((method) => (
          <div key={method.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-white">{method.name}</p>
              <p className="text-sm text-[var(--text-muted)]">
                {method.method_type.replace("_", " ")} · {method.display_name || "No display name"} · {method.is_active ? "Active" : "Inactive"}
                {method.is_default ? " · Default" : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditingId(method.id)} className="gap-2"><Pencil className="h-4 w-4" /> Edit</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void onUpdate(method.id, { is_active: !method.is_active, is_default: method.is_active ? false : method.is_default })}
                className="gap-2"
              >
                <Power className="h-4 w-4" /> {method.is_active ? "Deactivate" : "Activate"}
              </Button>
              {method.is_active && !method.is_default ? (
                <Button type="button" variant="ghost" onClick={() => void onUpdate(method.id, { is_default: true })} className="gap-2">
                  <Star className="h-4 w-4" /> Set default
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {editingId ? (
        <PaymentMethodForm
          key={editingId}
          method={editingMethod}
          onCancel={() => setEditingId(null)}
          onSubmit={async (event) => {
            await onSubmit(event, editingMethod?.id);
          }}
        />
      ) : null}
    </Card>
  );
}

function PaymentMethodForm({
  method,
  onCancel,
  onSubmit,
}: {
  method?: PaymentMethod;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [methodType, setMethodType] = useState<PaymentMethodType>(method?.method_type ?? "bank_transfer");
  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-4 border-t border-white/[0.08] pt-4 md:grid-cols-2">
      <Field label="Internal name" name="name" defaultValue={method?.name} required />
      <Field label="Display name" name="display_name" defaultValue={method?.display_name} />
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium text-slate-200">Type</span>
        <select name="method_type" value={methodType} onChange={(event) => setMethodType(event.target.value as PaymentMethodType)} className="w-full rounded-md border border-white/[0.12] bg-[#151b22] px-3 py-2 text-white">
          <option value="bank_transfer">Bank transfer</option>
          <option value="paypal">PayPal</option>
          <option value="cash">Cash</option>
          <option value="other">Other</option>
        </select>
      </label>
      {methodType === "bank_transfer" ? (
        <>
          <Field label="Bank name" name="bank_name" defaultValue={method?.bank_name} />
          <Field label="Account holder" name="account_holder" defaultValue={method?.account_holder} />
          <Field label="Account number" name="account_number" defaultValue={method?.account_number} />
          <Field label="Account type" name="account_type" defaultValue={method?.account_type} />
          <Field label="Currency" name="currency" defaultValue={method?.currency} />
        </>
      ) : null}
      {methodType === "paypal" ? (
        <>
          <Field label="PayPal email" name="paypal_email" type="email" defaultValue={method?.paypal_email} />
          <Field label="Payment URL" name="payment_url" defaultValue={method?.payment_url} />
          <Field label="Currency" name="currency" defaultValue={method?.currency} />
        </>
      ) : null}
      {methodType === "other" ? (
        <>
          <Field label="Payment URL" name="payment_url" defaultValue={method?.payment_url} />
          <Field label="Currency" name="currency" defaultValue={method?.currency} />
        </>
      ) : null}
      <div className="md:col-span-2"><Field label="Additional instructions" name="instructions" as="textarea" defaultValue={method?.instructions} /></div>
      <label className="flex items-center gap-2 text-sm text-slate-200"><input name="is_active" type="checkbox" defaultChecked={method?.is_active ?? true} /> Active</label>
      <label className="flex items-center gap-2 text-sm text-slate-200"><input name="is_default" type="checkbox" defaultChecked={method?.is_default ?? false} /> Default</label>
      <div className="flex gap-2 md:col-span-2">
        <Button className="gap-2"><CircleDollarSign className="h-4 w-4" /> {method ? "Update Payment Method" : "Create Payment Method"}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
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
