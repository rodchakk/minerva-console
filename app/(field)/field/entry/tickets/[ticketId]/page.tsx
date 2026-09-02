import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Smartphone } from "lucide-react";
import { isEntryPreviewReadOnly } from "@/features/entry/deploymentBoundary";
import { FieldTicketChat } from "@/features/entry/field/FieldTicketChat";
import { getFieldTicketDetail, type FieldTicketStatus } from "@/features/entry/field/ticketData";

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

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "";
}

export default async function FieldEntryTicketDetailPage({
  params,
}: PageProps<"/field/entry/tickets/[ticketId]">) {
  const { ticketId } = await params;
  const data = await getFieldTicketDetail(ticketId);

  if (!data.ticket) notFound();

  const ticket = data.ticket;
  const role = data.requester?.role || metadataText(ticket.metadata, "role");
  const unit = data.requester?.houseLabel || metadataText(ticket.metadata, "house_label");
  const platform = metadataText(ticket.metadata, "platform");
  const device = metadataText(ticket.metadata, "device_model");
  const osVersion = metadataText(ticket.metadata, "os_version");
  const appVersion = metadataText(ticket.metadata, "app_version");
  const buildVersion = metadataText(ticket.metadata, "build_version");
  const hasDeviceDetails = Boolean(platform || device || osVersion || appVersion || buildVersion);

  return (
    <div className="space-y-4">
      <Link
        href="/field/entry/tickets"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Tickets
      </Link>

      <section className="space-y-2 border-b border-[var(--console-border)] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--console-accent)]">
            {ticket.ticketNumber}
          </p>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] ${statusClass(ticket.status)}`}>
            {statusLabel(ticket.status)}
          </span>
        </div>
        <h1 className="break-words text-2xl font-semibold leading-8 text-[var(--console-text)]">
          {ticket.requesterName}
        </h1>
        <p className="break-words text-sm leading-5 text-[var(--console-text-muted)]">
          {ticket.category} · {ticket.communityName}
          {role ? ` · ${role}` : ""}
          {unit ? ` · ${unit}` : ""}
        </p>

        {hasDeviceDetails ? (
          <details className="rounded-lg border border-[var(--console-border)] bg-white/[0.025] px-3 py-2">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-xs font-bold text-[var(--console-text-muted)]">
              <Smartphone aria-hidden="true" className="h-4 w-4" />
              Device details
            </summary>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--console-text-soft)]">
              {platform ? <span className="rounded-full border border-[var(--console-border)] px-2 py-1">{platform}</span> : null}
              {device ? <span className="rounded-full border border-[var(--console-border)] px-2 py-1">{device}</span> : null}
              {osVersion ? <span className="rounded-full border border-[var(--console-border)] px-2 py-1">OS {osVersion}</span> : null}
              {appVersion ? <span className="rounded-full border border-[var(--console-border)] px-2 py-1">App {appVersion}</span> : null}
              {buildVersion ? <span className="rounded-full border border-[var(--console-border)] px-2 py-1">Build {buildVersion}</span> : null}
            </div>
          </details>
        ) : null}
      </section>

      {data.error ? (
        <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
          Some conversation history could not be loaded. Refresh before assuming messages are missing.
        </p>
      ) : null}

      <FieldTicketChat
        communityId={ticket.communityId}
        currentStaffUserId={data.currentStaffUserId}
        description={ticket.description}
        isReadOnlyPreview={isEntryPreviewReadOnly()}
        messages={data.messages}
        requester={
          data.requester
            ? {
                email: data.requester.email,
                fullName: data.requester.fullName,
                role: data.requester.role,
                userId: data.requester.userId,
              }
            : null
        }
        requesterName={ticket.requesterName}
        status={ticket.status}
        ticketId={ticket.id}
      />
    </div>
  );
}
