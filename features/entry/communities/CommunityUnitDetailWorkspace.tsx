"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Filter,
  History,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CommunityUnitQuickActions } from "@/features/entry/communities/CommunityUnitQuickActions";
import { ResidentQuickCreate } from "@/features/entry/communities/ResidentQuickCreate";
import { UnitResidentActions } from "@/features/entry/communities/UnitResidentActions";
import type {
  CommunityUnitHouseOption,
  CommunityUnitPendingActivation,
  CommunityUnitPreview,
  CommunityUnitResident,
} from "@/features/entry/communities/detailQueries";
import { cn } from "@/lib/supabase/utils";

type DetailTab = "access" | "passes" | "residents";
type ResidentFilter = "active" | "all" | "inactive" | "pending";

type Props = {
  communityId: string;
  communityName: string;
  houses: CommunityUnitHouseOption[];
  initialFilter?: string;
  initialQuery?: string;
  lastSignInByUserId: Record<string, string | null>;
  unit: CommunityUnitPreview;
  unitDisplayLabel: string;
  unitTypeLabel: string;
};

const residentFilters: Array<{ label: string; value: ResidentFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Inactive", value: "inactive" },
];

function normalizeFilter(value?: string): ResidentFilter {
  if (value === "active" || value === "pending" || value === "inactive") {
    return value;
  }
  return "all";
}

function formatLastSignIn(value?: string | null) {
  if (!value) return "Never signed in";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never signed in";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLastAccess(value: string) {
  return value === "Not available" ? "No access recorded" : value;
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "Resident admin";
  if (role === "RESIDENT") return "Resident";
  if (role === "UNASSIGNED") return "Unassigned";
  return role;
}

function Tag({
  children,
  tone = "default",
}: {
  children: ReactNode;
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

function SummaryMetric({
  active,
  hint,
  label,
  onClick,
  value,
}: {
  active?: boolean;
  hint: string;
  label: string;
  onClick?: () => void;
  value: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={!onClick}
      className={cn(
        "min-h-[84px] border-t border-white/[0.07] px-4 py-3.5 text-left first:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0",
        onClick ? "transition hover:bg-white/[0.015]" : "cursor-default",
        active &&
          "bg-[rgba(117,83,255,0.055)] shadow-[inset_0_-2px_0_#7553FF]",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#8F879D]">
        {label}
      </p>
      <div className="mt-1.5 text-xl font-semibold text-white">{value}</div>
      <p className="mt-1 text-[10px] text-[#A9A3B2]">{hint}</p>
    </button>
  );
}

export function CommunityUnitDetailWorkspace({
  communityId,
  communityName,
  houses,
  initialFilter,
  initialQuery = "",
  lastSignInByUserId,
  unit,
  unitDisplayLabel,
  unitTypeLabel,
}: Props) {
  const [tab, setTab] = useState<DetailTab>("residents");
  const [query, setQuery] = useState(initialQuery);
  const [residentFilter, setResidentFilter] = useState<ResidentFilter>(
    normalizeFilter(initialFilter),
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(
    null,
  );
  const [selectedPendingId, setSelectedPendingId] = useState<string | null>(
    null,
  );
  const [desktopWorkspaceHeight, setDesktopWorkspaceHeight] = useState<
    number | null
  >(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  const activeAccounts = unit.residents.filter(
    (resident) => resident.isActive,
  ).length;
  const lastAccess = formatLastAccess(unit.lastAccess);

  const filteredResidents = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return unit.residents.filter((resident) => {
      const matchesQuery =
        !normalized ||
        [
          resident.fullName,
          resident.account,
          resident.email,
          resident.username,
          resident.phone,
          resident.role,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);

      if (!matchesQuery) return false;
      if (residentFilter === "active") return resident.isActive;
      if (residentFilter === "inactive") return !resident.isActive;
      if (residentFilter === "pending") return false;
      return true;
    });
  }, [query, residentFilter, unit.residents]);

  const filteredPending = useMemo(() => {
    if (residentFilter !== "all" && residentFilter !== "pending") return [];

    const normalized = query.trim().toLowerCase();
    return unit.pendingActivationItems.filter((item) => {
      if (!normalized) return true;
      return [item.residentName, item.method, item.status, item.unitLabel]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [query, residentFilter, unit.pendingActivationItems]);

  const selectedResident =
    unit.residents.find((resident) => resident.userId === selectedResidentId) ??
    null;
  const selectedPending =
    unit.pendingActivationItems.find(
      (item) => item.id === selectedPendingId,
    ) ?? null;

  useEffect(() => {
    function updateHeight() {
      if (window.innerWidth < 1024) {
        setDesktopWorkspaceHeight(null);
        return;
      }

      const top = pageRef.current?.getBoundingClientRect().top ?? 0;
      setDesktopWorkspaceHeight(
        Math.max(540, Math.floor(window.innerHeight - top - 16)),
      );
    }

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
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

      if (selectedResidentId || selectedPendingId) {
        setSelectedResidentId(null);
        setSelectedPendingId(null);
      }
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
  }, [filterOpen, moreOpen, selectedPendingId, selectedResidentId]);

  function openResident(resident: CommunityUnitResident) {
    setSelectedPendingId(null);
    setSelectedResidentId(resident.userId);
  }

  function openPending(item: CommunityUnitPendingActivation) {
    setSelectedResidentId(null);
    setSelectedPendingId(item.id);
  }

  function showResidents(filter: ResidentFilter = "all") {
    setTab("residents");
    setResidentFilter(filter);
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
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
              ENTRY · UNIT DETAILS
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-white">
              Unit Details
            </h1>
            <p className="mt-2 text-sm font-semibold text-white">
              {unitDisplayLabel} · {communityName}
            </p>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#A9A3B2]">
              Manage household members, resident accounts, access activity, and passes for this unit.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-2.5">
            <Link
              href={`/products/entry/communities/${communityId}/units`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-4 text-sm font-semibold text-white shadow-[0_2px_0_#141119]"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to directory
            </Link>

            <ResidentQuickCreate
              communityId={communityId}
              fixedUnitId={unit.id}
              houses={houses}
              triggerClassName="inline-flex h-10 items-center justify-center rounded-[7px] border border-[#120539] bg-[#7553FF] px-4 text-sm font-semibold text-white shadow-[0_2px_0_#120539]"
              triggerLabel="Add resident"
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
                    className="block rounded-md px-3 py-2.5 text-xs font-medium text-[#D3CEDA] hover:bg-white/[0.04] hover:text-white"
                  >
                    Activation queue
                  </Link>
                  <CommunityUnitQuickActions
                    communityId={communityId}
                    displayMode="menu"
                    unit={unit}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="relative grid overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF] lg:grid-cols-4">
          <SummaryMetric
            label="Unit status"
            value={
              <span className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    unit.isActive ? "bg-[#67D7A5]" : "bg-[#8F879D]",
                  )}
                />
                {unit.isActive ? "Active" : "Inactive"}
              </span>
            }
            hint={`${unitTypeLabel} · Primary: ${unit.primaryResidentName || "No resident"}`}
          />
          <SummaryMetric
            active={tab === "residents" && residentFilter === "all"}
            label="Residents"
            value={unit.residentCount}
            hint={`${activeAccounts} active account${activeAccounts === 1 ? "" : "s"}`}
            onClick={() => showResidents("all")}
          />
          <SummaryMetric
            active={tab === "residents" && residentFilter === "pending"}
            label="Pending activation"
            value={unit.pendingActivations}
            hint="Residents still in activation flow"
            onClick={() => showResidents("pending")}
          />
          <SummaryMetric
            active={tab === "passes"}
            label="Active passes"
            value={unit.activePasses}
            hint={`Last access: ${lastAccess}`}
            onClick={() => setTab("passes")}
          />
        </section>

        <section className="relative flex min-h-[560px] flex-1 flex-col overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-[72px] before:bg-[#7553FF] lg:min-h-0">
          <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3 border-b border-[#141119] px-4">
            <div className="flex h-full items-center gap-5">
              {(
                [
                  ["residents", `Residents ${unit.residentCount + unit.pendingActivations}`],
                  ["access", "Access"],
                  ["passes", `Passes ${unit.activePasses}`],
                ] as Array<[DetailTab, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={cn(
                    "relative h-[52px] text-xs font-semibold transition",
                    tab === value ? "text-white" : "text-[#8F879D] hover:text-white",
                  )}
                >
                  {label}
                  {tab === value ? (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#7553FF]" />
                  ) : null}
                </button>
              ))}
            </div>

            {tab === "residents" ? (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <label className="relative block w-full max-w-[480px]">
                  <span className="sr-only">Search residents</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8F879D]"
                    aria-hidden
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search name, email, phone or username..."
                    className="h-9 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] pl-9 pr-3 text-sm text-[#E7E5EA] shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
                  />
                </label>

                <div ref={filterRef} className="relative">
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
                    {residentFilter !== "all" ? (
                      <span className="grid size-4 place-items-center rounded-[4px] bg-[#7553FF] text-[9px] text-white">
                        1
                      </span>
                    ) : null}
                  </button>

                  {filterOpen ? (
                    <div className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] p-2 shadow-[0_18px_45px_rgba(0,0,0,0.42)]">
                      {residentFilters.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setResidentFilter(item.value);
                            setFilterOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs",
                            residentFilter === item.value
                              ? "bg-[rgba(117,83,255,0.08)] text-white"
                              : "text-[#D3CEDA] hover:bg-white/[0.03] hover:text-white",
                          )}
                        >
                          <span>{item.label}</span>
                          <span
                            className={cn(
                              "size-3.5 rounded-[3px] border",
                              residentFilter === item.value
                                ? "border-[#7553FF] bg-[#7553FF]"
                                : "border-white/20",
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {tab === "residents" ? (
            filteredResidents.length === 0 && filteredPending.length === 0 ? (
              <div className="grid flex-1 place-items-center px-6 text-center">
                <div>
                  <p className="text-sm font-semibold text-white">
                    No residents match this view
                  </p>
                  <p className="mt-1 text-xs text-[#A9A3B2]">
                    Clear the search or filters to show household members again.
                  </p>
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable] [touch-action:pan-y]">
                <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-xs">
                  <colgroup>
                    <col className="w-[25%]" />
                    <col className="w-[23%]" />
                    <col className="w-[16%]" />
                    <col className="w-[20%]" />
                    <col className="w-[13%]" />
                    <col className="w-9" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-b border-[#141119] bg-[#1F1B26] text-[#8F879D]">
                    <tr className="text-[10px] uppercase tracking-[0.13em]">
                      <th className="px-3 py-2.5 font-semibold">Resident</th>
                      <th className="px-3 py-2.5 font-semibold">Account</th>
                      <th className="px-3 py-2.5 font-semibold">Role</th>
                      <th className="px-3 py-2.5 font-semibold">Last sign-in</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-2 py-2.5"><span className="sr-only">Open details</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141119] text-[#D6D0DC]">
                    {filteredResidents.map((resident) => {
                      const selected = selectedResident?.userId === resident.userId;
                      const isPrimary =
                        resident.isPrimary ||
                        resident.userId === unit.primaryResidentId;

                      return (
                        <tr
                          key={resident.userId}
                          tabIndex={0}
                          onClick={() => openResident(resident)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openResident(resident);
                            }
                          }}
                          className={cn(
                            "cursor-pointer outline-none transition hover:bg-white/[0.018] focus-visible:shadow-[inset_0_0_0_2px_#7553FF]",
                            selected &&
                              "bg-[rgba(117,83,255,0.075)] shadow-[inset_2px_0_0_#7553FF]",
                          )}
                        >
                          <td className="px-3 py-2.5 align-top">
                            <p className="truncate font-semibold text-white">
                              {resident.fullName}
                            </p>
                            <p className="mt-1 text-[10px] text-[#8F879D]">
                              {isPrimary ? "Primary resident" : "Household member"}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <p className="truncate text-[#D6D0DC]">{resident.account}</p>
                            <p className="mt-1 truncate text-[10px] text-[#8F879D]">
                              {resident.email || resident.phone || "No contact"}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 align-top">{roleLabel(resident.role)}</td>
                          <td className="px-3 py-2.5 align-top">
                            {formatLastSignIn(lastSignInByUserId[resident.userId])}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <Tag tone={resident.isActive ? "success" : "default"}>
                              {resident.isActive ? "Active" : "Inactive"}
                            </Tag>
                          </td>
                          <td className="px-2 py-2.5 align-middle text-right">
                            <ChevronRight className={cn("ml-auto size-4", selected ? "text-[#D8D1FF]" : "text-[#8F879D]")} aria-hidden />
                          </td>
                        </tr>
                      );
                    })}

                    {filteredPending.map((item) => {
                      const selected = selectedPending?.id === item.id;
                      return (
                        <tr
                          key={item.id}
                          tabIndex={0}
                          onClick={() => openPending(item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openPending(item);
                            }
                          }}
                          className={cn(
                            "cursor-pointer outline-none transition hover:bg-white/[0.018]",
                            selected &&
                              "bg-[rgba(117,83,255,0.075)] shadow-[inset_2px_0_0_#7553FF]",
                          )}
                        >
                          <td className="px-3 py-2.5 align-top">
                            <p className="truncate font-semibold text-white">{item.residentName}</p>
                            <p className="mt-1 text-[10px] text-[#8F879D]">Prepared resident</p>
                          </td>
                          <td className="px-3 py-2.5 align-top">{item.method}</td>
                          <td className="px-3 py-2.5 align-top">Pending activation</td>
                          <td className="px-3 py-2.5 align-top">Not activated</td>
                          <td className="px-3 py-2.5 align-top"><Tag tone="warning">Pending</Tag></td>
                          <td className="px-2 py-2.5 align-middle text-right">
                            <ChevronRight className={cn("ml-auto size-4", selected ? "text-[#D8D1FF]" : "text-[#8F879D]")} aria-hidden />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : tab === "access" ? (
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <div className="max-w-3xl overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
                <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-3">
                  <History className="size-4 text-[#BEB4FF]" aria-hidden />
                  <p className="text-xs font-semibold text-white">Most recent access</p>
                </div>
                <div className="grid gap-0 sm:grid-cols-3">
                  <div className="border-b border-white/[0.06] px-4 py-4 sm:border-b-0 sm:border-r">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#8F879D]">Resident</p>
                    <p className="mt-2 text-sm font-semibold text-white">{unit.primaryResidentName || "No resident"}</p>
                  </div>
                  <div className="border-b border-white/[0.06] px-4 py-4 sm:border-b-0 sm:border-r">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#8F879D]">Last access</p>
                    <p className="mt-2 text-sm font-semibold text-white">{lastAccess}</p>
                  </div>
                  <div className="px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#8F879D]">Unit status</p>
                    <p className="mt-2 text-sm font-semibold text-white">{unit.isActive ? "Active" : "Inactive"}</p>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-[#8F879D]">
                Full access history is not currently exposed on this unit screen.
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto overscroll-contain [scrollbar-gutter:stable]">
              {unit.activePassItems.length === 0 ? (
                <div className="grid min-h-[260px] place-items-center px-6 text-center">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {unit.activePasses > 0
                        ? `${unit.activePasses} active pass${unit.activePasses === 1 ? "" : "es"} reported`
                        : "No active passes"}
                    </p>
                    <p className="mt-1 text-xs text-[#A9A3B2]">
                      {unit.activePasses > 0
                        ? "Pass details are not available on this record."
                        : "This unit currently has no active frequent-access passes."}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  {unit.activePasses > unit.activePassItems.length ? (
                    <div className="border-b border-[#141119] bg-[rgba(117,83,255,0.04)] px-4 py-2 text-[10px] text-[#A9A3B2]">
                      {unit.activePasses - unit.activePassItems.length} additional active pass
                      {unit.activePasses - unit.activePassItems.length === 1 ? "" : "es"} reported without detail rows.
                    </div>
                  ) : null}
                  <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-[#141119] bg-[#1F1B26] text-[#8F879D]">
                    <tr className="text-[10px] uppercase tracking-[0.13em]">
                      <th className="px-3 py-2.5 font-semibold">Pass</th>
                      <th className="px-3 py-2.5 font-semibold">Resident</th>
                      <th className="px-3 py-2.5 font-semibold">Holder</th>
                      <th className="px-3 py-2.5 font-semibold">Expires</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141119] text-[#D6D0DC]">
                    {unit.activePassItems.map((pass) => (
                      <tr key={pass.id}>
                        <td className="px-3 py-2.5 font-semibold text-white">{pass.passName}</td>
                        <td className="px-3 py-2.5">{pass.residentName || "—"}</td>
                        <td className="px-3 py-2.5">{pass.holderName || "—"}</td>
                        <td className="px-3 py-2.5">{pass.expiresAt}</td>
                        <td className="px-3 py-2.5"><Tag tone="success">{pass.status}</Tag></td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#141119] bg-[#1F1B26] px-4 py-2 text-[10px] text-[#8F879D]">
            <span>
              {tab === "residents"
                ? `${filteredResidents.length + filteredPending.length} visible household record${filteredResidents.length + filteredPending.length === 1 ? "" : "s"}`
                : tab === "passes"
                  ? `${unit.activePassItems.length} active pass record${unit.activePassItems.length === 1 ? "" : "s"}`
                  : "Operational unit access context"}
            </span>
            <span>
              Created {unit.createdAt} · Last access {lastAccess}
            </span>
          </div>
        </section>

        {selectedResident ? (
          <aside className="fixed bottom-5 right-5 top-[76px] z-40 grid w-[440px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-[#141119] bg-[#292431] shadow-[0_24px_70px_rgba(0,0,0,0.45)] max-xl:inset-x-0 max-xl:bottom-0 max-xl:top-[54px] max-xl:w-auto max-xl:rounded-none">
            <div className="border-b border-[#141119] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">{selectedResident.fullName}</p>
                  <p className="mt-1 text-xs text-[#A9A3B2]">{unitDisplayLabel} · Resident details</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedResidentId(null)}
                  className="grid size-8 shrink-0 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#8F879D] hover:text-white"
                  aria-label="Close resident details"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Tag tone={selectedResident.isActive ? "success" : "default"}>
                  {selectedResident.isActive ? "Active" : "Inactive"}
                </Tag>
                {(selectedResident.isPrimary || selectedResident.userId === unit.primaryResidentId) ? (
                  <Tag tone="success">Primary resident</Tag>
                ) : (
                  <Tag>Resident</Tag>
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain p-3.5 [scrollbar-gutter:stable]">
              <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
                <div className="border-b border-white/[0.07] px-3 py-2.5">
                  <p className="text-xs font-semibold text-white">Resident account</p>
                </div>
                {[
                  ["Role", roleLabel(selectedResident.role)],
                  ["Account", selectedResident.account],
                  ["Username", selectedResident.username || "Not generated"],
                  ["Email", selectedResident.email || "Not provided"],
                  ["Phone", selectedResident.phone || "Not provided"],
                  ["Auth type", selectedResident.authType || "Not available"],
                  ["Last sign-in", formatLastSignIn(lastSignInByUserId[selectedResident.userId])],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-white/[0.06] px-3 py-2.5 text-[11px] last:border-b-0">
                    <span className="text-[#8F879D]">{label}</span>
                    <span className="break-words text-right text-white">{value}</span>
                  </div>
                ))}
              </section>

              <section className="mt-3 rounded-lg border border-[rgba(117,83,255,0.18)] bg-[rgba(117,83,255,0.055)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#BEB4FF]">Household context</p>
                <p className="mt-1.5 text-xs font-semibold text-white">
                  {(selectedResident.isPrimary || selectedResident.userId === unit.primaryResidentId)
                    ? "Primary resident"
                    : "Household member"}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-[#A9A3B2]">
                  {selectedResident.houseLabel || unitDisplayLabel}
                </p>
              </section>
            </div>

            <div className="border-t border-[#141119] bg-[#292431] p-3">
              <UnitResidentActions
                communityId={communityId}
                resident={selectedResident}
                triggerLabel="Manage resident"
                triggerClassName="inline-flex h-9 w-full items-center justify-center rounded-[7px] border border-[#120539] bg-[#7553FF] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#120539]"
              />
            </div>
          </aside>
        ) : null}

        {selectedPending ? (
          <aside className="fixed bottom-5 right-5 top-[76px] z-40 grid w-[440px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-[#141119] bg-[#292431] shadow-[0_24px_70px_rgba(0,0,0,0.45)] max-xl:inset-x-0 max-xl:bottom-0 max-xl:top-[54px] max-xl:w-auto max-xl:rounded-none">
            <div className="border-b border-[#141119] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">{selectedPending.residentName}</p>
                  <p className="mt-1 text-xs text-[#A9A3B2]">{unitDisplayLabel} · Prepared resident</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPendingId(null)}
                  className="grid size-8 shrink-0 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#8F879D] hover:text-white"
                  aria-label="Close pending resident details"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <div className="mt-3"><Tag tone="warning">Pending activation</Tag></div>
            </div>

            <div className="min-h-0 overflow-y-auto p-3.5">
              <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
                <div className="border-b border-white/[0.07] px-3 py-2.5"><p className="text-xs font-semibold text-white">Activation details</p></div>
                {[
                  ["Method", selectedPending.method],
                  ["Status", selectedPending.status],
                  ["Unit", selectedPending.unitLabel || unitDisplayLabel],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-white/[0.06] px-3 py-2.5 text-[11px] last:border-b-0">
                    <span className="text-[#8F879D]">{label}</span>
                    <span className="break-words text-right text-white">{value}</span>
                  </div>
                ))}
              </section>

              <section className="mt-3 rounded-lg border border-[rgba(243,202,87,0.20)] bg-[rgba(243,202,87,0.055)] p-3">
                <p className="text-xs font-semibold text-[#F2D77B]">Activation still pending</p>
                <p className="mt-1.5 text-[11px] leading-5 text-[#D8CFAD]">
                  Review this resident in Activation Queue to continue the invitation or PIN workflow.
                </p>
              </section>
            </div>

            <div className="border-t border-[#141119] bg-[#292431] p-3">
              <Link
                href={`/products/entry/activation?community_id=${communityId}`}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[7px] border border-[#120539] bg-[#7553FF] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#120539]"
              >
                Open Activation Queue
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
