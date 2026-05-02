import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CommunityListItem } from "@/features/entry/communities/queries";

type CommunityListProps = {
  communities: CommunityListItem[];
};

export function CommunityList({ communities }: CommunityListProps) {
  return (
    <div className="space-y-4">
      {communities.map((community) => (
        <article
          key={community.id}
          className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold text-slate-950">
                  {community.name}
                </h3>
                <Badge tone={community.isActive ? "success" : "warning"}>
                  {community.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-slate-600">{community.city}</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone={community.allowFrequentAccess ? "info" : "default"}>
                  Frequent access
                </Badge>
                <Badge tone={community.allowReservations ? "info" : "default"}>
                  Reservations
                </Badge>
                <Badge tone={community.allowMessages ? "info" : "default"}>
                  Messages
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[380px]">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Unit label</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {community.unitLabel}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total units</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {community.totalUnits}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total members</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {community.totalMembers}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" disabled>
              View detail placeholder
            </Button>
            <Button variant="secondary" disabled>
              Edit settings placeholder
            </Button>
            <Link href="/products/entry/communities/new">
              <Button>Create new community</Button>
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
