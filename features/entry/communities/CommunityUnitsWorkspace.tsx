"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { CommunityUnitPreview } from "@/features/entry/communities/detailQueries";
import { cn } from "@/lib/supabase/utils";

type UnitFilter = "all" | "active" | "occupied" | "no_residents" | "recent_access";

type CommunityUnitsWorkspaceProps = {
  communityId: string;
  units: CommunityUnitPreview[];
};

function DimensionalLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const primary = variant === "primary";

  return (
    <Link
      href={href}
      className={cn(
        "relative isolate inline-flex h-9 items-center justify-center rounded-[7px] px-3.5 text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2E2936]",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 -z-20 rounded-[7px]",
          primary
            ? "bg-[#120539] shadow-[0_2px_0_#120539]"
            : "bg-[#141119] shadow-[0_2px_0_#141119]",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 -translate-y-0.5 rounded-[7px] border",
          primary
            ? "border-[#120539] bg-[#7553FF]"
            : "border-[#141119] bg-[#2E2936]",
        )}
      />
      <span className="relative -translate-y-0.5 inline-flex items-center gap-2">
        {children}
      </span>
    </Link>
  );
}

function matchesFilter(unit: CommunityUnitPreview, filter: UnitFilter) {
  switch (filter) {
    case "active":
      return unit.isActive;
    case "occupied":
      return unit.residentCount > 0;
    case "no_residents":
      return unit.residentCount === 0;
    case "recent_access":
      return unit.lastAccess !== "Not available";
    case "all":
    default:
      return true;
  }
}

export function CommunityUnitsWorkspace({
  communityId,
  units,
}: CommunityUnitsWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UnitFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleUnits = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return units.filter((unit) => {
      const matchesQuery =
        !normalized ||
        [
          unit.label,
          unit.ownerName,
          unit.primaryResidentName,
          String(unit.activeResidents),
          String(unit.activePasses),
          unit.lastAccess,
          ...unit.residents.map((resident) => resident.fullName),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      return matchesQuery && matchesFilter(unit, filter);
    });
  }, [filter, query, units]);

  const selectedUnit =
    units.find((unit) => unit.id === selectedId) ?? null;

  return (
    <>
      <section
        id="units"
        className="relative overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]"
      >
        <div className="flex flex-col gap-4 border-b border-[#141119] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">
              Units
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#A9A3B2]">
              Community units, resident counts, access activity, and ownership status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[230px] flex-1 lg:w-[260px] lg:flex-none">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#A9A3B2]"
                aria-hidden
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search units..."
                className="h-9 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] pl-10 pr-3 text-sm text-[#E7E5EA] shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
              />
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((value) => !value)}
                className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
              >
                <Filter className="size-4" aria-hidden />
                Filters
                {filter !== "all" ? (
                  <span className="size-1.5 rounded-full bg-[#7553FF]" />
                ) : null}
              </button>

              {filterOpen ? (
                <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
                  <div className="flex items-center justify-between border-b border-[#141119] px-3.5 py-3">
                    <p className="text-sm font-semibold text-white">Filter units</p>
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      className="text-[#8F879D] hover:text-white"
                      aria-label="Close filters"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>

                  <div className="space-y-1 p-3">
                    {[
                      ["all", "All units"],
                      ["active", "Active units"],
                      ["occupied", "With residents"],
                      ["no_residents", "No residents"],
                      ["recent_access", "Recent access"],
                    ].map(([value, label]) => {
                      const selected = filter === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFilter(value as UnitFilter)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm",
                            selected
                              ? "bg-[rgba(117,83,255,0.10)] text-white"
                              : "text-[#D3CEDA] hover:bg-white/[0.03] hover:text-white",
                          )}
                        >
                          <span>{label}</span>
                          <span
                            className={cn(
                              "size-3.5 rounded-[3px] border",
                              selected
                                ? "border-[#7553FF] bg-[#7553FF]"
                                : "border-white/20",
                            )}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between border-t border-[#141119] px-3.5 py-3">
                    <button
                      type="button"
                      onClick={() => setFilter("all")}
                      className="text-xs font-medium text-[#A9A3B2] hover:text-white"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      className="rounded-md border border-[#120539] bg-[#7553FF] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_0_#120539]"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <Link
              href={"/products/entry/communities/" + communityId + "/units"}
              className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#141119]"
            >
              View full directory
              <ChevronRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>

        {visibleUnits.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full table-fixed text-left">
              <colgroup>
                <col className="w-[23%]" />
                <col className="w-[24%]" />
                <col className="w-[15%]" />
                <col className="w-[14%]" />
                <col className="w-[20%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#1F1B26] text-[10px] uppercase tracking-[0.14em] text-[#8F879D]">
                  <th className="border-b border-[#141119] px-5 py-3 font-medium">Unit</th>
                  <th className="border-b border-[#141119] px-4 py-3 font-medium">Owner</th>
                  <th className="border-b border-[#141119] px-4 py-3 font-medium">Residents</th>
                  <th className="border-b border-[#141119] px-4 py-3 font-medium">Passes</th>
                  <th className="border-b border-[#141119] px-4 py-3 font-medium">Last access</th>
                  <th className="border-b border-[#141119] px-4 py-3 font-medium" aria-label="Open details" />
                </tr>
              </thead>
              <tbody>
                {visibleUnits.slice(0, 8).map((unit) => {
                  const selected = selectedUnit?.id === unit.id;

                  return (
                    <tr
                      key={unit.id}
                      tabIndex={0}
                      onClick={() => setSelectedId(unit.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(unit.id);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-b border-[#141119] outline-none transition-colors last:border-b-0 hover:bg-white/[0.02] focus-visible:shadow-[inset_0_0_0_2px_#7553FF]",
                        selected &&
                          "bg-[rgba(117,83,255,0.075)] shadow-[inset_2px_0_0_#7553FF,inset_0_1px_0_rgba(117,83,255,0.35),inset_0_-1px_0_rgba(117,83,255,0.35)]",
                      )}
                    >
                      <td className="px-5 py-4 align-top">
                        <p className="truncate text-sm font-semibold text-white">{unit.label}</p>
                        <p className="mt-1 text-xs text-[#8F879D]">
                          {unit.isActive ? "Active unit" : "Inactive unit"}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-[#CFC9D6]">
                        {unit.ownerName}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <span className="size-2 rounded-full bg-[#67D7A5]" />
                          {unit.activeResidents} active
                        </div>
                        <p className="mt-1 text-xs text-[#8F879D]">
                          {unit.residentCount} linked
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top text-sm font-semibold text-white">
                        {unit.activePasses}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-[#CFC9D6]">
                        {unit.lastAccess}
                      </td>
                      <td className="px-4 py-4 align-middle text-right">
                        <ChevronRight
                          className={cn(
                            "ml-auto size-4",
                            selected ? "text-[#D8D1FF]" : "text-[#8F879D]",
                          )}
                          aria-hidden
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {visibleUnits.length > 8 ? (
              <div className="border-t border-[#141119] px-5 py-3 text-xs text-[#8F879D]">
                Showing 8 of {visibleUnits.length} matching units. Open the full directory to see all units.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-semibold text-white">No units match this view</p>
            <p className="mt-1 text-sm text-[#A9A3B2]">
              Clear the search or filters to show units again.
            </p>
          </div>
        )}
      </section>

      {selectedUnit ? (
        <aside className="fixed bottom-5 right-5 top-[76px] z-50 hidden w-[430px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-[#141119] bg-[#26222F] shadow-[0_24px_70px_rgba(0,0,0,0.42)] xl:grid">
          <div className="border-b border-[#141119] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#BEB4FF]">
                  Community unit
                </p>
                <h3 className="mt-2 truncate text-lg font-semibold text-white">
                  {selectedUnit.label}
                </h3>
                <p className="mt-1 text-xs text-[#A9A3B2]">
                  Unit details and current operational state
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-[#8F879D] hover:text-white"
                aria-label="Close unit details"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <span className="inline-flex min-h-6 items-center rounded-[4px] border border-[rgba(103,215,165,0.20)] bg-[rgba(103,215,165,0.06)] px-2 py-1 text-xs font-medium text-[#8EE2B9]">
                {selectedUnit.isActive ? "Active" : "Inactive"}
              </span>
              {selectedUnit.pendingActivations > 0 ? (
                <span className="inline-flex min-h-6 items-center rounded-[4px] border border-[rgba(228,194,106,0.24)] bg-[rgba(228,194,106,0.06)] px-2 py-1 text-xs font-medium text-[#F0D995]">
                  {selectedUnit.pendingActivations} pending activation
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-4">
            <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
              <div className="border-b border-white/[0.07] px-4 py-3">
                <p className="text-sm font-semibold text-white">Current state</p>
              </div>
              {[
                ["Owner", selectedUnit.ownerName],
                ["Active residents", String(selectedUnit.activeResidents)],
                ["Linked residents", String(selectedUnit.residentCount)],
                ["Active passes", String(selectedUnit.activePasses)],
                ["Pending activations", String(selectedUnit.pendingActivations)],
                ["Last access", selectedUnit.lastAccess],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[135px_minmax(0,1fr)] gap-3 border-b border-white/[0.06] px-4 py-3 text-xs last:border-b-0"
                >
                  <span className="text-[#8F879D]">{label}</span>
                  <span className="break-words text-white">{value}</span>
                </div>
              ))}
            </section>

            <section className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
              <div className="border-b border-white/[0.07] px-4 py-3">
                <p className="text-sm font-semibold text-white">Residents</p>
              </div>
              {selectedUnit.residents.length > 0 ? (
                <div className="divide-y divide-white/[0.06]">
                  {selectedUnit.residents.slice(0, 6).map((resident) => (
                    <div key={resident.userId} className="px-4 py-3">
                      <p className="text-xs font-semibold text-white">{resident.fullName}</p>
                      <p className="mt-1 text-[11px] text-[#8F879D]">
                        {resident.isPrimary ? "Primary resident" : resident.role} · {resident.status}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-4 text-xs text-[#A9A3B2]">
                  No resident details are linked to this unit.
                </p>
              )}
            </section>

            <section className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
              <div className="border-b border-white/[0.07] px-4 py-3">
                <p className="text-sm font-semibold text-white">Access context</p>
              </div>
              <div className="px-4 py-4">
                <p className="text-xs text-[#A9A3B2]">
                  {selectedUnit.activePasses > 0
                    ? selectedUnit.activePasses + " active frequent-access pass(es) are linked to this unit."
                    : "No active frequent-access passes are currently linked."}
                </p>
              </div>
            </section>
          </div>

          <div className="border-t border-[#141119] bg-[#26222F] p-4">
            <DimensionalLink
              href={
                "/products/entry/communities/" +
                communityId +
                "/units/" +
                selectedUnit.id
              }
              className="w-full"
            >
              Open unit
              <ChevronRight className="size-3.5" aria-hidden />
            </DimensionalLink>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <DimensionalLink
                href={"/products/entry/communities/" + communityId + "/users"}
                variant="secondary"
                className="w-full"
              >
                Manage residents
              </DimensionalLink>
              <DimensionalLink
                href={
                  "/products/entry/activation?community_id=" +
                  encodeURIComponent(communityId)
                }
                variant="secondary"
                className="w-full"
              >
                Activation queue
              </DimensionalLink>
            </div>
          </div>
        </aside>
      ) : null}

      {selectedUnit ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#26222F] xl:hidden">
          <div className="flex items-center justify-between border-b border-[#141119] px-4 py-4">
            <div>
              <p className="text-xs font-semibold text-white">{selectedUnit.label}</p>
              <p className="mt-1 text-[11px] text-[#8F879D]">Unit details</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="text-[#8F879D]"
              aria-label="Close unit details"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-[#A9A3B2]">
              {selectedUnit.ownerName} · {selectedUnit.activeResidents} active residents · {selectedUnit.activePasses} passes
            </p>
          </div>
          <div className="border-t border-[#141119] p-4">
            <DimensionalLink
              href={
                "/products/entry/communities/" +
                communityId +
                "/units/" +
                selectedUnit.id
              }
              className="w-full"
            >
              Open unit
            </DimensionalLink>
          </div>
        </div>
      ) : null}
    </>
  );
}
