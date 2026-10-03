import Link from "next/link";
import { Rubik } from "next/font/google";
import {
  AlertTriangle,
  ClipboardList,
  LifeBuoy,
  Plus,
  Send,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import {
  communityNeedsSetupAttention,
  isCommunityFullyActive,
  isCommunityPendingSetup,
} from "@/features/entry/communities/lifecycle";
import {
  listCommunitiesWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { OperationalActivityFeed } from "@/features/entry/operations/OperationalActivityFeed";
import {
  OperationalPrioritiesWorkspace,
  type OperationsPriorityItem,
} from "@/features/entry/operations/OperationalPrioritiesWorkspace";
import { getEntryOperationalActivity } from "@/features/entry/operations/queries";
import {
  getEntryObservability,
  type EntryObservabilityIncident,
} from "@/features/entry/observability/queries";
import { getEntrySupportTickets } from "@/features/entry/support/queries";
import { cn } from "@/lib/supabase/utils";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function getCommunityHref(communityId: string) {
  return "/products/entry/communities/" + communityId;
}

function getActivationQueueHref(communityId: string) {
  return (
    "/products/entry/activation?community_id=" +
    encodeURIComponent(communityId)
  );
}

function formatCount(value: number, singular: string, plural = singular + "s") {
  return value + " " + (value === 1 ? singular : plural);
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

function buildSetupPriority(
  community: CommunityWithProgressItem,
): OperationsPriorityItem & { urgency: number } {
  const needsAttention = communityNeedsSetupAttention(community);
  const nextStep = getOnboardingNextStepLabel(community.nextStepKey);

  return {
    actionLabel: needsAttention ? "Review setup" : "Continue setup",
    details: [
      { label: "Community", value: community.name },
      {
        label: "Progress",
        value: community.completedTasks + "/" + community.totalTasks + " complete",
      },
      { label: "Next step", value: nextStep },
      {
        label: "Pending activations",
        value: formatCount(
          community.activationPendingCount,
          "resident",
          "residents",
        ),
      },
    ],
    href: getCommunityHref(community.id),
    id: "setup-" + community.id,
    impact:
      community.activationPendingCount > 0
        ? formatCount(
            community.activationPendingCount,
            "pending activation",
            "pending activations",
          )
        : nextStep,
    secondaryAction: {
      href: "/products/entry/communities",
      label: "View communities",
    },
    stages: [
      { label: "Setup", state: "done" },
      { label: "Configure", state: "done" },
      { label: "Readiness", state: "active" },
      { label: "Active", state: "idle" },
    ],
    status: community.completedTasks + "/" + community.totalTasks + " complete",
    statusNote: "Final check",
    title: community.name,
    tone: needsAttention ? "amber" : "violet",
    type: "Onboarding",
    urgency:
      (needsAttention ? 90 : 70) + Math.min(community.activationPendingCount, 10),
  };
}

function buildActivationPriority(
  community: CommunityWithProgressItem,
): OperationsPriorityItem & { urgency: number } {
  return {
    actionLabel: "Open queue",
    details: [
      { label: "Community", value: community.name },
      {
        label: "Pending residents",
        value: formatCount(
          community.activationPendingCount,
          "resident",
          "residents",
        ),
      },
      { label: "Workspace", value: "Activation Queue" },
      { label: "State", value: "Queue review required" },
    ],
    href: getActivationQueueHref(community.id),
    id: "activation-" + community.id,
    impact: "Activation queue requires review before residents can be activated.",
    secondaryAction: {
      href: getCommunityHref(community.id),
      label: "Open community",
    },
    stages: [
      { label: "Prepared", state: "done" },
      { label: "Queue review", state: "active" },
      { label: "Invited", state: "idle" },
      { label: "Activated", state: "idle" },
    ],
    status: formatCount(
      community.activationPendingCount,
      "resident",
      "residents",
    ),
    statusNote: "Requires review",
    title: community.name,
    tone: "amber",
    type: "Residents",
    urgency: 82 + Math.min(community.activationPendingCount, 10),
  };
}

function DimensionalActionLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const primary = variant === "primary";

  return (
    <Link
      href={href}
      className="relative isolate inline-flex h-10 items-center justify-center rounded-[7px] px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E2936]"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 -z-20 rounded-[7px]",
          primary
            ? "bg-[#120539] shadow-[0_2px_0_#120539]"
            : "bg-[#141119] shadow-[0_2px_0_#141119]",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 -translate-y-0.5 rounded-[7px] border",
          primary
            ? "border-[#120539] bg-[#7553FF]"
            : "border-[#141119] bg-[#2E2936]",
        )}
      />
      <span className="relative -translate-y-0.5 inline-flex items-center gap-2">
        {children}
      </span>
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
        "grid min-h-[106px] grid-cols-[42px_minmax(0,1fr)] items-center gap-x-3 px-5 py-4",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-full border border-white/[0.14] bg-white/[0.02] text-[#D8D3E7]">
        <Icon className="size-[18px] stroke-[1.7]" aria-hidden />
      </span>

      <div className="min-w-0">
        <p className="text-xs text-[#A9A3B2]">{label}</p>
        <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-white">
          {value}
        </p>
      </div>

      <div className="col-start-2 mt-2 flex min-w-0 items-center gap-2 text-[11px] text-[#A9A3B2]">
        <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} />
        <span className="truncate">{note}</span>
      </div>
    </article>
  );
}

function ActivityPanel({
  initialResult,
}: {
  initialResult: Awaited<ReturnType<typeof getEntryOperationalActivity>>;
}) {
  return (
    <section className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
      <div className="border-b border-[#141119] px-5 py-4">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">
          Operational activity
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#A9A3B2]">
          Recent system and operational events across ENTRY.
        </p>
      </div>
      <OperationalActivityFeed initialResult={initialResult} limit={8} />
    </section>
  );
}

export default async function DashboardPage() {
  const [communities, operationalActivity, supportTickets, observability] =
    await Promise.all([
      listCommunitiesWithProgress(),
      getEntryOperationalActivity(8),
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

  const ticketPriority: Array<
    OperationsPriorityItem & { urgency: number }
  > =
    openTickets && openTickets.length > 0
      ? [
          {
            actionLabel: "Review tickets",
            details: [
              {
                label: "Open tickets",
                value: formatCount(openTickets.length, "ticket"),
              },
              {
                label: "In progress",
                value: formatCount(
                  openTickets.filter((ticket) => ticket.status === "in_progress")
                    .length,
                  "ticket",
                ),
              },
              { label: "Workspace", value: "ENTRY support" },
            ],
            href: "/products/entry/tickets",
            id: "support-tickets",
            impact: formatCount(
              openTickets.filter((ticket) => ticket.status === "in_progress")
                .length,
              "ticket in progress",
              "tickets in progress",
            ),
            status: formatCount(openTickets.length, "open ticket"),
            statusNote: "Support follow-up",
            title: "Support tickets",
            tone: "sky",
            type: "Tickets",
            urgency: 78 + Math.min(openTickets.length, 10),
          },
        ]
      : [];

  const incidentPriorities: Array<
    OperationsPriorityItem & { urgency: number }
  > =
    incidents?.slice(0, 2).map((incident, index) => {
      const communityLabel =
        incident.communities.length === 1
          ? incident.communities[0]?.communityName || "ENTRY platform"
          : incident.communities.length > 1
            ? formatCount(incident.communities.length, "community")
            : "ENTRY platform";

      return {
        actionLabel: "Review incident",
        details: [
          {
            label: "Occurrences",
            value: String(incident.occurrenceCount),
          },
          { label: "Severity", value: incident.severity },
          { label: "Community", value: communityLabel },
          { label: "Source", value: "ENTRY observability" },
          { label: "Reference", value: incident.fingerprint },
        ],
        href: "/products/entry/observability",
        id: "incident-" + incident.fingerprint + "-" + index,
        impact: incident.explanation,
        secondaryAction: {
          href: "/products/entry/observability",
          label: "View in observability",
        },
        stages: [
          { label: "Detected", state: "active" },
          { label: "Investigating", state: "idle" },
          { label: "Resolved", state: "idle" },
          { label: "Closed", state: "idle" },
        ],
        status:
          incident.severity +
          " · " +
          formatCount(incident.occurrenceCount, "occurrence"),
        statusNote: "Needs review",
        title:
          incident.communities.length === 1
            ? incident.communities[0]?.communityName || "ENTRY observability"
            : "ENTRY observability",
        tone:
          incident.severity === "CRITICAL" || incident.severity === "ERROR"
            ? "rose"
            : "amber",
        type: "Alerts / incidents",
        urgency: 85 + severityRank(incident.severity),
      };
    }) ?? [];

  const allPriorityItems = [
    ...pendingSetupCommunities.map(buildSetupPriority),
    ...activationPriorities,
    ...ticketPriority,
    ...incidentPriorities,
  ].sort((a, b) => b.urgency - a.urgency || a.title.localeCompare(b.title));

  const priorityItems: OperationsPriorityItem[] = allPriorityItems.slice(0, 8);

  return (
    <div className={cn(rubik.className, "relative -mx-4 -my-4 min-h-[calc(100vh-4rem)] space-y-4 bg-[#2E2936] px-4 py-5 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 lg:py-5 2xl:-mx-7 2xl:px-7")}>
      <section className="flex flex-col gap-5 pt-1 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white lg:text-[2.05rem]">
            ENTRY Operations
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#A9A3B2]">
            Action-focused workspace for issues, onboarding tasks, activations,
            and operational follow-up.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <DimensionalActionLink href="/products/entry/communities/new">
            <Plus className="size-4 stroke-[1.9]" aria-hidden />
            Create community
          </DimensionalActionLink>
          <DimensionalActionLink href="/products/entry/messages" variant="secondary">
            <Send className="size-4 stroke-[1.9]" aria-hidden />
            Send Minerva message
          </DimensionalActionLink>
        </div>
      </section>

      <section className="relative grid overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF] md:grid-cols-2 xl:grid-cols-4">
        <MetricItem
          icon={ClipboardList}
          label="Needs attention"
          value={allPriorityItems.length}
          note="Actionable operational items"
          dotClassName={
            allPriorityItems.length > 0 ? "bg-[#F6C941]" : "bg-[#67D7A5]"
          }
          className="border-b border-[#141119] md:border-r xl:border-b-0"
        />
        <MetricItem
          icon={UserRoundCheck}
          label="Pending activations"
          value={residentsInActivationQueue}
          note="Residents waiting in queue"
          dotClassName="bg-[#7553FF]"
          className="border-b border-[#141119] xl:border-r xl:border-b-0"
        />
        <MetricItem
          icon={LifeBuoy}
          label="Open tickets"
          value={openTickets ? openTickets.length : "—"}
          note={openTickets ? "Unresolved support tickets" : "Ticket count unavailable"}
          dotClassName="bg-[#66BEFF]"
          className="border-b border-[#141119] md:border-r md:border-b-0 xl:border-r"
        />
        <MetricItem
          icon={AlertTriangle}
          label="Alerts / incidents"
          value={incidents ? incidents.length : "—"}
          note={incidents ? "Current observability items" : "Incident count unavailable"}
          dotClassName={
            incidents && incidents.length > 0 ? "bg-[#FF667E]" : "bg-[#67D7A5]"
          }
        />
      </section>

      {priorityItems.length > 0 ? (
        <OperationalPrioritiesWorkspace items={priorityItems} />
      ) : (
        <section className="relative rounded-[10px] border border-[#141119] bg-[#24202B] px-5 py-12 text-center before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
          <p className="text-lg font-semibold text-white">Nothing needs attention</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#A9A3B2]">
            ENTRY is operating normally. New setup tasks, activations, tickets,
            or incidents will appear here when they require follow-up.
          </p>
        </section>
      )}

      <ActivityPanel initialResult={operationalActivity} />
    </div>
  );
}
