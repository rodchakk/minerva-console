import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock3,
  DatabaseZap,
  FileImage,
  FileJson,
  Gauge,
  ListTree,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { DiagnosticBundleControl } from "@/features/entry/observability/DiagnosticBundleControl";
import { ObservabilityFilters } from "@/features/entry/observability/ObservabilityFilters";
import {
  getEntryDiagnosticSnapshots,
  getEntryObservability,
  normalizeEntryObservabilityRange,
  type EntryDiagnosticSnapshotMeta,
  type EntryObservabilityData,
  type EntryObservabilityFlow,
  type EntryObservabilityIncident,
  type EntryObservabilityOcrQueue,
  type EntryObservabilityStatus,
} from "@/features/entry/observability/queries";
import { cn } from "@/lib/supabase/utils";

export const dynamic = "force-dynamic";

const statusCopy: Record<
  EntryObservabilityStatus,
  { className: string; label: string; pill: string }
> = {
  degraded: {
    className: "text-amber-300",
    label: "Degraded",
    pill: "border-amber-400/24 bg-amber-500/[0.10] text-amber-200",
  },
  down: {
    className: "text-rose-300",
    label: "Down",
    pill: "border-rose-400/24 bg-rose-500/[0.10] text-rose-200",
  },
  healthy: {
    className: "text-emerald-300",
    label: "Healthy",
    pill: "border-emerald-400/24 bg-emerald-500/[0.10] text-emerald-200",
  },
  idle: {
    className: "text-sky-300",
    label: "Idle",
    pill: "border-sky-400/20 bg-sky-500/[0.08] text-sky-200",
  },
  unknown: {
    className: "text-slate-300",
    label: "Unknown",
    pill: "border-white/12 bg-white/[0.04] text-slate-200",
  },
};

const severityClass: Record<string, string> = {
  CRITICAL: "border-rose-400/30 bg-rose-500/[0.10] text-rose-200",
  ERROR: "border-red-400/25 bg-red-500/[0.10] text-red-200",
  INFO: "border-sky-400/20 bg-sky-500/[0.08] text-sky-200",
  WARNING: "border-amber-400/25 bg-amber-500/[0.10] text-amber-200",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value: number | null) {
  if (value === null) return "Not available";
  return `${(value * 100).toFixed(value < 0.01 && value > 0 ? 2 : 1)}%`;
}

function formatLatency(value: number | null) {
  if (value === null) return "Not available";
  return `${formatNumber(Math.round(value))} ms`;
}

function formatMetricValue(value: number | null, unit: string) {
  if (value === null) return "No data";
  if (unit === "ms") return `${formatNumber(Math.round(value))} ms`;
  if (unit === "score") return value.toFixed(4);
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return formatNumber(Math.round(value));
}

function formatCost(value: number | null, hasUsageRecords: boolean) {
  if (value === null) {
    return hasUsageRecords ? "Not available" : "No data";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
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

function sentenceLabel(value: string) {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function SummaryCard({
  icon: Icon,
  label,
  note,
  tone,
  value,
}: {
  icon: LucideIcon;
  label: string;
  note: string;
  tone: string;
  value: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.18)]">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            tone,
          )}
        >
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

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function PanelHeader({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--console-border)] px-5 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-400/20 bg-violet-500/[0.10] text-violet-200">
          <Icon className="h-4.5 w-4.5 stroke-[1.75]" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-[var(--console-text-muted)]">
            {description}
          </p>
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyPanelState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-medium text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--console-text-muted)]">
        {description}
      </p>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const safeValues = values.filter((value) => Number.isFinite(value));
  if (safeValues.length < 2 || Math.max(...safeValues) <= 0) {
    return (
      <div className="flex h-24 items-center justify-center border-t border-[var(--console-border)] text-xs text-[var(--console-text-muted)]">
        No trend data
      </div>
    );
  }

  const max = Math.max(...safeValues);
  const width = 280;
  const height = 78;
  const points = safeValues
    .map((value, index) => {
      const x = (index / Math.max(safeValues.length - 1, 1)) * width;
      const y = height - (value / max) * (height - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      role="img"
      aria-label="Usage trend"
      viewBox={`0 0 ${width} ${height}`}
      className="h-24 w-full border-t border-[var(--console-border)] p-3"
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        points={points}
        stroke="rgb(168 85 247)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function CriticalFlows({
  flows,
  notificationsHref,
}: {
  flows: EntryObservabilityFlow[];
  notificationsHref: string;
}) {
  return (
    <Panel className="min-h-[360px]">
      <PanelHeader
        description="Health is derived from recent successes, failures, current integrity, and workload. Idle means no work is currently expected."
        icon={ListTree}
        title="Critical flows"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">Flow</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last successful operation</th>
              <th className="px-4 py-3 font-medium">Evidence</th>
              <th className="px-5 py-3 font-medium">P95 latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--console-border)]">
            {flows.map((flow) => (
              <tr key={flow.key} className="transition-colors hover:bg-white/[0.02]">
                <td className="px-5 py-3 font-medium text-slate-100">
                  {flow.key === "communications" ? (
                    <Link
                      href={notificationsHref}
                      className="inline-flex items-center gap-2 text-slate-100 transition-colors hover:text-white"
                    >
                      {flow.label}
                      <ArrowRight className="h-4 w-4 stroke-[1.75]" />
                    </Link>
                  ) : (
                    flow.label
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex min-w-24 items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold",
                      statusCopy[flow.status].pill,
                    )}
                  >
                    {statusCopy[flow.status].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {formatRelative(flow.lastSuccessAt)}
                </td>
                <td className="px-4 py-3 text-[var(--console-text-muted)]">
                  {formatNumber(flow.successCount)} ok / {formatNumber(flow.failureCount)} failed
                </td>
                <td className="px-5 py-3 text-slate-300">
                  {formatLatency(flow.p95LatencyMs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Incidents({ incidents }: { incidents: EntryObservabilityIncident[] }) {
  return (
    <Panel className="min-h-[360px]">
      <PanelHeader
        action={
          <Link
            href="/logs"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--console-border-strong)] bg-white/[0.025] px-3 text-sm font-semibold text-slate-100 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
          >
            Open logs
            <ArrowRight className="h-4 w-4 stroke-[1.75]" />
          </Link>
        }
        description="Recurring failures are grouped by fingerprint or normalized event shape."
        icon={AlertTriangle}
        title="Active incidents"
      />
      {incidents.length === 0 ? (
        <EmptyPanelState
          description="No recurring failure groups were found in the selected window. This is not the same as proof that every flow is healthy."
          title="No grouped incidents"
        />
      ) : (
        <div className="divide-y divide-[var(--console-border)]">
          {incidents.map((incident) => (
            <article key={incident.fingerprint} className="px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-mono text-sm font-semibold uppercase text-white">
                      {incident.errorCode || incident.eventType}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        severityClass[incident.severity] ?? severityClass.INFO,
                      )}
                    >
                      {incident.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">
                    {formatNumber(incident.occurrenceCount)} occurrences ·{" "}
                    {formatNumber(incident.affectedCommunityCount)} communities affected
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-5 text-[var(--console-text-muted)]">
                    {incident.explanation}
                  </p>
                  {incident.communities.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {incident.communities.map((community) => (
                        <span
                          key={`${incident.fingerprint}-${community.communityId ?? "global"}`}
                          className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-xs text-slate-300"
                        >
                          {community.communityName}: {formatNumber(community.occurrenceCount)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-left text-xs leading-5 text-[var(--console-text-muted)] md:text-right">
                  <p>First seen {formatRelative(incident.firstSeenAt)}</p>
                  <p>Last seen {formatRelative(incident.lastSeenAt)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}

function UsageAndCost({ data }: { data: EntryObservabilityData }) {
  const usage = data.usage;

  return (
    <Panel>
      <PanelHeader
        description="Provider usage is recorded in the usage ledger; costs stay unavailable when pricing is not known."
        icon={BarChart3}
        title="Usage and cost"
      />
      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
        <div className="border-b border-[var(--console-border)] p-5 lg:border-b-0 lg:border-r">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--console-text-muted)]">Usage records</dt>
              <dd className="font-semibold text-white">
                {formatNumber(usage.summary.recordCount)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--console-text-muted)]">Input tokens</dt>
              <dd className="font-semibold text-white">
                {formatNumber(usage.summary.inputTokens)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--console-text-muted)]">Output tokens</dt>
              <dd className="font-semibold text-white">
                {formatNumber(usage.summary.outputTokens)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--console-text-muted)]">Images</dt>
              <dd className="font-semibold text-white">
                {usage.summary.recordCount > 0
                  ? formatNumber(usage.summary.imageCount)
                  : "No data"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[var(--console-text-muted)]">Estimated cost</dt>
              <dd className="font-semibold text-white">
                {formatCost(
                  usage.summary.estimatedCost,
                  usage.summary.recordCount > 0,
                )}
              </dd>
            </div>
          </dl>
          {usage.summary.unknownCostCount > 0 ? (
            <p className="mt-4 rounded-md border border-amber-400/20 bg-amber-500/[0.08] px-3 py-2 text-xs leading-5 text-amber-100">
              {formatNumber(usage.summary.unknownCostCount)} usage records have no
              estimated cost because pricing was not safely known when recorded.
            </p>
          ) : null}
          <Sparkline values={usage.daily.map((item) => item.recordCount)} />
        </div>

        <div className="grid min-w-0 gap-0 xl:grid-cols-2">
          <div className="border-b border-[var(--console-border)] xl:border-b-0 xl:border-r">
            <div className="border-b border-[var(--console-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
              Providers
            </div>
            {usage.byProvider.length === 0 ? (
              <EmptyPanelState
                description="Provider calls will appear after instrumentation records usage."
                title="No provider usage"
              />
            ) : (
              <div className="divide-y divide-[var(--console-border)]">
                {usage.byProvider.slice(0, 6).map((item) => (
                  <div
                    key={`${item.provider}-${item.operation}-${item.serviceModel}`}
                    className="px-5 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-medium text-white">
                        {item.provider}
                      </p>
                      <span className="text-xs text-[var(--console-text-muted)]">
                        {formatNumber(item.recordCount)} calls
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--console-text-muted)]">
                      {sentenceLabel(item.operation)} · {item.serviceModel}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="border-b border-[var(--console-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
              Communities
            </div>
            {usage.byCommunity.length === 0 ? (
              <EmptyPanelState
                description="Community-attributed provider usage will appear here."
                title="No community usage"
              />
            ) : (
              <div className="divide-y divide-[var(--console-border)]">
                {usage.byCommunity.slice(0, 6).map((item) => (
                  <div
                    key={item.communityId ?? "global"}
                    className="px-5 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-medium text-white">
                        {item.communityName}
                      </p>
                      <span className="text-xs text-[var(--console-text-muted)]">
                        {formatNumber(item.recordCount)} records
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                      Cost {formatCost(item.estimatedCost, item.recordCount > 0)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function OcrQueue({ queue }: { queue: EntryObservabilityOcrQueue }) {
  const hasOpenWork = queue.pendingCount > 0 || queue.processingCount > 0;

  return (
    <Panel>
      <PanelHeader
        description="Queue health uses existing OCR queue state; provider token and cost accounting remains separate."
        icon={FileImage}
        title="OCR queue"
      />
      <div className="grid gap-0 md:grid-cols-4">
        <div className="border-b border-[var(--console-border)] px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-xs font-medium text-[var(--console-text-muted)]">Open work</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatNumber(queue.pendingCount + queue.processingCount)}
          </p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
            {formatNumber(queue.pendingCount)} pending / {formatNumber(queue.processingCount)} processing
          </p>
        </div>
        <div className="border-b border-[var(--console-border)] px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-xs font-medium text-[var(--console-text-muted)]">Failures</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatNumber(queue.failedCount)}
          </p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
            {formatNumber(queue.exhaustedCount)} exhausted attempts
          </p>
        </div>
        <div className="border-b border-[var(--console-border)] px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-xs font-medium text-[var(--console-text-muted)]">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatNumber(queue.completedCount)}
          </p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
            Last completion {formatRelative(queue.lastCompletedAt)}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-[var(--console-text-muted)]">Provider usage</p>
          <p className="mt-2 text-base font-semibold text-white">
            {queue.providerInstrumented ? "Instrumented" : "Not instrumented"}
          </p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
            {hasOpenWork
              ? `Oldest open ${formatRelative(queue.oldestOpenScheduledAt)}`
              : `${formatNumber(queue.totalJobs)} queue jobs observed`}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function AuditActivity({ data }: { data: EntryObservabilityData }) {
  return (
    <Panel>
      <PanelHeader
        action={
          <Link
            href="/products/entry"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--console-border-strong)] bg-white/[0.025] px-3 text-sm font-semibold text-slate-100 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
          >
            Operations
            <ArrowRight className="h-4 w-4 stroke-[1.75]" />
          </Link>
        }
        description="Recent administrative activity comes from existing audit systems."
        icon={ShieldCheck}
        title="Recent audit activity"
      />
      {data.auditActivity.length === 0 ? (
        <EmptyPanelState
          description="No relevant administrative activity was recorded in this window."
          title="No audit activity"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Community</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--console-border)]">
              {data.auditActivity.map((item) => (
                <tr key={`${item.source}-${item.eventId}`} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-medium text-white">
                    {sentenceLabel(item.action)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{item.actor}</td>
                  <td className="px-4 py-3 text-slate-300">{item.communityName}</td>
                  <td className="px-4 py-3 text-[var(--console-text-muted)]">
                    {sentenceLabel(item.source)}
                  </td>
                  <td className="px-5 py-3 text-[var(--console-text-muted)]">
                    <time dateTime={item.occurredAt} title={formatDateTime(item.occurredAt)}>
                      {formatRelative(item.occurredAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}


function PerformancePanel({ data }: { data: EntryObservabilityData }) {
  const performance = data.performance;

  return (
    <Panel>
      <PanelHeader
        description="Real user experience and backend timings are kept separate from capability health."
        icon={Gauge}
        title="Performance"
      />
      <div className="grid gap-0 md:grid-cols-4">
        <div className="border-b border-[var(--console-border)] px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-xs text-[var(--console-text-muted)]">Measured events</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatNumber(performance.summary.eventCount)}
          </p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
            {formatNumber(performance.summary.failedCount)} failed measurements
          </p>
        </div>
        <div className="border-b border-[var(--console-border)] px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-xs text-[var(--console-text-muted)]">P50</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatLatency(performance.summary.p50Ms)}
          </p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">Typical measured latency</p>
        </div>
        <div className="border-b border-[var(--console-border)] px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-xs text-[var(--console-text-muted)]">P95</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatLatency(performance.summary.p95Ms)}
          </p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">Slow-user experience</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[var(--console-text-muted)]">P99</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatLatency(performance.summary.p99Ms)}
          </p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
            Last sample {formatRelative(performance.summary.lastSeenAt)}
          </p>
        </div>
      </div>
      {performance.metrics.length === 0 ? (
        <EmptyPanelState
          title="Waiting for experience telemetry"
          description="Web and mobile measurements will appear here as instrumented clients report real user timings."
        />
      ) : (
        <div className="overflow-x-auto border-t border-[var(--console-border)]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Metric</th>
                <th className="px-4 py-3 font-medium">Surface</th>
                <th className="px-4 py-3 font-medium">P50</th>
                <th className="px-4 py-3 font-medium">P95</th>
                <th className="px-4 py-3 font-medium">P99</th>
                <th className="px-4 py-3 font-medium">Samples</th>
                <th className="px-5 py-3 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--console-border)]">
              {performance.metrics.slice(0, 16).map((metric) => (
                <tr
                  key={`${metric.surface}-${metric.metric}-${metric.unit}-${metric.appVersion ?? "current"}`}
                  className="hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3 font-medium text-white">{sentenceLabel(metric.metric)}</td>
                  <td className="px-4 py-3 text-slate-300">{sentenceLabel(metric.surface)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatMetricValue(metric.p50, metric.unit)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatMetricValue(metric.p95, metric.unit)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatMetricValue(metric.p99, metric.unit)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatNumber(metric.eventCount)}</td>
                  <td className="px-5 py-3 text-[var(--console-text-muted)]">{formatRelative(metric.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function InfrastructurePanel({ data }: { data: EntryObservabilityData }) {
  const infrastructure = data.infrastructure;
  const push = data.mobilePushDelivery;

  return (
    <Panel>
      <PanelHeader
        description="Workers, queues, database state, and verified mobile push delivery."
        icon={DatabaseZap}
        title="Operational infrastructure"
      />
      <div className="grid gap-0 md:grid-cols-4">
        <div className="border-b border-[var(--console-border)] px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-xs text-[var(--console-text-muted)]">DB connections</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(infrastructure.database.connections)}</p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
            {infrastructure.database.deadlocks} deadlocks · {infrastructure.database.conflicts} conflicts
          </p>
        </div>
        <div className="border-b border-[var(--console-border)] px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-xs text-[var(--console-text-muted)]">DB cache hit</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {infrastructure.database.cacheHitPercent === null
              ? "No data"
              : `${infrastructure.database.cacheHitPercent.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">PostgreSQL shared-buffer cache</p>
        </div>
        <div className="border-b border-[var(--console-border)] px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-xs text-[var(--console-text-muted)]">Mobile push delivery</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(push.deliveryRate)}</p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
            {formatNumber(push.deliveredCount)} delivered / {formatNumber(push.failedCount)} failed
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[var(--console-text-muted)]">Receipt pending</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(push.acceptedCount)}</p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">
            Last delivery {formatRelative(push.lastDeliveredAt)}
          </p>
        </div>
      </div>

      <div className="grid border-t border-[var(--console-border)] xl:grid-cols-2">
        <div className="border-b border-[var(--console-border)] xl:border-b-0 xl:border-r">
          <div className="border-b border-[var(--console-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
            Workers
          </div>
          <div className="divide-y divide-[var(--console-border)]">
            {infrastructure.workers.map((worker) => (
              <div key={worker.name} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-white">{sentenceLabel(worker.name)}</p>
                  <p className="mt-1 text-xs text-[var(--console-text-muted)]">{worker.schedule}</p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-xs font-semibold",
                    worker.status === "succeeded" ? "text-emerald-300" : worker.status === "running" ? "text-sky-300" : "text-rose-300",
                  )}>
                    {sentenceLabel(worker.status)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--console-text-muted)]">{formatRelative(worker.lastFinishedAt ?? worker.lastStartedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="border-b border-[var(--console-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
            Queues
          </div>
          <div className="divide-y divide-[var(--console-border)]">
            {infrastructure.queues.map((queue) => (
              <div key={queue.name} className="flex items-center justify-between gap-4 px-5 py-3">
                <div>
                  <p className="font-medium text-white">{queue.name}</p>
                  <p className="mt-1 text-xs text-[var(--console-text-muted)]">{sentenceLabel(queue.capability)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">
                    {formatNumber(queue.openCount)} open
                  </p>
                  <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                    {formatNumber(queue.failedCount)} system failed
                    {queue.deliveryUnavailableCount > 0
                      ? ` · ${formatNumber(queue.deliveryUnavailableCount)} delivery unavailable`
                      : ""}
                    {" · "}oldest {formatRelative(queue.oldestOpenAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ReadinessPanel({ data }: { data: EntryObservabilityData }) {
  return (
    <Panel>
      <PanelHeader
        description="Deployment readiness and adoption signals. These are operational context, not automatic product failures."
        icon={ShieldCheck}
        title="Rollout & readiness"
      />
      {data.readiness.communities.length === 0 ? (
        <EmptyPanelState title="No active communities" description="Readiness appears for active ENTRY communities." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Community</th>
                <th className="px-4 py-3 font-medium">Residents</th>
                <th className="px-4 py-3 font-medium">Resident push</th>
                <th className="px-4 py-3 font-medium">Guards</th>
                <th className="px-4 py-3 font-medium">Guard push</th>
                <th className="px-4 py-3 font-medium">Activated via queue</th>
                <th className="px-4 py-3 font-medium">Passes</th>
                <th className="px-4 py-3 font-medium">Gate accesses</th>
                <th className="px-5 py-3 font-medium">Messages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--console-border)]">
              {data.readiness.communities.map((community) => (
                <tr key={community.communityId} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-medium text-white">{community.communityName}</td>
                  <td className="px-4 py-3 text-slate-300">{formatNumber(community.activeResidents)}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {formatNumber(community.pushReadyResidents)} / {formatNumber(community.activeResidents)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{formatNumber(community.activeGuards)}</td>
                  <td className={cn(
                    "px-4 py-3",
                    community.activeGuards > 0 && community.pushReadyGuards === 0 ? "font-semibold text-amber-300" : "text-slate-300",
                  )}>
                    {formatNumber(community.pushReadyGuards)} / {formatNumber(community.activeGuards)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{formatNumber(community.activatedResidents)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatNumber(community.passesCreated)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatNumber(community.gateAccesses)}</td>
                  <td className="px-5 py-3 text-slate-300">{formatNumber(community.messagesPublished)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function IncidentHistoryPanel({ data }: { data: EntryObservabilityData }) {
  return (
    <Panel>
      <PanelHeader
        description="Durable lifecycle history remains available after a condition recovers."
        icon={ListTree}
        title="Incident history"
      />
      {data.incidentHistory.length === 0 ? (
        <EmptyPanelState title="No durable incidents" description="Recovered and current monitor incidents will accumulate here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Incident</th>
                <th className="px-4 py-3 font-medium">Capability</th>
                <th className="px-4 py-3 font-medium">Community</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">First seen</th>
                <th className="px-5 py-3 font-medium">Last / resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--console-border)]">
              {data.incidentHistory.slice(0, 30).map((incident) => (
                <tr key={incident.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <p className="font-medium text-white">{sentenceLabel(incident.eventType)}</p>
                    <p className="mt-1 text-xs text-[var(--console-text-muted)]">{incident.errorCode ?? incident.fingerprint}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{sentenceLabel(incident.capability)}</td>
                  <td className="px-4 py-3 text-slate-300">{incident.communityName ?? "ENTRY system"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full border px-2 py-1 text-[11px] font-semibold", severityClass[incident.severity] ?? severityClass.INFO)}>
                      {incident.severity}
                    </span>
                  </td>
                  <td className={cn(
                    "px-4 py-3 font-semibold",
                    incident.status === "open" ? "text-amber-300" : "text-emerald-300",
                  )}>
                    {incident.status === "open" ? "Open" : "Resolved"}
                  </td>
                  <td className="px-4 py-3 text-[var(--console-text-muted)]">{formatDateTime(incident.firstSeenAt)}</td>
                  <td className="px-5 py-3 text-[var(--console-text-muted)]">
                    {incident.resolvedAt ? `Resolved ${formatRelative(incident.resolvedAt)}` : formatRelative(incident.lastSeenAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}


function DiagnosticSnapshotsPanel({
  snapshots,
}: {
  snapshots: EntryDiagnosticSnapshotMeta[];
}) {
  return (
    <Panel>
      <PanelHeader
        description="Saved troubleshooting packages. ERROR/CRITICAL incidents automatically capture detection and recovery snapshots."
        icon={FileJson}
        title="Diagnostic snapshots"
      />
      {snapshots.length === 0 ? (
        <EmptyPanelState
          description="Manual saved diagnostics and automatic incident snapshots will appear here."
          title="No saved diagnostics yet"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
              <tr>
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Trigger</th>
                <th className="px-4 py-3 font-medium">Community</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Captured</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-5 py-3 font-medium">Bundle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--console-border)]">
              {snapshots.map((snapshot) => (
                <tr key={snapshot.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <p className="font-mono text-xs font-semibold text-violet-200">
                      {snapshot.diagnosticRef}
                    </p>
                    {snapshot.notes ? (
                      <p className="mt-1 max-w-sm truncate text-xs text-[var(--console-text-muted)]">
                        {snapshot.notes}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {snapshot.triggerType === "incident_open"
                      ? "Incident detected"
                      : snapshot.triggerType === "incident_recovery"
                        ? "Incident recovered"
                        : "Manual"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {snapshot.communityName ?? "All / ENTRY system"}
                  </td>
                  <td className="px-4 py-3">
                    {snapshot.systemStatus ? (
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-2 py-1 text-xs font-semibold",
                          statusCopy[snapshot.systemStatus].pill,
                        )}
                      >
                        {statusCopy[snapshot.systemStatus].label}
                      </span>
                    ) : (
                      <span className="text-[var(--console-text-muted)]">Not recorded</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--console-text-muted)]">
                    {formatRelative(snapshot.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-[var(--console-text-muted)]">
                    {formatDateTime(snapshot.startsAt)} → {formatDateTime(snapshot.endsAt)}
                  </td>
                  <td className="px-5 py-3">
                    <a
                      href={`/api/entry/observability/diagnostic?snapshot=${snapshot.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200 transition-colors hover:text-violet-100"
                    >
                      Open JSON
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function ObservabilityDashboard({
  data,
  diagnosticSnapshots,
}: {
  data: EntryObservabilityData;
  diagnosticSnapshots: EntryDiagnosticSnapshotMeta[];
}) {
  const status = statusCopy[data.summary.systemStatus];
  const hasUsageRecords = data.usage.summary.recordCount > 0;
  const notificationsParams = new URLSearchParams();

  if (data.range.key !== "24h") {
    notificationsParams.set("range", data.range.key);
  }

  if (data.range.communityId) {
    notificationsParams.set("community", data.range.communityId);
  }

  const notificationsHref = notificationsParams.toString()
    ? `/products/entry/observability/notifications?${notificationsParams.toString()}`
    : "/products/entry/observability/notifications";

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-6">
        <SummaryCard
          icon={Activity}
          label="System status"
          note={
            data.summary.lastObservedAt
              ? `Last observed ${formatRelative(data.summary.lastObservedAt)}`
              : "Insufficient telemetry"
          }
          tone="border-emerald-400/18 bg-emerald-500/[0.08] text-emerald-200"
          value={<span className={status.className}>{status.label}</span>}
        />
        <SummaryCard
          icon={DatabaseZap}
          label="Tracked operations"
          note={`${formatNumber(data.summary.unclassifiedOperations)} unclassified`}
          tone="border-violet-400/18 bg-violet-500/[0.10] text-violet-200"
          value={formatNumber(data.summary.trackedOperations)}
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Error rate"
          note={`${formatNumber(data.summary.failedOperations)} failed / ${formatNumber(data.summary.knownOutcomeOperations)} known outcomes`}
          tone="border-rose-400/18 bg-rose-500/[0.10] text-rose-200"
          value={formatPercent(data.summary.errorRate)}
        />
        <SummaryCard
          icon={Gauge}
          label="P95 latency"
          note="Only instrumented durations"
          tone="border-sky-400/18 bg-sky-500/[0.10] text-sky-200"
          value={formatLatency(data.summary.p95LatencyMs)}
        />
        <SummaryCard
          icon={FileImage}
          label="Images processed"
          note="From provider usage ledger"
          tone="border-fuchsia-400/18 bg-fuchsia-500/[0.10] text-fuchsia-200"
          value={
            hasUsageRecords ? formatNumber(data.summary.imagesProcessed) : "No data"
          }
        />
        <SummaryCard
          icon={Clock3}
          label="Estimated variable cost"
          note={
            data.summary.unknownCostCount > 0
              ? "Some usage has unknown cost"
              : "Historical recorded estimate"
          }
          tone="border-cyan-400/18 bg-cyan-500/[0.10] text-cyan-200"
          value={formatCost(data.summary.estimatedCost, hasUsageRecords)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.88fr)]">
        <CriticalFlows
          flows={data.criticalFlows}
          notificationsHref={notificationsHref}
        />
        <Incidents incidents={data.incidents} />
      </section>

      <PerformancePanel data={data} />

      <InfrastructurePanel data={data} />

      <ReadinessPanel data={data} />

      <IncidentHistoryPanel data={data} />

      <DiagnosticSnapshotsPanel snapshots={diagnosticSnapshots} />

      <OcrQueue queue={data.ocrQueue} />

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(520px,0.85fr)]">
        <UsageAndCost data={data} />
        <AuditActivity data={data} />
      </section>
    </div>
  );
}

export default async function EntryObservabilityPage(props: {
  searchParams: Promise<{
    community?: string | string[];
    range?: string | string[];
  }>;
}) {
  const searchParams = await props.searchParams;
  const range = normalizeEntryObservabilityRange(searchParams.range);
  const communityId = Array.isArray(searchParams.community)
    ? searchParams.community[0]
    : searchParams.community;
  const [result, diagnosticSnapshotsResult] = await Promise.all([
    getEntryObservability({
      communityId: communityId ?? null,
      range,
    }),
    getEntryDiagnosticSnapshots({
      communityId: communityId ?? null,
      limit: 12,
    }),
  ]);

  const communities = result.state === "ready" ? result.data.communities : [];
  const diagnosticSnapshots =
    diagnosticSnapshotsResult.state === "ready" ? diagnosticSnapshotsResult.data : [];
  const selectedCommunity =
    communityId && communities.some((community) => community.id === communityId)
      ? communityId
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ENTRY observability"
        description="Operational health, incidents, usage, and cost visibility for ENTRY."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DiagnosticBundleControl
              communities={communities}
              communityId={selectedCommunity}
              range={range}
            />
            <ObservabilityFilters
              communities={communities}
              communityId={selectedCommunity}
              range={range}
            />
          </div>
        }
      />

      {result.state === "unavailable" ? (
        <Panel>
          <div className="flex flex-col items-start gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/24 bg-amber-500/[0.10] px-3 py-1 text-xs font-semibold text-amber-100">
                <AlertTriangle className="h-3.5 w-3.5" />
                Observability unavailable
              </div>
              <h2 className="mt-4 text-xl font-semibold text-white">
                Could not load the ENTRY read model
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--console-text-muted)]">
                {result.error}
              </p>
            </div>
            <Link
              href="/products/entry/observability"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--console-border-strong)] bg-white/[0.025] px-3.5 text-sm font-semibold text-slate-100 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
            >
              <RefreshCw className="h-4 w-4 stroke-[1.75]" />
              Retry
            </Link>
          </div>
        </Panel>
      ) : (
        <ObservabilityDashboard
          data={result.data}
          diagnosticSnapshots={diagnosticSnapshots}
        />
      )}
    </div>
  );
}
