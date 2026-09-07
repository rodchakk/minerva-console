"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, Building2 } from "lucide-react";
import type {
  EntryObservabilityCommunity,
  EntryObservabilityTimeRange,
} from "@/features/entry/observability/queries";

type ObservabilityFiltersProps = {
  communities: EntryObservabilityCommunity[];
  communityId: string | null;
  range: EntryObservabilityTimeRange;
};

export function ObservabilityFilters({
  communities,
  communityId,
  range,
}: ObservabilityFiltersProps) {
  const router = useRouter();

  function updateFilter(next: {
    communityId?: string | null;
    range?: EntryObservabilityTimeRange;
  }) {
    const params = new URLSearchParams();
    const nextRange = next.range ?? range;
    const nextCommunityId =
      next.communityId === undefined ? communityId : next.communityId;

    if (nextRange !== "24h") {
      params.set("range", nextRange);
    }

    if (nextCommunityId) {
      params.set("community", nextCommunityId);
    }

    const query = params.toString();
    router.push(query ? `/products/entry/observability?${query}` : "/products/entry/observability");
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="relative block">
        <span className="sr-only">Community</span>
        <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--console-text-soft)]" />
        <select
          value={communityId ?? ""}
          onChange={(event) =>
            updateFilter({ communityId: event.target.value || null })
          }
          className="h-10 min-w-[210px] rounded-lg border border-[var(--console-border-strong)] bg-[var(--console-surface-raised)] pl-9 pr-9 text-sm font-medium text-slate-100 outline-none transition-colors hover:border-white/20 focus:border-[var(--console-accent-border)] focus:ring-2 focus:ring-[var(--console-accent)]/20"
        >
          <option value="">All communities</option>
          {communities.map((community) => (
            <option key={community.id} value={community.id}>
              {community.name}
            </option>
          ))}
        </select>
      </label>

      <label className="relative block">
        <span className="sr-only">Time range</span>
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--console-text-soft)]" />
        <select
          value={range}
          onChange={(event) =>
            updateFilter({
              range: event.target.value as EntryObservabilityTimeRange,
            })
          }
          className="h-10 min-w-[160px] rounded-lg border border-[var(--console-border-strong)] bg-[var(--console-surface-raised)] pl-9 pr-9 text-sm font-medium text-slate-100 outline-none transition-colors hover:border-white/20 focus:border-[var(--console-accent-border)] focus:ring-2 focus:ring-[var(--console-accent)]/20"
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </label>
    </div>
  );
}
