"use client";

import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/supabase/utils";

export type OperationsPriorityTone = "amber" | "rose" | "violet" | "sky";

export type OperationsPriorityStage = {
  label: string;
  state: "done" | "active" | "idle";
};

export type OperationsPriorityDetail = {
  label: string;
  value: string;
};

export type OperationsPriorityItem = {
  actionLabel: string;
  details: OperationsPriorityDetail[];
  href: string;
  id: string;
  impact: string;
  secondaryAction?: {
    href: string;
    label: string;
  };
  stages?: OperationsPriorityStage[];
  status: string;
  statusNote?: string;
  title: string;
  tone: OperationsPriorityTone;
  type: string;
};

function getToneDotClass(tone: OperationsPriorityTone) {
  switch (tone) {
    case "rose":
      return "bg-[#FF667E]";
    case "sky":
      return "bg-[#66BEFF]";
    case "violet":
      return "bg-[#7553FF]";
    case "amber":
    default:
      return "bg-[#F6C941]";
  }
}

function getToneTagClass(tone: OperationsPriorityTone) {
  switch (tone) {
    case "rose":
      return "border-[rgba(255,102,126,0.28)] bg-[rgba(255,102,126,0.07)] text-[#FFC1CB]";
    case "sky":
      return "border-[rgba(102,190,255,0.24)] bg-[rgba(102,190,255,0.06)] text-[#CBE9FF]";
    case "violet":
      return "border-[rgba(117,83,255,0.26)] bg-[rgba(117,83,255,0.07)] text-[#D8D1FF]";
    case "amber":
    default:
      return "border-[rgba(228,194,106,0.24)] bg-[rgba(228,194,106,0.06)] text-[#F0D995]";
  }
}

function getHighlightClass(tone: OperationsPriorityTone) {
  switch (tone) {
    case "rose":
      return "border-[rgba(255,102,126,0.28)] bg-[linear-gradient(to_right,rgba(255,102,126,0.13),rgba(255,102,126,0.06))]";
    case "sky":
      return "border-[rgba(102,190,255,0.24)] bg-[linear-gradient(to_right,rgba(102,190,255,0.11),rgba(102,190,255,0.05))]";
    case "amber":
      return "border-[rgba(228,194,106,0.24)] bg-[linear-gradient(to_right,rgba(228,194,106,0.11),rgba(228,194,106,0.05))]";
    case "violet":
    default:
      return "border-[#7553FF] bg-[linear-gradient(to_right,#7553FF_0,#7553FF_40px,rgba(72,40,184,0.58)_40px,rgba(72,40,184,0.58)_41px,transparent_41px),linear-gradient(#2E2936,#2E2936)]";
  }
}

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
          "absolute inset-0 -z-20 rounded-[7px] translate-y-0",
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

export function OperationalPrioritiesWorkspace({
  items,
}: {
  items: OperationsPriorityItem[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const typeOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.type))).sort(),
    [items],
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesType =
        selectedTypes.length === 0 || selectedTypes.includes(item.type);
      const matchesQuery =
        !normalizedQuery ||
        [item.title, item.type, item.status, item.impact]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesType && matchesQuery;
    });
  }, [items, query, selectedTypes]);

  const activeItem =
    visibleItems.find((item) => item.id === selectedId) ??
    visibleItems[0] ??
    null;

  function toggleType(type: string) {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  return (
    <section
      className={cn(
        "grid items-start gap-3",
        activeItem ? "xl:grid-cols-[minmax(0,1fr)_370px]" : "grid-cols-1",
      )}
    >
      <div className="relative min-w-0 overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B] before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF]">
        <div className="flex flex-col gap-4 border-b border-[#141119] px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">
              Operational priorities
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#A9A3B2]">
              Items that need your attention, sorted by urgency and impact.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[220px] flex-1 lg:w-[250px] lg:flex-none">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#A9A3B2]"
                aria-hidden
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search items..."
                className="h-9 w-full rounded-lg border border-[#141119] bg-[rgba(0,0,32,0.20)] pl-10 pr-3 text-sm text-[#E7E5EA] shadow-[inset_0_1px_0_#141119] outline-none placeholder:text-[#8F879D] focus:shadow-[inset_0_1px_0_#141119,0_0_0_2px_#7553FF]"
              />
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterOpen((value) => !value)}
                className="inline-flex h-9 items-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#7553FF]"
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                Filters
                {selectedTypes.length > 0 ? (
                  <span className="rounded-[4px] border border-[rgba(117,83,255,0.32)] bg-[rgba(117,83,255,0.10)] px-1.5 py-0.5 text-[10px] text-[#D8D1FF]">
                    {selectedTypes.length}
                  </span>
                ) : null}
              </button>

              {filterOpen ? (
                <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-lg border border-[#141119] bg-[#24202B] shadow-[0_18px_42px_rgba(0,0,0,0.34)]">
                  <div className="flex items-center justify-between border-b border-[#141119] px-3.5 py-3">
                    <p className="text-sm font-semibold text-white">Filter priorities</p>
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      className="text-[#A9A3B2] hover:text-white"
                      aria-label="Close filters"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>

                  <div className="p-3.5">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8F879D]">
                      Category
                    </p>
                    <div className="space-y-1">
                      {typeOptions.map((type) => {
                        const checked = selectedTypes.includes(type);

                        return (
                          <label
                            key={type}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-[#E7E5EA] hover:bg-white/[0.03]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleType(type)}
                              className="size-4 accent-[#7553FF]"
                            />
                            <span>{type}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#141119] px-3.5 py-3">
                    <button
                      type="button"
                      onClick={() => setSelectedTypes([])}
                      className="text-xs font-medium text-[#A9A3B2] hover:text-white"
                    >
                      Clear filters
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
          </div>
        </div>

        {visibleItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full table-fixed text-left">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[15%]" />
                <col className="w-[17%]" />
                <col className="w-[25%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#1F1B26] text-[10px] uppercase tracking-[0.14em] text-[#8F879D]">
                  <th className="border-b border-[#141119] px-5 py-3 font-medium">Item</th>
                  <th className="border-b border-[#141119] px-4 py-3 font-medium">Category</th>
                  <th className="border-b border-[#141119] px-4 py-3 font-medium">Status</th>
                  <th className="border-b border-[#141119] px-4 py-3 font-medium">Impact</th>
                  <th className="border-b border-[#141119] px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  const selected = activeItem?.id === item.id;

                  return (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      onClick={() => setSelectedId(item.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(item.id);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-b border-[#141119] outline-none transition-colors last:border-b-0 hover:bg-white/[0.02] focus-visible:shadow-[inset_0_0_0_2px_#7553FF]",
                        selected &&
                          "bg-[rgba(117,83,255,0.08)] shadow-[inset_2px_0_0_#7553FF,inset_0_1px_0_rgba(117,83,255,0.35),inset_0_-1px_0_rgba(117,83,255,0.35)]",
                      )}
                    >
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[rgba(231,229,234,0.16)] bg-white/[0.02] text-xs font-semibold text-white">
                            {item.title
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase() ?? "")
                              .join("") || "EN"}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                            <p className="mt-1 text-xs text-[#8F879D]">
                              Requires operational follow-up
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={cn(
                            "inline-flex min-h-6 items-center rounded-[4px] border px-2 py-1 text-xs font-medium",
                            getToneTagClass(item.tone),
                          )}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              getToneDotClass(item.tone),
                            )}
                          />
                          <span>{item.status}</span>
                        </div>
                        {item.statusNote ? (
                          <p className="mt-1 text-xs text-[#8F879D]">{item.statusNote}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top text-sm leading-5 text-[#A9A3B2]">
                        <span className="line-clamp-2">{item.impact}</span>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <DimensionalLink href={item.href}>
                            {item.actionLabel}
                          </DimensionalLink>
                          <ChevronRight className="size-4 text-[#8F879D]" aria-hidden />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-white">No priorities match these filters</p>
            <p className="mt-1 text-sm text-[#A9A3B2]">
              Clear the search or filters to show operational items again.
            </p>
          </div>
        )}
      </div>

      {activeItem ? (
        <aside className="overflow-hidden rounded-[10px] border border-[#141119] bg-[#26222F] shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
          <div className="border-b border-[#141119] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[rgba(231,229,234,0.16)] bg-white/[0.02] text-sm font-semibold text-white">
                  {activeItem.title
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? "")
                    .join("") || "EN"}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-white">{activeItem.title}</h3>
                  <p className="mt-1 text-xs text-[#A9A3B2]">
                    Requires operational follow-up
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-[#8F879D] transition hover:text-white"
                aria-label="Close details"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex min-h-6 items-center rounded-[4px] border px-2 py-1 text-xs font-medium",
                  getToneTagClass(activeItem.tone),
                )}
              >
                {activeItem.type}
              </span>
              <span className="text-xs text-[#8F879D]">{activeItem.status}</span>
            </div>

            {activeItem.stages && activeItem.stages.length > 0 ? (
              <div
                className="mt-5 grid gap-0"
                style={{
                  gridTemplateColumns: `repeat(${activeItem.stages.length}, minmax(0, 1fr))`,
                }}
              >
                {activeItem.stages.map((stage, index) => (
                  <div key={stage.label} className="relative min-w-0 pt-6 text-center">
                    {index > 0 ? (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute left-[-50%] top-[6px] h-px w-full",
                          stage.state === "done" || stage.state === "active"
                            ? "bg-[rgba(117,83,255,0.34)]"
                            : "bg-white/10",
                        )}
                      />
                    ) : null}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-1/2 top-0 z-10 size-3 -translate-x-1/2 rounded-full border",
                        stage.state === "idle"
                          ? "border-white/20 bg-[#2E2936]"
                          : "border-[#7553FF] bg-[#7553FF]",
                        stage.state === "active" &&
                          "shadow-[0_0_0_4px_rgba(117,83,255,0.14)]",
                      )}
                    />
                    <p
                      className={cn(
                        "truncate text-[10px]",
                        stage.state === "active" ? "text-white" : "text-[#8F879D]",
                      )}
                    >
                      {stage.label}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="p-4">
            <div
              className={cn(
                "rounded-lg border p-3.5",
                getHighlightClass(activeItem.tone),
                activeItem.tone === "violet" && "pl-14",
              )}
            >
              <p className="text-[11px] font-semibold text-[#D8D1FF]">Current state</p>
              <p className="mt-1 text-sm font-semibold text-white">{activeItem.status}</p>
              <p className="mt-2 text-xs leading-5 text-[#D3CEDA]">{activeItem.impact}</p>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.012]">
              {activeItem.details.map((detail, index) => (
                <div
                  key={`${detail.label}-${detail.value}`}
                  className={cn(
                    "grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-3.5 py-3 text-xs",
                    index > 0 && "border-t border-white/[0.07]",
                  )}
                >
                  <span className="text-[#8F879D]">{detail.label}</span>
                  <span className="break-words text-white">{detail.value}</span>
                </div>
              ))}
            </div>

            <p className="mb-2 mt-4 text-xs font-semibold text-white">Operational actions</p>
            <div className="grid gap-2">
              {activeItem.secondaryAction ? (
                <DimensionalLink
                  href={activeItem.secondaryAction.href}
                  variant="secondary"
                  className="w-full"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  {activeItem.secondaryAction.label}
                </DimensionalLink>
              ) : null}
              <DimensionalLink href={activeItem.href} className="w-full">
                {activeItem.actionLabel}
                <ChevronRight className="size-3.5" aria-hidden />
              </DimensionalLink>
            </div>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
