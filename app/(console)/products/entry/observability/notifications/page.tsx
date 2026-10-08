import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NotificationObservabilityDrilldown } from "@/features/entry/observability/NotificationObservabilityDrilldown";
import { NotificationWorkerHealthPanel } from "@/features/entry/observability/NotificationWorkerHealthPanel";
import { ObservabilityFilters } from "@/features/entry/observability/ObservabilityFilters";
import { getEntryNotificationWorkerHealth } from "@/features/entry/observability/notificationWorkerHealth";
import {
  getEntryNotificationObservability,
  normalizeEntryObservabilityRange,
} from "@/features/entry/observability/queries";

export const dynamic = "force-dynamic";

function UnavailableState({ error }: { error: string }) {
  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
      <div className="flex flex-col items-start gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/24 bg-amber-500/[0.10] px-3 py-1 text-xs font-semibold text-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Communications telemetry unavailable
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">
            Could not load the Communications read model
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--console-text-muted)]">
            {error}
          </p>
        </div>
        <Link
          href="/products/entry/observability/notifications"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--console-border-strong)] bg-white/[0.025] px-3.5 text-sm font-semibold text-slate-100 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
        >
          <RefreshCw className="h-4 w-4 stroke-[1.75]" />
          Retry
        </Link>
      </div>
    </section>
  );
}

export default async function EntryNotificationObservabilityPage(props: {
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

  const [result, workerHealth] = await Promise.all([
    getEntryNotificationObservability({
      communityId: communityId ?? null,
      range,
    }),
    getEntryNotificationWorkerHealth(),
  ]);

  const communities = result.state === "ready" ? result.data.communities : [];
  const selectedCommunity =
    communityId && communities.some((community) => community.id === communityId)
      ? communityId
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ENTRY observability / Communications"
        description="Push, email, worker, provider, and delivery evidence for ENTRY communications."
        actions={
          <ObservabilityFilters
            basePath="/products/entry/observability/notifications"
            communities={communities}
            communityId={selectedCommunity}
            range={range}
          />
        }
      />

      <NotificationWorkerHealthPanel result={workerHealth} />

      {result.state === "unavailable" ? (
        <UnavailableState error={result.error} />
      ) : (
        <NotificationObservabilityDrilldown data={result.data} />
      )}
    </div>
  );
}
