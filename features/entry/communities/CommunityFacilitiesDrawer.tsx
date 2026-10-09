"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { entryButtonClass } from "@/components/ui/entryButtonStyles";
import { createCommunityFacilitiesAction } from "@/features/entry/communities/actions";
import type {
  CommunityDetailPreviews,
  CommunityFacilityPreview,
} from "@/features/entry/communities/detailQueries";

type FacilityFilter = "all" | "active" | "inactive" | "free" | "paid";

type CommunityFacilitiesDrawerProps = {
  communityId: string;
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
  communityId,
  facilities,
  state,
  triggerLabel = "Manage facilities",
}: CommunityFacilitiesDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FacilityFilter>("all");
  const [facilityName, setFacilityName] = useState("");
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    facilities[0]?.id ?? null,
  );
  const [isCreating, startCreateTransition] = useTransition();

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

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const effectiveSelectedId =
    selectedId && filteredFacilities.some((facility) => facility.id === selectedId)
      ? selectedId
      : filteredFacilities[0]?.id ?? null;

  const selectedFacility =
    filteredFacilities.find((facility) => facility.id === effectiveSelectedId) ??
    filteredFacilities[0] ??
    facilities[0] ??
    null;
  const activeCount = facilities.filter((facility) => facility.isActive).length;
  const stateCopy = getFacilityStateCopy(state, facilities.length > 0);
  const canCreateFacilities = state !== "disabled" && state !== "unavailable";

  function submitFacility() {
    setCreateMessage(null);
    setCreateError(null);

    startCreateTransition(async () => {
      const result = await createCommunityFacilitiesAction({
        communityId,
        facilityNames: [facilityName],
      });

      if (!result.success) {
        setCreateError(result.error ?? "Could not add this facility.");
        return;
      }

      setFacilityName("");
      setCreateMessage(
        result.insertedFacilities === 1
          ? "Facility added successfully."
          : "Facilities added successfully.",
      );
      router.refresh();
    });
  }

  const addFacilityForm = canCreateFacilities ? (
    <div className="rounded-[10px] border border-[#141119] bg-[#24202B] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
            Add facility
          </span>
          <input
            id="entry-community-facility-name"
            name="entry_community_facility_name"
            autoComplete="off"
            value={facilityName}
            onChange={(event) => setFacilityName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (facilityName.trim() && !isCreating) submitFacility();
              }
            }}
            className="mt-2 h-9 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] px-3 text-sm text-white shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
            placeholder="Casa Club, Pool, Gym..."
          />
        </label>
        <button
          type="button"
          disabled={isCreating || !facilityName.trim()}
          onClick={submitFacility}
          className={entryButtonClass("primary", "sm:w-[150px]")}
        >
          <Plus className="size-3.5" aria-hidden />
          {isCreating ? "Adding..." : "Add facility"}
        </button>
      </div>
      {createMessage ? (
        <p className="mt-2 text-sm font-semibold text-emerald-200">
          {createMessage}
        </p>
      ) : null}
      {createError ? (
        <p className="mt-2 text-sm font-semibold text-rose-200">
          {createError}
        </p>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-[190px] items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold leading-none text-white shadow-[0_2px_0_#141119] transition hover:bg-[#342F3D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
      >
        <span className="whitespace-nowrap">{triggerLabel}</span>
        <ChevronRight className="size-3.5 shrink-0" aria-hidden />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <button
            type="button"
            aria-label="Close facilities drawer"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-4xl flex-col border-l border-[#141119] bg-[#26222F] shadow-[-28px_0_80px_rgba(0,0,0,0.42)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#141119] px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#BEB4FF]">
                  Entry community
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Facilities workspace
                </h2>
                <p className="mt-1 text-sm text-[#8F879D]">
                  Review reservable spaces without leaving the operational workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#8F879D] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
                aria-label="Close facilities drawer"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="grid border-b border-[#141119] bg-[#24202B] md:grid-cols-3">
              <div className="min-h-[88px] border-t border-white/[0.07] px-5 py-4 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0">
                <p className="text-xs uppercase tracking-[0.18em] text-[#8F879D]">
                  Total facilities
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {facilities.length}
                </p>
              </div>
              <div className="min-h-[88px] border-t border-white/[0.07] px-5 py-4 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0">
                <p className="text-xs uppercase tracking-[0.18em] text-[#8F879D]">
                  Active
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {activeCount}
                </p>
              </div>
              <div className="min-h-[88px] border-t border-white/[0.07] px-5 py-4 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0">
                <p className="text-xs uppercase tracking-[0.18em] text-[#8F879D]">
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

            <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
              {stateCopy ? (
                <div className="grid min-h-0 flex-1 place-items-center rounded-lg border border-dashed border-[#141119] bg-[#24202B] px-6 text-center">
                  <div className="w-full max-w-xl">
                    <p className="text-lg font-semibold text-white">
                      {stateCopy.title}
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-[#8F879D]">
                      {stateCopy.body}
                    </p>
                    <div className="mt-5 text-left">{addFacilityForm}</div>
                  </div>
                </div>
              ) : (
                <>
                  {addFacilityForm}
                  <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <label className="relative block min-w-0 flex-1">
                      <span className="sr-only">Search facilities</span>
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8F879D]"
                        aria-hidden
                      />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search facility name or price..."
                        className="h-9 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] pl-9 pr-3 text-sm text-white shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                    {filters.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setFilter(item.value)}
                        className={entryButtonClass(
                          filter === item.value ? "primary" : "secondary",
                          "min-w-[68px]",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                    </div>
                  </div>

                  <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B]">
                    <div className="grid grid-cols-[minmax(180px,1.2fr)_110px_120px_120px_110px] border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8F879D]">
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
                          <p className="mt-2 text-sm text-[#8F879D]">
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
                              className={`grid w-full grid-cols-[minmax(180px,1.2fr)_110px_120px_120px_110px] items-center rounded-lg border px-3 py-3 text-left text-sm transition ${
                                selected
                                  ? "border-[#7553FF] bg-[rgba(117,83,255,0.10)] shadow-[0_12px_34px_rgba(112,104,255,0.16)]"
                                  : "border-transparent hover:border-[#141119] hover:bg-white/5"
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
                              <span className="text-right text-[#8F879D]">
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

            <div className="border-t border-[#141119] bg-[#211D28] px-5 py-4">
              {selectedFacility ? (
                <div className="rounded-[10px] border border-[#141119] bg-[#24202B] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="grid h-16 w-16 place-items-center rounded-lg bg-[#7553FF] text-2xl text-white">
                        F
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#BEB4FF]">
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
                    <span className="inline-flex h-7 items-center rounded-[4px] border border-[#141119] bg-[#2E2936] px-2.5 text-[10px] font-semibold text-[#8F879D]">
                      Read-only
                    </span>
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
                        className="rounded-lg border border-white/8 bg-[#2E2936] px-4 py-3"
                      >
                        <p className="text-xs text-[#8F879D]">{label}</p>
                        <p className="mt-2 text-sm font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {[
                      "Edit facility",
                      "Disable facility",
                      "Configure reservations",
                    ].map((label) => (
                      <button
                        key={label}
                        type="button"
                        disabled
                        className={entryButtonClass(
                          "secondary",
                          "w-full justify-center text-[#8F879D]",
                        )}
                      >
                        {label}
                        <span className="text-[9px] font-medium text-[#6F6878]">Soon</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[#141119] bg-white/3 px-4 py-5 text-sm text-[#8F879D]">
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
