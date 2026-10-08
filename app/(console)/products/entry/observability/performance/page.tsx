import { AlertTriangle, BarChart3, Gauge, RefreshCw } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { ObservabilityFilters } from "@/features/entry/observability/ObservabilityFilters";
import {
  getEntryObservability,
  normalizeEntryObservabilityRange,
  type EntryObservabilityData,
} from "@/features/entry/observability/queries";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatLatency(value: number | null) {
  return value === null ? "Not available" : `${formatNumber(Math.round(value))} ms`;
}

function formatMetricValue(value: number | null, unit: string) {
  if (value === null) return "No data";
  if (unit === "ms") return `${formatNumber(Math.round(value))} ms`;
  if (unit === "score") return value.toFixed(4);
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return formatNumber(Math.round(value));
}

function formatCost(value: number | null, hasUsageRecords: boolean) {
  if (value === null) return hasUsageRecords ? "Not available" : "No data";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
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
  return `${Math.floor(hours / 24)}d ago`;
}

function sentenceLabel(value: string) {
  return value.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^\w/, (letter) => letter.toUpperCase());
}

function MetricCard({ label, note, value }: { label: string; note: string; value: React.ReactNode }) {
  return (
    <article className="relative rounded-[10px] border border-[#141119] bg-[#24202B] p-4 before:absolute before:left-0 before:top-0 before:h-px before:w-12 before:bg-[#7553FF]">
      <p className="text-xs font-medium text-[#A9A3B2]">{label}</p>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
      <p className="mt-2 text-xs leading-5 text-[#A9A3B2]">{note}</p>
    </article>
  );
}

function PerformanceDashboard({ data }: { data: EntryObservabilityData }) {
  const performance = data.performance;
  const usage = data.usage;
  const hasUsageRecords = usage.summary.recordCount > 0;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Measured events"
          value={formatNumber(performance.summary.eventCount)}
          note={`${formatNumber(performance.summary.failedCount)} failed measurements`}
        />
        <MetricCard label="P50" value={formatLatency(performance.summary.p50Ms)} note="Typical measured latency" />
        <MetricCard label="P95" value={formatLatency(performance.summary.p95Ms)} note="Slow-user experience" />
        <MetricCard label="P99" value={formatLatency(performance.summary.p99Ms)} note={`Last sample ${formatRelative(performance.summary.lastSeenAt)}`} />
      </section>

      <section className="overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B]">
        <div className="flex items-start gap-3 border-b border-[#141119] px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.14] bg-white/[0.02] text-[#D8D3E7]">
            <Gauge className="h-4.5 w-4.5 stroke-[1.75]" />
          </span>
          <div>
            <h2 className="font-semibold text-white">Performance metrics</h2>
            <p className="mt-1 text-sm text-[#A9A3B2]">Real user experience and backend timings by surface.</p>
          </div>
        </div>
        {performance.metrics.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#A9A3B2]">Waiting for experience telemetry.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-[#141119] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[#A9A3B2]">
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
              <tbody className="divide-y divide-[#141119]">
                {performance.metrics.slice(0, 24).map((metric) => (
                  <tr key={`${metric.surface}-${metric.metric}-${metric.unit}-${metric.appVersion ?? "current"}`} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium text-white">{sentenceLabel(metric.metric)}</td>
                    <td className="px-4 py-3 text-slate-300">{sentenceLabel(metric.surface)}</td>
                    <td className="px-4 py-3 text-slate-300">{formatMetricValue(metric.p50, metric.unit)}</td>
                    <td className="px-4 py-3 text-slate-300">{formatMetricValue(metric.p95, metric.unit)}</td>
                    <td className="px-4 py-3 text-slate-300">{formatMetricValue(metric.p99, metric.unit)}</td>
                    <td className="px-4 py-3 text-slate-300">{formatNumber(metric.eventCount)}</td>
                    <td className="px-5 py-3 text-[#A9A3B2]">{formatRelative(metric.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B]">
        <div className="flex items-start gap-3 border-b border-[#141119] px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.14] bg-white/[0.02] text-[#D8D3E7]">
            <BarChart3 className="h-4.5 w-4.5 stroke-[1.75]" />
          </span>
          <div>
            <h2 className="font-semibold text-white">Usage & variable cost</h2>
            <p className="mt-1 text-sm text-[#A9A3B2]">Provider usage, images, tokens, and recorded cost estimates.</p>
          </div>
        </div>

        <div className="grid border-b border-[#141119] md:grid-cols-5">
          <div className="border-b border-[#141119] px-5 py-4 md:border-b-0 md:border-r">
            <p className="text-xs text-[#A9A3B2]">Records</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatNumber(usage.summary.recordCount)}</p>
          </div>
          <div className="border-b border-[#141119] px-5 py-4 md:border-b-0 md:border-r">
            <p className="text-xs text-[#A9A3B2]">Images</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatNumber(usage.summary.imageCount)}</p>
          </div>
          <div className="border-b border-[#141119] px-5 py-4 md:border-b-0 md:border-r">
            <p className="text-xs text-[#A9A3B2]">Input tokens</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatNumber(usage.summary.inputTokens)}</p>
          </div>
          <div className="border-b border-[#141119] px-5 py-4 md:border-b-0 md:border-r">
            <p className="text-xs text-[#A9A3B2]">Output tokens</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatNumber(usage.summary.outputTokens)}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-[#A9A3B2]">Estimated cost</p>
            <p className="mt-2 text-xl font-semibold text-white">{formatCost(usage.summary.estimatedCost, hasUsageRecords)}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2">
          <div className="border-b border-[#141119] lg:border-b-0 lg:border-r">
            <div className="border-b border-[#141119] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#A9A3B2]">Providers</div>
            <div className="divide-y divide-[#141119]">
              {usage.byProvider.slice(0, 10).map((item) => (
                <div key={`${item.provider}-${item.operation}-${item.serviceModel}`} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{item.provider}</p>
                    <p className="mt-1 truncate text-xs text-[#A9A3B2]">{sentenceLabel(item.operation)} · {item.serviceModel}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-white">{formatNumber(item.recordCount)}</p>
                    <p className="mt-1 text-xs text-[#A9A3B2]">calls</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="border-b border-[#141119] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#A9A3B2]">Communities</div>
            <div className="divide-y divide-[#141119]">
              {usage.byCommunity.slice(0, 10).map((item) => (
                <div key={item.communityId ?? "global"} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{item.communityName}</p>
                    <p className="mt-1 text-xs text-[#A9A3B2]">{formatNumber(item.imageCount)} images</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-white">{formatNumber(item.recordCount)}</p>
                    <p className="mt-1 text-xs text-[#A9A3B2]">{formatCost(item.estimatedCost, item.recordCount > 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function UnavailableState({ error }: { error: string }) {
  return (
    <section className="rounded-[10px] border border-[#141119] bg-[#24202B] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
        <div>
          <h2 className="font-semibold text-white">Performance telemetry unavailable</h2>
          <p className="mt-2 text-sm text-[#A9A3B2]">{error}</p>
          <Link href="/products/entry/observability/performance" className="mt-4 inline-flex h-9 items-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-sm font-semibold text-white shadow-[0_2px_0_#141119]">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function EntryObservabilityPerformancePage(props: {
  searchParams: Promise<{ community?: string | string[]; range?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const range = normalizeEntryObservabilityRange(searchParams.range);
  const communityId = Array.isArray(searchParams.community) ? searchParams.community[0] : searchParams.community;
  const result = await getEntryObservability({ communityId: communityId ?? null, model: "performance", range });
  const communities = result.state === "ready" ? result.data.communities : [];
  const selectedCommunity =
    communityId && communities.some((community) => community.id === communityId) ? communityId : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="ENTRY monitors / Performance"
        description="Latency, real-user measurements, provider usage, and variable cost."
        actions={
          <ObservabilityFilters
            basePath="/products/entry/observability/performance"
            communities={communities}
            communityId={selectedCommunity}
            range={range}
          />
        }
      />
      {result.state === "unavailable" ? <UnavailableState error={result.error} /> : <PerformanceDashboard data={result.data} />}
    </div>
  );
}
