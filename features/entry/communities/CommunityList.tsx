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
          className="rounded-[28px] border border-[var(--border)] bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1 space-y-4">
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
              </div>

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

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                <Button
                  variant="secondary"
                  disabled
                  aria-label={`View details for ${community.name} coming soon`}
                >
                  View details
                </Button>
                <Button
                  variant="secondary"
                  disabled
                  aria-label={`Edit settings for ${community.name} coming soon`}
                >
                  Edit settings
                </Button>
                <span className="text-xs font-medium text-slate-500">
                  Coming soon
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[360px] xl:max-w-[360px]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Unit label
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {community.unitLabel}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Total units
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {community.totalUnits}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  Total members
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {community.totalMembers}
                </p>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
