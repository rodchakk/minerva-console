import { CommunityFinder } from "@/features/entry/field/CommunityFinder";
import {
  getFieldCommunitySetupLabel,
  getFieldCommunityStatusLabel,
} from "@/features/entry/field/formatting";
import { getOnboardingNextStepLabel } from "@/features/entry/onboardingCopy";
import { getCommunitiesWithProgressResult } from "@/features/entry/communities/queries";

export default async function FieldEntryCommunitiesPage() {
  const result = await getCommunitiesWithProgressResult();
  const fieldCommunities = result.items.map((community) => ({
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
          Communities
        </h1>
      </section>

      <CommunityFinder
        communities={fieldCommunities}
        error={result.error}
        state={result.state}
      />
    </div>
  );
}
