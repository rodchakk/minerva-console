import Link from "next/link";
import { Rubik } from "next/font/google";
import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  LifeBuoy,
} from "lucide-react";
import { entryButtonClass } from "@/components/ui/entryButtonStyles";
import { cn } from "@/lib/supabase/utils";
import { EntryPushControl } from "@/features/entry/push/EntryPushControl";
import {
  getEntrySupportTickets,
  type SupportStatus,
} from "@/features/entry/support/queries";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const dynamic = "force-dynamic";

const filters: Array<{ label: string; value: SupportStatus | null }> = [
  { label: "All", value: null },
  { label: "Received", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
];

const statusCopy = {
  open: {
    label: "Received",
    className: "border-sky-400/20 bg-sky-500/10 text-sky-200",
  },
  in_progress: {
    label: "In progress",
    className: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  },
  resolved: {
    label: "Resolved",
    className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
  },
} as const;

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusFromQuery(value?: string): SupportStatus | null {
  if (value === "open" || value === "in_progress" || value === "resolved") {
    return value;
  }
  return null;
}

function Metric({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="min-h-[94px] px-4 py-3.5">
      <div className="flex items-center gap-2 text-[#8F879D]">
        <span className="grid size-7 place-items-center rounded-[6px] border border-white/[0.09] bg-white/[0.02] text-[#CFC7FF]">
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-[10px] text-[#A9A3B2]">{helper}</p>
    </div>
  );
}

export default async function EntrySupportTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const activeStatus = statusFromQuery(params.status);
  const { tickets: allTickets, loadError } = await getEntrySupportTickets(null);
  const tickets = activeStatus
    ? allTickets.filter((ticket) => ticket.status === activeStatus)
    : allTickets;

  const counts = {
    all: allTickets.length,
    open: allTickets.filter((ticket) => ticket.status === "open").length,
    inProgress: allTickets.filter((ticket) => ticket.status === "in_progress").length,
    resolved: allTickets.filter((ticket) => ticket.status === "resolved").length,
  };

  return (
    <div
      className={cn(
        rubik.className,
        "relative -mx-4 -my-4 min-h-[calc(100vh-4rem)] bg-[#2E2936] px-4 py-5 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 2xl:-mx-7 2xl:px-7",
      )}
    >
      <div className="space-y-3">
        <header className="flex flex-col gap-4 px-0.5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
              ENTRY SUPPORT
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
              Support tickets
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#A9A3B2]">
              Review, reply to, and resolve support requests from ENTRY in one operational workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <EntryPushControl surface="console" />
          </div>
        </header>

        <section className="relative grid overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF] sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={<LifeBuoy className="size-4" />}
            label="All tickets"
            value={counts.all}
            helper="Across all support states"
          />
          <Metric
            icon={<CircleDot className="size-4" />}
            label="Received"
            value={counts.open}
            helper="Waiting for first review"
          />
          <Metric
            icon={<Clock3 className="size-4" />}
            label="In progress"
            value={counts.inProgress}
            helper="Currently being reviewed"
          />
          <Metric
            icon={<CheckCircle2 className="size-4" />}
            label="Resolved"
            value={counts.resolved}
            helper="Closed support work"
          />
        </section>

        <section className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF]">
          <div className="flex flex-col gap-3 border-b border-[#141119] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Ticket queue</h2>
              <p className="mt-1 text-[10px] text-[#A9A3B2]">
                {tickets.length} visible · select a ticket to open the support workspace
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const active = activeStatus === filter.value;
                const href = filter.value
                  ? `/products/entry/tickets?status=${filter.value}`
                  : "/products/entry/tickets";

                return (
                  <Link
                    key={filter.label}
                    href={href}
                    className={entryButtonClass(
                      active ? "primary" : "secondary",
                      "min-w-[96px]",
                    )}
                  >
                    {filter.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {loadError ? (
            <div className="m-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {loadError}
            </div>
          ) : null}

          {tickets.length === 0 && !loadError ? (
            <div className="grid min-h-[360px] place-items-center px-6 text-center">
              <div>
                <LifeBuoy className="mx-auto size-8 text-[#8F879D]" />
                <p className="mt-3 text-sm font-semibold text-white">
                  No tickets in this view
                </p>
                <p className="mt-1 text-xs text-[#A9A3B2]">
                  New support requests will appear here.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[980px] table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[18%]" />
                    <col className="w-[19%]" />
                    <col className="w-[15%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                    <col className="w-[9%]" />
                    <col className="w-9" />
                  </colgroup>
                  <thead className="border-b border-[#141119] bg-[#1F1B26] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                    <tr>
                      <th className="px-4 py-2.5">Ticket</th>
                      <th className="px-4 py-2.5">Requester</th>
                      <th className="px-4 py-2.5">Community</th>
                      <th className="px-4 py-2.5">Category</th>
                      <th className="px-4 py-2.5">Source</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Updated</th>
                      <th className="px-2 py-2.5">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141119]">
                    {tickets.map((ticket) => {
                      const status = statusCopy[ticket.status];
                      return (
                        <tr
                          key={ticket.id}
                          className="group transition-colors hover:bg-white/[0.018]"
                        >
                          <td className="px-4 py-3">
                            <Link
                              href={`/products/entry/tickets/${ticket.id}`}
                              className="font-semibold text-white hover:text-[#D8D1FF]"
                            >
                              {ticket.ticketNumber}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <p className="truncate font-semibold text-white">
                              {ticket.requesterName}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[#CFC9D6]">
                            <p className="truncate">{ticket.communityName}</p>
                          </td>
                          <td className="px-4 py-3 text-[#CFC9D6]">
                            <p className="truncate">{ticket.category}</p>
                          </td>
                          <td className="px-4 py-3 text-[#A9A3B2]">
                            {ticket.source === "mobile" ? "ENTRY Mobile" : "ENTRY Web"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-[4px] border px-2 py-1 text-[10px] font-semibold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-[#A9A3B2]">
                            {formatDate(ticket.updatedAt)}
                          </td>
                          <td className="px-2 py-3 text-right">
                            <Link
                              href={`/products/entry/tickets/${ticket.id}`}
                              aria-label={`Open ${ticket.ticketNumber}`}
                              className="inline-grid size-7 place-items-center rounded-md text-[#8F879D] transition group-hover:text-white"
                            >
                              <ChevronRight className="size-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-[#141119] md:hidden">
                {tickets.map((ticket) => {
                  const status = statusCopy[ticket.status];
                  return (
                    <Link
                      key={ticket.id}
                      href={`/products/entry/tickets/${ticket.id}`}
                      className="block px-4 py-4 transition hover:bg-white/[0.025]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#BEB4FF]">
                            {ticket.ticketNumber}
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-white">
                            {ticket.requesterName}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-[4px] border px-2 py-1 text-[10px] font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-[#CFC9D6]">{ticket.category}</p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#8F879D]">
                        <span className="truncate">
                          {ticket.communityName} · {ticket.source === "mobile" ? "Mobile" : "Web"}
                        </span>
                        <span className="shrink-0">{formatDate(ticket.updatedAt)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
