import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CommunityAdminActivityDrawer } from "@/features/entry/communities/CommunityAdminActivityDrawer";
import { CommunityFacilitiesDrawer } from "@/features/entry/communities/CommunityFacilitiesDrawer";
import { CommunityOnboardingReadinessPanel } from "@/features/entry/communities/CommunityOnboardingReadinessPanel";
import { CommunityUsersDrawer } from "@/features/entry/communities/CommunityUsersDrawer";
import { CommunityUnitsDrawer } from "@/features/entry/communities/CommunityUnitsDrawer";
import { getCommunityAdminActivityPreview } from "@/features/entry/communities/activityQueries";
import {
  getCommunityDetailPreviews,
  type CommunityDetailPreviews,
} from "@/features/entry/communities/detailQueries";
import {
  getCommunityOnboardingDetail,
  getCommunityWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

type ActionItem = {
  href: string;
  label: string;
  note: string;
};

function getProgressPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function getProgressWidth(completed: number, total: number) {
  return `${getProgressPercent(completed, total)}%`;
}

function needsSetupAttention(community: CommunityWithProgressItem) {
  return (
    community.totalUnits <= 0 ||
    community.nextStepKey === "units" ||
    (!community.isActive && community.onboardingStatus === "complete_active")
  );
}

function getSetupLabel(community: CommunityWithProgressItem) {
  if (needsSetupAttention(community)) return "Needs attention";
  if (community.onboardingStatus === "complete_active") return "Complete";
  if (community.onboardingStatus === "ready_for_final_review") return "Ready for review";
  return "Pending setup";
}

function getSetupTone(community: CommunityWithProgressItem) {
  if (needsSetupAttention(community)) return "warning" as const;
  if (community.onboardingStatus === "complete_active") return "success" as const;
  if (community.onboardingStatus === "ready_for_final_review") return "success" as const;
  return "info" as const;
}

function getPrimaryAction(community: CommunityWithProgressItem) {
  if (community.nextStepKey === "units" || community.totalUnits <= 0) {
    return {
      href: `/products/entry/communities/${community.id}/units/new`,
      label: "Create units",
      note: "Add unit records required for onboarding.",
    };
  }

  if (
    community.activationPendingCount > 0 ||
    community.nextStepKey === "review_activation_queue" ||
    community.nextStepKey === "activation_queue"
  ) {
    return {
      href: `/products/entry/activation?community_id=${community.id}`,
      label: "Open activation queue",
      note: "Review residents waiting for activation and next setup steps.",
    };
  }

  if (community.nextStepKey === "facilities") {
    return {
      href: `/products/entry/communities/${community.id}/facilities/new`,
      label: "Configure facilities",
      note: "Add reservable areas required for onboarding.",
    };
  }

  if (community.nextStepKey === "admins" || community.nextStepKey === "staff") {
    return {
      href: `/products/entry/communities/${community.id}/staff`,
      label: "Assign resident admin",
      note: "Select an existing resident and grant community admin privileges.",
    };
  }

  if (community.nextStepKey === "residents") {
    return {
      href: `/products/entry/users?community_id=${community.id}`,
      label: "Review users",
      note: "Import residents and review activation readiness.",
    };
  }

  if (community.nextStepKey === "final_review") {
    return {
      href: "#setup-progress",
      label: "Final review",
      note: "Complete readiness checks and activate the community.",
    };
  }

  if (community.onboardingStatus === "complete_active" && community.isActive) {
    return {
      href: `/products/entry/communities/${community.id}/units`,
      label: "Open operations",
      note: "Community is ready for regular operational review.",
    };
  }

  return {
    href: "#setup-progress",
    label: needsSetupAttention(community) ? "Review setup" : "Continue setup",
    note: "Review the current setup and operational readiness.",
  };
}

function getPreviewMetricStatus(
  state: CommunityDetailPreviews["messages"]["state"],
  readyLabel = "Live",
) {
  if (state === "live") return readyLabel;
  if (state === "disabled") return "Disabled";
  if (state === "unavailable") return "Preview";
  return "Empty";
}

function getAttentionItems(
  community: CommunityWithProgressItem,
  previews: CommunityDetailPreviews,
  blockers: string[],
) {
  const items: Array<{ description: string; title: string }> = blockers.map(
    (blocker) => ({
      description: "Resolve this item before completing onboarding.",
      title: blocker,
    }),
  );

  if (items.length === 0 && (community.totalUnits <= 0 || community.nextStepKey === "units")) {
    items.push({
      description: "Units are required to manage residents and control access.",
      title: "Create unit records",
    });
  }

  if (items.length === 0 && community.activationPendingCount > 0) {
    items.push({
      description: "Prepared residents are waiting in the activation queue.",
      title: "Review pending activations",
    });
  }

  if (items.length === 0 && community.allowReservations && previews.facilities.state !== "live") {
    items.push({
      description: "Reservable areas can be configured before using reservations.",
      title: "Configure facilities",
    });
  }

  if (previews.users.state === "unavailable") {
    items.push({
      description: "The user preview could not be loaded safely right now.",
      title: "User preview unavailable",
    });
  }

  if (items.length === 0) {
    items.push({
      description: "No immediate blockers were detected in the readiness gate.",
      title: "No critical attention items",
    });
  }

  return items.slice(0, 3);
}

function getCommunityOperators(users: CommunityDetailPreviews["users"]["items"]) {
  return users.filter((user) => {
    const normalizedRole = user.role.trim().toLowerCase();
    return normalizedRole === "admin" || normalizedRole === "guard";
  });
}

function MiniMetric({
  badge,
  hint,
  label,
  value,
}: {
  badge?: string;
  hint: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4 border-white/8 px-4 py-4 md:border-r last:border-r-0">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-[var(--surface-strong)] text-lg text-violet-200">
        {badge ?? "•"}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
        <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{hint}</p>
      </div>
    </div>
  );
}

function SummaryCard({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_16px_42px_rgba(2,6,23,0.2)]">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
          {title}
        </p>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function QuickActionCard({ action }: { action: ActionItem }) {
  return (
    <Link
      href={action.href}
      className="group flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/4 p-4 transition hover:border-violet-300/40 hover:bg-white/7"
    >
      <div>
        <p className="text-sm font-semibold text-white">{action.label}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{action.note}</p>
      </div>
      <span className="text-lg text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-white">
        →
      </span>
    </Link>
  );
}

function ActionButtonLink({
  href,
  label,
  variant,
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  if (href.startsWith("#")) {
    return (
      <a href={href}>
        <Button variant={variant === "secondary" ? "secondary" : undefined}>
          {label}
        </Button>
      </a>
    );
  }

  return (
    <Link href={href}>
      <Button variant={variant === "secondary" ? "secondary" : undefined}>
        {label}
      </Button>
    </Link>
  );
}

function EmptyInline({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm text-[var(--text-muted)]">
      {children}
    </div>
  );
}

export default async function CommunitySetupPage(
  props: PageProps<"/products/entry/communities/[communityId]">,
) {
  const { communityId } = await props.params;
  const community = await getCommunityWithProgress(communityId);

  if (!community) notFound();

  const [previews, adminActivity, onboardingDetail] = await Promise.all([
    getCommunityDetailPreviews(community.id, {
      allowMessages: community.allowMessages,
    }),
    getCommunityAdminActivityPreview(community.id, 50),
    getCommunityOnboardingDetail(community.id),
  ]);

  const primaryAction = getPrimaryAction(community);
  const progressPercent = getProgressPercent(community.completedTasks, community.totalTasks);
  const nextStepLabel = getOnboardingNextStepLabel(community.nextStepKey);
  const attentionItems = getAttentionItems(community, previews, onboardingDetail?.blockers ?? []);
  const communityOperators = getCommunityOperators(previews.users.items);
  const unitsForSnapshot = previews.units.items.slice(0, 5);
  const recentActivities = adminActivity.items.slice(0, 3);
  const shouldShowSetupProgress =
    onboardingDetail?.onboardingStatus !== "complete_active" &&
    community.onboardingStatus !== "complete_active";

  const quickActions: ActionItem[] = [
    { href: "#users-summary", label: "Review users", note: "Jump to the user summary." },
    {
      href: `/products/entry/communities/${community.id}/staff`,
      label: "Community operators",
      note: "Assign resident admins and guard access.",
    },
    {
      href: `/products/entry/activation?community_id=${community.id}`,
      label: "Open activation queue",
      note: "Review pending activations.",
    },
    {
      href: `/products/entry/settings?community_id=${community.id}`,
      label: "Community settings",
      note: "Review defaults and guardrails.",
    },
    {
      href: `/products/entry/messages?community_id=${community.id}`,
      label: "Send message",
      note: "Post a community update.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={community.name}
        description={community.city}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/products/entry/communities">
              <Button variant="secondary">Back to communities</Button>
            </Link>
            <ActionButtonLink href={primaryAction.href} label={primaryAction.label} />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={community.isActive ? "success" : "default"}>
          {community.isActive ? "Active" : "Inactive"}
        </Badge>
        <Badge tone={getSetupTone(community)}>{getSetupLabel(community)}</Badge>
        <Badge tone="info">{community.unitLabel}</Badge>
      </div>

      <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(112,104,255,0.16),rgba(17,24,39,0.88)_42%,rgba(8,11,22,0.96))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.28)] backdrop-blur xl:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-violet-200">
          Operational health
        </p>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.25fr_1fr_1.25fr] xl:divide-x xl:divide-white/8">
          <div className="flex gap-4 xl:pr-5">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-400/25 bg-amber-500/12 text-2xl text-amber-300">
              {getSetupLabel(community) === "Complete" ? "✓" : "!"}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Current status
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">{getSetupLabel(community)}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                {getSetupLabel(community) === "Complete"
                  ? "Community is ready for regular operation."
                  : "Action required to reach full readiness."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 xl:px-5">
            <div
              className="grid h-20 w-20 shrink-0 place-items-center rounded-full p-1"
              style={{
                background: `conic-gradient(var(--primary) ${progressPercent}%, rgba(255,255,255,0.12) 0)`,
              }}
            >
              <div className="grid h-full w-full place-items-center rounded-full bg-[var(--surface-strong)] text-sm font-semibold text-white">
                {progressPercent}%
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Setup progress
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {community.completedTasks} / {community.totalTasks} tasks complete
              </p>
              <div className="mt-3 h-2 rounded-full bg-white/8">
                <div
                  className="h-2 rounded-full bg-[var(--primary)]"
                  style={{ width: getProgressWidth(community.completedTasks, community.totalTasks) }}
                />
              </div>
            </div>
          </div>

          <div className="xl:px-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Next step
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">{nextStepLabel}</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              Continue from the current setup checkpoint.
            </p>
            <div className="mt-3 inline-flex">
              <ActionButtonLink
                href={primaryAction.href}
                label={primaryAction.label}
                variant="secondary"
              />
            </div>
          </div>

          <div className="xl:pl-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              What needs attention
            </p>
            <div className="mt-3 space-y-3">
              {attentionItems.map((item) => (
                <div key={item.title}>
                  <p className="text-sm font-semibold text-white">• {item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
            {shouldShowSetupProgress ? (
              <a
                href="#setup-progress"
                className="mt-3 inline-flex text-sm font-semibold text-violet-200 transition hover:text-white"
              >
                View setup details →
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_48px_rgba(2,6,23,0.2)] md:grid-cols-2 xl:grid-cols-5">
        <MiniMetric badge="▣" label="Units" value={community.totalUnits} hint="Total units" />
        <MiniMetric badge="◎" label="Members" value={community.totalMembers} hint="Total members" />
        <MiniMetric
          badge="◴"
          label="Pending activations"
          value={community.activationPendingCount}
          hint="Waiting in queue"
        />
        <MiniMetric
          badge="▤"
          label="Facilities"
          value={previews.facilities.state === "live" ? previews.facilities.activeCount : "—"}
          hint={
            previews.facilities.state === "live"
              ? "Active facilities"
              : previews.facilities.state === "disabled"
                ? "Reservations disabled"
                : "Not configured"
          }
        />
        <MiniMetric
          badge="⌁"
          label="Admin activity"
          value={adminActivity.state === "live" ? adminActivity.total : "—"}
          hint={getPreviewMetricStatus(adminActivity.state)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section
            id="units-snapshot"
            className="rounded-[30px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)] xl:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                Units snapshot
              </p>
              {previews.units.state === "empty" ? (
                <Link
                  href={`/products/entry/communities/${community.id}/units/new`}
                  className="text-sm font-semibold text-violet-200 transition hover:text-white"
                >
                  Add units →
                </Link>
              ) : (
                <CommunityUnitsDrawer
                  communityId={community.id}
                  units={previews.units.items}
                  triggerLabel="View full units directory"
                />
              )}
            </div>
            {previews.units.state === "unavailable" ? (
              <div className="mt-5">
                <EmptyInline>Units preview unavailable.</EmptyInline>
              </div>
            ) : previews.units.state === "empty" ? (
              <div className="mt-5">
                <EmptyInline>No units created yet.</EmptyInline>
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-[820px] w-full text-left text-sm">
                  <thead className="border-b border-white/8 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    <tr>
                      <th className="py-3 pr-4 font-semibold">Unit / building</th>
                      <th className="px-4 py-3 font-semibold">Owner</th>
                      <th className="px-4 py-3 font-semibold">Active residents</th>
                      <th className="px-4 py-3 font-semibold">Passes</th>
                      <th className="px-4 py-3 font-semibold">Last access</th>
                      <th className="py-3 pl-4 text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/7">
                    {unitsForSnapshot.map((unit, index) => (
                      <tr key={unit.id} className="text-[var(--text-muted)]">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="font-semibold text-white">{unit.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">{unit.ownerName}</td>
                        <td className="px-4 py-4 font-semibold text-white">{unit.activeResidents}</td>
                        <td className="px-4 py-4 font-semibold text-white">{unit.activePasses}</td>
                        <td className="px-4 py-4 text-white">{unit.lastAccess}</td>
                        <td className="py-4 pl-4 text-right">
                          <Badge tone={unit.isActive ? "success" : "default"}>
                            {unit.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <SummaryCard
              title="Users summary"
              action={
                <CommunityUsersDrawer
                  communityId={community.id}
                  users={previews.users.items}
                  state={previews.users.state}
                  triggerLabel="Review users"
                />
              }
            >
              <div id="users-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Admins", previews.users.counts.admins],
                  ["Guards", previews.users.counts.guards],
                  ["Residents", previews.users.counts.residents],
                  ["Inactive", previews.users.counts.inactive],
                ].map(([label, value]) => (
                  <div key={label} className="border-r border-white/8 last:border-r-0">
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                  </div>
                ))}
              </div>
              {previews.users.state === "live" ? (
                <div className="mt-5 rounded-[22px] border border-white/8 bg-white/4 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Community operators
                    </p>
                    <span className="text-xs text-[var(--text-muted)]">Admins and guards</span>
                  </div>
                  {communityOperators.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {communityOperators.slice(0, 4).map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[var(--surface-strong)] px-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
                            <p className="mt-1 text-sm text-[var(--text-muted)]">{user.contact}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <Badge tone="info">{user.role}</Badge>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{user.houseLabel}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-[var(--text-muted)]">
                      No admins or guards linked to this community yet.
                    </p>
                  )}
                </div>
              ) : null}
              {previews.users.state === "unavailable" ? (
                <p className="mt-4 text-sm text-[var(--text-muted)]">User preview unavailable.</p>
              ) : null}
            </SummaryCard>

            <SummaryCard
              title="Facilities summary"
              action={
                <CommunityFacilitiesDrawer
                  facilities={previews.facilities.items}
                  state={previews.facilities.state}
                  triggerLabel="Manage facilities"
                />
              }
            >
              <div id="facilities-summary">
                {previews.facilities.state === "live" ? (
                  <div className="space-y-3">
                    {previews.facilities.items.slice(0, 2).map((facility) => (
                      <div key={facility.id} className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{facility.name}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                              {facility.opensAt} to {facility.closesAt}
                            </p>
                          </div>
                          <Badge tone={facility.isActive ? "success" : "default"}>
                            {facility.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                            {facility.slotMinutes} min
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white">
                            {facility.pricePerSlot}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p className="text-base font-semibold text-white">
                      {previews.facilities.state === "disabled"
                        ? "Reservations disabled"
                        : previews.facilities.state === "unavailable"
                          ? "Preview unavailable"
                          : "No facilities configured"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                      Add facilities to manage reservable areas and operating windows.
                    </p>
                  </div>
                )}
              </div>
            </SummaryCard>

            <SummaryCard
              title="Recent admin activity"
              action={
                <CommunityAdminActivityDrawer
                  activities={adminActivity.items}
                  triggerLabel="View full log"
                />
              }
            >
              {adminActivity.state === "live" ? (
                <div className="space-y-3">
                  {recentActivities.map((activity) => (
                    <div key={activity.id}>
                      <p className="text-sm font-semibold text-white">{activity.summary}</p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {activity.actorName} · {activity.createdAt}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="text-base font-semibold text-white">
                    {adminActivity.state === "unavailable"
                      ? "Activity preview unavailable"
                      : "No admin activity yet"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Important administrative actions for this community will appear here.
                  </p>
                </div>
              )}
            </SummaryCard>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[30px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              Quick actions
            </p>
            <div className="mt-4 space-y-3">
              {quickActions.map((action) => (
                <QuickActionCard key={action.label} action={action} />
              ))}
            </div>
          </section>
        </aside>
      </section>

      {shouldShowSetupProgress ? (
        <CommunityOnboardingReadinessPanel
          communityId={community.id}
          detail={onboardingDetail}
          nextStepKey={community.nextStepKey}
          progressLabel={`${community.completedTasks} / ${community.totalTasks} tasks completed.`}
        />
      ) : null}
    </div>
  );
}
