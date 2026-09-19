"use client";

import {
  Activity,
  AlertTriangle,
  Check,
  Clipboard,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type FieldHealthStatus = "healthy" | "degraded" | "down" | "idle" | "unknown";

type FieldHealthFlow = {
  key: string;
  label: string;
  lastSuccessAt: string | null;
  status: FieldHealthStatus;
};

type FieldHealthIncident = {
  errorCode: string | null;
  eventType: string;
  explanation: string;
  fingerprint: string;
  lastSeenAt: string;
  occurrenceCount: number;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
};

export type FieldEntryHealthView = {
  flows: FieldHealthFlow[];
  generatedAt: string;
  incidents: FieldHealthIncident[];
  lastHealthyAt: string | null;
  performance: {
    p50Ms: number | null;
    p95Ms: number | null;
    p99Ms: number | null;
  };
  range: {
    endsAt: string;
    startsAt: string;
  };
  status: FieldHealthStatus;
};

type DiagnosticResponse = {
  bundle?: Record<string, unknown>;
  error?: string;
};

const DIAGNOSTIC_REQUIRED_SECTIONS = [
  "schema_version",
  "generated_at",
  "community",
  "range",
  "triage_summary",
  "current_incidents",
  "historical_failure_signals",
  "queue_health",
  "suspected_areas",
  "observability",
  "current_observability",
  "recent_events",
  "privacy",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function diagnosticInspection(bundle: Record<string, unknown>) {
  const missingSections = DIAGNOSTIC_REQUIRED_SECTIONS.filter(
    (section) => !Object.prototype.hasOwnProperty.call(bundle, section),
  );
  const issues: string[] = [];

  const schemaVersion =
    typeof bundle.schema_version === "number"
      ? bundle.schema_version
      : Number(bundle.schema_version);

  if (!Number.isFinite(schemaVersion) || schemaVersion < 2) {
    issues.push("unsupported schema");
  }

  const privacy = isRecord(bundle.privacy) ? bundle.privacy : {};
  if (privacy.pii_minimized !== true) {
    issues.push("privacy contract missing");
  }

  const range = isRecord(bundle.range) ? bundle.range : {};
  if (
    typeof range.starts_at !== "string" ||
    typeof range.ends_at !== "string"
  ) {
    issues.push("diagnostic range missing");
  }

  const triage = isRecord(bundle.triage_summary)
    ? bundle.triage_summary
    : {};
  if (typeof triage.system_status !== "string") {
    issues.push("current triage status missing");
  }

  const currentObservability = isRecord(bundle.current_observability)
    ? bundle.current_observability
    : {};
  const currentSummary = isRecord(currentObservability.summary)
    ? currentObservability.summary
    : {};

  if (typeof currentSummary.system_status !== "string") {
    issues.push("current observability status missing");
  }
  if (!Array.isArray(currentObservability.critical_flows)) {
    issues.push("current critical flows missing");
  }

  if (!isRecord(bundle.observability)) {
    issues.push("selected-window observability missing");
  }
  if (!isRecord(bundle.queue_health)) {
    issues.push("queue health missing");
  }
  if (!Array.isArray(bundle.current_incidents)) {
    issues.push("current incidents missing");
  }
  if (!Array.isArray(bundle.historical_failure_signals)) {
    issues.push("historical failure signals missing");
  }
  if (!Array.isArray(bundle.suspected_areas)) {
    issues.push("suspected areas missing");
  }
  if (!Array.isArray(bundle.recent_events)) {
    issues.push("recent events missing");
  }

  const json = JSON.stringify(bundle, null, 2);
  const bytes = new TextEncoder().encode(json).byteLength;
  const presentSections =
    DIAGNOSTIC_REQUIRED_SECTIONS.length - missingSections.length;

  return {
    bytes,
    complete: missingSections.length === 0 && issues.length === 0,
    issues: [...missingSections.map((section) => `missing ${section}`), ...issues],
    json,
    presentSections,
    schemaVersion,
    totalSections: DIAGNOSTIC_REQUIRED_SECTIONS.length,
  };
}

function formatDiagnosticSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  }

  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

const statusConfig: Record<
  FieldHealthStatus,
  { dot: string; label: string; panel: string; text: string }
> = {
  healthy: {
    dot: "bg-emerald-300 shadow-[0_0_20px_rgba(110,231,183,0.52)]",
    label: "HEALTHY",
    panel: "border-emerald-400/20 bg-emerald-500/[0.07]",
    text: "text-emerald-200",
  },
  degraded: {
    dot: "bg-amber-300 shadow-[0_0_20px_rgba(252,211,77,0.42)]",
    label: "DEGRADED",
    panel: "border-amber-400/25 bg-amber-500/[0.08]",
    text: "text-amber-200",
  },
  down: {
    dot: "bg-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.48)]",
    label: "DOWN",
    panel: "border-rose-400/25 bg-rose-500/[0.09]",
    text: "text-rose-200",
  },
  idle: {
    dot: "bg-sky-300 shadow-[0_0_20px_rgba(125,211,252,0.42)]",
    label: "IDLE",
    panel: "border-sky-400/20 bg-sky-500/[0.07]",
    text: "text-sky-200",
  },
  unknown: {
    dot: "bg-slate-500",
    label: "UNKNOWN",
    panel: "border-white/10 bg-white/[0.03]",
    text: "text-slate-300",
  },
};

const severityTone: Record<FieldHealthIncident["severity"], string> = {
  INFO: "border-sky-400/20 bg-sky-500/[0.08] text-sky-200",
  WARNING: "border-amber-400/25 bg-amber-500/[0.09] text-amber-200",
  ERROR: "border-red-400/25 bg-red-500/[0.09] text-red-200",
  CRITICAL: "border-rose-400/30 bg-rose-500/[0.11] text-rose-100",
};

function formatLatency(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  return `${Math.round(value).toLocaleString("en-US")} ms`;
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
  }).format(date);
}

function formatRelative(value: string | null) {
  if (!value) return "not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not recorded";

  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Clipboard is unavailable on this device.");
  }
}

function FlowStatus({ status }: { status: FieldHealthStatus }) {
  const config = statusConfig[status];

  return (
    <span className={`text-xs font-semibold ${config.text}`}>
      {config.label.charAt(0) + config.label.slice(1).toLowerCase()}
    </span>
  );
}

export function FieldEntryHealthWorkspace({
  data,
  error,
}: {
  data: FieldEntryHealthView | null;
  error: string | null;
}) {
  const router = useRouter();
  const [refreshPending, startRefresh] = useTransition();
  const [copyPending, setCopyPending] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  const status = data?.status ?? "unknown";
  const config = statusConfig[status];

  const affectedFlows = useMemo(
    () =>
      data?.flows.filter(
        (flow) => flow.status === "degraded" || flow.status === "down",
      ) ?? [],
    [data],
  );

  const operationalFlowCount =
    data?.flows.filter(
      (flow) => flow.status === "healthy" || flow.status === "idle",
    ).length ?? 0;

  async function copyDiagnostic() {
    setCopyPending(true);
    setCopyError(null);
    setCopyFeedback(null);

    try {
      const endsAt = new Date();
      const startsAt = new Date(
        endsAt.getTime() - 30 * 24 * 60 * 60 * 1000,
      );

      const response = await fetch("/api/entry/observability/diagnostic", {
        body: JSON.stringify({
          communityId: null,
          endsAt: endsAt.toISOString(),
          notes: null,
          save: false,
          startsAt: startsAt.toISOString(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await response.json()) as DiagnosticResponse;
      if (!response.ok || !payload.bundle) {
        throw new Error(
          payload.error || "Could not generate the ENTRY diagnostic.",
        );
      }

      const inspection = diagnosticInspection(payload.bundle);

      if (!inspection.complete) {
        throw new Error(
          `Diagnostic bundle is incomplete (${inspection.issues.join(", ")}). Nothing was copied.`,
        );
      }

      await copyText(inspection.json);
      setCopyFeedback(
        `Diagnostic copied · ${formatDiagnosticSize(inspection.bytes)} · schema v${inspection.schemaVersion} · ${inspection.presentSections}/${inspection.totalSections} sections · complete`,
      );
      window.setTimeout(() => setCopyFeedback(null), 5000);
    } catch (cause) {
      setCopyError(
        cause instanceof Error
          ? cause.message
          : "Could not copy the ENTRY diagnostic.",
      );
    } finally {
      setCopyPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="pt-1">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          ENTRY Field
        </p>
        <div className="mt-1.5 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold text-[var(--console-text)]">
              ENTRY Health
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--console-text-muted)]">
              Compact production visibility for critical ENTRY services.
            </p>
          </div>
          <Activity
            aria-hidden="true"
            className={`mt-1 h-6 w-6 shrink-0 ${config.text}`}
          />
        </div>
      </section>

      <section
        className={`rounded-2xl border p-4 shadow-[0_18px_50px_rgba(0,0,0,0.20)] sm:p-5 ${config.panel}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className={`h-9 w-9 shrink-0 rounded-full ${config.dot}`} />
            <div className="min-w-0">
              <p className={`text-2xl font-black tracking-tight ${config.text}`}>
                {config.label}
              </p>
              <p className="mt-1 text-sm text-[var(--console-text-muted)]">
                {data
                  ? `Updated ${formatRelative(data.generatedAt)}`
                  : "Health snapshot unavailable"}
              </p>
              <p className="mt-0.5 text-sm text-[var(--console-text-muted)]">
                Last fully healthy: {formatDateTime(data?.lastHealthyAt ?? null)}
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs font-semibold text-[var(--console-text-muted)]">
            Production
          </span>
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-amber-400/25 bg-amber-500/[0.08] px-4 py-3">
          <div className="flex gap-3">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
            />
            <div>
              <p className="text-sm font-semibold text-amber-100">
                Health data is temporarily unavailable
              </p>
              <p className="mt-1 text-sm leading-5 text-amber-100/75">{error}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[var(--console-border)] bg-[var(--console-surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--console-border)] px-4 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-[var(--console-text)]">
              Critical flows
            </h2>
            <p className="mt-0.5 text-xs text-[var(--console-text-muted)]">
              Current operational state
            </p>
          </div>
          {data ? (
            <span className="text-xs font-semibold text-[var(--console-text-muted)]">
              {operationalFlowCount} / {data.flows.length} operational
            </span>
          ) : null}
        </div>

        {data?.flows.length ? (
          <div className="divide-y divide-[var(--console-border)]">
            {data.flows.map((flow) => (
              <div
                key={flow.key}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusConfig[flow.status].dot}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--console-text)]">
                    {flow.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--console-text-muted)]">
                    Last success {formatRelative(flow.lastSuccessAt)}
                  </p>
                </div>
                <FlowStatus status={flow.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-[var(--console-text-muted)]">
            No current flow data.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gauge
              aria-hidden="true"
              className="h-4.5 w-4.5 text-[var(--console-accent)]"
            />
            <h2 className="text-base font-semibold text-[var(--console-text)]">
              Performance
            </h2>
          </div>
          <span className="text-xs text-[var(--console-text-muted)]">Last 24h</span>
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-[var(--console-border)]">
          {[
            ["p50", data?.performance.p50Ms ?? null],
            ["p95", data?.performance.p95Ms ?? null],
            ["p99", data?.performance.p99Ms ?? null],
          ].map(([label, value]) => (
            <div key={String(label)} className="px-3 first:pl-0 last:pr-0">
              <p className="text-xs text-[var(--console-text-muted)]">{label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--console-text)]">
                {formatLatency(value as number | null)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              className="h-4.5 w-4.5 text-[var(--console-accent)]"
            />
            <h2 className="text-base font-semibold text-[var(--console-text)]">
              Incidents
            </h2>
          </div>

          {data?.incidents.length ? (
            <div className="mt-3 space-y-3">
              {data.incidents.slice(0, 3).map((incident) => (
                <article key={incident.fingerprint}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs font-semibold text-[var(--console-text)]">
                      {incident.errorCode || incident.eventType}
                    </p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityTone[incident.severity]}`}
                    >
                      {incident.severity}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-5 text-[var(--console-text-muted)]">
                    {incident.explanation}
                  </p>
                  <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                    {incident.occurrenceCount} occurrence
                    {incident.occurrenceCount === 1 ? "" : "s"} · last seen{" "}
                    {formatRelative(incident.lastSeenAt)}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-3">
              <Check
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--console-text)]">
                  No current incidents
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--console-text-muted)]">
                  No open incident groups are affecting the current view.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck
              aria-hidden="true"
              className="h-4.5 w-4.5 text-[var(--console-accent)]"
            />
            <h2 className="text-base font-semibold text-[var(--console-text)]">
              Affected area
            </h2>
          </div>

          {affectedFlows.length > 0 ? (
            <div className="mt-3 space-y-2">
              {affectedFlows.map((flow) => (
                <div
                  key={flow.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2"
                >
                  <span className="text-sm text-[var(--console-text)]">
                    {flow.label}
                  </span>
                  <FlowStatus status={flow.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-3">
              <Check
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--console-text)]">
                  No critical flow impact
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--console-text-muted)]">
                  All key flows are operational or intentionally idle.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={refreshPending}
          onClick={() => {
            setCopyError(null);
            startRefresh(() => router.refresh());
          }}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--console-border)] bg-white/[0.025] px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:border-[var(--console-accent-border)] hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshPending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          )}
          {refreshPending ? "Refreshing…" : "Refresh"}
        </button>

        <button
          type="button"
          disabled={copyPending}
          onClick={() => void copyDiagnostic()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400 px-4 text-sm font-black text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {copyPending ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Clipboard aria-hidden="true" className="h-4 w-4" />
          )}
          {copyPending ? "Preparing…" : "Copy diagnostic"}
        </button>
      </div>

      <p className="text-center text-xs leading-5 text-[var(--console-text-muted)]">
        Validates all required diagnostic sections before copying the full
        privacy-minimized 30-day JSON used by Minerva Console. The raw JSON is
        not displayed in Field.
      </p>

      {copyFeedback ? (
        <div
          role="status"
          className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-3 text-sm font-semibold text-emerald-100"
        >
          <div className="flex items-center gap-2">
            <Check aria-hidden="true" className="h-4 w-4" />
            {copyFeedback}
          </div>
        </div>
      ) : null}

      {copyError ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-400/25 bg-rose-500/[0.09] px-4 py-3 text-sm leading-5 text-rose-100"
        >
          {copyError}
        </div>
      ) : null}
    </div>
  );
}
