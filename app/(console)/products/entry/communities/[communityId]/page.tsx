import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/cards/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  getCommunityDetailPreviews,
  type CommunityDetailPreviews,
} from "@/features/entry/communities/detailQueries";
import {
  getCommunityWithProgress,
  type CommunityWithProgressItem,
} from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

type ActionItem = {
  href?: string;
  label: string;
  note: string;
};

function getProgressWidth(completed: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((completed / total) * 100))}%`;
}

function needsSetupAttention(community: CommunityWithProgressItem) {
  return (
    community.totalUnits <= 0 ||
    community.nextStepKey === "units" ||
    (!community.isActive && community.onboardingStatus === "complete_active")
  );
}

function getSetupLabel(community: CommunityWithProgressItem) {
  if (needsSetupAttention(community)) {
    return "Needs attention";
  }

  if (community.onboardingStatus === "complete_active") {
    return "Complete";
  }

  return "Pending setup";
}

function getSetupTone(community: CommunityWithProgressItem) {
  if (needsSetupAttention(community)) {
    return "warning" as const;
  }

  if (community.onboardingStatus === "complete_active") {
    return "success" as const;
  }

  return "info" as const;
}

function getPrimaryAction(community: CommunityWithProgressItem) {
  if (
    community.activationPendingCount > 0 ||
    community.nextStepKey === "review_activation_queue"
  ) {
    return {
      href: `/products/entry/activation?community_id=${community.id}`,
      label: "Open activation queue",
      note: "Review residents waiting for activation and next setup steps.",
    };
  }

  if (community.onboardingStatus === "complete_active" && community.isActive) {
    return {
      href: `/products/entry/activation?community_id=${community.id}`,
      label: "Open operations",
      note: "Open the most active operational surface for this community.",
    };
  }

  if (needsSetupAttention(community)) {
    return {
      href: `/products/entry/communities/${community.id}`,
      label: "Review setup",
      note: "Baseline setup needs attention before regular operation.",
    };
  }

  if (community.onboardingStatus !== "complete_active") {
    return {
      href: `/products/entry/communities/${community.id}`,
      label: "Continue setup",
      note: "Continue the remaining setup work for this community.",
    };
  }

  return {
    href: `/products/entry/communities/${community.id}`,
    label: "Review setup",
    note: "Review the current setup and operational readiness.",
  };
}

function getPreviewMetricTone(state: CommunityDetailPreviews["messages"]["state"]) {
  if (state === "live") {
    return "success" as const;
  }

  if (state === "unavailable") {
    return "default" as const;
  }

  return "info" as const;
}

function getPreviewMetricStatus(
  state: CommunityDetailPreviews["messages"]["state"],
  readyLabel = "Live",
) {
  if (state === "live") {
    return readyLabel;
  }

  if (state === "disabled") {
    return "Disabled";
  }

  if (state === "unavailable") {
    return "Preview";
  }

  return "Empty";
}

function renderPreviewNotice(
  state: CommunityDetailPreviews["messages"]["state"],
  messages: {
    disabled?: string;
    empty: string;
    unavailable?: string;
  },
) {
  if (state === "disabled" && messages.disabled) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm text-[var(--text-muted)]">
        {messages.disabled}
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm text-[var(--text-muted)]">
        {messages.empty}
      </div>
    );
  }

  if (state === "unavailable") {
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm text-[var(--text-muted)]">
        {messages.unavailable ?? "Preview unavailable"}
      </div>
    );
  }

  return null;
}

function SectionShell({
  id,
  title,
  description,
  badge,
  action,
  children,
}: {
  action?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  description: string;
  id: string;
  title: string;
}) {
  return (
    <section
      id={id}
      className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur xl:p-7"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              {title}
            </p>
            {badge}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-[var(--surface-strong)] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export default async function CommunitySetupPage(
  props: PageProps<"/products/entry/communities/[communityId]">,
) {
  const { communityId } = await props.params;
  const community = await getCommunityWithProgress(communityId);

  if (!community) {
    notFound();
  }

  const previews = await getCommunityDetailPreviews(community.id, {
    allowMessages: community.allowMessages,
    allowReservations: community.allowReservations,
  });
  const primaryAction = getPrimaryAction(community);

  const quickActions: ActionItem[] = [
    {
      href: "#users-preview",
      label: "Review users",
      note: "Jump to the user preview for this community.",
    },
    {
      href: `/products/entry/communities/${community.id}/units`,
      label: "View units",
      note: "Inspect known unit records and recent access context.",
    },
    {
      href: "#facilities-preview",
      label: "Manage facilities",
      note: community.allowReservations
        ? "Review reservable facility configuration and operating windows."
        : "Reservations are disabled for this community.",
    },
    {
      href: `/products/entry/messages?community_id=${community.id}`,
      label: "Send message",
      note: "Prepare a community-targeted Minerva message draft.",
    },
    {
      href: `/products/entry/settings?community_id=${community.id}`,
      label: "Community settings",
      note: "Review product-level defaults and guardrails.",
    },
    {
      href: `/products/entry/activation?community_id=${community.id}`,
      label: "Open activation queue",
      note: "Review residents waiting in the activation queue.",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={community.name}
        description="Operational overview for this ENTRY community."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href="/products/entry/communities">
              <Button variant="secondary">Back to communities</Button>
            </Link>
            <Link href={primaryAction.href}>
              <Button>{primaryAction.label}</Button>
            </Link>
          </div>
        }
      />

      <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(112,104,255,0.14),rgba(17,24,39,0.92))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)] backdrop-blur xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={community.isActive ? "success" : "default"}>
                {community.isActive ? "Active" : "Inactive"}
              </Badge>
              <Badge tone={getSetupTone(community)}>{getSetupLabel(community)}</Badge>
              <Badge tone="info">{community.unitLabel}</Badge>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                Community operations
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-white">
                {community.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {community.city}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[rgba(9,12,24,0.5)] px-5 py-4 xl:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
              Operations note
            </p>
            <p className="mt-2 text-base font-semibold text-white">
              {community.onboardingStatus === "complete_active"
                ? "Community is ready for daily operations."
                : "Community still needs setup attention before full operation."}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              {primaryAction.note}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        <MetricCard
          label="Total units"
          value={String(community.totalUnits)}
          hint="Known unit records for this community."
          status="Live"
          tone="info"
        />
        <MetricCard
          label="Total members"
          value={String(community.totalMembers)}
          hint="Known members currently connected."
          status="Live"
          tone="info"
        />
        <MetricCard
          label="Pending activations"
          value={String(community.activationPendingCount)}
          hint="Residents waiting in the activation queue."
          status="Live"
          tone={community.activationPendingCount > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Tasks complete"
          value={`${community.completedTasks}/${community.totalTasks}`}
          hint="Setup progress stays visible without taking over the page."
          status="Live"
          tone={community.onboardingStatus === "complete_active" ? "success" : "info"}
        />
        <MetricCard
          label="Active facilities"
          value={
            previews.facilities.state === "live"
              ? String(previews.facilities.activeCount)
              : "—"
          }
          hint={
            previews.facilities.state === "disabled"
              ? "Reservations are disabled for this community."
              : previews.facilities.state === "unavailable"
                ? "Facility preview could not be loaded safely."
                : "Active reservable facilities configured for this community."
          }
          status={getPreviewMetricStatus(previews.facilities.state)}
          tone={getPreviewMetricTone(previews.facilities.state)}
        />
        <MetricCard
          label="Recent messages"
          value={
            previews.messages.state === "live"
              ? String(previews.messages.total)
              : "—"
          }
          hint={
            previews.messages.state === "disabled"
              ? "Messages are disabled for this community."
              : previews.messages.state === "unavailable"
                ? "Message history preview pending safe wiring."
                : "Recent community-targeted messages returned by the current RPC."
          }
          status={getPreviewMetricStatus(previews.messages.state)}
          tone={getPreviewMetricTone(previews.messages.state)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
        <div className="space-y-6">
          <SectionShell
            id="users-preview"
            title="Users preview"
            description="Read-only snapshot of connected admins, guards, and residents."
            badge={<Badge tone="info">{previews.users.total} known</Badge>}
            action={
              <Link href={`/products/entry/users?community_id=${community.id}`}>
                <Button variant="secondary">Open users</Button>
              </Link>
            }
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatChip label="Admins" value={previews.users.counts.admins} />
              <StatChip label="Guards" value={previews.users.counts.guards} />
              <StatChip label="Residents" value={previews.users.counts.residents} />
              <StatChip label="Inactive" value={previews.users.counts.inactive} />
            </div>

            {renderPreviewNotice(previews.users.state, {
              empty: "No users connected yet.",
              unavailable: "Preview unavailable",
            }) ?? (
              <div className="mt-5 space-y-3">
                {previews.users.items.map((user) => (
                  <div
                    key={user.id}
                    className="grid gap-3 rounded-[24px] border border-white/8 bg-[var(--surface-strong)] px-4 py-4 md:grid-cols-[minmax(0,1.3fr)_160px_180px_130px]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {user.fullName}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {user.contact}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Role
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {user.role}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Unit
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {user.houseLabel}
                      </p>
                    </div>
                    <div className="md:justify-self-end">
                      <Badge tone={user.isActive ? "success" : "default"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionShell>

          <SectionShell
            id="units-preview"
            title="Units preview"
            description="Read-only view of houses, apartments, or unit records currently returned by the admin RPC."
            badge={<Badge tone="info">{previews.units.total} known</Badge>}
            action={
              <Link href={`/products/entry/communities/${community.id}/units`}>
                <Button variant="secondary">Open units</Button>
              </Link>
            }
          >
            {renderPreviewNotice(previews.units.state, {
              empty: "No units created yet.",
              unavailable: "Preview unavailable",
            }) ?? (
              <div className="space-y-3">
                {previews.units.items.map((unit) => (
                  <div
                    key={unit.id}
                    className="grid gap-3 rounded-[24px] border border-white/8 bg-[var(--surface-strong)] px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_170px_120px_120px_150px_120px]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{unit.label}</p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {unit.ownerName}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Active residents
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {unit.activeResidents}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Passes
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {unit.activePasses}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Last access
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {unit.lastAccess}
                      </p>
                    </div>
                    <div className="md:col-span-2 md:justify-self-end">
                      <Badge tone={unit.isActive ? "success" : "default"}>
                        {unit.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionShell>

          <SectionShell
            id="facilities-preview"
            title="Facilities preview"
            description="Read-only status of reservable areas, operating hours, and slot pricing."
            badge={
              <Badge
                tone={
                  previews.facilities.state === "disabled" ? "default" : "info"
                }
              >
                {previews.facilities.state === "disabled"
                  ? "Reservations disabled"
                  : `${previews.facilities.total} known`}
              </Badge>
            }
          >
            {renderPreviewNotice(previews.facilities.state, {
              disabled: "Reservations are disabled for this community.",
              empty: "No facilities configured yet.",
              unavailable: "Preview unavailable",
            }) ?? (
              <div className="space-y-3">
                {previews.facilities.items.map((facility) => (
                  <div
                    key={facility.id}
                    className="grid gap-3 rounded-[24px] border border-white/8 bg-[var(--surface-strong)] px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_150px_140px_150px_150px_120px]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {facility.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {facility.opensAt} to {facility.closesAt}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Slot minutes
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {facility.slotMinutes || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Price
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {facility.pricePerSlot}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Currency
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {facility.currency}
                      </p>
                    </div>
                    <div className="md:col-span-2 md:justify-self-end">
                      <Badge tone={facility.isActive ? "success" : "default"}>
                        {facility.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionShell>

          <SectionShell
            id="messages-preview"
            title="Messages preview"
            description="Recent community messages when the current read-only RPC is available."
            badge={
              <Badge tone={getPreviewMetricTone(previews.messages.state)}>
                {getPreviewMetricStatus(previews.messages.state)}
              </Badge>
            }
            action={
              <Link href={`/products/entry/messages?community_id=${community.id}`}>
                <Button variant="secondary">Prepare message</Button>
              </Link>
            }
          >
            {renderPreviewNotice(previews.messages.state, {
              disabled: "Messages are disabled for this community.",
              empty: "Message history preview pending.",
              unavailable: "Preview unavailable",
            }) ?? (
              <div className="space-y-3">
                {previews.messages.items.map((message) => (
                  <div
                    key={message.id}
                    className="grid gap-3 rounded-[24px] border border-white/8 bg-[var(--surface-strong)] px-4 py-4 md:grid-cols-[minmax(0,1.35fr)_160px_180px_160px]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {message.title}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {message.sourceType}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Published
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {message.publishedAt}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Expires
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {message.expiresAt}
                      </p>
                    </div>
                    <div className="md:justify-self-end">
                      <Badge tone="info">{message.sourceType}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionShell>
        </div>

        <div className="space-y-6">
          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              Quick actions
            </p>
            <div className="mt-4 space-y-3">
              {quickActions.map((action) => {
                const card = (
                  <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                    <p className="text-sm font-semibold text-white">{action.label}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                      {action.note}
                    </p>
                  </div>
                );

                if (!action.href) {
                  return <div key={action.label}>{card}</div>;
                }

                if (action.href.startsWith("#")) {
                  return (
                    <a key={action.label} href={action.href} className="block">
                      {card}
                    </a>
                  );
                }

                return (
                  <Link key={action.label} href={action.href} className="block">
                    {card}
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                  Setup status
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Operational readiness
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  {community.completedTasks} / {community.totalTasks} tasks
                  completed. Next step:{" "}
                  {getOnboardingNextStepLabel(community.nextStepKey)}.
                </p>
              </div>
              <Link href={primaryAction.href}>
                <Button>{primaryAction.label}</Button>
              </Link>
            </div>

            <div className="mt-5 h-3 rounded-full bg-white/8">
              <div
                className="h-3 rounded-full bg-[var(--primary)] transition-[width]"
                style={{
                  width: getProgressWidth(
                    community.completedTasks,
                    community.totalTasks,
                  ),
                }}
              />
            </div>

            <div className="mt-5 grid gap-3">
              <StatChip label="Current status" value={getSetupLabel(community)} />
              <StatChip
                label="Tasks complete"
                value={`${community.completedTasks}/${community.totalTasks}`}
              />
              <StatChip
                label="Next step"
                value={getOnboardingNextStepLabel(community.nextStepKey)}
              />
            </div>
          </section>

          <section className="rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              Feature flags
            </p>
            <div className="mt-4 space-y-3">
              {[
                {
                  enabled: community.allowFrequentAccess,
                  label: "Frequent access",
                },
                {
                  enabled: community.allowReservations,
                  label: "Reservations",
                },
                {
                  enabled: community.allowMessages,
                  label: "Messages",
                },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center justify-between rounded-[22px] border border-white/8 bg-[var(--surface-strong)] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{feature.label}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Read-only status
                    </p>
                  </div>
                  <Badge tone={feature.enabled ? "success" : "default"}>
                    {feature.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
