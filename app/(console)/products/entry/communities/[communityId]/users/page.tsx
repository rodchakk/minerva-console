import { notFound } from "next/navigation";
import { CommunityUsersClient } from "@/features/entry/users/CommunityUsersClient";
import { getCommunityUsersPage } from "@/features/entry/users/queries";

export default async function CommunityUsersPage(
  props: PageProps<"/products/entry/communities/[communityId]/users">,
) {
  const { communityId } = await props.params;
  const data = await getCommunityUsersPage(communityId);

  if (!data.community) {
    notFound();
  }

  const usersVersion = data.users
    .map((user) =>
      [
        user.userId,
        user.fullName,
        user.email,
        user.username,
        user.phone,
        user.houseId,
        user.role,
        user.isActive ? "active" : "inactive",
      ].join(":"),
    )
    .join("|");

  return (
    <div className="space-y-6">
      <CommunityUsersClient
        key={`${data.community.id}:${usersVersion}`}
        community={data.community}
        houses={data.houses}
        initialUsers={data.users}
        loadError={data.usersError}
      />
    </div>
  );
}
