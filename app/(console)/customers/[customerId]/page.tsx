import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Edit3,
  Mail,
  Phone,
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

function Card({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5">
      <div className="flex items-center gap-3 border-b border-[var(--console-border)] pb-4">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] text-slate-200">
          {icon}
        </span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--console-border)] py-3 last:border-b-0">
      <span className="text-sm text-[var(--console-text-muted)]">{label}</span>
      <span className="text-right text-sm font-medium text-slate-100">{value}</span>
    </div>
  );
}

function Contact({ contact }: { contact: CustomerContact }) {
  return (
    <div className="rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] p-4">
      <div className="flex items-start justify-between gap-3">
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
          <Phone className="h-4 w-4 text-[var(--console-text-muted)]" />
          {contact.phone || "No phone set"}
        </p>
        <p className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-[var(--console-text-muted)]" />
          {contact.email || "No email set"}
        </p>
      </div>
    </div>
  );
}

export default async function CustomerDetailPage(props: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await props.params;
  const customer = await getCustomerProfile(customerId);

  if (!customer) {
    notFound();
  }

  const additionalContacts = customer.contacts.filter((contact) => !contact.isPrimary);

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-5 px-0.5 pt-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff8b8b]">
            Minerva · Customers
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
            Minerva customer profile. Product relationships are shown separately below.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/customers"
            className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] px-3.5 text-sm font-semibold text-slate-100 hover:bg-white/[0.05]"
          >
            Back to customers
          </Link>
          <Link
            href={`/customers/${customer.id}/edit`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#ff4d4d] px-3.5 text-sm font-semibold text-white hover:bg-[#ff6262]"
          >
            <Edit3 className="h-4 w-4" />
            Edit customer info
          </Link>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card icon={<UserRound className="h-4 w-4" />} title="Customer info">
            <div className="grid gap-4 lg:grid-cols-2">
              {customer.primaryContact ? <Contact contact={customer.primaryContact} /> : null}
              {additionalContacts.map((contact) => (
                <Contact key={contact.id} contact={contact} />
              ))}
              {!customer.primaryContact && additionalContacts.length === 0 ? (
                <p className="text-sm text-[var(--console-text-muted)]">No contacts added.</p>
              ) : null}
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card icon={<WalletCards className="h-4 w-4" />} title="Billing">
              <Row label="Billing contact" value={customer.billingContactName || "Not set"} />
              <Row label="Billing email" value={customer.billingEmail || "Not set"} />
              <Row label="Preferred channel" value={formatBillingChannel(customer.billingPreferredChannel)} />
              {customer.billingNotes ? (
                <p className="mt-4 rounded-md border border-[var(--console-border)] bg-[var(--console-surface-raised)] px-4 py-3 text-sm leading-6 text-slate-200">
                  {customer.billingNotes}
                </p>
              ) : null}
            </Card>

            <Card icon={<CalendarDays className="h-4 w-4" />} title="Contract">
              <Row label="Contract date" value={formatCustomerDate(customer.contractDate)} />
              <Row label="Status" value={formatCustomerStatus(customer.status)} />
            </Card>

            <Card icon={<Scale className="h-4 w-4" />} title="Legal info">
              <Row label="Legal name" value={customer.legalName || "Not set"} />
              <Row label="RTN / Tax ID" value={customer.taxId || "Not set"} />
            </Card>

            <Card icon={<StickyNote className="h-4 w-4" />} title="Internal notes">
              <p className="text-sm leading-6 text-slate-200">
                {customer.internalNotes || "No internal notes added."}
              </p>
            </Card>
          </div>
        </div>

        <aside className="space-y-5">
          <Card icon={<Building2 className="h-4 w-4" />} title="Products & services">
            {customer.community ? (
              <div className="rounded-md border border-violet-400/15 bg-violet-400/[0.05] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-violet-200">ENTRY</p>
                <Link
                  href={`/products/entry/communities/${customer.community.id}`}
                  className="mt-2 flex items-center justify-between gap-3 text-sm font-semibold text-white hover:text-violet-100"
                >
                  <span>{customer.community.name}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <p className="mt-2 text-xs leading-5 text-[var(--console-text-muted)]">
                  Linked ENTRY community. The customer itself belongs to Minerva Technologies.
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--console-text-muted)]">No product relationship linked.</p>
            )}
          </Card>

          <Card icon={<CalendarDays className="h-4 w-4" />} title="Quick summary">
            <Row label="Status" value={formatCustomerStatus(customer.status)} />
            <Row label="Created" value={formatCustomerDate(customer.createdAt, "—")} />
            <Row label="Last updated" value={formatCustomerDate(customer.updatedAt, "—")} />
          </Card>
        </aside>
      </section>
    </div>
  );
}
