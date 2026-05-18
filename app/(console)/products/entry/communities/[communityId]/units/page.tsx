import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
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

const unitDisplayLimits = [10, 20, 50, 100] as const;

type UnitsMetricTone = "default" | "success" | "warning" | "info";

function formatCommunityUnitLabel(label: string) {
  const normalized = label.trim().toLowerCase();

  if (normalized === "condominios") {
    return "Condominiums";
  }

  if (normalized === "casas") {
    return "Houses";
  }

  if (normalized === "apartamentos") {
    return "Apartments";
  }

  return label;
}

function UnitsMetricCard({
  badgeLabel,
  description,
  icon,
  label,
  tone = "default",
  value,
}: {
  badgeLabel?: string;
  description: string;
  icon: ReactNode;
  label: string;
  tone?: UnitsMetricTone;
  value: string;
}) {
  const toneClasses: Record<UnitsMetricTone, string> = {
    default:
      "border-slate-400/14 bg-slate-500/10 text-slate-200 ring-slate-300/10",
    success:
      "border-emerald-400/14 bg-emerald-500/10 text-emerald-200 ring-emerald-300/10",
    warning:
      "border-amber-400/14 bg-amber-500/10 text-amber-200 ring-amber-300/10",
    info:
      "border-violet-400/14 bg-violet-500/10 text-violet-100 ring-violet-300/20",
  };

  return (
    <article className="rounded-[24px] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-sm ${toneClasses[tone]}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-100">{label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
              {value}
            </p>
          </div>
        </div>
        {badgeLabel ? <Badge tone={tone}>{badgeLabel}</Badge> : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
        {description}
      </p>
    </article>
  );
}

function UnitsMetricIcon({ children }: { children: string }) {
  return <span className="text-xs font-semibold">{children}</span>;
}

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
    limit?: number;
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

  if (params.limit && params.limit !== 10) {
    search.set("limit", String(params.limit));
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
  const rawLimit =
    typeof searchParams.limit === "string" ? Number(searchParams.limit) : NaN;
  const visibleLimit = unitDisplayLimits.includes(rawLimit as (typeof unitDisplayLimits)[number])
    ? (rawLimit as (typeof unitDisplayLimits)[number])
    : 10;
  const visibleItems = unitsData.filteredItems.slice(0, visibleLimit);
  const primaryAction = getPrimaryAction(community);
  const hasFilters = Boolean(unitsData.query) || unitsData.status !== "all";
  const metricBadge = unitsData.state === "unavailable" ? "Preview" : "Live";
  const communityUnitLabel = formatCommunityUnitLabel(community.unitLabel);
  const metrics = [
    {
      label: "Total units",
      value: String(unitsData.summary.totalUnits),
      description: "All known houses or apartments returned by the admin RPC.",
      tone: "info" as const,
      icon: <UnitsMetricIcon>UT</UnitsMetricIcon>,
    },
    {
      label: "Active units",
      value: String(unitsData.summary.activeUnits),
      description: "Units currently marked as active.",
      tone: "success" as const,
      icon: <UnitsMetricIcon>AC</UnitsMetricIcon>,
    },
    {
      label: "Inactive units",
      value: String(unitsData.summary.inactiveUnits),
      description: "Units not currently active.",
      tone: "default" as const,
      icon: <UnitsMetricIcon>IN</UnitsMetricIcon>,
    },
    {
      label: "Active residents",
      value: String(unitsData.summary.activeResidents),
      description: "Sum of active residents across all units.",
      tone: "info" as const,
      icon: <UnitsMetricIcon>RS</UnitsMetricIcon>,
    },
    {
      label: "Active passes",
      value: String(unitsData.summary.activePasses),
      description: "Sum of active passes currently linked to units.",
      tone: unitsData.summary.activePasses > 0 ? ("warning" as const) : ("info" as const),
      icon: <UnitsMetricIcon>PS</UnitsMetricIcon>,
    },
    {
      label: "Units with recent access",
      value: String(unitsData.summary.unitsWithRecentAccess),
      description: "Units where a recent access timestamp is available.",
      tone: "success" as const,
      icon: <UnitsMetricIcon>RA</UnitsMetricIcon>,
    },
  ];

  return (
    <div className="space-y-6">
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

      <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(112,104,255,0.16),rgba(14,19,29,0.96))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.24)] backdrop-blur xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="info">ENTRY community</Badge>
              <Badge tone={community.isActive ? "success" : "default"}>
                {community.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge tone="info">{communityUnitLabel}</Badge>
            </div>
            <div className="mt-5">
              <h2 className="text-3xl font-semibold text-white">{community.name}</h2>
              <p className="mt-3 inline-flex items-center gap-2 text-sm leading-6 text-[var(--text-muted)]">
                <span className="grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-white/5 text-[10px] text-slate-300">
                  •
                </span>
                {community.city}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[rgba(9,12,24,0.46)] px-5 py-5 xl:max-w-[24rem] xl:border-l xl:border-l-white/12">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-violet-300/20 bg-[linear-gradient(180deg,rgba(103,80,255,0.22),rgba(50,38,119,0.34))] text-sm font-semibold text-violet-100">
                UD
              </div>
              <div>
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
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {metrics.map((metric) => (
          <UnitsMetricCard
            key={metric.label}
            badgeLabel={metricBadge}
            description={metric.description}
            icon={metric.icon}
            label={metric.label}
            tone={metric.tone}
            value={metric.value}
          />
        ))}
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

        <form className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px_auto]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Search
            </span>
            <input
              name="q"
              defaultValue={unitsData.query}
              placeholder="Search by unit label or owner"
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
            <input type="hidden" name="limit" value={String(visibleLimit)} />
            <Button type="submit" className="w-full lg:w-auto">
              Apply filters
            </Button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap gap-2.5">
          {statusFilters.map((filter) => {
            const href = buildUnitsHref(community.id, {
              limit: visibleLimit,
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
            <h3 className="text-xl font-semibold text-white">
              Community unit directory
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="info">{unitsData.totalMatching} matching units</Badge>
            <form
              action={`/products/entry/communities/${community.id}/units`}
              className="flex items-center gap-2"
            >
              <input type="hidden" name="q" value={unitsData.query} />
              <input type="hidden" name="status" value={unitsData.status} />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <span>Show</span>
                  <select
                    name="limit"
                    defaultValue={String(visibleLimit)}
                    className="h-10 rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/40"
                  >
                    {unitDisplayLimits.map((limit) => (
                      <option key={limit} value={String(limit)}>
                        {limit}
                      </option>
                    ))}
                  </select>
                  <span>units</span>
                </label>
                <Button type="submit" variant="secondary">
                  Apply
                </Button>
              </div>
            </form>
          </div>
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
          <div className="mt-6 overflow-hidden rounded-[28px] border border-white/8 bg-[rgba(8,12,24,0.34)]">
            <div className="hidden grid-cols-[minmax(0,1.25fr)_1fr_130px_110px_110px_150px_160px_220px] gap-3 border-b border-white/8 bg-white/[0.03] px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] xl:grid">
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
              {visibleItems.map((unit) => (
                <div
                  key={unit.id}
                  className="grid gap-4 bg-[var(--surface-strong)] px-5 py-5 xl:grid-cols-[minmax(0,1.25fr)_1fr_130px_110px_110px_150px_160px_220px] xl:items-center"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-violet-300/14 bg-violet-500/10 text-xs font-semibold text-violet-100 ring-1 ring-inset ring-violet-300/12">
                        {unit.label.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {unit.label}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)] xl:hidden">
                          {unit.ownerName || "No owner linked"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="hidden xl:block">
                    <p className="text-sm text-white">
                      {unit.ownerName || "No owner linked"}
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
