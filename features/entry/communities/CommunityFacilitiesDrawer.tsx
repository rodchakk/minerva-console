"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import type {
  CommunityDetailPreviews,
  CommunityFacilityPreview,
} from "@/features/entry/communities/detailQueries";

type FacilityFilter = "all" | "active" | "inactive" | "free" | "paid";

type CommunityFacilitiesDrawerProps = {
  facilities: CommunityFacilityPreview[];
  state: CommunityDetailPreviews["facilities"]["state"];
  triggerLabel?: string;
};

const filters: Array<{ label: string; value: FacilityFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Free", value: "free" },
  { label: "Paid", value: "paid" },
];

function getFacilityStateCopy(
  state: CommunityFacilitiesDrawerProps["state"],
  hasResults: boolean,
) {
  if (state === "disabled") {
    return {
      body: "Reservations are disabled for this community.",
      title: "Reservations disabled",
    };
  }

  if (state === "unavailable") {
    return {
      body: "The facilities preview could not be loaded right now.",
      title: "Preview unavailable",
    };
  }

  if (!hasResults || state === "empty") {
    return {
      body: "Add facilities later to prepare reservation-ready spaces.",
      title: "No facilities configured",
    };
  }

  return null;
}

export function CommunityFacilitiesDrawer({
  facilities,
  state,
  triggerLabel = "Manage facilities",
}: CommunityFacilitiesDrawerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FacilityFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    facilities[0]?.id ?? null,
  );

  const filteredFacilities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return facilities.filter((facility) => {
      const matchesQuery =
        !normalizedQuery ||
        facility.name.toLowerCase().includes(normalizedQuery) ||
        facility.pricePerSlot.toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      switch (filter) {
        case "active":
          return facility.isActive;
        case "inactive":
          return !facility.isActive;
        case "free":
          return facility.pricePerSlot === "Free";
        case "paid":
          return facility.pricePerSlot !== "Free";
        default:
          return true;
      }
    });
  }, [facilities, filter, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (filteredFacilities.length === 0) {
      setSelectedId(null);
      return;
    }

    if (
      !selectedId ||
      !filteredFacilities.some((facility) => facility.id === selectedId)
    ) {
      setSelectedId(filteredFacilities[0]?.id ?? null);
    }
  }, [filteredFacilities, open, selectedId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const selectedFacility =
    filteredFacilities.find((facility) => facility.id === selectedId) ??
    filteredFacilities[0] ??
    facilities[0] ??
    null;
  const activeCount = facilities.filter((facility) => facility.isActive).length;
  const stateCopy = getFacilityStateCopy(state, facilities.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-violet-200 transition hover:text-white"
      >
        {triggerLabel} {"->"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <button
            type="button"
            aria-label="Close facilities drawer"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-4xl flex-col border-l border-white/10 bg-[rgba(7,11,22,0.98)] shadow-[-28px_0_80px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                  Entry community
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Facilities workspace
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Review reservable spaces without leaving the operational workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl text-[var(--text-muted)] transition hover:border-violet-300/40 hover:text-white"
                aria-label="Close facilities drawer"
              >
                x
              </button>
            </div>

            <div className="grid gap-4 border-b border-white/10 px-6 py-5 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-[var(--surface)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Total facilities
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {facilities.length}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-[var(--surface)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Active
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {activeCount}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-[var(--surface)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Readiness
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {state === "live"
                    ? "Preview ready"
                    : state === "disabled"
                      ? "Reservations off"
                      : state === "unavailable"
                        ? "Preview blocked"
                        : "Awaiting setup"}
                </p>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
              {stateCopy ? (
                <div className="grid min-h-0 flex-1 place-items-center rounded-[28px] border border-dashed border-white/10 bg-[var(--surface)] px-6 text-center">
                  <div>
                    <p className="text-lg font-semibold text-white">{stateCopy.title}</p>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      {stateCopy.body}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <label className="relative block">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                      /
                    </span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by facility name or price..."
                      className="h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/50"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {filters.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setFilter(item.value)}
                        className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                          filter === item.value
                            ? "border-violet-300/50 bg-[var(--primary)] text-white shadow-[0_14px_32px_rgba(112,104,255,0.28)]"
                            : "border-white/10 bg-white/5 text-[var(--text-muted)] hover:border-violet-300/40 hover:text-white"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-[var(--surface)]">
                    <div className="grid grid-cols-[minmax(180px,1.2fr)_110px_120px_120px_110px] border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      <span>Facility</span>
                      <span className="text-center">Status</span>
                      <span className="text-center">Slot</span>
                      <span className="text-center">Price</span>
                      <span className="text-right">Hours</span>
                    </div>

                    {filteredFacilities.length === 0 ? (
                      <div className="grid h-64 place-items-center px-6 text-center">
                        <div>
                          <p className="text-base font-semibold text-white">
                            No facilities match this view
                          </p>
                          <p className="mt-2 text-sm text-[var(--text-muted)]">
                            Try another filter or clear the search field.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="max-h-[46vh] overflow-y-auto px-3 py-3">
                        {filteredFacilities.map((facility) => {
                          const selected = facility.id === selectedFacility?.id;

                          return (
                            <button
                              key={facility.id}
                              type="button"
                              onClick={() => setSelectedId(facility.id)}
                              className={`grid w-full grid-cols-[minmax(180px,1.2fr)_110px_120px_120px_110px] items-center rounded-2xl border px-3 py-3 text-left text-sm transition ${
                                selected
                                  ? "border-violet-300/50 bg-violet-400/12 shadow-[0_12px_34px_rgba(112,104,255,0.16)]"
                                  : "border-transparent hover:border-white/10 hover:bg-white/5"
                              }`}
                            >
                              <span className="font-semibold text-white">{facility.name}</span>
                              <span className="text-center">
                                <Badge tone={facility.isActive ? "success" : "default"}>
                                  {facility.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </span>
                              <span className="text-center font-semibold text-white">
                                {facility.slotMinutes} min
                              </span>
                              <span className="text-center font-semibold text-white">
                                {facility.pricePerSlot}
                              </span>
                              <span className="text-right text-[var(--text-muted)]">
                                {facility.opensAt} - {facility.closesAt}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-white/10 bg-[rgba(9,12,24,0.84)] px-6 py-5">
              {selectedFacility ? (
                <div className="rounded-[28px] border border-white/10 bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--primary)] text-2xl text-white">
                        F
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                          Selected facility
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold text-white">
                            {selectedFacility.name}
                          </h3>
                          <Badge tone={selectedFacility.isActive ? "success" : "default"}>
                            {selectedFacility.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[var(--text-muted)]">
                      Read-only
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    {[
                      [
                        "Operating hours",
                        `${selectedFacility.opensAt} - ${selectedFacility.closesAt}`,
                      ],
                      ["Slot duration", `${selectedFacility.slotMinutes} minutes`],
                      ["Price per slot", selectedFacility.pricePerSlot],
                      ["Currency", selectedFacility.currency],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-white/8 bg-[var(--surface-strong)] px-4 py-3"
                      >
                        <p className="text-xs text-[var(--text-muted)]">{label}</p>
                        <p className="mt-2 text-sm font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                      "Edit facility",
                      "Disable facility",
                      "Configure reservations",
                    ].map((label) => (
                      <button
                        key={label}
                        type="button"
                        disabled
                        className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]"
                      >
                        {label} <span className="ml-2 text-xs">Coming soon</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm text-[var(--text-muted)]">
                  Select a facility to see details here.
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
