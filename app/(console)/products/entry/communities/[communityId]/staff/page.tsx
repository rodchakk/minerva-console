import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";
import { getCommunityStaffPageData } from "@/features/entry/staff/actions";
import { StaffOperatorsPanel } from "@/features/entry/staff/StaffOperatorsPanel";

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
        description="Manage resident admins and guard accounts who operate within your community."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link href={`/products/entry/communities/${community.id}`}>
              <Button variant="secondary">Back to community</Button>
            </Link>
            <Link href={`/products/entry/communities/${community.id}#completion-actions`}>
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
