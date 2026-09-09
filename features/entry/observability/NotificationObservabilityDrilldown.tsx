"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  Mail,
  RadioTower,
  Send,
  ShieldAlert,
} from "lucide-react";
import type {
  EntryNotificationObservabilityData,
  EntryNotificationObservabilityEvent,
  EntryNotificationObservabilityEventStatus,
  EntryNotificationObservabilityStatus,
} from "@/features/entry/observability/queries";
import { cn } from "@/lib/supabase/utils";

const statusCopy: Record<
  EntryNotificationObservabilityEventStatus,
  { className: string; label: string }
> = {
  failed: {
    className: "border-rose-400/24 bg-rose-500/[0.10] text-rose-200",
    label: "Failed",
  },
  skipped: {
    className: "border-amber-400/24 bg-amber-500/[0.10] text-amber-200",
    label: "Skipped",
  },
  success: {
    className: "border-emerald-400/24 bg-emerald-500/[0.10] text-emerald-200",
    label: "Success",
  },
  unknown: {
    className: "border-white/12 bg-white/[0.04] text-slate-200",
    label: "Unknown",
  },
};

const summaryStatusCopy: Record<
  EntryNotificationObservabilityStatus,
  { className: string; label: string }
> = {
  degraded: {
    className: "text-amber-300",
    label: "Needs review",
  },
  down: {
    className: "text-rose-300",
    label: "Failing",
  },
  healthy: {
    className: "text-emerald-300",
    label: "Observed",
  },
  unknown: {
    className: "text-slate-300",
    label: "Unknown",
  },
};

function formatNumber(value: number | null) {
  if (value === null) return "Not recorded";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    second: "2-digit",
  }).format(date);
}

function formatRelative(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function sentenceLabel(value: string | null) {
  if (!value) return "Not recorded";

  return value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function formatProviderReached(value: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}

function SummaryCard({
  icon: Icon,
  label,
  note,
  value,
}: {
  icon: typeof Info;
  label: string;
  note: string;
  value: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.18)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-400/18 bg-cyan-500/[0.10] text-cyan-200">
          <Icon className="h-5 w-5 stroke-[1.75]" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--console-text-muted)]">
            {label}
          </p>
          <div className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-white">
            {value}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--console-text-muted)]">
            {note}
          </p>
        </div>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: EntryNotificationObservabilityEventStatus }) {
  const copy = statusCopy[status];

  return (
    <span
      className={cn(
        "inline-flex min-w-20 items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold",
        copy.className,
      )}
    >
      {copy.label}
    </span>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.025] px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-slate-100">{value}</dd>
    </div>
  );
}

function KnownClaimFailure({ event }: { event: EntryNotificationObservabilityEvent }) {
  if (event.errorCode !== "PUSH_CLAIM_RPC_ERROR") return null;

  return (
    <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.08] p-4 text-sm leading-6 text-amber-50">
      <p className="font-semibold">Worker failed while claiming notification queue work.</p>
      <p className="mt-2 text-amber-100/90">
        No specific notification had been selected. Provider delivery was not
        reached. Impact to a specific recipient cannot be proven.
      </p>
      {event.errorSummary ? (
        <p className="mt-2 font-mono text-xs text-amber-100">
          Error: {event.errorSummary}
        </p>
      ) : null}
    </div>
  );
}

function EventDetail({ event }: { event: EntryNotificationObservabilityEvent }) {
  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
      <div className="border-b border-[var(--console-border)] px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
              Event detail
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              {event.operation}
            </h2>
            <p className="mt-1 text-sm text-[var(--console-text-muted)]">
              {formatDateTime(event.occurredAt)}
            </p>
          </div>
          <StatusPill status={event.status} />
        </div>
      </div>

      <div className="space-y-4 p-5">
        <KnownClaimFailure event={event} />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailRow label="Channel" value={sentenceLabel(event.channel)} />
          <DetailRow label="Layer" value={sentenceLabel(event.layer)} />
          <DetailRow
            label="Community"
            value={event.communityName ?? "Not identified"}
          />
          <DetailRow
            label="Message"
            value={event.messageLabel ?? event.messageId ?? "Not identified"}
          />
          <DetailRow
            label="Audience"
            value={`${sentenceLabel(event.audienceType)}${
              event.audienceLabel ? `: ${event.audienceLabel}` : ""
            }`}
          />
          <DetailRow label="Attempts" value={formatNumber(event.attempts)} />
          <DetailRow
            label="Provider reached"
            value={formatProviderReached(event.providerReached)}
          />
          <DetailRow
            label="Duration"
            value={
              event.durationMs === null
                ? "Not recorded"
                : `${formatNumber(event.durationMs)} ms`
            }
          />
          <DetailRow
            label="Retry"
            value={`${sentenceLabel(event.retryMode)}. ${event.retrySummary}`}
          />
          <DetailRow
            label="Created"
            value={formatDateTime(event.createdAt)}
          />
          <DetailRow
            label="Claimed"
            value={formatDateTime(event.claimedAt)}
          />
          <DetailRow
            label="Completed"
            value={formatDateTime(event.completedAt)}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <DetailRow
            label="Reason"
            value={event.errorSummary ?? "No sanitized reason recorded"}
          />
          <DetailRow label="Impact" value={event.impactSummary} />
          <DetailRow
            label="Recovery"
            value={
              event.recoverySummary ??
              "Recovery evidence is not applicable to this event."
            }
          />
          <DetailRow
            label="Correlation"
            value={event.correlationId ?? "Not recorded"}
          />
        </div>
      </div>
    </section>
  );
}

export function NotificationObservabilityDrilldown({
  data,
}: {
  data: EntryNotificationObservabilityData;
}) {
  const [selectedId, setSelectedId] = useState(data.events[0]?.id ?? null);
  const selectedEvent = useMemo(
    () => data.events.find((event) => event.id === selectedId) ?? data.events[0],
    [data.events, selectedId],
  );
  const status = summaryStatusCopy[data.summary.status];

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          icon={RadioTower}
          label="Status"
          note="No events stays Unknown"
          value={<span className={status.className}>{status.label}</span>}
        />
        <SummaryCard
          icon={Clock3}
          label="Events in range"
          note={`Last observed ${formatRelative(data.summary.lastObservedAt)}`}
          value={formatNumber(data.summary.eventCount)}
        />
        <SummaryCard
          icon={ShieldAlert}
          label="Failed"
          note={`Last failure ${formatRelative(data.summary.lastFailureAt)}`}
          value={formatNumber(data.summary.failedCount)}
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Skipped"
          note="Skipped is not a provider outage"
          value={formatNumber(data.summary.skippedCount)}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Succeeded"
          note="Recorded success evidence"
          value={formatNumber(data.summary.successCount)}
        />
      </section>

      {data.events.length === 0 ? (
        <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-5 py-10 text-center">
          <p className="font-medium text-white">
            {data.range.communityId
              ? "No notification events matched this filter"
              : "No notification events recorded"}
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--console-text-muted)]">
            {data.range.communityId
              ? "The selected community and time range did not return notification evidence."
              : "The selected time range did not return notification evidence. This remains Unknown, not Healthy."}
          </p>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.75fr)]">
          <div className="overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--console-border)] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Notification events
                </h2>
                <p className="mt-1 text-sm text-[var(--console-text-muted)]">
                  Showing {formatNumber(data.events.length)} of{" "}
                  {formatNumber(data.summary.eventCount)}
                </p>
              </div>
              <Send className="h-5 w-5 text-[var(--console-text-soft)]" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Layer</th>
                    <th className="px-4 py-3 font-medium">Community</th>
                    <th className="px-4 py-3 font-medium">Operation</th>
                    <th className="px-4 py-3 font-medium">Audience</th>
                    <th className="px-4 py-3 font-medium">Attempts</th>
                    <th className="px-5 py-3 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--console-border)]">
                  {data.events.map((event) => (
                    <tr
                      key={event.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-white/[0.035]",
                        selectedEvent?.id === event.id && "bg-white/[0.045]",
                      )}
                      onClick={() => setSelectedId(event.id)}
                    >
                      <td className="px-5 py-3 text-slate-300">
                        <time dateTime={event.occurredAt}>
                          {formatRelative(event.occurredAt)}
                        </time>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={event.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {sentenceLabel(event.layer)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {event.communityName ?? "Not identified"}
                      </td>
                      <td className="px-4 py-3 text-slate-100">
                        {event.operation}
                      </td>
                      <td className="px-4 py-3 text-[var(--console-text-muted)]">
                        {event.audienceLabel ?? sentenceLabel(event.audienceType)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatNumber(event.attempts)}
                      </td>
                      <td className="max-w-[260px] truncate px-5 py-3 text-[var(--console-text-muted)]">
                        {event.errorSummary ?? event.impactSummary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedEvent ? (
            <EventDetail event={selectedEvent} />
          ) : (
            <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-5 py-10 text-center">
              <Mail className="mx-auto h-7 w-7 text-[var(--console-text-soft)]" />
              <p className="mt-3 font-medium text-white">Select an event</p>
            </section>
          )}
        </section>
      )}

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-5 py-4 text-sm leading-6 text-[var(--console-text-muted)]">
        Generated {formatDateTime(data.generatedAt)}. Limit clamped to{" "}
        {formatNumber(data.limit)} events. Raw provider payloads, push tokens,
        emails, message bodies, and credentials are excluded from this contract.
      </section>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-5 py-4 text-sm leading-6 text-[var(--console-text-muted)]">
        Follow-up: move the database-side worker invocation credential to
        Supabase Vault or a managed secret path, and bring the deployed
        smart-service Edge Function under repository source control before
        future runtime changes.
      </section>
    </div>
  );
}
