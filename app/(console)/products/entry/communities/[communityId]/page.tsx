import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";

function getProgressWidth(completed: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((completed / total) * 100))}%`;
}

function getPrimaryAction(communityId: string, nextStepKey: string) {
  if (
    nextStepKey === "residents" ||
    nextStepKey === "invitations" ||
    nextStepKey === "review_activation_queue"
  ) {
    return {
      href: `/products/entry/activation?community_id=${communityId}`,
      label: "Open Activation Queue",
      note: "Continue resident onboarding from the activation queue.",
    };
  }

  if (nextStepKey === "units") {
    return {
      href: `/products/entry/communities/new`,
      label: "Open Community Onboarding",
      note: "Use the onboarding form to add missing setup data for now.",
    };
  }

  if (nextStepKey === "facilities") {
    return {
      href: `/products/entry/communities/new`,
      label: "Open Community Onboarding",
      note: "Facility editing will be folded into the resumed onboarding flow.",
    };
  }

  return {
    href: `/products/entry/activation?community_id=${communityId}`,
    label: "Review Activation Queue",
    note: "This community is already active. You can review prepared residents here.",
  };
}

export default async function CommunitySetupPage(
  props: PageProps<"/products/entry/communities/[communityId]">,
) {
  const { communityId } = await props.params;
  const community = await getCommunityWithProgress(communityId);

  if (!community) {
    notFound();
  }

  const primaryAction = getPrimaryAction(community.id, community.nextStepKey);

  return (
    <div className="space-y-8">
      <PageHeader
        title={community.name}
        description="Resume community onboarding from the exact step tracked for this ENTRY community."
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

      <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                tone={
                  community.onboardingStatus === "complete_active"
                    ? "success"
                    : "warning"
                }
              >
                {community.onboardingStatus === "complete_active"
                  ? "Complete & Active"
                  : "Pending setup"}
              </Badge>
              <Badge tone={community.isActive ? "success" : "default"}>
                {community.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              {community.city} · Unit label: {community.unitLabel}
            </p>
            <p className="text-sm leading-6 text-slate-600">
              Next step: {getOnboardingNextStepLabel(community.nextStepKey)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:max-w-[360px]">
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
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3.5">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Tasks complete
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {community.completedTasks} / {community.totalTasks}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Onboarding progress
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {community.completedTasks} / {community.totalTasks} tasks completed.
              The current step is{" "}
              {getOnboardingNextStepLabel(community.nextStepKey).toLowerCase()}.
            </p>
          </div>
          <Link href={primaryAction.href}>
            <Button>{primaryAction.label}</Button>
          </Link>
        </div>

        <div className="mt-5 h-3 rounded-full bg-slate-200">
          <div
            className="h-3 rounded-full bg-teal-600 transition-[width]"
            style={{
              width: getProgressWidth(
                community.completedTasks,
                community.totalTasks,
              ),
            }}
          />
        </div>

        <p className="mt-4 text-sm text-slate-600">{primaryAction.note}</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-950">1. Units</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {community.totalUnits > 0
              ? `${community.totalUnits} units already exist in this community.`
              : "No units have been detected yet."}
          </p>
        </article>
        <article className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-950">2. Residents</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {community.totalMembers > 0
              ? `${community.totalMembers} members are already connected.`
              : "Resident activation is still pending for this community."}
          </p>
        </article>
        <article className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-950">
            3. Invitations & Activation
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {community.activationPendingCount > 0
              ? `${community.activationPendingCount} activation records are waiting in the queue.`
              : "No pending activation queue rows were found yet."}
          </p>
        </article>
      </section>
    </div>
  );
}
