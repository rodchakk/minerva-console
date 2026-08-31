import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { notFound } from "next/navigation";
import {
  replyToEntrySupportTicket,
  updateEntrySupportTicketStatus,
} from "@/features/entry/support/actions";
import { getEntrySupportTicket } from "@/features/entry/support/queries";

export const dynamic = "force-dynamic";

const statusCopy = {
  open: { label: "Recibido", className: "border-sky-400/20 bg-sky-500/10 text-sky-200" },
  in_progress: { label: "En revisión", className: "border-amber-400/20 bg-amber-500/10 text-amber-200" },
  resolved: { label: "Resuelto", className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200" },
} as const;

function formatDateTime(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function metadataRows(metadata: Record<string, unknown>) {
  const labels: Record<string, string> = {
    platform: "Platform",
    app_version: "App version",
    build: "Build",
    os: "OS",
    surface: "Surface",
  };

  return Object.entries(metadata)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .slice(0, 6)
    .map(([key, value]) => ({ label: labels[key] ?? key.replaceAll("_", " "), value: String(value) }));
}

export default async function EntrySupportTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ sent?: string; updated?: string; error?: string }>;
}) {
  const { ticketId } = await params;
  const query = await searchParams;
  const { ticket, messages, loadError } = await getEntrySupportTicket(ticketId);

  if (!ticket) notFound();

  const status = statusCopy[ticket.status];
  const metadata = metadataRows(ticket.metadata);

  return (
    <div className="space-y-5 pt-5">
      <Link
        href="/products/entry/tickets"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </Link>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">{ticket.ticketNumber}</p>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{ticket.category}</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {ticket.requesterName} · {ticket.communityName} · {ticket.source === "mobile" ? "Mobile" : "Web"}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Creado {formatDateTime(ticket.createdAt)} · Actualizado {formatDateTime(ticket.updatedAt)}</p>
          </div>

          <form action={updateEntrySupportTicketStatus} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <select
              name="status"
              defaultValue={ticket.status}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/40"
            >
              <option value="open">Recibido</option>
              <option value="in_progress">En revisión</option>
              <option value="resolved">Resuelto</option>
            </select>
            <button type="submit" className="rounded-lg border border-violet-400/20 bg-violet-500/12 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/18">
              Guardar estado
            </button>
          </form>
        </div>
      </section>

      {query.sent === "1" ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Respuesta enviada.</div>
      ) : null}
      {query.updated === "1" ? (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">Estado actualizado.</div>
      ) : null}
      {query.error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">No pudimos completar la acción. Intenta nuevamente.</div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">Conversation</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Ticket activity</h2>
            </div>
          </div>

          {loadError ? (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">Algunos mensajes no pudieron cargarse.</div>
          ) : null}

          <div className="mt-5 space-y-4">
            <div className="flex justify-start">
              <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 sm:max-w-[78%]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200">{ticket.requesterName}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white">{ticket.description}</p>
                <p className="mt-2 text-[11px] text-[var(--text-muted)]">{formatDateTime(ticket.createdAt)}</p>
              </div>
            </div>

            {messages.map((message) => {
              const staff = message.authorType === "staff";
              return (
                <div key={message.id} className={`flex ${staff ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[78%] ${staff ? "rounded-br-md border border-violet-400/18 bg-violet-500/12" : "rounded-bl-md border border-[var(--border)] bg-[var(--surface-strong)]"}`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${staff ? "text-violet-200" : "text-[var(--text-muted)]"}`}>
                      {staff ? "Minerva Support" : ticket.requesterName}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white">{message.body}</p>
                    <p className="mt-2 text-[11px] text-[var(--text-muted)]">{formatDateTime(message.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <form action={replyToEntrySupportTicket} className="mt-6 border-t border-[var(--border)] pt-5">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]" htmlFor="support-reply">
              Reply
            </label>
            <textarea
              id="support-reply"
              name="body"
              required
              maxLength={4000}
              rows={4}
              placeholder="Escribe una respuesta para el usuario..."
              className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3.5 py-3 text-sm leading-6 text-white outline-none placeholder:text-[var(--text-muted)] focus:border-violet-400/40"
            />
            <button type="submit" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-500/12 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/18">
              <Send className="h-4 w-4" />
              Send reply
            </button>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">Context</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Requester</dt>
                <dd className="mt-1 font-medium text-white">{ticket.requesterName}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Community</dt>
                <dd className="mt-1 font-medium text-white">{ticket.communityName}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Source</dt>
                <dd className="mt-1 font-medium text-white">{ticket.source === "mobile" ? "ENTRY Mobile" : "ENTRY Web"}</dd>
              </div>
            </dl>
          </section>

          {metadata.length > 0 ? (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">Technical context</p>
              <dl className="mt-4 space-y-3 text-sm">
                {metadata.map((item) => (
                  <div key={item.label}>
                    <dt className="capitalize text-xs text-[var(--text-muted)]">{item.label}</dt>
                    <dd className="mt-1 break-words font-medium text-white">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
