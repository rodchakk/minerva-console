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
      className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(2,6,23,0.22)] backdrop-blur"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] lg:items-end">
        <div className="space-y-2">
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
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-[var(--primary)]"
          >
            <option value="">Select a community</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name} {community.city ? `• ${community.city}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
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
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-[var(--primary)]"
          >
            {ACTIVATION_QUEUE_STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Apply filters</Button>
          <Link href="/products/entry/activation">
            <Button type="button" variant="secondary">
              Clear
            </Button>
          </Link>
        </div>
      </div>
    </form>
  );
}
