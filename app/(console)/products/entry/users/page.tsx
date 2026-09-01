import { redirect } from "next/navigation";
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
    <div className="space-y-5">
      <section className="px-0.5 pt-5">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200">
            ENTRY DIRECTORY
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white lg:text-[2.05rem]">
            ENTRY users
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
            Search people across ENTRY communities and jump directly into the
            right community when you need to manage an account.
          </p>
        </div>
      </section>
      <UserSearch />
    </div>
  );
}
