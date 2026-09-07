import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  Clock3,
  Compass,
  MessageSquare,
  Plus,
  Send,
  UserRoundCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { listCommunitiesWithProgress } from "@/features/entry/communities/queries";
import { OperationalActivityFeed } from "@/features/entry/operations/OperationalActivityFeed";
import { getEntryOperationalActivity } from "@/features/entry/operations/queries";
import {
  getOutriderAttentionCount,
  listOutriderSessions,
  type OutriderListItem,
} from "@/features/entry/outrider/queries";
import { getOutriderStatusLabel } from "@/features/entry/outrider/model";
import { cn } from "@/lib/supabase/utils";

const quickActions = [
  {
    label: "Create community",
    href: "/products/entry/communities/new",
    note: "Start a new onboarding flow",
    icon: UsersRound,
    tone: "border-violet-400/15 bg-violet-500/[0.10] text-violet-200",
  },
  {
    label: "Open Outrider",
    href: "/products/entry/outrider",
    note: "Review community setup intake",
    icon: Compass,
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

function getOutriderStatusClass(status: string) {
  switch (status) {
    case "approved":
      return "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-200";
    case "ready_for_review":
      return "border-violet-400/20 bg-violet-500/[0.08] text-violet-200";
    case "needs_information":
      return "border-amber-400/20 bg-amber-500/[0.08] text-amber-200";
    case "in_progress":
      return "border-cyan-400/20 bg-cyan-500/[0.08] text-cyan-200";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-200";
  }
}

function formatOutriderDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

function statusCount(sessions: OutriderListItem[], status: OutriderListItem["status"]) {
  return sessions.filter((session) => session.status === status).length;
}

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
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  note: string;
  dotClassName: string;
  className?: string;
  href?: string;
}) {
  const content = (
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
  );

  return (
    <article
      className={cn(
        "flex h-full items-center justify-center px-5 py-4",
        className,
      )}
    >
      {href ? (
        <Link
          href={href}
          className="w-full max-w-[250px] rounded-md transition-colors hover:bg-white/[0.025]"
        >
          {content}
        </Link>
      ) : (
        content
      )}
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
  const [
    communities,
    operationalActivity,
    outriderSessions,
    outriderAttentionCount,
  ] = await Promise.all([
    listCommunitiesWithProgress(),
    getEntryOperationalActivity(15),
    listOutriderSessions(),
    getOutriderAttentionCount(),
  ]);

  const activeCommunities = communities.filter((community) => community.isActive);
  const pendingSetup = communities.filter(
    (community) => community.onboardingStatus !== "complete_active",
  );
  const residentsInActivationQueue = communities.reduce(
    (sum, community) => sum + community.activationPendingCount,
    0,
  );
  const visibleOutriderSessions = outriderSessions.slice(0, 6);
  const setupOverview = [
    {
      label: "Ready for review",
      value: statusCount(outriderSessions, "ready_for_review"),
      tone: "border-violet-400/15 bg-violet-500/[0.10] text-violet-200",
    },
    {
      label: "In progress",
      value: statusCount(outriderSessions, "in_progress"),
      tone: "border-cyan-400/15 bg-cyan-500/[0.10] text-cyan-200",
    },
    {
      label: "Needs information",
      value: statusCount(outriderSessions, "needs_information"),
      tone: "border-amber-400/15 bg-amber-500/[0.10] text-amber-200",
    },
    {
      label: "Not started",
      value: statusCount(outriderSessions, "not_started"),
      tone: "border-slate-400/15 bg-slate-500/[0.10] text-slate-200",
    },
    {
      label: "Approved",
      value: statusCount(outriderSessions, "approved"),
      tone: "border-emerald-400/15 bg-emerald-500/[0.10] text-emerald-200",
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
          icon={ClipboardList}
          label="Outrider"
          value={outriderAttentionCount ?? "—"}
          note={
            outriderAttentionCount === null
              ? "Outrider count unavailable"
              : "Community setup intakes"
          }
          dotClassName={outriderAttentionCount === null ? "bg-amber-400" : "bg-violet-400"}
          href="/products/entry/outrider"
        />
      </section>

      <section className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <ConsolePanel className="h-full overflow-hidden">
            <SectionHeading
              title="Outrider operations"
              description="Community setup intakes waiting for progress, review, or handoff."
              action={
                <ActionLink href="/products/entry/outrider">
                  View Outrider
                  <ArrowUpRight className="h-4 w-4 stroke-[1.75]" />
                </ActionLink>
              }
            />

            {visibleOutriderSessions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--console-border)] bg-white/[0.015] text-[11px] uppercase tracking-[0.16em] text-[var(--console-text-muted)]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Community</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Outrider</th>
                      <th className="px-4 py-3 font-medium">Files</th>
                      <th className="px-4 py-3 font-medium">Last update</th>
                      <th className="px-5 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOutriderSessions.map((session) => (
                      <tr
                        key={session.id}
                        className="border-b border-[var(--console-border)] transition-colors hover:bg-white/[0.025] last:border-b-0"
                      >
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--console-border-strong)] bg-white/[0.025] text-slate-300">
                              <Compass className="h-4.5 w-4.5 stroke-[1.75]" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-white">
                                {session.communityName}
                              </p>
                              <p className="mt-1 text-xs text-[var(--console-text-muted)]">
                                {session.communityCity}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getOutriderStatusClass(
                              session.status,
                            )}`}
                          >
                            {getOutriderStatusLabel(session.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="min-w-[170px]">
                            <div className="flex items-center justify-between gap-3 text-xs text-[var(--console-text-muted)]">
                              <span>{session.progressPercent}% complete</span>
                              <span>{session.completedSections.length}/5</span>
                            </div>
                            <div className="mt-2 h-1 rounded-full bg-white/[0.08]">
                              <div
                                className="h-1 rounded-full bg-[var(--console-accent)]"
                                style={{ width: `${session.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-300">
                          {session.attachmentCount}
                        </td>
                        <td className="px-4 py-4 align-top text-slate-300">
                          {formatOutriderDate(session.updatedAt)}
                        </td>
                        <td className="px-5 py-4 align-top text-right">
                          <Link
                            href={`/products/entry/outrider/${session.id}`}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--console-border)] bg-white/[0.025] px-3 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/50"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <h3 className="text-lg font-semibold text-white">
                  No Outrider intakes yet
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--console-text-muted)]">
                  Start Outrider from the workspace to collect setup information
                  before configuring ENTRY.
                </p>
                <div className="mt-5">
                  <ActionLink href="/products/entry/outrider" variant="primary">
                    <Compass className="h-4 w-4 stroke-[1.75]" />
                    Open Outrider
                  </ActionLink>
                </div>
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
                Setup Overview
              </p>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-3 px-4 py-4">
              {setupOverview.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm font-semibold ${item.tone}`}
                  >
                    {item.value}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-200">
                      {item.label}
                    </p>
                    <div className="mt-1 h-1 rounded-full bg-white/[0.08]">
                      <div
                        className="h-1 rounded-full bg-white/50"
                        style={{
                          width: `${
                            outriderSessions.length
                              ? Math.round((item.value / outriderSessions.length) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
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
