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

function getCommunityHref(communityId: string) {
  return `/products/entry/communities/${communityId}`;
}

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
    <div className="space-y-5 2xl:space-y-6">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,2.35fr)_330px] 2xl:grid-cols-[minmax(0,2.7fr)_340px]">
        <div className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(112,104,255,0.18),rgba(17,24,39,0.92))] p-7 shadow-[0_24px_70px_rgba(2,6,23,0.32)] backdrop-blur xl:min-h-[250px] xl:p-8 2xl:min-h-[270px] 2xl:p-9">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl">
              <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-100 ring-1 ring-inset ring-white/10">
                ENTRY dashboard
              </div>
              <h1 className="mt-4 text-5xl font-semibold tracking-tight text-white 2xl:text-[3.4rem]">
                ENTRY Operations
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
                Onboard communities, manage setup, and support clients from one
                place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/products/entry/communities/new">
                <Button>Create community</Button>
              </Link>
              <Link href="/products/entry/messages">
                <Button variant="secondary">Send Minerva message</Button>
              </Link>
            </div>
          </div>
        </div>

        <aside className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur xl:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
            Quick Actions
          </p>
          <div className="mt-4 space-y-3">
            {[
              {
                label: "Create community",
                href: "/products/entry/communities/new",
                note: "Start a new onboarding flow.",
              },
              {
                label: "Open Activation Queue",
                href: "/products/entry/activation",
                note: "Review residents waiting for setup.",
              },
              {
                label: "Review users",
                href: "/products/entry/users",
                note: "Search current user records.",
              },
              {
                label: "Publish message",
                href: "/products/entry/messages",
                note: "Prepare official Minerva updates.",
              },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="block rounded-[24px] border border-white/8 bg-white/4 p-4 transition hover:border-violet-400/20 hover:bg-white/8"
              >
                <p className="text-sm font-semibold text-white">{action.label}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                  {action.note}
                </p>
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <p className="text-sm font-medium text-[var(--text-muted)]">
            Active Communities
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {activeCommunities.length}
          </p>
          <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
            Communities currently marked active in the existing onboarding data.
          </p>
        </article>
        <article className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <p className="text-sm font-medium text-[var(--text-muted)]">
            Pending Setup
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {pendingSetup.length}
          </p>
          <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
            Communities still moving toward <span className="font-semibold text-slate-200">complete_active</span>.
          </p>
        </article>
        <article className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <p className="text-sm font-medium text-[var(--text-muted)]">
            Residents in Activation Queue
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {residentsInActivationQueue}
          </p>
          <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
            Sum of pending activation rows derived from the community progress
            dataset.
          </p>
        </article>
        <article className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)]">
                Messages Sent Today
              </p>
              <p className="mt-3 text-3xl font-semibold text-white">Pending</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-violet-500/12 px-2.5 py-1 text-xs font-semibold text-violet-200 ring-1 ring-inset ring-violet-400/20">
              Coming soon
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
            Messaging UI is ready for backend wiring once send and delivery
            tracking are connected.
          </p>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,2.5fr)_300px] 2xl:grid-cols-[minmax(0,2.85fr)_320px]">
        <div className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur xl:p-7 2xl:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                Community Focus
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Setup priorities across ENTRY
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                The most important communities are sorted by onboarding urgency and
                activation load.
              </p>
            </div>
            <Link href="/products/entry/communities">
              <Button variant="secondary">View all communities</Button>
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {prioritizedCommunities.length > 0 ? (
              prioritizedCommunities.map((community) => {
                const isComplete = community.onboardingStatus === "complete_active";

                return (
                  <article
                    key={community.id}
                    className="rounded-[28px] border border-white/8 bg-white/4 p-5 xl:p-6"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">
                            {community.name}
                          </h3>
                          <span className="inline-flex items-center rounded-full bg-white/8 px-2.5 py-1 text-xs font-semibold text-slate-200">
                            {community.city}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                              community.isActive
                                ? "bg-emerald-500/12 text-emerald-300 ring-emerald-400/20"
                                : "bg-amber-500/12 text-amber-300 ring-amber-400/20"
                            }`}
                          >
                            {community.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <div className="mt-4 rounded-[24px] border border-white/8 bg-[var(--surface-strong)] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-200">
                              Onboarding progress
                            </p>
                            <p className="text-sm text-[var(--text-muted)]">
                              {community.completedTasks} / {community.totalTasks} complete
                            </p>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-white/8">
                            <div
                              className="h-2 rounded-full bg-[var(--primary)]"
                              style={{
                                width: getProgressWidth(
                                  community.completedTasks,
                                  community.totalTasks,
                                ),
                              }}
                            />
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-3">
                            <p>Next step: {getOnboardingNextStepLabel(community.nextStepKey)}</p>
                            <p>Total units: {community.totalUnits}</p>
                            <p>Pending activations: {community.activationPendingCount}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center xl:pl-4">
                        <Link href={getCommunityHref(community.id)}>
                          <Button variant={isComplete ? "secondary" : "primary"}>
                            {isComplete ? "Open" : "Continue setup"}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <article className="rounded-[28px] border border-dashed border-[var(--border-strong)] bg-white/4 px-6 py-10 text-center">
                <h3 className="text-lg font-semibold text-white">
                  No community records yet
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
                  Once `listCommunitiesWithProgress()` returns rows, this panel will
                  surface the communities that need the most attention.
                </p>
              </article>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur xl:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              Setup Priorities
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-2xl font-semibold text-white">
                  {pendingSetup.length}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  communities needing setup
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-2xl font-semibold text-white">
                  {residentsInActivationQueue}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  residents pending activation
                </p>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <p className="text-2xl font-semibold text-white">
                  {inactiveCommunities.length}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  inactive communities requiring review
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur xl:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              Recent Activity
            </p>
            <div className="mt-4 rounded-[24px] border border-dashed border-[var(--border-strong)] bg-white/4 p-5">
              <p className="text-sm font-semibold text-white">
                Live activity feed coming soon
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                This panel is reserved for onboarding events, queue changes, and
                publishing activity once the live feed is wired in.
              </p>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
