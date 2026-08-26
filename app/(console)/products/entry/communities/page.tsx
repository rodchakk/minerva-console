import Link from "next/link";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Plus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { CommunityList } from "@/features/entry/communities/CommunityList";
import {
  listCommunitiesWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";
import { cn } from "@/lib/supabase/utils";

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
          community.isActive &&
          community.onboardingStatus !== "complete_active" &&
          !needsAttention(community),
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
      return communities.filter(
        (community) =>
          community.isActive && community.onboardingStatus === "complete_active",
      );
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
          "There are no fully active communities in this view right now.",
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
    icon: UsersRound,
    dotClassName: "bg-violet-400",
  },
  {
    label: "Active communities",
    hint: "Shown by default",
    icon: CheckCircle2,
    dotClassName: "bg-emerald-400",
  },
  {
    label: "Pending setup",
    hint: "Active communities awaiting completion",
    icon: Clock3,
    dotClassName: "bg-amber-400",
  },
  {
    label: "Inactive communities",
    hint: "Archived from the main view",
    icon: Archive,
    dotClassName: "bg-slate-400",
  },
] as const;

function ActionLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
        variant === "primary"
          ? "border border-transparent bg-[var(--console-accent)] text-white hover:bg-[var(--console-accent-hover)]"
          : "border border-[var(--console-border-strong)] bg-white/[0.025] text-slate-100 hover:border-white/20 hover:bg-white/[0.05]",
      )}
    >
      {children}
    </Link>
  );
}

function MetricItem({
  icon: Icon,
  label,
  value,
  note,
  dotClassName,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  note: string;
  dotClassName: string;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex h-full items-center justify-center px-5 py-4",
        className,
      )}
    >
      <div className="w-full max-w-[250px]">
        <p className="text-xs font-medium text-[var(--console-text-muted)]">
          {label}
        </p>
        <div className="mt-2 grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--console-border-strong)] bg-white/[0.025] text-slate-300">
            <Icon className="h-4.5 w-4.5 stroke-[1.75]" />
          </span>
          <p className="min-w-0 text-2xl font-semibold tracking-tight text-white">
            {value}
          </p>
        </div>
        <div className="mt-2 grid grid-cols-[36px_minmax(0,1fr)] gap-3.5">
          <span aria-hidden="true" />
          <p className="flex min-w-0 items-center gap-2 text-xs text-[var(--console-text-muted)]">
            <span className={cn("h-1.5 w-1.5 rounded-full", dotClassName)} />
            <span>{note}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

function EmptyDirectory({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] px-5 py-10 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--console-text-muted)]">
        {description}
      </p>
      <div className="mt-6">
        <ActionLink href="/products/entry/communities" variant="secondary">
          View active communities
        </ActionLink>
      </div>
    </section>
  );
}

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
  const activeCount = communities.filter(
    (community) =>
      community.isActive && community.onboardingStatus === "complete_active",
  ).length;
  const pendingCount = communities.filter(
    (community) =>
      community.isActive &&
      community.onboardingStatus !== "complete_active" &&
      !needsAttention(community),
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
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              ENTRY DIRECTORY
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
              ENTRY communities
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Directory and onboarding workspace for active ENTRY communities.
              Archived communities remain available through the inactive filter.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionLink href="/products/entry/communities/new" variant="primary">
              <Plus className="h-4 w-4 stroke-[1.75]" />
              Onboard new community
            </ActionLink>
            <ActionLink href="/products/entry/communities?filter=pending_setup">
              <Clock3 className="h-4 w-4 stroke-[1.75]" />
              View pending setup
            </ActionLink>
          </div>
        </div>
      </section>

      <nav
        aria-label="Community filters"
        className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-1"
      >
        {filters.map((filter) => {
          const isActive = currentFilter === filter.value;

          return (
            <Link
              key={filter.value}
              href={filter.href}
              className={cn(
                "inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
                isActive
                  ? "bg-[var(--console-accent-subtle)] text-violet-100 ring-1 ring-inset ring-[var(--console-accent-border)]"
                  : "text-[var(--console-text-muted)] hover:bg-white/[0.035] hover:text-slate-100",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {communities.length > 0 ? (
        <section className="grid overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card, index) => (
            <MetricItem
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={cardValues[index]}
              note={card.hint}
              dotClassName={card.dotClassName}
              className={cn(
                index < 2 ? "border-b border-[var(--console-border)]" : "",
                index === 0 ? "md:border-r xl:border-b-0" : "",
                index === 1 ? "xl:border-r xl:border-b-0" : "",
                index === 2 ? "md:border-r md:border-b-0 xl:border-r" : "",
              )}
            />
          ))}
        </section>
      ) : null}

      {filteredCommunities.length > 0 ? (
        <CommunityList communities={filteredCommunities} />
      ) : (
        <EmptyDirectory
          title={emptyState.title}
          description={emptyState.description}
        />
      )}
    </div>
  );
}
