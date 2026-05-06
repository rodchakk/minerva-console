"use client";

import { useEffect, useMemo, useState } from "react";
import type { CommunityFacilityPreview } from "@/features/entry/communities/detailQueries";

type FacilityFilter = "all" | "active" | "inactive" | "priced" | "free";

type CommunityFacilitiesDrawerProps = {
  disabled?: boolean;
  facilities: CommunityFacilityPreview[];
  state: "live" | "empty" | "unavailable" | "disabled";
  triggerLabel?: string;
};

const filters: Array<{ label: string; value: FacilityFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Priced", value: "priced" },
  { label: "Free", value: "free" },
];

function isFreeFacility(facility: CommunityFacilityPreview) {
  return facility.pricePerSlot.toLowerCase() === "free";
}

function FacilityStatusBadge({ facility }: { facility: CommunityFacilityPreview }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        facility.isActive
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/7 text-[var(--text-muted)]"
      }`}
    >
      {facility.isActive ? "Active" : "Inactive"}
    </span>
  );
}

function DisabledAction({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]"
    >
      {label} <span className="ml-2 text-xs">Coming soon</span>
    </button>
  );
}

export function CommunityFacilitiesDrawer({
  disabled = false,
  facilities,
  state,
  triggerLabel = "Manage facilities",
}: CommunityFacilitiesDrawerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FacilityFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(facilities[0]?.id ?? null);

  const canOpen = !disabled && state !== "disabled" && state !== "unavailable";

  const filteredFacilities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return facilities.filter((facility) => {
      const matchesQuery =
        !normalizedQuery || facility.name.toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      switch (filter) {
        case "active":
          return facility.isActive;
        case "inactive":
          return !facility.isActive;
        case "priced":
          return !isFreeFacility(facility);
        case "free":
          return isFreeFacility(facility);
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
    null;

  return (
    <>
      <button
        type="button"
        onClick={() => canOpen && setOpen(true)}
        disabled={!canOpen}
        className={`text-sm font-semibold transition ${
          canOpen
            ? "text-violet-200 hover:text-white"
            : "cursor-not-allowed text-[var(--text-muted)]"
        }`}
      >
        {triggerLabel} {canOpen ? "→" : ""}
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
                  Facilities Directory
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Review reservable areas, hours, pricing, and readiness without leaving review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl text-[var(--text-muted)] transition hover:border-violet-300/40 hover:text-white"
                aria-label="Close facilities drawer"
              >
                ×
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
              <label className="relative block">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                  ⌕
                </span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search facilities..."
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
                <div className="grid grid-cols-[minmax(160px,1fr)_120px_130px_130px_120px] border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <span>Facility</span>
                  <span className="text-center">Slot</span>
                  <span className="text-center">Price</span>
                  <span className="text-center">Hours</span>
                  <span className="text-right">Status</span>
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
                          className={`grid w-full grid-cols-[minmax(160px,1fr)_120px_130px_130px_120px] items-center rounded-2xl border px-3 py-3 text-left text-sm transition ${
                            selected
                              ? "border-violet-300/50 bg-violet-400/12 shadow-[0_12px_34px_rgba(112,104,255,0.16)]"
                              : "border-transparent hover:border-white/10 hover:bg-white/5"
                          }`}
                        >
                          <span className="font-semibold text-white">{facility.name}</span>
                          <span className="text-center font-semibold text-white">
                            {facility.slotMinutes || "—"} min
                          </span>
                          <span className="text-center text-[var(--text-muted)]">
                            {facility.pricePerSlot}
                          </span>
                          <span className="text-center text-[var(--text-muted)]">
                            {facility.opensAt}–{facility.closesAt}
                          </span>
                          <span className="text-right">
                            <FacilityStatusBadge facility={facility} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 bg-[rgba(9,12,24,0.84)] px-6 py-5">
              {selectedFacility ? (
                <div className="rounded-[28px] border border-white/10 bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--primary)] text-2xl text-white">
                        ◇
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                          Selected facility
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold text-white">
                            {selectedFacility.name}
                          </h3>
                          <FacilityStatusBadge facility={selectedFacility} />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-5">
                    {[
                      ["Hours", `${selectedFacility.opensAt} to ${selectedFacility.closesAt}`],
                      ["Slot minutes", selectedFacility.slotMinutes || "Not set"],
                      ["Price", selectedFacility.pricePerSlot],
                      ["Currency", selectedFacility.currency],
                      ["Status", selectedFacility.isActive ? "Active" : "Inactive"],
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
                    <DisabledAction label="Edit facility" />
                    <DisabledAction label="Disable facility" />
                    <DisabledAction label="View reservation activity" />
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
