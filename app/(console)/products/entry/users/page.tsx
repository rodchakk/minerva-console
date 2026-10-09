import { redirect } from "next/navigation";
import { Rubik } from "next/font/google";
import { UserSearch } from "@/features/entry/users/UserSearch";
import { cn } from "@/lib/supabase/utils";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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
    <div className={cn(rubik.className, "relative -mx-4 -my-4 min-h-[calc(100vh-4rem)] space-y-4 bg-[#2E2936] px-4 py-5 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:px-6 lg:py-5 2xl:-mx-7 2xl:px-7")}>
      <section className="px-0.5 pt-5">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
            ENTRY DIRECTORY
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white lg:text-[2.05rem]">
            ENTRY users
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#A9A3B2]">
            Find any ENTRY account and manage access, identity, role, and unit
            assignment from one workspace.
          </p>
        </div>
      </section>
      <UserSearch />
    </div>
  );
}
