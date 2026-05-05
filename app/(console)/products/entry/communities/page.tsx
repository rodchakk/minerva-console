import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import {
  CommunityList,
} from "@/features/entry/communities/CommunityList";
import { listCommunitiesWithProgress } from "@/features/entry/communities/queries";

export default async function CommunitiesPage() {
  const communities = await listCommunitiesWithProgress();

  return (
    <div className="space-y-8">
      <PageHeader
        title="ENTRY communities"
        description="Community onboarding and feature configuration for the ENTRY product area."
        actions={
          <Link href="/products/entry/communities/new">
            <Button>Create new community</Button>
          </Link>
        }
      />

      {communities.length > 0 ? (
        <CommunityList communities={communities} />
      ) : (
        <EmptyState
          title="No communities available"
          description="No community rows were returned by list_superadmin_communities_with_progress_v1(). Once records exist, they will appear here with onboarding progress and next steps."
          actionHref="/products/entry/communities/new"
          actionLabel="Create first community"
        />
      )}
    </div>
  );
}
