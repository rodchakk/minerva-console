import { AlertTriangle, FileJson, History, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { DiagnosticBundleControl } from "@/features/entry/observability/DiagnosticBundleControl";
import { ObservabilityFilters } from "@/features/entry/observability/ObservabilityFilters";
import {
  getEntryDiagnosticSnapshots,
  getEntryObservability,
  normalizeEntryObservabilityRange,
  type EntryDiagnosticSnapshotMeta,
  type EntryObservabilityData,
} from "@/features/entry/observability/queries";
import { cn } from "@/lib/supabase/utils";

export const dynamic = "force-dynamic";

const severityClass: Record<string, string> = {
  CRITICAL: "border-rose-400/30 bg-rose-500/[0.10] text-rose-200",
  ERROR: "border-red-400/25 bg-red-500/[0.10] text-red-200",
  INFO: "border-sky-400/20 bg-sky-500/[0.08] text-sky-200",
  WARNING: "border-amber-400/25 bg-amber-500/[0.10] text-amber-200",
};

function sentenceLabel(value: string) {
  return value.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^\w/, (letter) => letter.toUpperCase());
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
  return `${Math.floor(hours / 24)}d ago`;
}

function DiagnosticsDashboard({
  data,
  snapshots,
}: {
  data: EntryObservabilityData;
  snapshots: EntryDiagnosticSnapshotMeta[];
}) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B]">
        <div className="flex items-start gap-3 border-b border-[#141119] px-5 py-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/[0.14] bg-white/[0.02] text-[#D8D3E7]">
            <History className="h-4.5 w-4.5 stroke-[1.75]" />
          </span>
          <div>
            <h2 className="font-semibold text-white">Incident history</h2>
            <p className="mt-1 text-sm text-[#A9A3B2]">
              Durable monitor history remains available after a condition recovers.
            </p>
          </div>
        </div>
        {data.incidentHistory.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#A9A3B2]">No durable incidents in this window.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#141119] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[#A9A3B2]">
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
              <tbody className="divide-y divide-[#141119]">
                {data.incidentHistory.slice(0, 50).map((incident) => (
                  <tr key={incident.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <p className="font-medium text-white">{sentenceLabel(incident.eventType)}</p>
                      <p className="mt-1 text-xs text-[#A9A3B2]">{incident.errorCode ?? incident.fingerprint}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{sentenceLabel(incident.capability)}</td>
                    <td className="px-4 py-3 text-slate-300">{incident.communityName ?? "ENTRY system"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-[4px] border px-2 py-1 text-[11px] font-semibold", severityClass[incident.severity] ?? severityClass.INFO)}>
                        {incident.severity}
                      </span>
                    </td>
                    <td className={cn("px-4 py-3 font-semibold", incident.status === "open" ? "text-amber-300" : "text-emerald-300")}>
                      {incident.status === "open" ? "Open" : "Resolved"}
                    </td>
                    <td className="px-4 py-3 text-[#A9A3B2]">{formatDateTime(incident.firstSeenAt)}</td>
                    <td className="px-5 py-3 text-[#A9A3B2]">
                      {incident.resolvedAt ? `Resolved ${formatRelative(incident.resolvedAt)}` : formatRelative(incident.lastSeenAt)}
                    </td>
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
            <FileJson className="h-4.5 w-4.5 stroke-[1.75]" />
          </span>
          <div>
            <h2 className="font-semibold text-white">Diagnostic snapshots</h2>
            <p className="mt-1 text-sm text-[#A9A3B2]">
              Manual bundles plus automatic detection and recovery captures.
            </p>
          </div>
        </div>
        {snapshots.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#A9A3B2]">No saved diagnostics yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-[#141119] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[#A9A3B2]">
                <tr>
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Trigger</th>
                  <th className="px-4 py-3 font-medium">Community</th>
                  <th className="px-4 py-3 font-medium">Captured</th>
                  <th className="px-5 py-3 font-medium">Bundle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141119]">
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs font-semibold text-violet-200">{snapshot.diagnosticRef}</p>
                      {snapshot.notes ? <p className="mt-1 max-w-md truncate text-xs text-[#A9A3B2]">{snapshot.notes}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {snapshot.triggerType === "incident_open"
                        ? "Incident detected"
                        : snapshot.triggerType === "incident_recovery"
                          ? "Incident recovered"
                          : "Manual"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{snapshot.communityName ?? "All / ENTRY system"}</td>
                    <td className="px-4 py-3 text-[#A9A3B2]">{formatRelative(snapshot.createdAt)}</td>
                    <td className="px-5 py-3">
                      <a
                        href={`/api/entry/observability/diagnostic?snapshot=${snapshot.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-violet-200 transition-colors hover:text-violet-100"
                      >
                        Open JSON
                      </a>
                    </td>
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
            <ShieldCheck className="h-4.5 w-4.5 stroke-[1.75]" />
          </span>
          <div>
            <h2 className="font-semibold text-white">Recent audit activity</h2>
            <p className="mt-1 text-sm text-[#A9A3B2]">Administrative changes that may explain operational state.</p>
          </div>
        </div>
        {data.auditActivity.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#A9A3B2]">No relevant administrative activity in this window.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[#141119] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[#A9A3B2]">
                <tr>
                  <th className="px-5 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Community</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141119]">
                {data.auditActivity.map((item) => (
                  <tr key={`${item.source}-${item.eventId}`} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium text-white">{sentenceLabel(item.action)}</td>
                    <td className="px-4 py-3 text-slate-300">{item.actor}</td>
                    <td className="px-4 py-3 text-slate-300">{item.communityName}</td>
                    <td className="px-4 py-3 text-[#A9A3B2]">{sentenceLabel(item.source)}</td>
                    <td className="px-5 py-3 text-[#A9A3B2]">{formatRelative(item.occurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          <h2 className="font-semibold text-white">Diagnostics unavailable</h2>
          <p className="mt-2 text-sm text-[#A9A3B2]">{error}</p>
          <Link href="/products/entry/observability/diagnostics" className="mt-4 inline-flex h-9 items-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-sm font-semibold text-white shadow-[0_2px_0_#141119]">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function EntryObservabilityDiagnosticsPage(props: {
  searchParams: Promise<{ community?: string | string[]; range?: string | string[] }>;
}) {
  const searchParams = await props.searchParams;
  const range = normalizeEntryObservabilityRange(searchParams.range);
  const communityId = Array.isArray(searchParams.community) ? searchParams.community[0] : searchParams.community;

  const [result, snapshotsResult] = await Promise.all([
    getEntryObservability({ communityId: communityId ?? null, model: "diagnostics", range }),
    getEntryDiagnosticSnapshots({ communityId: communityId ?? null, limit: 20 }),
  ]);

  const communities = result.state === "ready" ? result.data.communities : [];
  const selectedCommunity =
    communityId && communities.some((community) => community.id === communityId) ? communityId : null;
  const snapshots = snapshotsResult.state === "ready" ? snapshotsResult.data : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="ENTRY observability / Diagnostics"
        description="Incident history, saved troubleshooting bundles, and operational audit context."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DiagnosticBundleControl communities={communities} communityId={selectedCommunity} range={range} />
            <ObservabilityFilters
              basePath="/products/entry/observability/diagnostics"
              communities={communities}
              communityId={selectedCommunity}
              range={range}
            />
          </div>
        }
      />
      {result.state === "unavailable" ? (
        <UnavailableState error={result.error} />
      ) : (
        <DiagnosticsDashboard data={result.data} snapshots={snapshots} />
      )}
    </div>
  );
}
