import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert } from "lucide-react";
import type { EntryNotificationWorkerHealthResult } from "@/features/entry/observability/notificationWorkerHealth";
import { cn } from "@/lib/supabase/utils";

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
  return `${Math.floor(hours / 24)}d ago`;
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

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.025] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-muted)]">
        {label}
      </p>
      <div className="mt-1.5 text-base font-semibold text-white">{value}</div>
      <p className="mt-1 text-xs leading-5 text-[var(--console-text-muted)]">{note}</p>
    </div>
  );
}

export function NotificationWorkerHealthPanel({
  result,
}: {
  result: EntryNotificationWorkerHealthResult;
}) {
  if (result.state === "unavailable") {
    return (
      <section className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-5 py-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <h2 className="font-semibold text-amber-50">Worker recovery telemetry unavailable</h2>
            <p className="mt-1 text-sm leading-6 text-amber-100/80">{result.error}</p>
          </div>
        </div>
      </section>
    );
  }

  const health = result.data;
  const statusCopy = health.status === "healthy"
    ? { label: "Healthy", className: "text-emerald-300", Icon: CheckCircle2 }
    : health.status === "degraded"
      ? { label: health.isStale ? "Stale" : "Needs review", className: "text-amber-300", Icon: ShieldAlert }
      : { label: "Unknown", className: "text-slate-300", Icon: Clock3 };
  const StatusIcon = statusCopy.Icon;

  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-5 shadow-[0_18px_42px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-400/18 bg-cyan-500/[0.10] text-cyan-200">
            <RefreshCw className="h-5 w-5 stroke-[1.75]" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
              Notification worker health
            </p>
            <div className="mt-2 flex items-center gap-2">
              <StatusIcon className={cn("h-5 w-5", statusCopy.className)} />
              <h2 className={cn("text-xl font-semibold", statusCopy.className)}>
                {statusCopy.label}
              </h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--console-text-muted)]">
              Worker-cycle health is tracked separately from notification delivery outcomes. A successful empty cycle proves the worker recovered without pretending a notification was delivered.
            </p>
          </div>
        </div>

        <div
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold",
            health.recovered
              ? "border-emerald-400/24 bg-emerald-500/[0.10] text-emerald-200"
              : health.lastFailureAt
                ? "border-amber-400/24 bg-amber-500/[0.10] text-amber-200"
                : "border-white/12 bg-white/[0.04] text-slate-300",
          )}
        >
          {health.recovered
            ? `Recovered ${formatRelative(health.recoveredAt)}`
            : health.lastFailureAt
              ? "Recovery not yet proven"
              : "No recorded worker failure"}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label="Last successful cycle"
          value={formatRelative(health.lastSuccessAt)}
          note={formatDateTime(health.lastSuccessAt)}
        />
        <Metric
          label="Last failure"
          value={formatRelative(health.lastFailureAt)}
          note={health.lastErrorCode ?? "No unresolved worker error code"}
        />
        <Metric
          label="Consecutive failures"
          value={health.consecutiveFailures}
          note={health.isStale ? "Heartbeat is outside the expected 6m window" : "Resets to zero after a successful cycle"}
        />
        <Metric
          label="Last cycle work"
          value={`${health.lastClaimed ?? 0} claimed`}
          note={`${health.lastProcessed ?? 0} processed`}
        />
        <Metric
          label="Recovery"
          value={health.recovered ? "Recovered" : health.lastFailureAt ? "Pending" : "Not needed"}
          note={health.recoverySummary}
        />
      </div>
    </section>
  );
}
