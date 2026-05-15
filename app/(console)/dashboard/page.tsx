import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { listCommunitiesWithProgress } from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

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
    return "border-emerald-400/18 bg-emerald-500/10 text-emerald-200";
  }

  if (onboardingStatus.includes("progress")) {
    return "border-sky-400/18 bg-sky-500/10 text-sky-200";
  }

  if (onboardingStatus.includes("pending")) {
    return "border-amber-400/18 bg-amber-500/10 text-amber-200";
  }

  if (isActive) {
    return "border-emerald-400/18 bg-emerald-500/10 text-emerald-200";
  }

  return "border-white/10 bg-white/5 text-slate-200";
}

const quickActions = [
  {
    label: "Create community",
    href: "/products/entry/communities/new",
    note: "Start a new onboarding flow.",
    tone: "bg-violet-500/12 text-violet-200",
  },
  {
    label: "Open Activation Queue",
    href: "/products/entry/activation",
    note: "Review residents waiting for setup.",
    tone: "bg-amber-500/12 text-amber-200",
  },
  {
    label: "Review users",
    href: "/products/entry/users",
    note: "Search current user records.",
    tone: "bg-sky-500/12 text-sky-200",
  },
  {
    label: "Publish message",
    href: "/products/entry/messages",
    note: "Prepare official Minerva updates.",
    tone: "bg-fuchsia-500/12 text-fuchsia-200",
  },
];

export default async function DashboardPage() {
  const communities = await listCommunitiesWithProgress();

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
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 lg:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-200">
              ENTRY Operations
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2rem]">
              ENTRY Operations
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Onboard communities, monitor setup, and keep operational work moving
              from one workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/products/entry/communities/new">
              <Button>Create community</Button>
            </Link>
            <Link href="/products/entry/messages">
              <Button variant="secondary">Send Minerva message</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Active Communities
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {activeCommunities.length}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Communities currently active.
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Pending Setup
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {pendingSetup.length}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Communities not yet `complete_active`.
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Residents in Activation Queue
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {residentsInActivationQueue}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Pending activation rows across communities.
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Messages Today
            </p>
            <span className="inline-flex items-center rounded-md border border-violet-400/16 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200">
              Pending
            </span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">Pending</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Messaging UI is ready for backend wiring.
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_320px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-200">
                  Community Focus
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  Setup priorities across ENTRY
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Communities sorted by onboarding urgency and activation load.
                </p>
              </div>
              <Link href="/products/entry/communities">
                <Button variant="secondary">View all communities</Button>
              </Link>
            </div>

            {prioritizedCommunities.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[var(--border)] bg-[var(--surface-strong)] text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
                          className="border-b border-[var(--border)] last:border-b-0"
                        >
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/8 bg-[var(--surface-strong)] text-xs font-semibold text-slate-200">
                                {community.name
                                  .split(" ")
                                  .map((part) => part[0] ?? "")
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-white">{community.name}</p>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                  Next:{" "}
                                  {getOnboardingNextStepLabel(community.nextStepKey)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-slate-200">
                            {community.city}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${getStatusClass(
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
                              <div className="flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
                                <span>
                                  {community.completedTasks}/{community.totalTasks} complete
                                </span>
                                <span>{progressValue}%</span>
                              </div>
                              <div className="mt-2 h-1.5 rounded-full bg-white/6">
                                <div
                                  className="h-1.5 rounded-full bg-[var(--primary)]"
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
                          <td className="px-4 py-4 align-top text-slate-200">
                            {community.totalUnits}
                          </td>
                          <td className="px-4 py-4 align-top text-slate-200">
                            {community.activationPendingCount}
                          </td>
                          <td className="px-5 py-4 align-top text-right">
                            <Link href={getCommunityHref(community.id)}>
                              <Button variant={isComplete ? "secondary" : "primary"}>
                                {isComplete ? "Open" : "Continue setup"}
                              </Button>
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
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
                  Once `listCommunitiesWithProgress()` returns rows, this panel will
                  surface the communities that need the most attention.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                Quick Actions
              </p>
            </div>
            <div className="px-3 py-2">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/4"
                >
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${action.tone}`}
                  >
                    •
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{action.label}</p>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                      {action.note}
                    </p>
                  </div>
                  <span className="text-sm text-[var(--text-muted)]">›</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                Setup Priorities
              </p>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
                <p className="text-2xl font-semibold text-white">
                  {pendingSetup.length}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  communities needing setup
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
                <p className="text-2xl font-semibold text-white">
                  {residentsInActivationQueue}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  residents pending activation
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
                <p className="text-2xl font-semibold text-white">
                  {inactiveCommunities.length}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  inactive communities requiring review
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                Operational Notes
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm font-medium text-white">
                Live activity feed coming soon
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                This space remains reserved for onboarding events, queue changes,
                and publishing activity once the feed is connected.
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
