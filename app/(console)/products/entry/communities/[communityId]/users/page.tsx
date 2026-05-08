import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(8,12,22,0.98))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.28)] backdrop-blur xl:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">
                Minerva Console
              </p>
              <span className="inline-flex items-center rounded-full bg-violet-500/14 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200 ring-1 ring-inset ring-violet-400/20">
                ENTRY
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                Community users
              </h1>
              <Badge tone={data.community.isActive ? "success" : "default"}>
                {data.community.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-lg font-semibold text-violet-100">{data.community.name}</p>
            <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
              Searchable support workspace for residents, admins, and guards in this
              community.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={`/products/entry/communities/${data.community.id}`}>
              <Button variant="secondary">Community detail</Button>
            </Link>
            <Link href="/products/entry/communities">
              <Button variant="secondary">Back to communities</Button>
            </Link>
          </div>
        </div>
      </section>

      <CommunityUsersClient
        community={data.community}
        houses={data.houses}
        initialUsers={data.users}
        loadError={data.usersError}
      />
    </div>
  );
}
