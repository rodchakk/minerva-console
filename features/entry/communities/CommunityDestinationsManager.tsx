"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  createCommunityDestinationAction,
  renameCommunityDestinationAction,
  setCommunityDestinationActiveAction,
  updateCommunityDestinationOrderAction,
} from "@/features/entry/communities/actions";
import type {
  CommunityDestinationPreview,
  CommunityDetailPreviews,
} from "@/features/entry/communities/detailQueries";

type CommunityDestinationsManagerProps = {
  activeCount: number;
  communityId: string;
  communityName: string;
  destinations: CommunityDestinationPreview[];
  state: CommunityDetailPreviews["destinations"]["state"];
};

function EmptyDestinations({ state }: { state: CommunityDestinationsManagerProps["state"] }) {
  if (state === "unavailable") {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-strong)] px-4 py-5 text-sm text-[var(--text-muted)]">
        Destination catalog is not available yet. Apply the ENTRY manual access migration first.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-strong)] px-4 py-5 text-sm text-[var(--text-muted)]">
      No internal destinations configured yet.
    </div>
  );
}

export function CommunityDestinationsManager({
  activeCount,
  communityId,
  communityName,
  destinations,
  state,
}: CommunityDestinationsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const sortedDestinations = useMemo(
    () =>
      [...destinations].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      }),
    [destinations],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Community
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{communityName}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Destinations
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{destinations.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Active
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{activeCount}</p>
        </div>
      </div>

      <form action={createCommunityDestinationAction} className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
        <input type="hidden" name="community_id" value={communityId} />
        <input
          name="name"
          required
          placeholder="New destination"
          className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/50"
        />
        <input
          name="category"
          placeholder="Category"
          className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/50"
        />
        <Button type="submit">Create</Button>
      </form>

      {sortedDestinations.length === 0 ? (
        <EmptyDestinations state={state} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-strong)]">
          {sortedDestinations.map((destination, index) => {
            const isEditing = editingId === destination.id;
            const canMoveUp = index > 0;
            const canMoveDown = index < sortedDestinations.length - 1;

            return (
              <div
                key={destination.id}
                className="grid gap-3 border-b border-[var(--border)] px-3 py-3 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_110px_160px]"
              >
                <div className="min-w-0">
                  {isEditing ? (
                    <form action={renameCommunityDestinationAction} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                      <input type="hidden" name="community_id" value={communityId} />
                      <input type="hidden" name="destination_id" value={destination.id} />
                      <input
                        name="name"
                        required
                        defaultValue={destination.name}
                        className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-white outline-none focus:border-violet-300/50"
                      />
                      <input
                        name="category"
                        defaultValue={destination.category}
                        placeholder="Category"
                        className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-white outline-none focus:border-violet-300/50"
                      />
                      <div className="flex gap-2">
                        <Button type="submit">Save</Button>
                        <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">
                          {destination.name}
                        </p>
                        <Badge tone={destination.isActive ? "success" : "default"}>
                          {destination.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {destination.category || "No category"} · Order {destination.sortOrder}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <form action={updateCommunityDestinationOrderAction}>
                    <input type="hidden" name="community_id" value={communityId} />
                    <input type="hidden" name="destination_id" value={destination.id} />
                    <input type="hidden" name="direction" value="up" />
                    <Button type="submit" variant="secondary" disabled={!canMoveUp}>
                      Up
                    </Button>
                  </form>
                  <form action={updateCommunityDestinationOrderAction}>
                    <input type="hidden" name="community_id" value={communityId} />
                    <input type="hidden" name="destination_id" value={destination.id} />
                    <input type="hidden" name="direction" value="down" />
                    <Button type="submit" variant="secondary" disabled={!canMoveDown}>
                      Down
                    </Button>
                  </form>
                </div>

                <div className="flex items-center justify-start gap-2 lg:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEditingId(destination.id)}
                  >
                    Rename
                  </Button>
                  <form action={setCommunityDestinationActiveAction}>
                    <input type="hidden" name="community_id" value={communityId} />
                    <input type="hidden" name="destination_id" value={destination.id} />
                    <input
                      type="hidden"
                      name="is_active"
                      value={destination.isActive ? "false" : "true"}
                    />
                    <Button
                      type="submit"
                      variant={destination.isActive ? "danger" : "secondary"}
                    >
                      {destination.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
