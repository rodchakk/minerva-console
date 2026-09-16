import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  Plus,
  Search,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  formatCustomerDate,
  formatCustomerStatus,
  listCustomerProfiles,
  type CustomerListItem,
} from "@/features/entry/customers/queries";
import { cn } from "@/lib/supabase/utils";

type CustomerFilter = "active" | "inactive" | "all";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function filterCustomers(
  customers: CustomerListItem[],
  status: CustomerFilter,
) {
  if (status === "all") {
    return customers;
  }

  return customers.filter((customer) => customer.status === status);
}

function ActionLink({
  children,
  href,
  variant = "secondary",
}: {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
        variant === "primary"
          ? "border border-transparent bg-[var(--console-accent)] text-white hover:bg-[var(--console-accent-hover)]"
          : "border border-[var(--console-border-strong)] bg-white/[0.025] text-slate-100 hover:border-white/20 hover:bg-white/[0.05]",
      )}
    >
      {children}
    </Link>
  );
}

function MetricItem({
  icon: Icon,
  label,
  value,
  note,
  className,
}: {
  className?: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  note: string;
  value: React.ReactNode;
}) {
  return (
    <article className={cn("px-5 py-4", className)}>
      <p className="text-xs font-medium text-[var(--console-text-muted)]">
        {label}
      </p>
      <div className="mt-2 grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--console-border-strong)] bg-white/[0.025] text-slate-300">
          <Icon className="h-4.5 w-4.5 stroke-[1.75]" />
        </span>
        <p className="min-w-0 text-2xl font-semibold tracking-tight text-white">
          {value}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-[36px_minmax(0,1fr)] gap-3.5">
        <span aria-hidden="true" />
        <p className="text-xs text-[var(--console-text-muted)]">{note}</p>
      </div>
    </article>
  );
}

function EmptyCustomers() {
  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-5 py-10 text-center">
      <h2 className="text-lg font-semibold text-white">No customer profiles found</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--console-text-muted)]">
        Customer profiles will appear here after Minerva staff creates them manually.
      </p>
      <div className="mt-6">
        <ActionLink href="/products/entry/customers/new" variant="primary">
          <Plus className="h-4 w-4 stroke-[1.75]" />
          New customer
        </ActionLink>
      </div>
    </section>
  );
}

export default async function CustomersPage(
  props: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
) {
  const searchParams = await props.searchParams;
  const query = getSingleParam(searchParams.q).trim();
  const rawStatus = getSingleParam(searchParams.status);
  const currentStatus: CustomerFilter =
    rawStatus === "inactive" || rawStatus === "all" ? rawStatus : "active";
  const customers = await listCustomerProfiles({
    query,
    status: "all",
  });
  const filteredCustomers = filterCustomers(customers, currentStatus);
  const activeCount = customers.filter((customer) => customer.status === "active").length;
  const inactiveCount = customers.filter((customer) => customer.status === "inactive").length;
  const filters: Array<{ href: string; label: string; value: CustomerFilter }> = [
    {
      href: query
        ? `/products/entry/customers?q=${encodeURIComponent(query)}`
        : "/products/entry/customers",
      label: "Active",
      value: "active",
    },
    {
      href: `/products/entry/customers?status=inactive${query ? `&q=${encodeURIComponent(query)}` : ""}`,
      label: "Inactive",
      value: "inactive",
    },
    {
      href: `/products/entry/customers?status=all${query ? `&q=${encodeURIComponent(query)}` : ""}`,
      label: "All customers",
      value: "all",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              ENTRY DIRECTORY
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
              Customer profiles
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Manual customer records for ENTRY communities, contacts, billing, legal details, and internal notes.
            </p>
          </div>

          <ActionLink href="/products/entry/customers/new" variant="primary">
            <Plus className="h-4 w-4 stroke-[1.75]" />
            New customer
          </ActionLink>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] md:grid-cols-3">
        <MetricItem
          className="border-b border-[var(--console-border)] md:border-r md:border-b-0"
          icon={UserRound}
          label="Total profiles"
          note="Manual customer records"
          value={customers.length}
        />
        <MetricItem
          className="border-b border-[var(--console-border)] md:border-r md:border-b-0"
          icon={Building2}
          label="Active customers"
          note="Currently active"
          value={activeCount}
        />
        <MetricItem
          icon={WalletCards}
          label="Inactive customers"
          note="Retained for reference"
          value={inactiveCount}
        />
      </section>

      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <nav
          aria-label="Customer filters"
          className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-1"
        >
          {filters.map((filter) => {
            const isActive = currentStatus === filter.value;

            return (
              <Link
                key={filter.value}
                href={filter.href}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
                  isActive
                    ? "bg-[var(--console-accent-subtle)] text-violet-100 ring-1 ring-inset ring-[var(--console-accent-border)]"
                    : "text-[var(--console-text-muted)] hover:bg-white/[0.035] hover:text-slate-100",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>

        <form className="relative w-full md:max-w-sm">
          {currentStatus !== "active" ? (
            <input type="hidden" name="status" value={currentStatus} />
          ) : null}
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--console-text-muted)]" />
          <input
            name="q"
            defaultValue={query}
            className="h-9 w-full rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-[var(--console-text-soft)] focus:border-[var(--console-accent-border)]"
            placeholder="Search customers"
          />
        </form>
      </section>

      {filteredCustomers.length > 0 ? (
        <section className="overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                <tr>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Linked community</th>
                  <th className="px-4 py-3 font-medium">Primary contact</th>
                  <th className="px-4 py-3 font-medium">Billing</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last updated</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--console-border)]">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{customer.customerName}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {customer.community ? (
                        <Link
                          href={`/products/entry/communities/${customer.community.id}`}
                          className="font-medium text-slate-100 transition-colors hover:text-white"
                        >
                          {customer.community.name}
                        </Link>
                      ) : (
                        "Community unavailable"
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-white">
                        {customer.primaryContact?.name ?? "No primary contact"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                        {customer.primaryContact?.email ||
                          customer.primaryContact?.phone ||
                          "No contact detail"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-white">
                        {customer.billingContactName || "Not set"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                        {customer.billingEmail || "No billing email"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={customer.status === "active" ? "success" : "default"}>
                        {formatCustomerStatus(customer.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {formatCustomerDate(customer.updatedAt, "Not available")}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/products/entry/customers/${customer.id}`}
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-[var(--console-border)] bg-white/[0.025] px-3 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
                      >
                        View
                        <ArrowUpRight className="h-3.5 w-3.5 stroke-[1.75]" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyCustomers />
      )}
    </div>
  );
}
