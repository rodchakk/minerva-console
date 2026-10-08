import { notFound } from "next/navigation";
import { CommunityDirectoryWorkspace } from "@/features/entry/communities/CommunityDirectoryWorkspace";
import { getCommunityUnitsPageData } from "@/features/entry/communities/detailQueries";
import { getCommunityWithProgress } from "@/features/entry/communities/queries";

export default async function CommunityUnitsPage(
  props: PageProps<"/products/entry/communities/[communityId]/units">,
) {
  const { communityId } = await props.params;
  const community = await getCommunityWithProgress(communityId);

  if (!community) notFound();

  const unitsData = await getCommunityUnitsPageData({
    communityId: community.id,
  });

  return (
    <CommunityDirectoryWorkspace
      communityId={community.id}
      communityName={community.name}
      houses={unitsData.houses}
      state={unitsData.state}
      summary={unitsData.summary}
      units={unitsData.items}
    />
  );
}
