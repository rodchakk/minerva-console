import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { StaffOperatorsPanel } from "@/features/entry/staff/StaffOperatorsPanel";
import { getCommunityStaffPageData } from "@/features/entry/staff/actions";

export default async function CommunityStaffPage(
  props: PageProps<"/products/entry/communities/[communityId]/staff">,
) {
  const { communityId } = await props.params;
  const community = await getCommunityWithProgress(communityId);

  if (!community) notFound();

  const staffData = await getCommunityStaffPageData(community.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Community operators"
        description={`${community.name} · assign resident admins and guard accounts before final onboarding review.`}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={`/products/entry/communities/${community.id}`}>
              <Button variant="secondary">Back to community</Button>
            </Link>
            <Link href={`/products/entry/communities/${community.id}#setup-status`}>
              <Button>Final review</Button>
            </Link>
          </div>
        }
      />

      <StaffOperatorsPanel
        admins={staffData.admins}
        communityId={community.id}
        guards={staffData.guards}
        residents={staffData.residents}
      />
    </div>
  );
}
