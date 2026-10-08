import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Clock3,
  Smartphone,
  UserCircle,
} from "lucide-react";
import { notFound } from "next/navigation";
import { entryButtonClass } from "@/components/ui/entryButtonStyles";
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
  className,
  contentClassName,
  rows,
  title,
}: {
  className?: string;
  contentClassName?: string;
  rows: DetailRow[];
  title: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-[10px] border border-[#141119] bg-[#24202B] p-4",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#BEB4FF]">
        {title}
      </p>
      <dl className={cn("mt-3 space-y-2.5 text-sm", contentClassName)}>
        {rows.map((item) => (
          <div
            key={item.label}
            className={cn(
              "grid grid-cols-[96px_minmax(0,1fr)] gap-3",
              title === "Context" && item.label === "Created"
                ? "mt-3 border-t border-white/[0.07] pt-3"
                : "",
            )}
          >
            <dt className="text-[11px] leading-5 text-[#8F879D]">
              {item.label}
            </dt>
            <dd className="break-words text-[11px] font-semibold leading-5 text-white">
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
  const { ticket, messages, requester, loadError } =
    await getEntrySupportTicket(ticketId);

  if (!ticket) notFound();

  const status = statusCopy[ticket.status];
  const category = formatCategory(ticket.category);
  const source = formatSource(ticket.source);
  const requesterRole =
    requester?.role || metadataString(ticket.metadata, ["role"]);
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
    <div className="relative -mx-4 -my-4 min-h-[calc(100vh-4rem)] bg-[#2E2936] px-4 py-5 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 2xl:-mx-7 2xl:px-7">
      <div className="mx-auto max-w-[1680px] space-y-3">
        <Link
          href="/products/entry/tickets"
          className={entryButtonClass("secondary", "w-fit")}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to tickets
        </Link>

        <section className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF]">
          <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
                  {ticket.ticketNumber}
                </p>
                <span
                  className={cn(
                    "rounded-[4px] border px-2 py-1 text-[10px] font-semibold",
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              </div>
              <h1 className="mt-2 truncate text-2xl font-semibold tracking-[-0.025em] text-white">
                {category}
              </h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#A9A3B2]">
                Support request from {ticket.requesterName}. Review the
                conversation, context, and account tools from one workspace.
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
                className="h-9 min-w-40 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#141119] outline-none transition focus:ring-2 focus:ring-[#7553FF]"
              >
                <option value="open">Received</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <button
                type="submit"
                className={entryButtonClass("primary", "min-w-[108px]")}
              >
                Save status
              </button>
            </form>
          </div>

          <div className="grid border-t border-[#141119] sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-h-[76px] px-4 py-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                <UserCircle className="size-3.5 text-[#CFC7FF]" aria-hidden />
                Requester
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-white">
                {ticket.requesterName}
              </p>
              <p className="mt-1 truncate text-[10px] text-[#8F879D]">
                {requesterRole || "ENTRY user"}
              </p>
            </div>

            <div className="min-h-[76px] border-t border-white/[0.06] px-4 py-3 sm:border-l sm:border-t-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                <Building2 className="size-3.5 text-[#CFC7FF]" aria-hidden />
                Community
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-white">
                {ticket.communityName}
              </p>
              <p className="mt-1 truncate text-[10px] text-[#8F879D]">
                {houseLabel || "No unit available"}
              </p>
            </div>

            <div className="min-h-[76px] border-t border-white/[0.06] px-4 py-3 xl:border-l xl:border-t-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                <Smartphone className="size-3.5 text-[#CFC7FF]" aria-hidden />
                Source
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{source}</p>
              <p className="mt-1 text-[10px] text-[#8F879D]">{category}</p>
            </div>

            <div className="min-h-[76px] border-t border-white/[0.06] px-4 py-3 sm:border-l xl:border-t-0">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                <Clock3 className="size-3.5 text-[#CFC7FF]" aria-hidden />
                Last updated
              </div>
              <p className="mt-2 text-sm font-semibold text-white">
                {formatDateTime(ticket.updatedAt)}
              </p>
              <p className="mt-1 text-[10px] text-[#8F879D]">
                Created {formatDateTime(ticket.createdAt)}
              </p>
            </div>
          </div>
        </section>

        {query.sent === "1" ? (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Reply sent.
          </div>
        ) : null}

        {query.updated === "1" ? (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            Status updated.
          </div>
        ) : null}

        {query.error ? (
          <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            We could not complete the action. Try again.
          </div>
        ) : null}

        <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
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

          <aside className="grid min-h-0 gap-3 xl:h-[clamp(590px,72vh,760px)] xl:grid-rows-[auto_minmax(0,1fr)_auto]">
            <section className="rounded-[10px] border border-[#141119] bg-[#24202B] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#BEB4FF]">
                Quick actions
              </p>
              <p className="mt-1 text-[10px] text-[#8F879D]">
                Resolve common support tasks without leaving this ticket.
              </p>
              <div className="mt-3">
                <SupportQuickTools
                  communityHref={communityHref}
                  diagnostics={diagnostics}
                  requesterName={ticket.requesterName}
                  resetDisabledReason={resetDisabledReason}
                  residentHref={residentHref}
                  ticketId={ticket.id}
                />
              </div>
            </section>

            <DetailSection
              className="min-h-0 overflow-hidden"
              contentClassName="min-h-0 overflow-y-auto pr-1 [scrollbar-gutter:stable]"
              rows={contextRows}
              title="Context"
            />

            <DetailSection
              rows={technicalRows}
              title="Technical context"
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
