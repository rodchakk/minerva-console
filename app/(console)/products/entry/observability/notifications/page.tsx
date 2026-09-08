import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NotificationObservabilityDrilldown } from "@/features/entry/observability/NotificationObservabilityDrilldown";
import { ObservabilityFilters } from "@/features/entry/observability/ObservabilityFilters";
import {
  getEntryNotificationObservability,
  normalizeEntryObservabilityRange,
} from "@/features/entry/observability/queries";

export const dynamic = "force-dynamic";

function observabilityHref({
  communityId,
  range,
}: {
  communityId: string | null;
  range: string;
}) {
  const params = new URLSearchParams();

  if (range !== "24h") {
    params.set("range", range);
  }

  if (communityId) {
    params.set("community", communityId);
  }

  const query = params.toString();
  return query ? `/products/entry/observability?${query}` : "/products/entry/observability";
}

function UnavailableState({ error }: { error: string }) {
  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]">
      <div className="flex flex-col items-start gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/24 bg-amber-500/[0.10] px-3 py-1 text-xs font-semibold text-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Notification telemetry unavailable
          </div>
          <h2 className="mt-4 text-xl font-semibold text-white">
            Could not load the Notifications read model
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
  const result = await getEntryNotificationObservability({
    communityId: communityId ?? null,
    range,
  });

  const communities = result.state === "ready" ? result.data.communities : [];
  const selectedCommunity =
    communityId && communities.some((community) => community.id === communityId)
      ? communityId
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ENTRY observability / Notifications"
        description="Notification queue, worker, provider, and onboarding-email evidence."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href={observabilityHref({ communityId: selectedCommunity, range })}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--console-border-strong)] bg-white/[0.025] px-3.5 text-sm font-semibold text-slate-100 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
            >
              <ArrowLeft className="h-4 w-4 stroke-[1.75]" />
              Back to observability
            </Link>
            <ObservabilityFilters
              basePath="/products/entry/observability/notifications"
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
        <NotificationObservabilityDrilldown data={result.data} />
      )}
    </div>
  );
}

