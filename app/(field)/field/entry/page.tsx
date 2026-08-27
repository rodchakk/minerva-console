import { CommunityFinder } from "@/features/entry/field/CommunityFinder";
import {
  getFieldCommunitySetupLabel,
  getFieldCommunityStatusLabel,
} from "@/features/entry/field/formatting";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { listCommunitiesWithProgress } from "@/features/entry/communities/queries";

export default async function FieldEntryPage() {
  const communities = await listCommunitiesWithProgress();
  const fieldCommunities = communities.map((community) => ({
    activationPendingCount: community.activationPendingCount,
    city: community.city,
    completedTasks: community.completedTasks,
    href: `/field/entry/communities/${encodeURIComponent(community.id)}`,
    id: community.id,
    isActive: community.isActive,
    name: community.name,
    nextStepLabel: getOnboardingNextStepLabel(community.nextStepKey),
    setupLabel: getFieldCommunitySetupLabel(community),
    statusLabel: getFieldCommunityStatusLabel(community),
    totalMembers: community.totalMembers,
    totalTasks: community.totalTasks,
    totalUnits: community.totalUnits,
  }));

  return (
    <div className="space-y-5">
      <section className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          ENTRY Field
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--console-text)]">
          Community finder
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--console-text-muted)]">
          Find an ENTRY community by name or city, then open its read-only field
          overview.
        </p>
      </section>

      <CommunityFinder communities={fieldCommunities} />
    </div>
  );
}
