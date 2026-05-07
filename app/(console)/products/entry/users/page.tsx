import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserSearch } from "@/features/entry/users/UserSearch";

type EntryUsersPageProps = {
  searchParams?: Promise<{
    community_id?: string;
  }>;
};

export default async function EntryUsersPage({ searchParams }: EntryUsersPageProps) {
  const params = await searchParams;
  const communityId = params?.community_id?.trim();

  if (communityId) {
    redirect(
      `/products/entry/activation?community_id=${encodeURIComponent(
        communityId,
      )}&status=pending`,
    );
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
