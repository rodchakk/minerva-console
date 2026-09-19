import Link from "next/link";
import { Building2, ContactRound, Mail, Plus, Search } from "lucide-react";
import {
  formatCustomerDate,
  formatCustomerStatus,
  listCustomerProfiles,
} from "@/features/entry/customers/queries";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function CustomersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const query = getSingleParam(searchParams.q);
  const status = getSingleParam(searchParams.status) || "active";
  const customers = await listCustomerProfiles({ query, status });

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 px-0.5 pt-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff8b8b]">
            Minerva · Customers
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
            Customers
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
            Canonical customer directory for Minerva Technologies. Product relationships such as ENTRY are linked from each customer profile.
          </p>
        </div>

        <Link
          href="/customers/new"
          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-md bg-[#ff4d4d] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#ff6262]"
        >
          <Plus className="h-4 w-4 stroke-[1.75]" />
          New customer
        </Link>
      </section>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <form className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--console-text-muted)]" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Search customer, contact, email..."
              className="h-9 w-full rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-[var(--console-text-soft)] focus:border-[#ff4d4d]/60"
            />
          </div>
          <select
            name="status"
            defaultValue={status}
            className="h-9 rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-3 text-sm text-slate-100 outline-none focus:border-[#ff4d4d]/60"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <button
            type="submit"
            className="h-9 rounded-md border border-[var(--console-border)] bg-white/[0.03] px-4 text-xs font-semibold text-slate-100 hover:bg-white/[0.06]"
          >
            Filter
          </button>
        </form>
      </section>

      {customers.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_140px_110px] gap-4 border-b border-[var(--console-border)] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--console-text-muted)] lg:grid">
            <span>Customer</span>
            <span>Primary contact</span>
            <span>Billing</span>
            <span>Product link</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-[var(--console-border)]">
            {customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="grid gap-4 px-5 py-4 transition-colors hover:bg-white/[0.025] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_140px_110px] lg:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{customer.customerName}</p>
                  <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                    Updated {formatCustomerDate(customer.updatedAt, "—")}
                  </p>
                </div>

                <div className="min-w-0 text-sm text-slate-200">
                  <p className="truncate">{customer.primaryContact?.name || "Not set"}</p>
                  <p className="mt-1 truncate text-xs text-[var(--console-text-muted)]">
                    {customer.primaryContact?.phone || customer.primaryContact?.email || "No contact method"}
                  </p>
                </div>

                <div className="min-w-0 text-sm text-slate-200">
                  <p className="truncate">{customer.billingContactName || "Not set"}</p>
                  <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--console-text-muted)]">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {customer.billingEmail || "No billing email"}
                  </p>
                </div>

                <div className="min-w-0">
                  {customer.community ? (
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-violet-400/15 bg-violet-400/[0.06] px-2 py-1 text-xs text-violet-100">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">ENTRY</span>
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--console-text-muted)]">None</span>
                  )}
                </div>

                <span className="text-sm text-slate-200">{formatCustomerStatus(customer.status)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-[var(--console-border)] bg-[var(--console-surface)] px-6 py-12 text-center">
          <ContactRound className="mx-auto h-8 w-8 text-[var(--console-text-muted)]" />
          <h2 className="mt-4 font-semibold text-white">No customers found</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--console-text-muted)]">
            Add Minerva&apos;s first customer profile or adjust the current filters.
          </p>
        </section>
      )}
    </div>
  );
}
