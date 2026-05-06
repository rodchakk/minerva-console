"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CommunityUnitPreview } from "@/features/entry/communities/detailQueries";

type UnitFilter = "all" | "active" | "inactive" | "has_residents" | "has_passes";

type CommunityUnitsDrawerProps = {
  communityId: string;
  triggerLabel?: string;
  units: CommunityUnitPreview[];
};

const filters: Array<{ label: string; value: UnitFilter }> = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Has residents", value: "has_residents" },
  { label: "Has passes", value: "has_passes" },
];

function getStatusLabel(unit: CommunityUnitPreview) {
  if (!unit.isActive) {
    return "Inactive";
  }

  if (unit.activeResidents <= 0) {
    return "No residents";
  }

  return "Active";
}

function getStatusClass(unit: CommunityUnitPreview) {
  if (!unit.isActive) {
    return "border-white/10 bg-white/7 text-[var(--text-muted)]";
  }

  if (unit.activeResidents <= 0) {
    return "border-indigo-400/20 bg-indigo-400/10 text-indigo-200";
  }

  return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
}

function UnitStatusBadge({ unit }: { unit: CommunityUnitPreview }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusClass(
        unit,
      )}`}
    >
      {getStatusLabel(unit)}
    </span>
  );
}

export function CommunityUnitsDrawer({
  communityId,
  triggerLabel = "View full units directory",
  units,
}: CommunityUnitsDrawerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UnitFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(units[0]?.id ?? null);

  const filteredUnits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return units.filter((unit) => {
      const matchesQuery =
        !normalizedQuery ||
        unit.label.toLowerCase().includes(normalizedQuery) ||
        unit.ownerName.toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }

      switch (filter) {
        case "active":
          return unit.isActive;
        case "inactive":
          return !unit.isActive;
        case "has_residents":
          return unit.activeResidents > 0;
        case "has_passes":
          return unit.activePasses > 0;
        default:
          return true;
      }
    });
  }, [filter, query, units]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (filteredUnits.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !filteredUnits.some((unit) => unit.id === selectedId)) {
      setSelectedId(filteredUnits[0]?.id ?? null);
    }
  }, [filteredUnits, open, selectedId]);

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

  const selectedUnit =
    filteredUnits.find((unit) => unit.id === selectedId) ?? filteredUnits[0] ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-violet-200 transition hover:text-white"
      >
        {triggerLabel} →
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <button
            type="button"
            aria-label="Close units directory"
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
                  Units Directory
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Search, filter, and inspect unit records without leaving review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl text-[var(--text-muted)] transition hover:border-violet-300/40 hover:text-white"
                aria-label="Close units directory"
              >
                ×
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <label className="relative block">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    ⌕
                  </span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by unit label or owner..."
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/50"
                  />
                </label>
                <Link
                  href={`/products/entry/communities/${communityId}/units`}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:border-violet-300/40 hover:bg-white/8"
                >
                  Open page fallback
                </Link>
              </div>

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
                <div className="grid grid-cols-[minmax(120px,1fr)_minmax(140px,1fr)_120px_90px_120px] border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <span>Unit</span>
                  <span>Owner</span>
                  <span className="text-center">Residents</span>
                  <span className="text-center">Passes</span>
                  <span className="text-right">Status</span>
                </div>

                {filteredUnits.length === 0 ? (
                  <div className="grid h-64 place-items-center px-6 text-center">
                    <div>
                      <p className="text-base font-semibold text-white">
                        No units match this view
                      </p>
                      <p className="mt-2 text-sm text-[var(--text-muted)]">
                        Try another filter or clear the search field.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[46vh] overflow-y-auto px-3 py-3">
                    {filteredUnits.map((unit) => {
                      const selected = unit.id === selectedUnit?.id;

                      return (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => setSelectedId(unit.id)}
                          className={`grid w-full grid-cols-[minmax(120px,1fr)_minmax(140px,1fr)_120px_90px_120px] items-center rounded-2xl border px-3 py-3 text-left text-sm transition ${
                            selected
                              ? "border-violet-300/50 bg-violet-400/12 shadow-[0_12px_34px_rgba(112,104,255,0.16)]"
                              : "border-transparent hover:border-white/10 hover:bg-white/5"
                          }`}
                        >
                          <span className="font-semibold text-white">{unit.label}</span>
                          <span className="truncate text-[var(--text-muted)]">
                            {unit.ownerName}
                          </span>
                          <span className="text-center font-semibold text-white">
                            {unit.activeResidents}
                          </span>
                          <span className="text-center font-semibold text-white">
                            {unit.activePasses}
                          </span>
                          <span className="text-right">
                            <UnitStatusBadge unit={unit} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 bg-[rgba(9,12,24,0.84)] px-6 py-5">
              {selectedUnit ? (
                <div className="rounded-[28px] border border-white/10 bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--primary)] text-2xl text-white">
                       ⌂
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                          Selected unit
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-2xl font-semibold text-white">
                            {selectedUnit.label}
                          </h3>
                          <UnitStatusBadge unit={selectedUnit} />
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/products/entry/communities/${communityId}/units/${selectedUnit.id}`}
                      className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-violet-300/40 hover:bg-white/8"
                    >
                      Open full details ↗
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-5">
                    {[
                      ["Owner", selectedUnit.ownerName],
                      ["Active residents", selectedUnit.activeResidents],
                      ["Active passes", selectedUnit.activePasses],
                      ["Last access", selectedUnit.lastAccess],
                      ["Created", selectedUnit.createdAt],
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
                      "Edit unit",
                      "Disable unit",
                      "View access history",
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
                <EmptyInline>Select a unit to see details here.</EmptyInline>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
