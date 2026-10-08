"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Filter, MoreHorizontal, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResidentQuickCreate } from "@/features/entry/communities/ResidentQuickCreate";
import { UnitBulkDeleteManager, type BulkDeleteUnit } from "@/features/entry/communities/UnitBulkDeleteManager";
import type {
  CommunityUnitHouseOption,
  CommunityUnitPreview,
  CommunityUnitsSummary,
} from "@/features/entry/communities/detailQueries";
import { cn } from "@/lib/supabase/utils";

type DirectoryFilter =
  | "active"
  | "all"
  | "inactive"
  | "no_residents"
  | "occupied"
  | "pending_activation";

type Props = {
  communityId: string;
  communityName: string;
  houses: CommunityUnitHouseOption[];
  state: "disabled" | "empty" | "live" | "unavailable";
  summary: CommunityUnitsSummary;
  units: CommunityUnitPreview[];
};

const filters: Array<{ label: string; value: DirectoryFilter }> = [
  { label: "All units", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Occupied", value: "occupied" },
  { label: "No residents", value: "no_residents" },
  { label: "Pending activation", value: "pending_activation" },
];

function matchesFilter(unit: CommunityUnitPreview, filter: DirectoryFilter) {
  if (filter === "active") return unit.isActive;
  if (filter === "inactive") return !unit.isActive;
  if (filter === "occupied") return unit.residentCount > 0;
  if (filter === "no_residents") return unit.residentCount === 0;
  if (filter === "pending_activation") return unit.pendingActivations > 0;
  return true;
}

function getRecommendation(unit: CommunityUnitPreview) {
  if (unit.pendingActivations > 0) {
    return {
      title: "Review pending activation",
      description: `${unit.pendingActivations} resident${unit.pendingActivations === 1 ? " is" : "s are"} still waiting in the activation flow.`,
    };
  }
  if (unit.residentCount === 0) {
    return {
      title: "Create or assign a resident",
      description: "This unit currently has no household members linked to it.",
    };
  }
  if (!unit.isActive) {
    return {
      title: "Review inactive unit",
      description: "This unit is inactive. Open its details before restoring access.",
    };
  }
  return {
    title: "No immediate action required",
    description: "This household is active and has no pending activation work.",
  };
}

function Tag({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center whitespace-nowrap rounded-[4px] border px-2 py-1 text-[10px] font-semibold",
        tone === "success" &&
          "border-[rgba(103,215,165,0.20)] bg-[rgba(103,215,165,0.06)] text-[#8EE2B9]",
        tone === "warning" &&
          "border-[rgba(243,202,87,0.22)] bg-[rgba(243,202,87,0.06)] text-[#F2D77B]",
        tone === "default" &&
          "border-white/10 bg-white/[0.025] text-[#C8C1CD]",
      )}
    >
      {children}
    </span>
  );
}

function DimensionalLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="relative isolate inline-flex h-10 items-center justify-center rounded-[7px] px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
    >
      <span
        aria-hidden
        className="absolute inset-0 -z-20 rounded-[7px] bg-[#141119] shadow-[0_2px_0_#141119]"
      />
      <span
        aria-hidden
        className="absolute inset-0 -z-10 -translate-y-0.5 rounded-[7px] border border-[#141119] bg-[#2E2936]"
      />
      <span className="relative -translate-y-0.5 inline-flex items-center gap-2 whitespace-nowrap">
        {children}
      </span>
    </Link>
  );
}

function SummaryMetric({
  active,
  hint,
  label,
  onClick,
  value,
}: {
  active: boolean;
  hint: string;
  label: string;
  onClick: () => void;
  value: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[84px] border-t border-white/[0.07] px-4 py-3.5 text-left transition first:border-t-0 hover:bg-white/[0.015] lg:border-l lg:border-t-0 lg:first:border-l-0",
        active &&
          "bg-[rgba(117,83,255,0.055)] shadow-[inset_0_-2px_0_#7553FF]",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8F879D]">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-[10px] text-[#A9A3B2]">{hint}</p>
    </button>
  );
}

export function CommunityDirectoryWorkspace({
  communityId,
  communityName,
  houses,
  state,
  summary,
  units,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DirectoryFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [desktopWorkspaceHeight, setDesktopWorkspaceHeight] = useState<number | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const visibleUnits = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return units.filter((unit) => {
      const searchable = [
        unit.label,
        unit.ownerName,
        unit.primaryResidentName,
        String(unit.residentCount),
        String(unit.pendingActivations),
        unit.lastAccess,
        ...unit.residents.flatMap((resident) => [
          resident.fullName,
          resident.email,
          resident.phone,
          resident.username,
        ]),
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalized || searchable.includes(normalized)) &&
        matchesFilter(unit, filter)
      );
    });
  }, [filter, query, units]);

  const selectedUnit = units.find((unit) => unit.id === selectedId) ?? null;
  const recommendation = selectedUnit ? getRecommendation(selectedUnit) : null;
  const deleteUnits: BulkDeleteUnit[] = units.map((unit) => ({
    id: unit.id,
    label: unit.label,
  }));

  useEffect(() => {
    function updateWorkspaceHeight() {
      if (window.innerWidth < 1024) {
        setDesktopWorkspaceHeight(null);
        return;
      }

      const top = pageRef.current?.getBoundingClientRect().top ?? 0;
      setDesktopWorkspaceHeight(
        Math.max(520, Math.floor(window.innerHeight - top - 16)),
      );
    }

    updateWorkspaceHeight();
    window.addEventListener("resize", updateWorkspaceHeight);
    return () => window.removeEventListener("resize", updateWorkspaceHeight);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (filterOpen) {
        setFilterOpen(false);
        return;
      }
      if (moreOpen) {
        setMoreOpen(false);
        return;
      }
      if (selectedId) setSelectedId(null);
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (filterOpen && !filterRef.current?.contains(target)) {
        setFilterOpen(false);
      }
      if (moreOpen && !moreRef.current?.contains(target)) {
        setMoreOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [filterOpen, moreOpen, selectedId]);

  function applyFilter(next: DirectoryFilter) {
    setFilter(next);
    setFilterOpen(false);
  }

  return (
    <div
      ref={pageRef}
      style={
        desktopWorkspaceHeight
          ? { height: `${desktopWorkspaceHeight}px` }
          : undefined
      }
      className="-mx-4 -my-4 min-h-[calc(100vh-4rem)] bg-[#2E2936] px-4 py-4 text-[#E7E5EA] lg:-mx-6 lg:-my-5 lg:min-h-0 lg:overflow-hidden lg:px-6 lg:py-5 2xl:-mx-7 2xl:px-7"
    >
      <div className="flex min-h-[calc(100vh-6.5rem)] flex-col gap-3 lg:h-full lg:min-h-0">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
              ENTRY DIRECTORY
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
              Community Directory
            </h1>
            <p className="mt-2 text-sm font-semibold text-white">{communityName}</p>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#A9A3B2]">
              Units, households, residents, access activity, and activation context in one operational directory.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-2.5">
            <DimensionalLink href={`/products/entry/communities/${communityId}`}>
              <ArrowLeft className="size-4" aria-hidden />
              Back to community
            </DimensionalLink>

            <ResidentQuickCreate
              communityId={communityId}
              houses={houses}
              triggerClassName="inline-flex h-10 items-center justify-center rounded-[7px] border border-[#120539] bg-[#7553FF] px-4 text-sm font-semibold text-white shadow-[0_2px_0_#120539] outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
            />

            <div ref={moreRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setMoreOpen((value) => !value);
                  setFilterOpen(false);
                }}
                aria-expanded={moreOpen}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-4 text-sm font-semibold text-white shadow-[0_2px_0_#141119]"
              >
                <MoreHorizontal className="size-4" aria-hidden />
                More
              </button>

              {moreOpen ? (
                <div className="absolute right-0 top-12 z-30 w-60 overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.42)]">
                  <Link
                    href={`/products/entry/activation?community_id=${communityId}`}
                    onClick={() => setMoreOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-xs font-medium text-[#D3CEDA] hover:bg-white/[0.04] hover:text-white"
                  >
                    Activation queue
                  </Link>
                  <Link
                    href={`/products/entry/communities/${communityId}/units/new`}
                    onClick={() => setMoreOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-xs font-medium text-[#D3CEDA] hover:bg-white/[0.04] hover:text-white"
                  >
                    Add unit
                  </Link>
                  <div onClick={() => setMoreOpen(false)}>
                    <UnitBulkDeleteManager
                      communityId={communityId}
                      units={deleteUnits}
                      wrapperClassName=""
                      triggerLabel="Manage / delete units"
                      triggerClassName="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-medium text-[#FFC1CB] hover:bg-[rgba(255,102,126,0.07)] hover:text-white"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="relative grid overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF] lg:grid-cols-4">
          <SummaryMetric
            active={filter === "all"}
            label="Units"
            value={summary.totalUnits}
            hint="All community units"
            onClick={() => applyFilter("all")}
          />
          <SummaryMetric
            active={filter === "occupied"}
            label="Residents"
            value={summary.residentCount}
            hint="Residents linked to units"
            onClick={() => applyFilter("occupied")}
          />
          <SummaryMetric
            active={filter === "pending_activation"}
            label="Pending activation"
            value={summary.pendingActivations}
            hint="Residents still in activation flow"
            onClick={() => applyFilter("pending_activation")}
          />
          <SummaryMetric
            active={filter === "inactive"}
            label="Inactive units"
            value={summary.inactiveUnits}
            hint={summary.inactiveUnits === 0 ? "No units currently inactive" : "Units currently inactive"}
            onClick={() => applyFilter("inactive")}
          />
        </section>

        <section className="relative flex min-h-[560px] flex-1 flex-col overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF] lg:min-h-0">
          <div className="grid gap-3 border-b border-[#141119] px-4 py-3 lg:grid-cols-[auto_minmax(300px,1fr)_auto] lg:items-center">
            <div className="min-w-[210px]">
              <h2 className="text-base font-semibold text-white">Units & households</h2>
              <p className="mt-1 text-[10px] text-[#A9A3B2]">
                {units.length} units · select a row for details
              </p>
            </div>

            <label className="relative block w-full max-w-[580px]">
              <span className="sr-only">Search community directory</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8F879D]"
                aria-hidden
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search unit, resident, owner, reference or phone..."
                className="h-9 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] pl-9 pr-3 text-sm text-[#E7E5EA] shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
              />
            </label>

            <div ref={filterRef} className="relative justify-self-end">
              <button
                type="button"
                onClick={() => {
                  setFilterOpen((value) => !value);
                  setMoreOpen(false);
                }}
                aria-expanded={filterOpen}
                className="inline-flex h-9 min-w-[104px] items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#141119]"
              >
                <Filter className="size-3.5" aria-hidden />
                Filters
                {filter !== "all" ? (
                  <span className="grid size-4 place-items-center rounded-[4px] bg-[#7553FF] text-[9px] text-white">1</span>
                ) : null}
              </button>

              {filterOpen ? (
                <div className="absolute right-0 top-11 z-30 w-72 overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] shadow-[0_18px_45px_rgba(0,0,0,0.42)]">
                  <div className="flex items-center justify-between border-b border-[#141119] px-3.5 py-3">
                    <p className="text-xs font-semibold text-white">Filter directory</p>
                    <button
                      type="button"
                      onClick={() => applyFilter("all")}
                      className="text-[10px] font-semibold text-[#BEB4FF] hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="p-2.5">
                    {filters.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => applyFilter(item.value)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs",
                          filter === item.value
                            ? "bg-[rgba(117,83,255,0.08)] text-white"
                            : "text-[#D3CEDA] hover:bg-white/[0.03] hover:text-white",
                        )}
                      >
                        <span>{item.label}</span>
                        <span
                          className={cn(
                            "size-3.5 rounded-[3px] border",
                            filter === item.value
                              ? "border-[#7553FF] bg-[#7553FF]"
                              : "border-white/20",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {state === "unavailable" ? (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <div>
                <p className="text-sm font-semibold text-white">Directory unavailable</p>
                <p className="mt-1 text-xs text-[#A9A3B2]">Community units could not be loaded right now.</p>
              </div>
            </div>
          ) : visibleUnits.length === 0 ? (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <div>
                <p className="text-sm font-semibold text-white">
                  {units.length === 0 ? "No units created yet" : "No units match this view"}
                </p>
                <p className="mt-1 text-xs text-[#A9A3B2]">
                  {units.length === 0
                    ? "Add the first unit to begin building the community directory."
                    : "Clear the search or filters to show units again."}
                </p>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable] [touch-action:pan-y]">
              <table className="w-full min-w-[1120px] table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[23%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[17%]" />
                  <col className="w-[9%]" />
                  <col className="w-9" />
                </colgroup>
                <thead className="sticky top-0 z-10 border-b border-[#141119] bg-[#1F1B26] text-[#8F879D]">
                  <tr className="text-[10px] uppercase tracking-[0.13em]">
                    <th className="px-3 py-2.5 font-semibold">Unit</th>
                    <th className="px-3 py-2.5 font-semibold">Primary resident</th>
                    <th className="px-3 py-2.5 font-semibold">Residents</th>
                    <th className="px-3 py-2.5 font-semibold">Pending</th>
                    <th className="px-3 py-2.5 font-semibold">Active passes</th>
                    <th className="px-3 py-2.5 font-semibold">Last access</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-2 py-2.5"><span className="sr-only">Open details</span></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#141119] text-[#D6D0DC]">
                  {visibleUnits.map((unit) => {
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
                          "cursor-pointer outline-none transition hover:bg-white/[0.018] focus-visible:shadow-[inset_0_0_0_2px_#7553FF]",
                          selected && "bg-[rgba(117,83,255,0.075)] shadow-[inset_2px_0_0_#7553FF]",
                        )}
                      >
                        <td className="px-3 py-2.5 align-top">
                          <p className="truncate font-semibold text-white" title={unit.label}>{unit.label}</p>
                          <p className="mt-1 text-[10px] text-[#8F879D]">{unit.isActive ? "Active unit" : "Inactive unit"}</p>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <p className="truncate font-semibold text-white" title={unit.primaryResidentName || unit.ownerName || "No residents"}>
                            {unit.primaryResidentName || unit.ownerName || "No residents"}
                          </p>
                          <p className="mt-1 text-[10px] text-[#8F879D]">{unit.residentCount > 0 ? "Primary resident" : "Unassigned"}</p>
                        </td>
                        <td className="px-3 py-2.5 align-top font-semibold text-white">{unit.residentCount}</td>
                        <td className="px-3 py-2.5 align-top font-semibold text-white">{unit.pendingActivations}</td>
                        <td className="px-3 py-2.5 align-top">{unit.activePasses}</td>
                        <td className="px-3 py-2.5 align-top">{unit.lastAccess === "Not available" ? "No access recorded" : unit.lastAccess}</td>
                        <td className="px-3 py-2.5 align-top">
                          <Tag tone={unit.isActive ? "success" : "default"}>{unit.isActive ? "Active" : "Inactive"}</Tag>
                        </td>
                        <td className="px-2 py-2.5 align-middle text-right">
                          <ChevronRight className={cn("ml-auto size-4", selected ? "text-[#D8D1FF]" : "text-[#8F879D]")} aria-hidden />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#141119] bg-[#1F1B26] px-4 py-2 text-[10px] text-[#8F879D]">
            <span>Showing {visibleUnits.length} matching unit{visibleUnits.length === 1 ? "" : "s"} of {units.length}</span>
            <span>Directory searches units and resident context without opening each record</span>
          </div>
        </section>

        {selectedUnit && recommendation ? (
          <aside className="fixed bottom-5 right-5 top-[76px] z-40 grid w-[440px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-[#141119] bg-[#292431] shadow-[0_24px_70px_rgba(0,0,0,0.45)] max-xl:inset-x-0 max-xl:bottom-0 max-xl:top-[54px] max-xl:w-auto max-xl:rounded-none">
            <div className="border-b border-[#141119] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-[rgba(117,83,255,0.28)] bg-[rgba(117,83,255,0.08)] text-sm font-semibold text-[#E3DEFF]">⌂</span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">{selectedUnit.label}</p>
                    <p className="mt-1 text-xs text-[#A9A3B2]">{communityName} · Unit details</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="grid size-8 shrink-0 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#8F879D] transition hover:text-white"
                  aria-label="Close unit details"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Tag tone={selectedUnit.isActive ? "success" : "default"}>{selectedUnit.isActive ? "Active" : "Inactive"}</Tag>
                <Tag tone={selectedUnit.pendingActivations > 0 ? "warning" : "default"}>
                  {selectedUnit.pendingActivations > 0
                    ? `${selectedUnit.pendingActivations} pending activation${selectedUnit.pendingActivations === 1 ? "" : "s"}`
                    : "No pending activations"}
                </Tag>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain p-3.5 [scrollbar-gutter:stable]">
              <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
                <div className="border-b border-white/[0.07] px-3 py-2.5"><p className="text-xs font-semibold text-white">Unit overview</p></div>
                {[
                  ["Residents", String(selectedUnit.residentCount)],
                  ["Pending activation", String(selectedUnit.pendingActivations)],
                  ["Active passes", String(selectedUnit.activePasses)],
                  ["Last access", selectedUnit.lastAccess === "Not available" ? "No access recorded" : selectedUnit.lastAccess],
                  ["Status", selectedUnit.isActive ? "Active" : "Inactive"],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-b border-white/[0.06] px-3 py-2.5 text-[11px] last:border-b-0">
                    <span className="text-[#8F879D]">{label}</span>
                    <span className="break-words text-right text-white">{value}</span>
                  </div>
                ))}
              </section>

              <section className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
                <div className="border-b border-white/[0.07] px-3 py-2.5"><p className="text-xs font-semibold text-white">Household</p></div>
                {selectedUnit.residents.length > 0 ? (
                  <div className="divide-y divide-white/[0.06]">
                    {selectedUnit.residents.map((resident) => {
                      const isPrimaryResident =
                        resident.isPrimary ||
                        resident.userId === selectedUnit.primaryResidentId ||
                        Boolean(
                          selectedUnit.primaryResidentName &&
                            resident.fullName.trim().toLowerCase() ===
                              selectedUnit.primaryResidentName.trim().toLowerCase(),
                        );

                      return (
                        <div key={resident.userId} className="px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-semibold text-white">
                                {resident.fullName}
                              </p>
                              <p className="mt-1 truncate text-[10px] text-[#8F879D]">
                                {resident.email || resident.phone || resident.account}
                              </p>
                            </div>
                            <Tag tone={isPrimaryResident ? "success" : "default"}>
                              {isPrimaryResident ? "Primary resident" : "Resident"}
                            </Tag>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-3 py-4 text-[11px] text-[#A9A3B2]">No residents are currently linked to this unit.</p>
                )}
              </section>

              <section className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
                <div className="border-b border-white/[0.07] px-3 py-2.5"><p className="text-xs font-semibold text-white">Operational context</p></div>
                <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 border-b border-white/[0.06] px-3 py-2.5 text-[11px]">
                  <span className="text-[#8F879D]">Activation queue</span>
                  <span className="text-right text-white">
                    {selectedUnit.pendingActivations > 0
                      ? `${selectedUnit.pendingActivations} resident${selectedUnit.pendingActivations === 1 ? "" : "s"} pending`
                      : "Queue clear"}
                  </span>
                </div>
                <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 px-3 py-2.5 text-[11px]">
                  <span className="text-[#8F879D]">Access activity</span>
                  <span className="text-right text-white">{selectedUnit.lastAccess === "Not available" ? "No access recorded" : selectedUnit.lastAccess}</span>
                </div>
              </section>

              {selectedUnit.activePassItems.length > 0 ? (
                <section className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
                  <div className="border-b border-white/[0.07] px-3 py-2.5"><p className="text-xs font-semibold text-white">Active passes</p></div>
                  <div className="divide-y divide-white/[0.06]">
                    {selectedUnit.activePassItems.slice(0, 6).map((pass) => (
                      <div key={pass.id} className="px-3 py-2.5">
                        <p className="text-[11px] font-semibold text-white">{pass.passName}</p>
                        <p className="mt-1 text-[10px] text-[#8F879D]">{pass.holderName || pass.residentName} · {pass.status}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <div className="border-t border-[#141119] bg-[#292431] p-3">
              <div className="mb-2.5 rounded-lg border border-[rgba(117,83,255,0.18)] bg-[rgba(117,83,255,0.055)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#BEB4FF]">Recommended next action</p>
                <p className="mt-1.5 text-xs font-semibold text-white">{recommendation.title}</p>
                <p className="mt-1 text-[10px] leading-4 text-[#A9A3B2]">{recommendation.description}</p>
              </div>

              <ResidentQuickCreate
                communityId={communityId}
                houses={houses}
                fixedUnitId={selectedUnit.id}
                triggerClassName="inline-flex h-9 w-full items-center justify-center rounded-[7px] border border-[#120539] bg-[#7553FF] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#120539]"
              />

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link
                  href={`/products/entry/communities/${communityId}/units/${selectedUnit.id}`}
                  className="inline-flex h-9 items-center justify-center rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#141119]"
                >
                  Open unit details
                </Link>
                <Link
                  href={`/products/entry/activation?community_id=${communityId}`}
                  className="inline-flex h-9 items-center justify-center rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#141119]"
                >
                  Activation queue
                </Link>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
