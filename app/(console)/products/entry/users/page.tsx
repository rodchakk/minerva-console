import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserSearch } from "@/features/entry/users/UserSearch";

export default async function EntryUsersPage(
  props: PageProps<"/products/entry/users">,
) {
  const params = await props.searchParams;
  const rawCommunityId = params?.community_id;
  const communityId =
    typeof rawCommunityId === "string"
      ? rawCommunityId.trim()
      : rawCommunityId?.[0]?.trim();

  if (communityId) {
    redirect(`/products/entry/communities/${encodeURIComponent(communityId)}/staff`);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="ENTRY users"
        description="Search users through the production admin RPC and prepare future support actions from a single product workspace."
      />
      <UserSearch />
    </div>
  );
}
