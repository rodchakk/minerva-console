import { CommunityFinder } from "@/features/entry/field/CommunityFinder";
import { getCommunitiesWithProgressResult } from "@/features/entry/communities/queries";

export default async function FieldEntryCommunitiesPage() {
  const result = await getCommunitiesWithProgressResult();
  const fieldCommunities = result.items.map((community) => ({
    city: community.city,
    href: `/field/entry/communities/${encodeURIComponent(community.id)}`,
    id: community.id,
    isActive: community.isActive,
    name: community.name,
    statusLabel: community.isActive ? "Active" : "Inactive",
    totalMembers: community.totalMembers,
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
