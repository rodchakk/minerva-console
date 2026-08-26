import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  MessageSquare,
  Plus,
  Search,
  Send,
  UserRoundCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { listCommunitiesWithProgress } from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { OperationalActivityFeed } from "@/features/entry/operations/OperationalActivityFeed";
import {
  getEntryOperationalActivity,
  getEntryPublishedMessagesLast24Hours,
} from "@/features/entry/operations/queries";
import { cn } from "@/lib/supabase/utils";

function getProgressWidth(completed: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((completed / total) * 100))}%`;
}

function getProgressValue(completed: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((completed / total) * 100));
}

function getCommunityHref(communityId: string) {
  return `/products/entry/communities/${communityId}`;
}

function getStatusLabel(onboardingStatus: string, isActive: boolean) {
  if (onboardingStatus === "complete_active" && isActive) {
    return "Active";
  }

  if (onboardingStatus === "complete_active") {
    return "Complete";
  }

  if (onboardingStatus.includes("progress")) {
    return "In progress";
  }

  if (onboardingStatus.includes("pending")) {
    return "Pending";
  }

  return isActive ? "Active" : "Inactive";
}

function getStatusClass(onboardingStatus: string, isActive: boolean) {
  if (onboardingStatus === "complete_active" && isActive) {
    return "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200";
  }

  if (onboardingStatus.includes("progress")) {
    return "border-violet-400/20 bg-violet-500/[0.08] text-violet-200";
  }

  if (onboardingStatus.includes("pending")) {
    return "border-amber-400/20 bg-amber-500/[0.08] text-amber-200";
  }

  if (isActive) {
    return "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200";
  }

  return "border-white/10 bg-white/[0.04] text-slate-200";
}

const quickActions = [
  {
    label: "Create community",
    href: "/products/entry/communities/new",
    note: "Start a new onboarding flow",
    icon: UsersRound,
    tone: "border-violet-400/15 bg-violet-500/[0.10] text-violet-200",
  },
  {
    label: "Open Activation Queue",
    href: "/products/entry/activation",
    note: "Review residents waiting for setup",
    icon: Clock3,
    tone: "border-amber-400/15 bg-amber-500/[0.10] text-amber-200",
  },
  {
    label: "Review users",
    href: "/products/entry/users",
    note: "Search current user records",
    icon: Users,
    tone: "border-cyan-400/15 bg-cyan-500/[0.10] text-cyan-200",
  },
  {
    label: "Publish message",
    href: "/products/entry/messages",
    note: "Prepare official Minerva updates",
    icon: MessageSquare,
    tone: "border-fuchsia-400/15 bg-fuchsia-500/[0.10] text-fuchsia-200",
  },
];

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

function ConsolePanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)]",
        className,
      )}
    >
      {children}
    </section>
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

function SectionHeading({
  label,
  title,
  description,
  action,
}: {
  label?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--console-border)] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {label ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-text-muted)]">
            {label}
          </p>
        ) : null}
        <h2
          className={cn(
            "font-semibold text-white",
            label ? "mt-2 text-lg" : "text-lg",
          )}
        >
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export default async function DashboardPage() {
  const [communities, operationalActivity, messagesLast24Hours] = await Promise.all([
    listCommunitiesWithProgress(),
    getEntryOperationalActivity(15),
    getEntryPublishedMessagesLast24Hours(),
  ]);

  const activeCommunities = communities.filter((community) => community.isActive);
  const pendingSetup = communities.filter(
    (community) => community.onboardingStatus !== "complete_active",
  );
  const residentsInActivationQueue = communities.reduce(
    (sum, community) => sum + community.activationPendingCount,
    0,
  );
  const inactiveCommunities = communities.filter((community) => !community.isActive);
  const prioritizedCommunities = [...communities]
    .sort((a, b) => {
      const aPending = a.onboardingStatus !== "complete_active" ? 1 : 0;
      const bPending = b.onboardingStatus !== "complete_active" ? 1 : 0;

      if (aPending !== bPending) {
        return bPending - aPending;
      }

      if (a.activationPendingCount !== b.activationPendingCount) {
        return b.activationPendingCount - a.activationPendingCount;
      }

      return a.name.localeCompare(b.name);
    })
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
              ENTRY Operations
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Onboard communities, monitor setup, and keep operational work moving
              from one workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ActionLink href="/products/entry/communities/new" variant="primary">
              <Plus className="h-4 w-4 stroke-[1.75]" />
              Create community
            </ActionLink>
            <ActionLink href="/products/entry/messages">
              <Send className="h-4 w-4 stroke-[1.75]" />
              Send Minerva message
            </ActionLink>
          </div>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] md:grid-cols-2 xl:grid-cols-4">
        <MetricItem
          icon={UsersRound}
          label="Active communities"
          value={activeCommunities.length}
          note="Communities currently active"
          dotClassName="bg-emerald-400"
          className="border-b border-[var(--console-border)] md:border-r xl:border-b-0"
        />
        <MetricItem
          icon={Clock3}
          label="Pending setup"
          value={pendingSetup.length}
          note="Communities not yet complete"
          dotClassName="bg-violet-400"
          className="border-b border-[var(--console-border)] xl:border-r xl:border-b-0"
        />
        <MetricItem
          icon={UserRoundCheck}
          label="Residents in activation queue"
          value={residentsInActivationQueue}
          note="Pending activation rows"
          dotClassName="bg-slate-400"
          className="border-b border-[var(--console-border)] md:border-r md:border-b-0 xl:border-r"
        />
        <MetricItem
          icon={MessageSquare}
          label="Messages (24h)"
          value={messagesLast24Hours ?? "—"}
          note={
            messagesLast24Hours === null
              ? "Message count unavailable"
              : "Published community updates"
          }
          dotClassName={messagesLast24Hours === null ? "bg-amber-400" : "bg-violet-400"}
        />
      </section>

      <section className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <ConsolePanel className="h-full overflow-hidden">
            <SectionHeading
              title="Setup priorities across ENTRY"
              description="Communities sorted by onboarding urgency and activation load."
              action={
                <ActionLink href="/products/entry/communities">
                  View all communities
                  <ArrowUpRight className="h-4 w-4 stroke-[1.75]" />
                </ActionLink>
              }
            />

            {prioritizedCommunities.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Community</th>
                      <th className="px-4 py-3 font-medium">City</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Onboarding</th>
                      <th className="px-4 py-3 font-medium">Units</th>
                      <th className="px-4 py-3 font-medium">Pending</th>
                      <th className="px-5 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prioritizedCommunities.map((community) => {
                      const isComplete =
                        community.onboardingStatus === "complete_active";
                      const progressValue = getProgressValue(
                        community.completedTasks,
                        community.totalTasks,
                      );

                      return (
                        <tr
                          key={community.id}
                          className="border-b border-[var(--console-border)] transition-colors hover:bg-white/[0.025] last:border-b-0"
                        >
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--console-border-strong)] bg-white/[0.025] text-xs font-semibold text-slate-200">
                                {community.name
                                  .split(" ")
                                  .map((part) => part[0] ?? "")
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-white">{community.name}</p>
                                <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                                  {getOnboardingNextStepLabel(community.nextStepKey)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-slate-300">
                            {community.city}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getStatusClass(
                                community.onboardingStatus,
                                community.isActive,
                              )}`}
                            >
                              {getStatusLabel(
                                community.onboardingStatus,
                                community.isActive,
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="min-w-[190px]">
                              <div className="flex items-center justify-between gap-3 text-xs text-[var(--console-text-muted)]">
                                <span>
                                  {community.completedTasks}/{community.totalTasks} complete
                                </span>
                                <span>{progressValue}%</span>
                              </div>
                              <div className="mt-2 h-1 rounded-full bg-white/[0.08]">
                                <div
                                  className="h-1 rounded-full bg-[var(--console-accent)]"
                                  style={{
                                    width: getProgressWidth(
                                      community.completedTasks,
                                      community.totalTasks,
                                    ),
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-slate-300">
                            {community.totalUnits}
                          </td>
                          <td className="px-4 py-4 align-top text-slate-300">
                            {community.activationPendingCount}
                          </td>
                          <td className="px-5 py-4 align-top text-right">
                            <Link
                              href={getCommunityHref(community.id)}
                              className={cn(
                                "inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50",
                                isComplete
                                  ? "border border-[var(--console-border)] bg-white/[0.025] text-slate-100 hover:bg-white/[0.05]"
                                  : "border border-transparent bg-[var(--console-accent-subtle)] text-violet-100 hover:bg-violet-500/20",
                              )}
                            >
                              {isComplete ? "Open" : "Continue setup"}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <h3 className="text-lg font-semibold text-white">
                  No community records yet
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--console-text-muted)]">
                  Communities that need operational attention will appear here.
                </p>
              </div>
            )}
          </ConsolePanel>
        </div>

        <div className="flex h-full min-w-0 flex-col gap-3">
          <ConsolePanel className="flex flex-[1.08] flex-col overflow-hidden">
            <div className="border-b border-[var(--console-border)] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-text-muted)]">
                Quick Actions
              </p>
            </div>
            <div className="flex flex-1 flex-col justify-center p-2">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-white/[0.035]"
                  >
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${action.tone}`}
                    >
                      <Icon className="h-4 w-4 stroke-[1.75]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">
                        {action.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-[var(--console-text-muted)]">
                        {action.note}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--console-text-soft)] transition-colors group-hover:text-slate-300" />
                  </Link>
                );
              })}
            </div>
          </ConsolePanel>

          <ConsolePanel className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-[var(--console-border)] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-text-muted)]">
                Setup Priorities
              </p>
            </div>
            <div className="flex flex-1 flex-col justify-center divide-y divide-[var(--console-border)] px-4 py-2">
              {[
                {
                  label: "communities needing setup",
                  value: pendingSetup.length,
                  icon: UsersRound,
                  tone: "border-violet-400/15 bg-violet-500/[0.10] text-violet-200",
                },
                {
                  label: "residents pending activation",
                  value: residentsInActivationQueue,
                  icon: UserRoundCheck,
                  tone: "border-amber-400/15 bg-amber-500/[0.10] text-amber-200",
                },
                {
                  label: "inactive communities requiring review",
                  value: inactiveCommunities.length,
                  icon: Search,
                  tone: "border-cyan-400/15 bg-cyan-500/[0.10] text-cyan-200",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="flex items-center gap-3 py-3">
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${item.tone}`}
                    >
                      <Icon className="h-4 w-4 stroke-[1.75]" />
                    </span>
                    <div>
                      <p className="text-xl font-semibold leading-6 text-white">
                        {item.value}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-[var(--console-text-muted)]">
                        {item.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ConsolePanel>
        </div>
      </section>

      <ConsolePanel className="overflow-hidden">
        <SectionHeading
          title="Operational activity"
          description="Important system and operational events across ENTRY."
        />
        <OperationalActivityFeed initialResult={operationalActivity} />
      </ConsolePanel>
    </div>
  );
}
