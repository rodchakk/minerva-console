import Link from "next/link";
import { ArrowLeft, ArrowRight, MessageSquareText } from "lucide-react";
import { getFieldTickets, type FieldTicketStatus } from "@/features/entry/field/ticketData";

type TicketFilter = "active" | "all" | FieldTicketStatus;

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeFilter(value: string): TicketFilter {
  return ["all", "open", "in_progress", "resolved"].includes(value)
    ? (value as TicketFilter)
    : "active";
}

function statusLabel(status: FieldTicketStatus) {
  if (status === "in_progress") return "In progress";
  if (status === "resolved") return "Resolved";
  return "Open";
}

function statusClass(status: FieldTicketStatus) {
  if (status === "resolved") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  }
  if (status === "in_progress") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-100";
  }
  return "border-amber-300/30 bg-amber-300/10 text-amber-100";
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(date);
}

const filters: Array<{ label: string; value: TicketFilter }> = [
  { label: "Active", value: "active" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "All", value: "all" },
];

export default async function FieldEntryTicketsPage({
  searchParams,
}: PageProps<"/field/entry/tickets">) {
  const params = await searchParams;
  const filter = normalizeFilter(getParam(params.status));
  const data = await getFieldTickets();
  const tickets = data.tickets.filter((ticket) => {
    if (filter === "all") return true;
    if (filter === "active") return ticket.status !== "resolved";
    return ticket.status === filter;
  });

  return (
    <div className="space-y-4">
      <Link
        href="/field/entry"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        ENTRY
      </Link>

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          ENTRY Field
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--console-text)]">Tickets</h1>
            <p className="mt-1 text-sm leading-5 text-[var(--console-text-muted)]">
              Support conversations from ENTRY.
            </p>
          </div>
          <span className="rounded-full border border-[var(--console-border)] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-[var(--console-text-muted)]">
            {tickets.length}
          </span>
        </div>
      </section>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Ticket filters">
        {filters.map((item) => {
          const active = item.value === filter;
          const href =
            item.value === "active"
              ? "/field/entry/tickets"
              : `/field/entry/tickets?status=${item.value}`;
          return (
            <Link
              key={item.value}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 text-xs font-bold ${
                active
                  ? "border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-text)]"
                  : "border-[var(--console-border)] bg-white/[0.03] text-[var(--console-text-muted)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {data.error ? (
        <section className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
          Tickets are unavailable right now. Try again before treating this as an empty inbox.
        </section>
      ) : null}

      {!data.error && tickets.length === 0 ? (
        <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5 text-center">
          <MessageSquareText aria-hidden="true" className="mx-auto h-6 w-6 text-[var(--console-text-soft)]" />
          <p className="mt-2 text-sm font-semibold text-[var(--console-text)]">No tickets here.</p>
        </section>
      ) : null}

      <section className="grid gap-2.5" aria-label="Support tickets">
        {tickets.map((ticket) => (
          <Link
            key={ticket.id}
            href={`/field/entry/tickets/${encodeURIComponent(ticket.id)}`}
            className="group flex min-h-24 items-center justify-between gap-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-3.5 transition-colors hover:border-[var(--console-accent-border)] hover:bg-[var(--console-surface-hover)] active:bg-white/[0.08]"
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[var(--console-text)]">
                  {ticket.requesterName}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] ${statusClass(ticket.status)}`}>
                  {statusLabel(ticket.status)}
                </span>
              </span>
              <span className="mt-1 block text-xs font-semibold text-[var(--console-text-muted)]">
                {ticket.ticketNumber} · {ticket.category} · {ticket.communityName}
              </span>
              <span className="mt-1.5 line-clamp-2 block break-words text-sm leading-5 text-[var(--console-text-soft)]">
                {ticket.description}
              </span>
              <span className="mt-1.5 block text-[11px] text-[var(--console-text-soft)]">
                Updated {formatUpdatedAt(ticket.updatedAt)}
              </span>
            </span>
            <ArrowRight
              aria-hidden="true"
              className="h-5 w-5 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-[var(--console-text)]"
            />
          </Link>
        ))}
      </section>
    </div>
  );
}
