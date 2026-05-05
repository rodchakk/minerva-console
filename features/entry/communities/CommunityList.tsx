import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CommunityListItem } from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

type CommunityListProps = {
  communities: CommunityListItem[];
};

function getStatusTone(status: string): "success" | "warning" {
  return status === "complete_active" ? "success" : "warning";
}

function getStatusLabel(status: string) {
  return status === "complete_active" ? "Complete & Active" : "Pending setup";
}

function getProgressWidth(completed: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((completed / total) * 100))}%`;
}

function getCta(community: CommunityListItem) {
  if (community.onboardingStatus === "complete_active") {
    return {
      disabled: false,
      href: `/products/entry/communities/${community.id}`,
      label: "View details",
      note: "",
    };
  }

  return {
    disabled: false,
    href: `/products/entry/communities/${community.id}`,
    label: "Continue setup",
    note: "",
  };
}

export function CommunityList({ communities }: CommunityListProps) {
  return (
    <div className="space-y-4">
      {communities.map((community) => {
        const cta = getCta(community);

        return (
          <article
            key={community.id}
            className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1 space-y-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-slate-950">
                      {community.name}
                    </h3>
                    <Badge tone={getStatusTone(community.onboardingStatus)}>
                      {getStatusLabel(community.onboardingStatus)}
                    </Badge>
                    <Badge tone={community.isActive ? "success" : "default"}>
                      {community.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600">{community.city}</p>
                </div>

                <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Onboarding progress
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {community.completedTasks} / {community.totalTasks || 0} tasks
                        complete
                      </p>
                    </div>
                    <p className="text-sm font-medium text-slate-600">
                      Next step: {getOnboardingNextStepLabel(community.nextStepKey)}
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-teal-600 transition-[width]"
                      style={{
                        width: getProgressWidth(
                          community.completedTasks,
                          community.totalTasks,
                        ),
                      }}
                    />
                  </div>
                  {community.activationPendingCount > 0 ? (
                    <p className="text-sm text-slate-600">
                      {community.activationPendingCount} resident activation records
                      are waiting in the queue.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tone={community.allowFrequentAccess ? "info" : "default"}>
                    Frequent access
                  </Badge>
                  <Badge tone={community.allowReservations ? "info" : "default"}>
                    Reservations
                  </Badge>
                  <Badge tone={community.allowMessages ? "info" : "default"}>
                    Messages
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                  {cta.disabled ? (
                    <>
                      <Button variant="secondary" disabled>
                        {cta.label}
                      </Button>
                      {cta.note ? (
                        <span className="text-xs font-medium text-slate-500">
                          {cta.note}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <Link href={cta.href}>
                      <Button>{cta.label}</Button>
                    </Link>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:max-w-[360px]">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Unit label
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {community.unitLabel}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Total units
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {community.totalUnits}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Total members
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {community.totalMembers}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    Queue pending
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {community.activationPendingCount}
                  </p>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
