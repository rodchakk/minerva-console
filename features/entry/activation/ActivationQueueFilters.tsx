import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ACTIVATION_QUEUE_STATUS_OPTIONS } from "@/features/entry/activation/actions";
import type { CommunityWithProgressItem } from "@/features/entry/communities/queries";

type ActivationQueueFiltersProps = {
  communities: CommunityWithProgressItem[];
  selectedCommunityId: string;
  selectedStatus: string;
};

export function ActivationQueueFilters({
  communities,
  selectedCommunityId,
  selectedStatus,
}: ActivationQueueFiltersProps) {
  return (
    <form
      action="/products/entry/activation"
      className="rounded-[22px] border border-[var(--border)] bg-[rgba(16,20,29,0.86)] p-3.5 shadow-[0_12px_30px_rgba(2,6,23,0.16)] backdrop-blur"
    >
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] xl:items-end">
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium text-slate-200"
            htmlFor="activation-community"
          >
            Community
          </label>
          <select
            id="activation-community"
            name="community_id"
            defaultValue={selectedCommunityId}
            className="h-11 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-slate-100 outline-none transition focus:border-violet-400/50"
          >
            <option value="">Select a community</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name} {community.city ? `• ${community.city}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            className="text-sm font-medium text-slate-200"
            htmlFor="activation-status"
          >
            Status
          </label>
          <select
            id="activation-status"
            name="status"
            defaultValue={selectedStatus}
            className="h-11 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-4 text-sm text-slate-100 outline-none transition focus:border-violet-400/50"
          >
            {ACTIVATION_QUEUE_STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3 xl:justify-end">
          <Button type="submit" className="min-w-28">
            Apply filters
          </Button>
          <Link href="/products/entry/activation">
            <Button type="button" variant="secondary" className="min-w-20">
              Clear
            </Button>
          </Link>
        </div>
      </div>
    </form>
  );
}
