import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CommunityList } from "@/features/entry/communities/CommunityList";
import {
  listCommunitiesWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";

type CommunityFilter =
  | "active"
  | "pending_setup"
  | "all"
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
        (community) =>
          community.isActive && community.onboardingStatus !== "complete_active",
      );
    case "all":
      return communities;
    case "inactive":
      return communities.filter((community) => !community.isActive);
    case "needs_attention":
      return communities.filter(
        (community) => community.isActive && needsAttention(community),
      );
    case "active":
    default:
      return communities.filter((community) => community.isActive);
  }
}

function getEmptyStateCopy(filter: CommunityFilter) {
  switch (filter) {
    case "pending_setup":
      return {
        title: "No active communities pending setup",
        description:
          "All active communities are either complete or currently outside the pending setup stage.",
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
          "No communities are currently archived or marked inactive.",
      };
    case "needs_attention":
      return {
        title: "No active communities need attention",
        description:
          "No active communities are currently missing core setup requirements.",
      };
    default:
      return {
        title: "No communities available",
        description:
          "Start by onboarding a new community to populate the ENTRY workspace.",
      };
  }
}

const summaryCards = [
  {
    label: "Total communities",
    hint: "Across all statuses",
    iconTone: "border-violet-400/16 bg-violet-500/10 text-violet-200",
  },
  {
    label: "Active communities",
    hint: "Shown by default",
    iconTone: "border-emerald-400/16 bg-emerald-500/10 text-emerald-200",
  },
  {
    label: "Pending setup",
    hint: "Active communities awaiting completion",
    iconTone: "border-amber-400/16 bg-amber-500/10 text-amber-200",
  },
  {
    label: "Inactive communities",
    hint: "Archived from the main view",
    iconTone: "border-slate-400/16 bg-slate-500/10 text-slate-200",
  },
] as const;

export default async function CommunitiesPage(
  props: PageProps<"/products/entry/communities">,
) {
  const communities = await listCommunitiesWithProgress();
  const searchParams = await props.searchParams;
  const rawFilter = getSingleParam(searchParams.filter);
  const currentFilter: CommunityFilter =
    rawFilter === "pending_setup" ||
    rawFilter === "all" ||
    rawFilter === "inactive" ||
    rawFilter === "needs_attention"
      ? rawFilter
      : "active";

  const filteredCommunities = filterCommunities(communities, currentFilter);
  const totalCount = communities.length;
  const activeCount = communities.filter((community) => community.isActive).length;
  const pendingCount = communities.filter(
    (community) =>
      community.isActive && community.onboardingStatus !== "complete_active",
  ).length;
  const inactiveCount = communities.filter((community) => !community.isActive).length;

  const filters: Array<{ label: string; value: CommunityFilter; href: string }> = [
    { label: "Active", value: "active", href: "/products/entry/communities" },
    {
      label: "Pending setup",
      value: "pending_setup",
      href: "/products/entry/communities?filter=pending_setup",
    },
    {
      label: "Needs attention",
      value: "needs_attention",
      href: "/products/entry/communities?filter=needs_attention",
    },
    {
      label: "Inactive / archived",
      value: "inactive",
      href: "/products/entry/communities?filter=inactive",
    },
    {
      label: "All communities",
      value: "all",
      href: "/products/entry/communities?filter=all",
    },
  ];

  const emptyState = getEmptyStateCopy(currentFilter);
  const cardValues = [totalCount, activeCount, pendingCount, inactiveCount];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 lg:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-200">
              ENTRY Directory
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2rem]">
              ENTRY communities
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Directory and onboarding workspace for active ENTRY communities.
              Archived communities remain available through the inactive filter.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/products/entry/communities/new">
              <Button>Onboard new community</Button>
            </Link>
            <Link href="/products/entry/communities?filter=pending_setup">
              <Button variant="secondary">View pending setup</Button>
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {filters.map((filter) => {
            const isActive = currentFilter === filter.value;

            return (
              <Link
                key={filter.value}
                href={filter.href}
                className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-violet-400/18 bg-violet-500/12 text-white"
                    : "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-muted)] hover:border-white/12 hover:bg-[var(--surface-muted)] hover:text-white"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </section>

      {communities.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card, index) => (
            <article
              key={card.label}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold ${card.iconTone}`}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-white">
                    {cardValues[index]}
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
          actionLabel="View active communities"
        />
      )}
    </div>
  );
}
