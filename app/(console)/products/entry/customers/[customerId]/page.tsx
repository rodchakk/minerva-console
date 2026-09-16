import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Edit3,
  Mail,
  Phone,
  Plus,
  Scale,
  StickyNote,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import {
  formatBillingChannel,
  formatCustomerDate,
  formatCustomerStatus,
  getCustomerProfile,
  type CustomerContact,
} from "@/features/entry/customers/queries";
import { cn } from "@/lib/supabase/utils";

function DetailCard({
  children,
  className,
  title,
  icon,
}: {
  children: React.ReactNode;
  className?: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-[var(--console-border)] pb-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] text-slate-200">
          {icon}
        </span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ContactBlock({ contact }: { contact: CustomerContact }) {
  return (
    <div className="rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{contact.name}</p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
            {contact.isPrimary ? "Primary Contact" : contact.role || "Additional contact"}
          </p>
        </div>
        {contact.isPrimary ? <Badge tone="info">Primary</Badge> : null}
      </div>
      <div className="mt-4 space-y-2 text-sm text-slate-300">
        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0 stroke-[1.75] text-[var(--console-text-muted)]" />
          {contact.phone || "No phone set"}
        </p>
        <p className="flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0 stroke-[1.75] text-[var(--console-text-muted)]" />
          {contact.email || "No email set"}
        </p>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--console-border)] py-3 last:border-b-0">
      <span className="text-sm text-[var(--console-text-muted)]">{label}</span>
      <span className="text-right text-sm font-medium text-slate-100">{value}</span>
    </div>
  );
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
        "inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
        variant === "primary"
          ? "border border-transparent bg-[var(--console-accent)] text-white hover:bg-[var(--console-accent-hover)]"
          : "border border-[var(--console-border)] bg-white/[0.025] text-slate-100 hover:bg-white/[0.05]",
      )}
    >
      {children}
    </Link>
  );
}

export default async function CustomerDetailPage(
  props: {
    params: Promise<{ customerId: string }>;
  },
) {
  const { customerId } = await props.params;
  const customer = await getCustomerProfile(customerId);

  if (!customer) {
    notFound();
  }

  const additionalContacts = customer.contacts.filter((contact) => !contact.isPrimary);

  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              ENTRY · Customers
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
                {customer.customerName}
              </h1>
              <Badge tone={customer.status === "active" ? "success" : "default"}>
                {formatCustomerStatus(customer.status)}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Customer profile for {customer.community?.name ?? "an ENTRY community"}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/products/entry/customers"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-[var(--console-border-strong)] bg-white/[0.025] px-3.5 text-sm font-semibold text-slate-100 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
            >
              Back to customers
            </Link>
            <Link
              href={`/products/entry/customers/${customer.id}/edit`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-[var(--console-accent)] px-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--console-accent-hover)]"
            >
              <Edit3 className="h-4 w-4 stroke-[1.75]" />
              Edit customer info
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <DetailCard
            icon={<UserRound className="h-4 w-4 stroke-[1.75]" />}
            title="Customer info"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {customer.primaryContact ? (
                <ContactBlock contact={customer.primaryContact} />
              ) : (
                <div className="rounded-md border border-dashed border-[var(--console-border)] bg-white/[0.015] p-4 text-sm text-[var(--console-text-muted)]">
                  No primary contact set.
                </div>
              )}

              {additionalContacts.length > 0 ? (
                additionalContacts.map((contact) => (
                  <ContactBlock key={contact.id} contact={contact} />
                ))
              ) : (
                <div className="rounded-md border border-dashed border-[var(--console-border)] bg-white/[0.015] p-4 text-sm text-[var(--console-text-muted)]">
                  No additional contacts added.
                </div>
              )}
            </div>
          </DetailCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <DetailCard
              icon={<WalletCards className="h-4 w-4 stroke-[1.75]" />}
              title="Billing"
            >
              <div className="space-y-3 text-sm">
                <SummaryRow
                  label="Billing contact"
                  value={customer.billingContactName || "Not set"}
                />
                <SummaryRow
                  label="Billing email"
                  value={customer.billingEmail || "Not set"}
                />
                <SummaryRow
                  label="Preferred channel"
                  value={formatBillingChannel(customer.billingPreferredChannel)}
                />
              </div>
              {customer.billingNotes ? (
                <p className="mt-4 rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-4 py-3 text-sm leading-6 text-slate-200">
                  {customer.billingNotes}
                </p>
              ) : null}
            </DetailCard>

            <DetailCard
              icon={<CalendarDays className="h-4 w-4 stroke-[1.75]" />}
              title="Contract"
            >
              <div className="space-y-3 text-sm">
                <SummaryRow
                  label="Contract date"
                  value={formatCustomerDate(customer.contractDate)}
                />
                <SummaryRow
                  label="Status"
                  value={formatCustomerStatus(customer.status)}
                />
              </div>
            </DetailCard>

            <DetailCard
              icon={<Scale className="h-4 w-4 stroke-[1.75]" />}
              title="Legal info"
            >
              <div className="space-y-3 text-sm">
                <SummaryRow
                  label="Legal name"
                  value={customer.legalName || "Not set"}
                />
                <SummaryRow label="RTN / Tax ID" value={customer.taxId || "Not set"} />
              </div>
            </DetailCard>

            <DetailCard
              icon={<StickyNote className="h-4 w-4 stroke-[1.75]" />}
              title="Internal notes"
            >
              <p className="text-sm leading-6 text-slate-200">
                {customer.internalNotes || "No internal notes added."}
              </p>
            </DetailCard>
          </div>
        </div>

        <aside className="space-y-5">
          <DetailCard
            icon={<Building2 className="h-4 w-4 stroke-[1.75]" />}
            title="Quick summary"
          >
            <SummaryRow
              label="Linked community"
              value={
                customer.community ? (
                  <Link
                    href={`/products/entry/communities/${customer.community.id}`}
                    className="inline-flex items-center gap-1 text-violet-200 transition-colors hover:text-white"
                  >
                    {customer.community.name}
                    <ArrowUpRight className="h-3.5 w-3.5 stroke-[1.75]" />
                  </Link>
                ) : (
                  "Not available"
                )
              }
            />
            <SummaryRow
              label="Status"
              value={
                <Badge tone={customer.status === "active" ? "success" : "default"}>
                  {formatCustomerStatus(customer.status)}
                </Badge>
              }
            />
            <SummaryRow
              label="Contract date"
              value={formatCustomerDate(customer.contractDate)}
            />
            <SummaryRow
              label="Last updated"
              value={formatCustomerDate(customer.updatedAt, "Not available")}
            />
          </DetailCard>

          <DetailCard
            icon={<Edit3 className="h-4 w-4 stroke-[1.75]" />}
            title="Actions"
          >
            <div className="space-y-3">
              <ActionLink
                href={`/products/entry/customers/${customer.id}/edit`}
                variant="primary"
              >
                <Edit3 className="h-4 w-4 stroke-[1.75]" />
                Edit customer info
              </ActionLink>
              <ActionLink href={`/products/entry/customers/${customer.id}/edit`}>
                <Plus className="h-4 w-4 stroke-[1.75]" />
                Add contact
              </ActionLink>
              <ActionLink href={`/products/entry/customers/${customer.id}/edit`}>
                <StickyNote className="h-4 w-4 stroke-[1.75]" />
                Add/edit internal note
              </ActionLink>
            </div>
          </DetailCard>
        </aside>
      </section>
    </div>
  );
}
