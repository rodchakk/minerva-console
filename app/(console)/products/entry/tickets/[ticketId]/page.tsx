import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { updateEntrySupportTicketStatus } from "@/features/entry/support/actions";
import { SupportConversation } from "@/features/entry/support/SupportConversation";
import { SupportQuickTools } from "@/features/entry/support/SupportQuickTools";
import { getEntrySupportTicket } from "@/features/entry/support/queries";
import { cn } from "@/lib/supabase/utils";

export const dynamic = "force-dynamic";

type DetailRow = {
  label: string;
  value: string;
};

const statusCopy = {
  open: {
    className: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    label: "Received",
  },
  in_progress: {
    className: "border-amber-400/20 bg-amber-500/10 text-amber-200",
    label: "In progress",
  },
  resolved: {
    className: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
    label: "Resolved",
  },
} as const;

const categoryCopy: Record<string, string> = {
  accesos: "Access",
  cuenta: "Account",
  notificaciones: "Notifications",
  otro: "Other",
  pases: "Passes",
  reservas: "Reservations",
};

function formatDateTime(value: string) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCategory(value: string) {
  return categoryCopy[value.trim().toLowerCase()] ?? value;
}

function formatSource(value: "mobile" | "web") {
  return value === "mobile" ? "ENTRY Mobile" : "ENTRY Web";
}

function metadataString(
  metadata: Record<string, unknown>,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = metadata[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const text = String(value).trim();
      if (text) return text;
    }
  }

  return fallback;
}

function compactRows(rows: DetailRow[]) {
  return rows.filter((row) => row.value.trim());
}

function DetailSection({
  rows,
  title,
}: {
  rows: DetailRow[];
  title: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[11px] font-semibold uppercase text-violet-200">
        {title}
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-[var(--text-muted)]">{item.label}</dt>
            <dd className="mt-1 break-words font-medium text-white">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
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
  const { ticket, messages, requester, loadError } = await getEntrySupportTicket(ticketId);

  if (!ticket) notFound();

  const status = statusCopy[ticket.status];
  const category = formatCategory(ticket.category);
  const source = formatSource(ticket.source);
  const requesterRole = requester?.role || metadataString(ticket.metadata, ["role"]);
  const houseLabel =
    requester?.houseLabel ||
    metadataString(ticket.metadata, [
      "house_label",
      "houseLabel",
      "unit_label",
      "unitLabel",
      "unit",
      "house",
    ]);
  const contactRows = compactRows([
    { label: "Email", value: requester?.email ?? "" },
    { label: "Username", value: requester?.username ?? "" },
    { label: "Requester user ID", value: ticket.createdBy },
  ]);
  const contextRows = compactRows([
    { label: "Community", value: ticket.communityName },
    { label: "Source", value: source },
    { label: "Category", value: category },
    { label: "Role", value: requesterRole },
    { label: "House / unit", value: houseLabel },
    { label: "Created", value: formatDateTime(ticket.createdAt) },
    { label: "Updated", value: formatDateTime(ticket.updatedAt) },
  ]);
  const technicalRows = compactRows([
    {
      label: "App version",
      value: metadataString(ticket.metadata, ["app_version", "appVersion"]),
    },
    { label: "Build", value: metadataString(ticket.metadata, ["build"]) },
    {
      label: "Platform",
      value: metadataString(ticket.metadata, ["platform"]),
    },
    {
      label: "OS version",
      value: metadataString(ticket.metadata, ["os_version", "osVersion", "os"]),
    },
    {
      label: "Device model",
      value: metadataString(ticket.metadata, [
        "device_model",
        "deviceModel",
        "device",
      ]),
    },
    {
      label: "Surface",
      value: metadataString(ticket.metadata, ["surface"]),
    },
  ]);
  const diagnostics = compactRows([
    { label: "Ticket", value: ticket.ticketNumber },
    { label: "Requester", value: ticket.requesterName },
    { label: "Requester user ID", value: ticket.createdBy },
    { label: "Community", value: ticket.communityName },
    { label: "Community ID", value: ticket.communityId ?? "" },
    { label: "Source", value: source },
    { label: "Category", value: category },
    { label: "Status", value: status.label },
    ...technicalRows,
    { label: "Role", value: requesterRole },
    { label: "House / unit", value: houseLabel },
  ]);
  const residentHref =
    ticket.communityId && ticket.createdBy
      ? `/field/entry/communities/${encodeURIComponent(
          ticket.communityId,
        )}/people/residents/${encodeURIComponent(ticket.createdBy)}`
      : null;
  const communityHref = ticket.communityId
    ? `/products/entry/communities/${encodeURIComponent(ticket.communityId)}`
    : null;
  const resetDisabledReason = !ticket.communityId
    ? "Community ID is unavailable."
    : !ticket.createdBy
      ? "Requester user ID is unavailable."
      : undefined;

  return (
    <div className="space-y-4 pt-5">
      <Link
        href="/products/entry/tickets"
        className="inline-flex min-h-9 items-center gap-2 rounded-md px-1 text-sm font-semibold text-[var(--text-muted)] transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tickets
      </Link>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_18px_60px_rgba(2,6,23,0.18)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase text-violet-200">
                {ticket.ticketNumber}
              </p>
              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                  status.className,
                )}
              >
                {status.label}
              </span>
            </div>
            <h1 className="mt-2 truncate text-2xl font-semibold text-white sm:text-3xl">
              {category}
            </h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {ticket.requesterName} · {ticket.communityName} · {source}
            </p>
          </div>

          <form
            action={updateEntrySupportTicketStatus}
            className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center"
          >
            <input type="hidden" name="ticketId" value={ticket.id} />
            <label className="sr-only" htmlFor="ticket-status">
              Ticket status
            </label>
            <select
              id="ticket-status"
              name="status"
              defaultValue={ticket.status}
              className="h-10 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/40"
            >
              <option value="open">Received</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <button
              type="submit"
              className="h-10 rounded-md border border-violet-400/20 bg-violet-500/14 px-4 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20"
            >
              Save status
            </button>
          </form>
        </div>
      </section>

      {query.sent === "1" ? (
        <div className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Reply sent.
        </div>
      ) : null}
      {query.updated === "1" ? (
        <div className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Status updated.
        </div>
      ) : null}
      {query.error ? (
        <div className="rounded-md border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          We could not complete the action. Try again.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SupportConversation
          loadError={loadError}
          messages={messages}
          ticket={{
            createdAt: ticket.createdAt,
            description: ticket.description,
            id: ticket.id,
            requesterName: ticket.requesterName,
            ticketNumber: ticket.ticketNumber,
          }}
        />

        <aside className="space-y-4">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-[11px] font-semibold uppercase text-violet-200">
              Contact / identity
            </p>
            <div className="mt-4">
              <p className="break-words text-lg font-semibold text-white">
                {ticket.requesterName}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase text-[var(--text-muted)]">
                {[requesterRole, houseLabel].filter(Boolean).join(" · ") ||
                  "Identity details unavailable"}
              </p>
            </div>
            {contactRows.length > 0 ? (
              <dl className="mt-4 space-y-3 text-sm">
                {contactRows.map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs text-[var(--text-muted)]">
                      {item.label}
                    </dt>
                    <dd className="mt-1 break-words font-medium text-white">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>

          <section className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-[11px] font-semibold uppercase text-violet-200">
              Quick Tools
            </p>
            <SupportQuickTools
              communityHref={communityHref}
              diagnostics={diagnostics}
              requesterName={ticket.requesterName}
              resetDisabledReason={resetDisabledReason}
              residentHref={residentHref}
              ticketId={ticket.id}
            />
          </section>

          <DetailSection rows={contextRows} title="Context" />
          <DetailSection rows={technicalRows} title="Technical Context" />
        </aside>
      </div>
    </div>
  );
}
