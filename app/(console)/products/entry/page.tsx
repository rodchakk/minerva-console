import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Compass,
  LifeBuoy,
  Plus,
  Send,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  communityNeedsSetupAttention,
  getCommunityProgressValue,
  isCommunityFullyActive,
  isCommunityPendingSetup,
} from "@/features/entry/communities/lifecycle";
import {
  listCommunitiesWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { OperationalActivityFeed } from "@/features/entry/operations/OperationalActivityFeed";
import { getEntryOperationalActivity } from "@/features/entry/operations/queries";
import {
  getEntryObservability,
  type EntryObservabilityIncident,
} from "@/features/entry/observability/queries";
import { getEntrySupportTickets } from "@/features/entry/support/queries";
import { cn } from "@/lib/supabase/utils";

type OperationalPriorityItem = {
  actionLabel: string;
  href: string;
  id: string;
  impact: string;
  status: string;
  title: string;
  tone: "amber" | "rose" | "violet" | "sky";
  type: string;
  urgency: number;
};

function getProgressWidth(completed: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.min(100, Math.round((completed / total) * 100))}%`;
}

function getCommunityHref(communityId: string) {
  return `/products/entry/communities/${communityId}`;
}

function getActivationQueueHref(communityId: string) {
  return `/products/entry/activation?community_id=${encodeURIComponent(communityId)}`;
}

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "EN"
  );
}

function severityRank(severity: EntryObservabilityIncident["severity"]) {
  switch (severity) {
    case "CRITICAL":
      return 4;
    case "ERROR":
      return 3;
    case "WARNING":
      return 2;
    case "INFO":
    default:
      return 1;
  }
}

const quickActions = [
  {
    label: "Open Activation Queue",
    href: "/products/entry/activation",
    note: "Review residents waiting for setup",
    icon: Clock3,
    tone: "border-amber-400/15 bg-amber-500/[0.10] text-amber-200",
  },
  {
    label: "Open Outrider",
    href: "/products/entry/outrider",
    note: "Open the community intake workspace",
    icon: Compass,
    tone: "border-violet-400/15 bg-violet-500/[0.10] text-violet-200",
  },
  {
    label: "Review tickets",
    href: "/products/entry/tickets",
    note: "Open resident support follow-up",
    icon: LifeBuoy,
    tone: "border-sky-400/15 bg-sky-500/[0.10] text-sky-200",
  },
  {
    label: "Review users",
    href: "/products/entry/users",
    note: "Search current user records",
    icon: Users,
    tone: "border-cyan-400/15 bg-cyan-500/[0.10] text-cyan-200",
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

function getToneClass(tone: OperationalPriorityItem["tone"]) {
  switch (tone) {
    case "rose":
      return "border-rose-400/20 bg-rose-500/[0.08] text-rose-200";
    case "sky":
      return "border-sky-400/20 bg-sky-500/[0.08] text-sky-200";
    case "violet":
      return "border-violet-400/20 bg-violet-500/[0.08] text-violet-200";
    case "amber":
    default:
      return "border-amber-400/20 bg-amber-500/[0.08] text-amber-200";
  }
}

function buildSetupPriority(community: CommunityWithProgressItem) {
  const needsAttention = communityNeedsSetupAttention(community);

  return {
    actionLabel: needsAttention ? "Review setup" : "Continue setup",
    href: getCommunityHref(community.id),
    id: `setup-${community.id}`,
    impact:
      community.activationPendingCount > 0
        ? formatCount(
            community.activationPendingCount,
            "pending activation",
            "pending activations",
          )
        : getOnboardingNextStepLabel(community.nextStepKey),
    status: `${community.completedTasks}/${community.totalTasks} complete`,
    title: community.name,
    tone: needsAttention ? "amber" : "violet",
    type: "Onboarding",
    urgency:
      (needsAttention ? 90 : 70) + Math.min(community.activationPendingCount, 10),
  } satisfies OperationalPriorityItem;
}

function buildActivationPriority(community: CommunityWithProgressItem) {
  return {
    actionLabel: "Open queue",
    href: getActivationQueueHref(community.id),
    id: `activation-${community.id}`,
    impact: "Activation queue requires review",
    status: formatCount(community.activationPendingCount, "resident", "residents"),
    title: community.name,
    tone: "amber",
    type: "Residents",
    urgency: 82 + Math.min(community.activationPendingCount, 10),
  } satisfies OperationalPriorityItem;
}

export default async function DashboardPage() {
  const [communities, operationalActivity, supportTickets, observability] =
    await Promise.all([
      listCommunitiesWithProgress(),
      getEntryOperationalActivity(15),
      getEntrySupportTickets(null),
      getEntryObservability({ range: "24h" }),
    ]);

  const pendingSetupCommunities = communities.filter(isCommunityPendingSetup);
  const residentsInActivationQueue = communities.reduce(
    (sum, community) => sum + community.activationPendingCount,
    0,
  );
  const openTickets = supportTickets.loadError
    ? null
    : supportTickets.tickets.filter((ticket) => ticket.status !== "resolved");
  const incidents =
    observability.state === "ready"
      ? [...observability.data.incidents].sort(
          (a, b) =>
            severityRank(b.severity) - severityRank(a.severity) ||
            b.occurrenceCount - a.occurrenceCount,
        )
      : null;

  const activationPriorities = communities
    .filter(
      (community) =>
        isCommunityFullyActive(community) && community.activationPendingCount > 0,
    )
    .map(buildActivationPriority);

  const ticketPriority =
    openTickets && openTickets.length > 0
      ? [
          {
            actionLabel: "Review tickets",
            href: "/products/entry/tickets",
            id: "support-tickets",
            impact: formatCount(
              openTickets.filter((ticket) => ticket.status === "in_progress").length,
              "ticket in progress",
              "tickets in progress",
            ),
            status: formatCount(openTickets.length, "open ticket"),
            title: "Support tickets",
            tone: "sky" as const,
            type: "Tickets",
            urgency: 78 + Math.min(openTickets.length, 10),
          },
        ]
      : [];

  const incidentPriorities =
    incidents?.slice(0, 2).map((incident, index) => ({
      actionLabel: "Review incident",
      href: "/products/entry/observability",
      id: `incident-${incident.fingerprint}-${index}`,
      impact: incident.explanation,
      status: `${incident.severity} · ${formatCount(
        incident.occurrenceCount,
        "occurrence",
      )}`,
      title:
        incident.communities.length === 1
          ? incident.communities[0]?.communityName || "ENTRY observability"
          : "ENTRY observability",
      tone:
        incident.severity === "CRITICAL" || incident.severity === "ERROR"
          ? ("rose" as const)
          : ("amber" as const),
      type: "Alerts / incidents",
      urgency: 85 + severityRank(incident.severity),
    })) ?? [];

  const allPriorityItems = [
    ...pendingSetupCommunities.map(buildSetupPriority),
    ...activationPriorities,
    ...ticketPriority,
    ...incidentPriorities,
  ].sort((a, b) => b.urgency - a.urgency || a.title.localeCompare(b.title));
  const priorityItems = allPriorityItems.slice(0, 8);

  const summaryRows = [
    {
      label: "Communities awaiting setup completion",
      value: pendingSetupCommunities.length,
    },
    {
      label: "Residents waiting in activation queue",
      value: residentsInActivationQueue,
    },
    {
      label: "Open support tickets",
      value: openTickets ? openTickets.length : "Unavailable",
    },
    {
      label: "Current alerts / incidents",
      value: incidents ? incidents.length : "Unavailable",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
              ENTRY Operations
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
              Action-focused workspace for issues, onboarding tasks, activations,
              and operational follow-up.
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
          icon={ClipboardList}
          label="Needs attention"
          value={allPriorityItems.length}
          note="Actionable operational items"
          dotClassName={
            allPriorityItems.length > 0 ? "bg-amber-400" : "bg-emerald-400"
          }
          className="border-b border-[var(--console-border)] md:border-r xl:border-b-0"
        />
        <MetricItem
          icon={UserRoundCheck}
          label="Pending activations"
          value={residentsInActivationQueue}
          note="Residents waiting in queue"
          dotClassName="bg-amber-400"
          className="border-b border-[var(--console-border)] xl:border-r xl:border-b-0"
        />
        <MetricItem
          icon={LifeBuoy}
          label="Open tickets"
          value={openTickets ? openTickets.length : "-"}
          note={openTickets ? "Unresolved support tickets" : "Ticket count unavailable"}
          dotClassName={openTickets ? "bg-sky-400" : "bg-amber-400"}
          className="border-b border-[var(--console-border)] md:border-r md:border-b-0 xl:border-r"
        />
        <MetricItem
          icon={AlertTriangle}
          label="Alerts / incidents"
          value={incidents ? incidents.length : "-"}
          note={incidents ? "Current observability items" : "Incident count unavailable"}
          dotClassName={incidents && incidents.length > 0 ? "bg-rose-400" : "bg-emerald-400"}
        />
      </section>

      <section className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <ConsolePanel className="h-full overflow-hidden">
            <SectionHeading
              title="Operational priorities"
              description="Items that need your attention, sorted by urgency and impact."
              action={
                <ActionLink href="/products/entry/communities">
                  View communities
                  <ArrowUpRight className="h-4 w-4 stroke-[1.75]" />
                </ActionLink>
              }
            />

            {priorityItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Impact</th>
                      <th className="px-5 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priorityItems.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[var(--console-border)] transition-colors hover:bg-white/[0.025] last:border-b-0"
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--console-border-strong)] bg-white/[0.025] text-xs font-semibold text-slate-200">
                              {getInitials(item.title)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-white">{item.title}</p>
                              <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                                Requires operational follow-up
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                              getToneClass(item.tone),
                            )}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-300">
                          {item.status}
                        </td>
                        <td className="max-w-[320px] px-4 py-4 align-top text-[var(--console-text-muted)]">
                          <span className="line-clamp-2">{item.impact}</span>
                        </td>
                        <td className="px-5 py-4 align-top text-right">
                          <Link
                            href={item.href}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-transparent bg-[var(--console-accent-subtle)] px-3 text-xs font-semibold text-violet-100 transition-colors hover:bg-violet-500/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
                          >
                            {item.actionLabel}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
                <h3 className="mt-3 text-lg font-semibold text-white">
                  Nothing needs attention
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--console-text-muted)]">
                  ENTRY is operating normally. New setup tasks, activations,
                  tickets, or incidents will appear here when they need follow-up.
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

          <ConsolePanel className="overflow-hidden">
            <div className="border-b border-[var(--console-border)] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--console-text-muted)]">
                Operational Summary
              </p>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {summaryRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-start justify-between gap-4 rounded-md border border-[var(--console-border)] bg-white/[0.018] px-3 py-2.5"
                  >
                    <span className="text-xs leading-5 text-[var(--console-text-muted)]">
                      {row.label}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-white">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {pendingSetupCommunities.length > 0 ? (
                <div className="mt-4 border-t border-[var(--console-border)] pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                    Setup progress
                  </p>
                  <div className="mt-3 space-y-3">
                    {pendingSetupCommunities.slice(0, 3).map((community) => {
                      const progressValue = getCommunityProgressValue(community);

                      return (
                        <div key={community.id}>
                          <div className="flex items-center justify-between gap-3 text-xs text-[var(--console-text-muted)]">
                            <span className="truncate">{community.name}</span>
                            <span className="shrink-0">{progressValue}%</span>
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
                      );
                    })}
                  </div>
                </div>
              ) : null}
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
