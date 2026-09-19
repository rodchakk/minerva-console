import Link from "next/link";
import { Activity } from "lucide-react";
import type { EntryObservabilityStatus } from "@/features/entry/observability/queries";

type FieldEntryHealthIndicatorProps = {
  incidentCount?: number;
  status?: EntryObservabilityStatus;
};

const statusConfig: Record<
  EntryObservabilityStatus,
  { icon: string; label: string; pill: string }
> = {
  healthy: {
    icon: "text-emerald-300",
    label: "Healthy",
    pill: "border-emerald-400/25 bg-emerald-500/[0.09]",
  },
  degraded: {
    icon: "text-amber-300",
    label: "Degraded",
    pill: "border-amber-400/25 bg-amber-500/[0.09]",
  },
  down: {
    icon: "text-rose-300",
    label: "Down",
    pill: "border-rose-400/30 bg-rose-500/[0.10]",
  },
  idle: {
    icon: "text-sky-300",
    label: "Idle",
    pill: "border-sky-400/20 bg-sky-500/[0.08]",
  },
  unknown: {
    icon: "text-slate-400",
    label: "Unknown",
    pill: "border-[var(--console-border)] bg-white/[0.03]",
  },
};

export function FieldEntryHealthIndicator({
  incidentCount = 0,
  status = "unknown",
}: FieldEntryHealthIndicatorProps) {
  const config = statusConfig[status];
  const incidentLabel =
    incidentCount > 0
      ? `, ${incidentCount} current incident${incidentCount === 1 ? "" : "s"}`
      : "";

  return (
    <Link
      href="/field/entry/health"
      aria-label={`ENTRY health: ${config.label}${incidentLabel}`}
      title={`ENTRY health · ${config.label}${incidentLabel}`}
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold text-[var(--console-text)] transition-colors hover:bg-white/[0.07] ${config.pill}`}
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <Activity aria-hidden="true" className={`h-4 w-4 ${config.icon}`} />
        {status === "down" || status === "degraded" ? (
          <span className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-current text-rose-300" />
        ) : null}
      </span>
      <span className="hidden shrink-0 sm:inline">{config.label}</span>
      {incidentCount > 0 ? (
        <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-white/10 px-1 text-[10px] leading-4 text-white">
          {incidentCount}
        </span>
      ) : null}
    </Link>
  );
}
