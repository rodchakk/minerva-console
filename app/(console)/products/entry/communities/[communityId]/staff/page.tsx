import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
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
          <Link href={`/products/entry/communities/${community.id}`}>
            <Button variant="secondary">
              <Building2 className="mr-2 h-4 w-4" aria-hidden />
              Back to community details
            </Button>
          </Link>
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
