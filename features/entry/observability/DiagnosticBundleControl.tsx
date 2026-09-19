"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  Copy,
  Download,
  FileJson,
  Loader2,
  Save,
  Stethoscope,
  X,
} from "lucide-react";
import type {
  EntryObservabilityCommunity,
  EntryObservabilityTimeRange,
} from "@/features/entry/observability/queries";

type DiagnosticBundleControlProps = {
  communities: EntryObservabilityCommunity[];
  communityId: string | null;
  range: EntryObservabilityTimeRange;
};

type DiagnosticResponse = {
  bundle?: Record<string, unknown>;
  snapshot?: {
    created_at?: string;
    diagnostic_ref?: string;
    id?: string;
  } | null;
  error?: string;
};

type Preset = "15m" | "1h" | "6h" | "24h" | "7d" | "30d" | "custom";

function hoursForPreset(preset: Exclude<Preset, "custom">) {
  if (preset === "15m") return 0.25;
  if (preset === "1h") return 1;
  if (preset === "6h") return 6;
  if (preset === "7d") return 24 * 7;
  if (preset === "30d") return 24 * 30;
  return 24;
}

function defaultPreset(range: EntryObservabilityTimeRange): Preset {
  return range === "7d" ? "7d" : range === "30d" ? "30d" : "24h";
}

function localDateTimeValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function diagnosticSummary(bundle: Record<string, unknown>) {
  const triage = asRecord(bundle.triage_summary);
  const community = asRecord(bundle.community);
  const range = asRecord(bundle.range);
  const observability = asRecord(bundle.observability);
  const performance = asRecord(observability.performance);
  const performanceSummary = asRecord(performance.summary);
  const infrastructure = asRecord(observability.infrastructure);
  const queues = asArray(infrastructure.queues).map(asRecord);
  const incidents = asArray(observability.incidents).map(asRecord);
  const flows = asArray(observability.critical_flows).map(asRecord);

  const lines = [
    "ENTRY Diagnostic",
    `Community: ${String(community.name || "All communities")}`,
    `Window: ${String(range.starts_at || "?")} → ${String(range.ends_at || "?")}`,
    `System: ${String(triage.system_status || "unknown").toUpperCase()}`,
    "",
    `Active incidents: ${incidents.length}`,
  ];

  for (const incident of incidents.slice(0, 8)) {
    lines.push(
      `- ${String(incident.error_code || incident.event_type || "Incident")} [${String(
        incident.severity || "INFO",
      )}]`,
    );
  }

  lines.push("", "Critical flows:");
  for (const flow of flows) {
    lines.push(`- ${String(flow.label || flow.key || "Flow")}: ${String(flow.status || "unknown")}`);
  }

  lines.push(
    "",
    "Performance:",
    `- p50: ${performanceSummary.p50_ms ?? "n/a"} ms`,
    `- p95: ${performanceSummary.p95_ms ?? "n/a"} ms`,
    `- p99: ${performanceSummary.p99_ms ?? "n/a"} ms`,
    "",
    "Queues:",
  );

  for (const queue of queues) {
    lines.push(
      `- ${String(queue.name || "Queue")}: ${String(queue.open_count ?? 0)} open / ${String(
        queue.failed_count ?? 0,
      )} failed`,
    );
  }

  return lines.join("\n");
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export function DiagnosticBundleControl({
  communities,
  communityId,
  range,
}: DiagnosticBundleControlProps) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<Preset>(() => defaultPreset(range));
  const [customStart, setCustomStart] = useState(() =>
    localDateTimeValue(new Date(Date.now() - 60 * 60 * 1000)),
  );
  const [customEnd, setCustomEnd] = useState(() => localDateTimeValue(new Date()));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [response, setResponse] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const selectedCommunity = useMemo(
    () => communities.find((community) => community.id === communityId) ?? null,
    [communities, communityId],
  );

  function rangeForRequest() {
    const endsAt = preset === "custom" ? new Date(customEnd) : new Date();
    const startsAt =
      preset === "custom"
        ? new Date(customStart)
        : new Date(endsAt.getTime() - hoursForPreset(preset) * 60 * 60 * 1000);

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new Error("Choose a valid diagnostic time window.");
    }

    return {
      endsAt: endsAt.toISOString(),
      startsAt: startsAt.toISOString(),
    };
  }

  async function generate(save: boolean, fixedRange?: { startsAt: string; endsAt: string }) {
    const setBusy = save ? setSaving : setLoading;
    setBusy(true);
    setError(null);

    try {
      const requestRange = fixedRange ?? rangeForRequest();
      const result = await fetch("/api/entry/observability/diagnostic", {
        body: JSON.stringify({
          communityId,
          endsAt: requestRange.endsAt,
          notes: notes || null,
          save,
          startsAt: requestRange.startsAt,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const payload = (await result.json()) as DiagnosticResponse;
      if (!result.ok || !payload.bundle) {
        throw new Error(payload.error || "Could not generate diagnostic bundle.");
      }

      setResponse(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate diagnostic bundle.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrent() {
    const bundle = response?.bundle;
    if (!bundle) return;
    const bundleRange = asRecord(bundle.range);
    const startsAt = String(bundleRange.starts_at || "");
    const endsAt = String(bundleRange.ends_at || "");
    if (!startsAt || !endsAt) return;

    await generate(true, { startsAt, endsAt });
  }

  async function handleCopy(kind: "summary" | "json") {
    if (!response?.bundle) return;
    const value =
      kind === "summary"
        ? diagnosticSummary(response.bundle)
        : JSON.stringify(response.bundle, null, 2);

    await copyText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  }

  function downloadJson() {
    if (!response?.bundle) return;

    const blob = new Blob([JSON.stringify(response.bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `entry-diagnostic-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-violet-400/25 bg-violet-500/[0.10] px-3.5 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-300/40 hover:bg-violet-500/[0.16]"
      >
        <Stethoscope className="h-4 w-4" />
        Generate diagnostic
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-white/12 bg-[#111315] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">ENTRY diagnostic bundle</h2>
                <p className="mt-1 text-sm leading-5 text-slate-400">
                  Consolidates health, incidents, performance, infrastructure, and privacy-minimized
                  recent events into one troubleshooting package.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close diagnostic dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Community
                  </p>
                  <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-sm text-white">
                    {selectedCommunity?.name ?? "All communities"}
                  </p>
                </div>
                <label>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Window
                  </span>
                  <select
                    value={preset}
                    onChange={(event) => setPreset(event.target.value as Preset)}
                    className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#17191c] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                  >
                    <option value="15m">Last 15 minutes</option>
                    <option value="1h">Last hour</option>
                    <option value="6h">Last 6 hours</option>
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="custom">Custom range</option>
                  </select>
                </label>
              </div>

              {preset === "custom" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Start
                    </span>
                    <input
                      type="datetime-local"
                      value={customStart}
                      onChange={(event) => setCustomStart(event.target.value)}
                      className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#17191c] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      End
                    </span>
                    <input
                      type="datetime-local"
                      value={customEnd}
                      onChange={(event) => setCustomEnd(event.target.value)}
                      className="mt-2 h-10 w-full rounded-lg border border-white/10 bg-[#17191c] px-3 text-sm text-white outline-none focus:border-violet-400/50"
                    />
                  </label>
                </div>
              ) : null}

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Notes (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value.slice(0, 1000))}
                  placeholder="Example: Guard reported QR failures around 7:40 PM."
                  rows={2}
                  className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-[#17191c] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
                />
              </label>

              {error ? (
                <div className="rounded-lg border border-rose-400/20 bg-rose-500/[0.08] px-3 py-2 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              {!response?.bundle ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void generate(false)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
                  {loading ? "Generating…" : "Generate bundle"}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.07] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                      <Check className="h-4 w-4" />
                      Diagnostic ready
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      The package is privacy-minimized and ready to copy, download, or save for later investigation.
                    </p>
                    {response.snapshot?.diagnostic_ref ? (
                      <p className="mt-3 font-mono text-xs text-violet-200">
                        Saved as {response.snapshot.diagnostic_ref}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopy("summary")}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-100 hover:bg-white/[0.06]"
                    >
                      {copied === "summary" ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                      Copy summary
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy("json")}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-100 hover:bg-white/[0.06]"
                    >
                      {copied === "json" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      Copy JSON
                    </button>
                    <button
                      type="button"
                      onClick={downloadJson}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-100 hover:bg-white/[0.06]"
                    >
                      <Download className="h-4 w-4" />
                      Download JSON
                    </button>
                    <button
                      type="button"
                      disabled={saving || Boolean(response.snapshot?.diagnostic_ref)}
                      onClick={() => void saveCurrent()}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-violet-400/25 bg-violet-500/[0.10] px-3 text-sm font-semibold text-violet-100 hover:bg-violet-500/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {response.snapshot?.diagnostic_ref ? "Snapshot saved" : "Save snapshot"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResponse(null);
                        setError(null);
                      }}
                      className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-400 hover:bg-white/[0.04] hover:text-white"
                    >
                      Generate another
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-500">
                Excluded by design: passwords, activation PINs, QR tokens, raw push tokens,
                visitor names, email addresses, and message bodies. ERROR/CRITICAL incidents
                also save automatic 90-day snapshots at detection and recovery.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
