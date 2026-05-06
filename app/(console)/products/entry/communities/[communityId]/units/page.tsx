import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/cards/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  getCommunityUnitsPageData,
  type CommunityUnitsStatusFilter,
} from "@/features/entry/communities/detailQueries";
import {
  getCommunityWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";

const statusFilters: Array<{
  label: string;
  value: CommunityUnitsStatusFilter;
}> = [
  { label: "All units", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Has residents", value: "has_residents" },
  { label: "Has passes", value: "has_passes" },
  { label: "Recent access", value: "recent_access" },
];

function needsSetupAttention(community: CommunityWithProgressItem) {
  return (
    community.totalUnits <= 0 ||
    community.nextStepKey === "units" ||
    (!community.isActive && community.onboardingStatus === "complete_active")
  );
}

function getPrimaryAction(community: CommunityWithProgressItem) {
  if (
    community.activationPendingCount > 0 ||
    community.nextStepKey === "review_activation_queue"
  ) {
    return {
      href: `/products/entry/activation?community_id=${community.id}`,
      label: "Open activation queue",
    };
  }

  if (needsSetupAttention(community)) {
    return {
      href: `/products/entry/communities/${community.id}`,
      label: "Review setup",
    };
  }

  if (community.onboardingStatus !== "complete_active") {
    return {
      href: `/products/entry/communities/${community.id}`,
      label: "Continue setup",
    };
  }

  return {
    href: `/products/entry/activation?community_id=${community.id}`,
    label: "Open activation queue",
  };
}

function buildUnitsHref(
  communityId: string,
  params: {
    q?: string;
    status?: CommunityUnitsStatusFilter;
  },
) {
  const search = new URLSearchParams();

  if (params.q?.trim()) {
    search.set("q", params.q.trim());
  }

  if (params.status && params.status !== "all") {
    search.set("status", params.status);
  }

  const queryString = search.toString();

  return `/products/entry/communities/${communityId}/units${
    queryString ? `?${queryString}` : ""
  }`;
}

export default async function CommunityUnitsPage(
  props: PageProps<"/products/entry/communities/[communityId]/units">,
) {
  const { communityId } = await props.params;
  const searchParams = await props.searchParams;
  const community = await getCommunityWithProgress(communityId);

  if (!community) {
    notFound();
  }

  const unitsData = await getCommunityUnitsPageData({
    communityId: community.id,
    q: typeof searchParams.q === "string" ? searchParams.q : undefined,
    status: typeof searchParams.status === "string" ? searchParams.status : undefined,
  });
  const primaryAction = getPrimaryAction(community);
  const hasFilters = Boolean(unitsData.query) || unitsData.status !== "all";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Units"
        description="Review houses, apartments, and operational unit records for this community."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={`/products/entry/communities/${community.id}`}>
              <Button variant="secondary">Back to community</Button>
            </Link>
            <Link href={primaryAction.href}>
              <Button>{primaryAction.label}</Button>
            </Link>
          </div>
        }
      />

      <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(112,104,255,0.14),rgba(17,24,39,0.92))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)] backdrop-blur xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="info">ENTRY community</Badge>
              <Badge tone={community.isActive ? "success" : "default"}>
                {community.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge tone="info">{community.unitLabel}</Badge>
            </div>
            <div>
              <h2 className="text-3xl font-semibold text-white">{community.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {community.city}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[rgba(9,12,24,0.5)] px-5 py-4 xl:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
              Unit directory
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              Read-only operational record of houses and apartments.
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Use this view to inspect occupancy, access activity, and current
              setup coverage before editing tools are wired in.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <MetricCard
          label="Total units"
          value={String(unitsData.summary.totalUnits)}
          hint="All known houses or apartments returned by the admin RPC."
          status={unitsData.state === "unavailable" ? "Preview" : "Live"}
          tone="info"
        />
        <MetricCard
          label="Active units"
          value={String(unitsData.summary.activeUnits)}
          hint="Units currently marked as active."
          status={unitsData.state === "unavailable" ? "Preview" : "Live"}
          tone="success"
        />
        <MetricCard
          label="Inactive units"
          value={String(unitsData.summary.inactiveUnits)}
          hint="Units not currently active."
          status={unitsData.state === "unavailable" ? "Preview" : "Live"}
          tone="default"
        />
        <MetricCard
          label="Active residents"
          value={String(unitsData.summary.activeResidents)}
          hint="Sum of active residents across all units."
          status={unitsData.state === "unavailable" ? "Preview" : "Live"}
          tone="info"
        />
        <MetricCard
          label="Active passes"
          value={String(unitsData.summary.activePasses)}
          hint="Sum of active passes currently linked to units."
          status={unitsData.state === "unavailable" ? "Preview" : "Live"}
          tone={unitsData.summary.activePasses > 0 ? "warning" : "info"}
        />
        <MetricCard
          label="Units with recent access"
          value={String(unitsData.summary.unitsWithRecentAccess)}
          hint="Units where a recent access timestamp is available."
          status={unitsData.state === "unavailable" ? "Preview" : "Live"}
          tone="success"
        />
      </section>

      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur xl:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              Filters
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Search the unit directory
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Filter by unit status or search by house label and owner name.
            </p>
          </div>
          {hasFilters ? (
            <Link href={buildUnitsHref(community.id, {})}>
              <Button variant="secondary">Clear filters</Button>
            </Link>
          ) : null}
        </div>

        <form className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Search
            </span>
            <input
              name="q"
              defaultValue={unitsData.query}
              placeholder="Search by house label or owner"
              className="w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-400/40"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Status
            </span>
            <select
              name="status"
              defaultValue={unitsData.status}
              className="w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-400/40"
            >
              {statusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <Button type="submit" className="w-full lg:w-auto">
              Apply filters
            </Button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap gap-3">
          {statusFilters.map((filter) => {
            const href = buildUnitsHref(community.id, {
              q: unitsData.query,
              status: filter.value,
            });
            const active = unitsData.status === filter.value;

            return (
              <Link key={filter.value} href={href}>
                <span
                  className={[
                    "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-violet-500/18 text-violet-100 ring-1 ring-inset ring-violet-400/30"
                      : "bg-white/6 text-slate-200 ring-1 ring-inset ring-white/8 hover:bg-white/10",
                  ].join(" ")}
                >
                  {filter.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur xl:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              Unit records
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Community unit directory
            </h3>
          </div>
          <Badge tone="info">{unitsData.totalMatching} matching units</Badge>
        </div>

        {unitsData.state === "unavailable" ? (
          <div className="mt-6 rounded-[28px] border border-dashed border-white/10 bg-white/3 px-5 py-6">
            <p className="text-base font-semibold text-white">
              Units preview unavailable
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              The unit directory could not be loaded right now.
            </p>
          </div>
        ) : unitsData.items.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-dashed border-white/10 bg-white/3 px-5 py-6">
            <p className="text-base font-semibold text-white">No units created yet</p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Use the onboarding flow or community creation import to add houses
              or apartments.
            </p>
            <div className="mt-4">
              <Link href={`/products/entry/communities/${community.id}`}>
                <Button variant="secondary">Back to community</Button>
              </Link>
            </div>
          </div>
        ) : unitsData.filteredItems.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-dashed border-white/10 bg-white/3 px-5 py-6">
            <p className="text-base font-semibold text-white">
              No units match this filter
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Adjust the search or clear the current filters to review all unit
              records again.
            </p>
            <div className="mt-4">
              <Link href={buildUnitsHref(community.id, {})}>
                <Button variant="secondary">Clear filters</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[28px] border border-white/8">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_1fr_130px_130px_140px_150px_150px_220px] gap-3 border-b border-white/8 bg-white/4 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] xl:grid">
              <span>Unit</span>
              <span>Owner</span>
              <span>Status</span>
              <span>Residents</span>
              <span>Passes</span>
              <span>Last access</span>
              <span>Created</span>
              <span>Actions</span>
            </div>

            <div className="divide-y divide-white/8">
              {unitsData.filteredItems.map((unit) => (
                <div
                  key={unit.id}
                  className="grid gap-4 bg-[var(--surface-strong)] px-5 py-5 xl:grid-cols-[minmax(0,1.2fr)_1fr_130px_130px_140px_150px_150px_220px] xl:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{unit.label}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)] xl:hidden">
                      {unit.ownerName || "No owner recorded"}
                    </p>
                  </div>
                  <div className="hidden xl:block">
                    <p className="text-sm text-white">
                      {unit.ownerName || "No owner recorded"}
                    </p>
                  </div>
                  <div>
                    <Badge tone={unit.isActive ? "success" : "default"}>
                      {unit.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] xl:hidden">
                      Active residents
                    </p>
                    <p className="mt-1 text-sm text-white xl:mt-0">
                      {unit.activeResidents}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] xl:hidden">
                      Active passes
                    </p>
                    <p className="mt-1 text-sm text-white xl:mt-0">
                      {unit.activePasses}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] xl:hidden">
                      Last access
                    </p>
                    <p className="mt-1 text-sm text-white xl:mt-0">
                      {unit.lastAccess}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] xl:hidden">
                      Created
                    </p>
                    <p className="mt-1 text-sm text-white xl:mt-0">
                      {unit.createdAt}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <Link
                      href={`/products/entry/communities/${community.id}/units/${unit.id}`}
                    >
                      <Button type="button" variant="secondary">
                        View details
                      </Button>
                    </Link>
                    <Button type="button" variant="ghost" disabled>
                      Disable
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
