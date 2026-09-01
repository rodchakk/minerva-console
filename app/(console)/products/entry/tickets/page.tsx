import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import {
  getEntrySupportTickets,
  type SupportStatus,
} from "@/features/entry/support/queries";

export const dynamic = "force-dynamic";

const filters: Array<{ label: string; value: SupportStatus | null }> = [
  { label: "Todos", value: null },
  { label: "Recibidos", value: "open" },
  { label: "En revisión", value: "in_progress" },
  { label: "Resueltos", value: "resolved" },
];

const statusCopy = {
  open: { label: "Recibido", className: "border-sky-400/20 bg-sky-500/10 text-sky-200" },
  in_progress: { label: "En revisión", className: "border-amber-400/20 bg-amber-500/10 text-amber-200" },
  resolved: { label: "Resuelto", className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" },
} as const;

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusFromQuery(value?: string): SupportStatus | null {
  if (value === "open" || value === "in_progress" || value === "resolved") return value;
  return null;
}

export default async function EntrySupportTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const activeStatus = statusFromQuery(params.status);
  const { tickets, loadError } = await getEntrySupportTickets(activeStatus);

  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              ENTRY SUPPORT
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
              Support tickets
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Revisa, responde y resuelve solicitudes enviadas desde ENTRY.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-400/15 bg-violet-500/10 text-violet-200">
            <LifeBuoy className="h-5 w-5 stroke-[1.75]" />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-3 sm:p-4">
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
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-violet-400/25 bg-violet-500/12 text-violet-100"
                    : "border-[var(--console-border)] bg-white/[0.025] text-[var(--console-text-muted)] hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </section>

      {loadError ? (
        <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {loadError}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
        {tickets.length === 0 && !loadError ? (
          <div className="px-6 py-14 text-center">
            <LifeBuoy className="mx-auto h-7 w-7 text-[var(--console-text-muted)]" />
            <p className="mt-3 text-sm font-semibold text-white">No hay tickets en esta vista</p>
            <p className="mt-1 text-xs text-[var(--console-text-muted)]">Las nuevas solicitudes aparecerán aquí.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="border-b border-[var(--console-border)] bg-[var(--console-surface-raised)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--console-text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Ticket</th>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Comunidad</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Origen</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Actualizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--console-border)]">
                  {tickets.map((ticket) => {
                    const status = statusCopy[ticket.status];
                    return (
                      <tr key={ticket.id} className="transition-colors hover:bg-white/[0.025]">
                        <td className="px-4 py-4">
                          <Link href={`/products/entry/tickets/${ticket.id}`} className="font-semibold text-violet-200 hover:text-white">
                            {ticket.ticketNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-white">{ticket.requesterName}</td>
                        <td className="px-4 py-4 text-[var(--console-text-muted)]">{ticket.communityName}</td>
                        <td className="max-w-48 truncate px-4 py-4 text-[var(--console-text-muted)]">{ticket.category}</td>
                        <td className="px-4 py-4 text-[var(--console-text-muted)]">{ticket.source === "mobile" ? "Mobile" : "Web"}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right text-xs text-[var(--console-text-muted)]">{formatDate(ticket.updatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[var(--console-border)] md:hidden">
              {tickets.map((ticket) => {
                const status = statusCopy[ticket.status];
                return (
                  <Link
                    key={ticket.id}
                    href={`/products/entry/tickets/${ticket.id}`}
                    className="block px-4 py-4 transition-colors hover:bg-white/[0.025]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-violet-200">{ticket.ticketNumber}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-white">{ticket.requesterName}</p>
                      </div>
                      <span className={`shrink-0 rounded-md border px-2.5 py-0.5 text-[10px] font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[var(--console-text-muted)]">{ticket.category}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--console-text-muted)]">
                      <span className="truncate">{ticket.communityName} · {ticket.source === "mobile" ? "Mobile" : "Web"}</span>
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
  );
}
