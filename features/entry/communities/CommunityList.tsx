import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CommunityListItem } from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

type CommunityListProps = {
  communities: CommunityListItem[];
};

function getSetupState(community: CommunityListItem) {
  if (!community.isActive && community.onboardingStatus === "complete_active") {
    return {
      label: "Needs review",
      tone: "warning" as const,
      progressTone: "bg-amber-400",
    };
  }

  if (
    community.totalUnits <= 0 ||
    community.nextStepKey === "units" ||
    (community.onboardingStatus !== "complete_active" &&
      community.totalMembers <= 0 &&
      community.activationPendingCount <= 0)
  ) {
    return {
      label: "Needs attention",
      tone: "warning" as const,
      progressTone: "bg-amber-400",
    };
  }

  if (community.onboardingStatus === "complete_active") {
    return {
      label: "Complete",
      tone: "success" as const,
      progressTone: "bg-emerald-400",
    };
  }

  return {
    label: "Pending setup",
    tone: "warning" as const,
    progressTone: "bg-[var(--primary)]",
  };
}

function getProgressWidth(completed: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((completed / total) * 100))}%`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "MC";
}

function getCta(community: CommunityListItem) {
  const setupState = getSetupState(community);

  if (community.onboardingStatus === "complete_active") {
    return {
      href: `/products/entry/communities/${community.id}`,
      label: "Open",
    };
  }

  if (setupState.label === "Needs attention") {
    return {
      href: `/products/entry/communities/${community.id}`,
      label: "Review",
    };
  }

  return {
    href: `/products/entry/communities/${community.id}`,
    label: "Continue setup",
  };
}

export function CommunityList({ communities }: CommunityListProps) {
  return (
    <div className="space-y-4">
      {communities.map((community) => {
        const cta = getCta(community);
        const setupState = getSetupState(community);
        const enabledFeatures = [
          community.allowFrequentAccess ? "Frequent access" : null,
          community.allowReservations ? "Reservations" : null,
          community.allowMessages ? "Messages" : null,
        ].filter((feature): feature is string => feature !== null);

        return (
          <article
            key={community.id}
            className="rounded-[30px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(17,24,39,0.92),rgba(11,16,28,0.96))] p-5 shadow-[0_20px_55px_rgba(2,6,23,0.24)] backdrop-blur sm:p-6"
          >
            <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(420px,0.95fr)_auto] xl:items-center">
              <div className="flex min-w-0 gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-[linear-gradient(180deg,rgba(112,104,255,0.22),rgba(26,35,64,0.96))] text-xl font-semibold text-violet-100 ring-1 ring-inset ring-violet-400/20">
                  {getInitials(community.name)}
                </div>

                <div className="min-w-0 space-y-3">
                  <div>
                    <h3 className="truncate text-2xl font-semibold text-white">
                      {community.name}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      ◌ {community.city}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={community.isActive ? "success" : "default"}>
                      {community.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Badge tone={setupState.tone}>{setupState.label}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {enabledFeatures.length > 0 ? (
                      enabledFeatures.map((feature) => (
                        <Badge key={feature} tone="info">
                          {feature}
                        </Badge>
                      ))
                    ) : (
                      <Badge tone="default">No optional modules enabled</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[22px] border border-white/8 bg-[rgba(9,12,24,0.54)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Total units
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {community.totalUnits}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-[rgba(9,12,24,0.54)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Total members
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {community.totalMembers}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-[rgba(9,12,24,0.54)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Unit label
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {community.unitLabel}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-[rgba(9,12,24,0.54)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Queue pending
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${
                      community.activationPendingCount > 0
                        ? "text-amber-300"
                        : "text-white"
                    }`}
                  >
                    {community.activationPendingCount}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 xl:min-w-[320px]">
                <div className="rounded-[24px] border border-white/8 bg-[rgba(9,12,24,0.58)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Setup status: {setupState.label}
                      </p>
                      {community.onboardingStatus === "complete_active" ? (
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          All tasks completed
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {community.completedTasks} / {community.totalTasks || 0} tasks
                          complete
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-[var(--text-muted)]">
                      {community.completedTasks} / {community.totalTasks || 0} tasks
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/8">
                    <div
                      className={`h-2 rounded-full transition-[width] ${setupState.progressTone}`}
                      style={{
                        width: getProgressWidth(
                          community.completedTasks,
                          community.totalTasks,
                        ),
                      }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                    Next step: {getOnboardingNextStepLabel(community.nextStepKey)}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Link href={cta.href}>
                    <Button>{cta.label}</Button>
                  </Link>
                  <button
                    type="button"
                    aria-label="More options coming soon"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/6 text-slate-200"
                    disabled
                  >
                    ⋮
                  </button>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
