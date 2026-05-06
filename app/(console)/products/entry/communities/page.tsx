import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CommunityList } from "@/features/entry/communities/CommunityList";
import {
  listCommunitiesWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";

type CommunityFilter =
  | "all"
  | "pending_setup"
  | "active"
  | "inactive"
  | "needs_attention";

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function needsAttention(community: CommunityWithProgressItem) {
  return (
    community.totalUnits <= 0 ||
    community.nextStepKey === "units" ||
    (community.onboardingStatus !== "complete_active" &&
      community.totalMembers <= 0 &&
      community.activationPendingCount <= 0)
  );
}

function filterCommunities(
  communities: CommunityWithProgressItem[],
  filter: CommunityFilter,
) {
  switch (filter) {
    case "pending_setup":
      return communities.filter(
        (community) => community.onboardingStatus !== "complete_active",
      );
    case "active":
      return communities.filter((community) => community.isActive);
    case "inactive":
      return communities.filter((community) => !community.isActive);
    case "needs_attention":
      return communities.filter(needsAttention);
    default:
      return communities;
  }
}

function getEmptyStateCopy(filter: CommunityFilter) {
  switch (filter) {
    case "pending_setup":
      return {
        title: "No communities pending setup",
        description:
          "All connected communities are either complete or currently outside the pending setup stage.",
      };
    case "active":
      return {
        title: "No active communities found",
        description:
          "There are no communities currently marked active in this view.",
      };
    case "inactive":
      return {
        title: "No inactive communities found",
        description:
          "Every connected community is currently marked active in this view.",
      };
    case "needs_attention":
      return {
        title: "No communities need attention",
        description:
          "No communities are currently missing core setup requirements.",
      };
    default:
      return {
        title: "No communities available",
        description:
          "Start by onboarding a new community to populate the ENTRY workspace.",
      };
  }
}

export default async function CommunitiesPage(
  props: PageProps<"/products/entry/communities">,
) {
  const communities = await listCommunitiesWithProgress();
  const searchParams = await props.searchParams;
  const rawFilter = getSingleParam(searchParams.filter);
  const currentFilter: CommunityFilter =
    rawFilter === "pending_setup" ||
    rawFilter === "active" ||
    rawFilter === "inactive" ||
    rawFilter === "needs_attention"
      ? rawFilter
      : "all";

  const filteredCommunities = filterCommunities(communities, currentFilter);
  const totalCount = communities.length;
  const activeCount = communities.filter((community) => community.isActive).length;
  const pendingCount = communities.filter(
    (community) => community.onboardingStatus !== "complete_active",
  ).length;
  const inactiveCount = communities.filter((community) => !community.isActive).length;

  const filters: Array<{ label: string; value: CommunityFilter }> = [
    { label: "All communities", value: "all" },
    { label: "Pending setup", value: "pending_setup" },
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
    { label: "Needs attention", value: "needs_attention" },
  ];

  const emptyState = getEmptyStateCopy(currentFilter);

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(10,13,24,0.98))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.26)] backdrop-blur xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">
                Minerva Console
              </p>
              <span className="inline-flex items-center rounded-full bg-violet-500/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200 ring-1 ring-inset ring-violet-400/20">
                ENTRY
              </span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">
              ENTRY communities
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
              Directory and onboarding workspace for ENTRY communities.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/products/entry/communities/new">
              <Button>+ Onboard new community</Button>
            </Link>
            <Link href="/products/entry/communities?filter=pending_setup">
              <Button variant="secondary">◌ View pending setup</Button>
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {filters.map((filter) => {
            const href =
              filter.value === "all"
                ? "/products/entry/communities"
                : `/products/entry/communities?filter=${filter.value}`;
            const isActive = currentFilter === filter.value;

            return (
              <Link
                key={filter.value}
                href={href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-violet-500/18 text-white ring-1 ring-inset ring-violet-400/30"
                    : "bg-white/6 text-[var(--text-muted)] ring-1 ring-inset ring-white/10 hover:bg-white/10 hover:text-white"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </section>

      {communities.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total communities",
              value: totalCount,
              hint: "Across all statuses",
              tone:
                "bg-violet-500/14 text-violet-200 ring-violet-400/20",
              marker: "◎",
            },
            {
              label: "Active communities",
              value: activeCount,
              hint: "Currently operational",
              tone:
                "bg-emerald-500/14 text-emerald-200 ring-emerald-400/20",
              marker: "↗",
            },
            {
              label: "Pending setup",
              value: pendingCount,
              hint: "Awaiting completion",
              tone:
                "bg-amber-500/14 text-amber-200 ring-amber-400/20",
              marker: "◔",
            },
            {
              label: "Inactive communities",
              value: inactiveCount,
              hint: "Not currently active",
              tone:
                "bg-slate-500/14 text-slate-200 ring-slate-400/20",
              marker: "⊘",
            },
          ].map((card) => (
            <article
              key={card.label}
              className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-lg font-semibold ring-1 ring-inset ${card.tone}`}
                >
                  {card.marker}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-muted)]">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    {card.hint}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {filteredCommunities.length > 0 ? (
        <CommunityList communities={filteredCommunities} />
      ) : (
        <EmptyState
          title={emptyState.title}
          description={emptyState.description}
          actionHref="/products/entry/communities"
          actionLabel="View all communities"
        />
      )}
    </div>
  );
}
