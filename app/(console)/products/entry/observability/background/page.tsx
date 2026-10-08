import { AlertTriangle, DatabaseZap, FileImage, RefreshCw, ServerCog } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { ObservabilityFilters } from "@/features/entry/observability/ObservabilityFilters";
import {
  getEntryObservability,
  normalizeEntryObservabilityRange,
  type EntryObservabilityData,
} from "@/features/entry/observability/queries";
import { cn } from "@/lib/supabase/utils";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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

function workerStatusClass(status: string) {
  switch (status.trim().toLowerCase()) {
    case "succeeded":
      return "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200";
    case "running":
      return "border-sky-400/20 bg-sky-500/[0.08] text-sky-200";
    case "failed":
      return "border-rose-400/24 bg-rose-500/[0.10] text-rose-200";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-300";
  }
}

function queueStatusClass(input: {
  deliveryUnavailableCount: number;
  failedCount: number;
  openCount: number;
}) {
  if (input.failedCount > 0) return "border-rose-400/24 bg-rose-500/[0.10] text-rose-200";
  if (input.deliveryUnavailableCount > 0) return "border-amber-400/22 bg-amber-500/[0.08] text-amber-200";
  if (input.openCount > 0) return "border-violet-400/20 bg-violet-500/[0.08] text-violet-200";
  return "border-emerald-400/18 bg-emerald-500/[0.07] text-emerald-200";
}

function MetricCard({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value: React.ReactNode;
}) {
  return (
    <article className="relative rounded-[10px] border border-[#141119] bg-[#24202B] p-4 before:absolute before:left-0 before:top-0 before:h-px before:w-12 before:bg-[#7553FF]">
      <p className="text-xs font-medium text-[#A9A3B2]">{label}</p>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
      <p className="mt-2 text-xs leading-5 text-[#A9A3B2]">{note}</p>
    </article>
  );
}

function BackgroundDashboard({ data }: { data: EntryObservabilityData }) {
  const infrastructure = data.infrastructure;
  const push = data.mobilePushDelivery;
  const ocr = data.ocrQueue;
  const deliveryRate =
    push.deliveryRate === null ? "Not available" : `${(push.deliveryRate * 100).toFixed(1)}%`;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="DB connections"
          value={formatNumber(infrastructure.database.connections)}
          note={`${infrastructure.database.deadlocks} deadlocks · ${infrastructure.database.conflicts} conflicts`}
        />
        <MetricCard
          label="Mobile push delivery"
          value={deliveryRate}
          note={`${formatNumber(push.deliveredCount)} delivered / ${formatNumber(push.failedCount)} failed`}
        />
        <MetricCard
          label="OCR open work"
          value={formatNumber(ocr.pendingCount + ocr.processingCount)}
          note={`${formatNumber(ocr.failedCount)} failed · last done ${formatRelative(ocr.lastCompletedAt)}`}
        />
        <MetricCard
          label="Background monitors"
          value={formatNumber(infrastructure.workers.length)}
          note={`${formatNumber(infrastructure.queues.length)} queues tracked`}
        />
      </section>

      <section className="overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B]">
        <div className="flex items-start gap-3 border-b border-[#141119] px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.14] bg-white/[0.02] text-[#D8D3E7]">
            <ServerCog className="h-4.5 w-4.5 stroke-[1.75]" />
          </span>
          <div>
            <h2 className="font-semibold text-white">Workers & cron monitors</h2>
            <p className="mt-1 text-sm text-[#A9A3B2]">
              Last execution state for ENTRY background work.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-[#141119] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[#A9A3B2]">
              <tr>
                <th className="px-5 py-3 font-medium">Worker</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-5 py-3 font-medium">Last run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141119]">
              {infrastructure.workers.map((worker) => (
                <tr key={worker.name} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-medium text-white">{sentenceLabel(worker.name)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#A9A3B2]">{worker.schedule || "Not scheduled"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", workerStatusClass(worker.status))}>
                      {sentenceLabel(worker.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{formatRelative(worker.lastFinishedAt ?? worker.lastStartedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B]">
        <div className="flex items-start gap-3 border-b border-[#141119] px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.14] bg-white/[0.02] text-[#D8D3E7]">
            <DatabaseZap className="h-4.5 w-4.5 stroke-[1.75]" />
          </span>
          <div>
            <h2 className="font-semibold text-white">Queues</h2>
            <p className="mt-1 text-sm text-[#A9A3B2]">
              Open work, failures, and delivery-unavailable outcomes.
            </p>
          </div>
        </div>
        <div className="divide-y divide-[#141119]">
          {infrastructure.queues.map((queue) => (
            <article key={queue.name} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-white">{queue.name}</p>
                <p className="mt-1 text-xs text-[#A9A3B2]">{sentenceLabel(queue.capability)} · oldest {formatRelative(queue.oldestOpenAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-md border px-2 py-1 text-xs font-semibold", queueStatusClass(queue))}>
                  {formatNumber(queue.openCount)} open
                </span>
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-300">
                  {formatNumber(queue.failedCount)} system failed
                </span>
                {queue.deliveryUnavailableCount > 0 ? (
                  <span className="rounded-md border border-amber-400/20 bg-amber-500/[0.08] px-2 py-1 text-xs text-amber-200">
                    {formatNumber(queue.deliveryUnavailableCount)} unavailable
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B]">
        <div className="flex items-start gap-3 border-b border-[#141119] px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.14] bg-white/[0.02] text-[#D8D3E7]">
            <FileImage className="h-4.5 w-4.5 stroke-[1.75]" />
          </span>
          <div>
            <h2 className="font-semibold text-white">OCR queue</h2>
            <p className="mt-1 text-sm text-[#A9A3B2]">
              Plate-recognition recovery and retry state.
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-4">
          <div className="border-b border-[#141119] px-5 py-4 md:border-b-0 md:border-r">
            <p className="text-xs text-[#A9A3B2]">Pending</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(ocr.pendingCount)}</p>
          </div>
          <div className="border-b border-[#141119] px-5 py-4 md:border-b-0 md:border-r">
            <p className="text-xs text-[#A9A3B2]">Processing</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(ocr.processingCount)}</p>
          </div>
          <div className="border-b border-[#141119] px-5 py-4 md:border-b-0 md:border-r">
            <p className="text-xs text-[#A9A3B2]">Failed</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(ocr.failedCount)}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-[#A9A3B2]">Completed</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(ocr.completedCount)}</p>
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
          <h2 className="font-semibold text-white">Background telemetry unavailable</h2>
          <p className="mt-2 text-sm text-[#A9A3B2]">{error}</p>
          <Link href="/products/entry/observability/background" className="mt-4 inline-flex h-9 items-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-sm font-semibold text-white shadow-[0_2px_0_#141119]">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function EntryObservabilityBackgroundPage(props: {
  searchParams: Promise<{ community?: string | string[]; range?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const range = normalizeEntryObservabilityRange(searchParams.range);
  const communityId = Array.isArray(searchParams.community) ? searchParams.community[0] : searchParams.community;
  const result = await getEntryObservability({ communityId: communityId ?? null, model: "background", range });
  const communities = result.state === "ready" ? result.data.communities : [];
  const selectedCommunity =
    communityId && communities.some((community) => community.id === communityId) ? communityId : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="ENTRY observability / Background"
        description="Cron monitors, workers, queues, database pressure, and OCR recovery."
        actions={
          <ObservabilityFilters
            basePath="/products/entry/observability/background"
            communities={communities}
            communityId={selectedCommunity}
            range={range}
          />
        }
      />
      {result.state === "unavailable" ? <UnavailableState error={result.error} /> : <BackgroundDashboard data={result.data} />}
    </div>
  );
}
