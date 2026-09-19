import {
  FieldEntryHealthWorkspace,
  type FieldEntryHealthView,
} from "@/features/entry/field/FieldEntryHealthWorkspace";
import {
  getEntryDiagnosticSnapshots,
  getEntryObservability,
} from "@/features/entry/observability/queries";

export const dynamic = "force-dynamic";

export default async function FieldEntryHealthPage() {
  const [observability, snapshots] = await Promise.all([
    getEntryObservability({ range: "24h" }).catch(() => ({
      error: "ENTRY health could not be loaded.",
      state: "unavailable" as const,
    })),
    getEntryDiagnosticSnapshots({ limit: 50 }).catch(() => ({
      error: "Diagnostic snapshots could not be loaded.",
      state: "unavailable" as const,
    })),
  ]);

  if (observability.state !== "ready") {
    return (
      <FieldEntryHealthWorkspace
        data={null}
        error={observability.error}
      />
    );
  }

  const currentStatus = observability.data.summary.systemStatus;
  const lastHealthyAt =
    currentStatus === "healthy"
      ? observability.data.generatedAt
      : snapshots.state === "ready"
        ? snapshots.data.find((snapshot) => snapshot.systemStatus === "healthy")
            ?.createdAt ?? null
        : null;

  const data = {
    flows: observability.data.criticalFlows.map((flow) => ({
      key: flow.key,
      label: flow.label,
      lastSuccessAt: flow.lastSuccessAt,
      status: flow.status,
    })),
    generatedAt: observability.data.generatedAt,
    incidents: observability.data.incidents.map((incident) => ({
      errorCode: incident.errorCode,
      eventType: incident.eventType,
      explanation: incident.explanation,
      fingerprint: incident.fingerprint,
      lastSeenAt: incident.lastSeenAt,
      occurrenceCount: incident.occurrenceCount,
      severity: incident.severity,
    })),
    lastHealthyAt,
    performance: {
      p50Ms: observability.data.performance.summary.p50Ms,
      p95Ms: observability.data.performance.summary.p95Ms,
      p99Ms: observability.data.performance.summary.p99Ms,
    },
    range: {
      endsAt: observability.data.range.endsAt,
      startsAt: observability.data.range.startsAt,
    },
    status: currentStatus,
  } satisfies FieldEntryHealthView;

  return <FieldEntryHealthWorkspace data={data} error={null} />;
}
