"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { deleteCommunityUnitsAction } from "@/features/entry/communities/unitDeletionActions";

export type BulkDeleteUnit = {
  id: string;
  label: string;
};

export function UnitBulkDeleteManager({
  communityId,
  units,
}: {
  communityId: string;
  units: BulkDeleteUnit[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredUnits = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-GT");
    if (!normalized) return units;
    return units.filter((unit) =>
      unit.label.toLocaleLowerCase("es-GT").includes(normalized),
    );
  }, [query, units]);

  const allFilteredSelected =
    filteredUnits.length > 0 && filteredUnits.every((unit) => selected.has(unit.id));

  function toggleUnit(unitId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
    setMessage(null);
  }

  function toggleAllFiltered() {
    setSelected((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredUnits.forEach((unit) => next.delete(unit.id));
      } else {
        filteredUnits.forEach((unit) => next.add(unit.id));
      }
      return next;
    });
    setMessage(null);
  }

  function closeManager() {
    if (isPending) return;
    setOpen(false);
    setMessage(null);
  }

  function deleteSelected() {
    const houseIds = Array.from(selected);
    if (houseIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${houseIds.length} selected unit${houseIds.length === 1 ? "" : "s"}?\n\nOnly empty units can be deleted. Units with residents, registrations, passes, activations, or operational history are protected and the operation will stop.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteCommunityUnitsAction({ communityId, houseIds });
      if (!result.success) {
        setMessage(result.message ?? "The selected units could not be deleted.");
        return;
      }

      setSelected(new Set());
      setMessage(
        `${result.deletedCount ?? houseIds.length} unit${(result.deletedCount ?? houseIds.length) === 1 ? "" : "s"} deleted.`,
      );
      router.refresh();
      window.setTimeout(() => {
        setOpen(false);
        setMessage(null);
      }, 700);
    });
  }

  if (units.length === 0) return null;

  return (
    <div className="mb-4 flex justify-end">
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4" aria-hidden />
        Manage / delete units
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <section className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#151515] shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
                  Unit management
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">Select units to delete</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Delete one, several, or all empty units. Units with real activity are protected.
                </p>
              </div>
              <button
                type="button"
                onClick={closeManager}
                className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Close unit manager"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>

            <div className="border-b border-white/10 px-5 py-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search unit..."
                  className="h-11 w-full rounded-lg border border-white/10 bg-black/20 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400/50"
                />
              </label>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  onClick={toggleAllFiltered}
                  className="font-semibold text-violet-200 transition hover:text-white"
                >
                  {allFilteredSelected ? "Clear visible selection" : `Select all ${filteredUnits.length} shown`}
                </button>
                <span className="text-slate-400">{selected.size} selected</span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {filteredUnits.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-400">No units match this search.</div>
              ) : (
                <div className="space-y-1">
                  {filteredUnits.map((unit) => {
                    const checked = selected.has(unit.id);
                    return (
                      <label
                        key={unit.id}
                        className={[
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition",
                          checked
                            ? "border-violet-400/30 bg-violet-500/10"
                            : "border-transparent bg-white/[0.025] hover:bg-white/[0.05]",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUnit(unit.id)}
                          className="h-4 w-4 accent-violet-500"
                        />
                        <span className="font-semibold text-white">{unit.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <footer className="border-t border-white/10 px-5 py-4">
              {message ? (
                <p className={`mb-3 text-sm ${message.includes("deleted") ? "text-emerald-300" : "text-rose-300"}`}>
                  {message}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-xs leading-5 text-slate-500">
                  Deletion is permanent. If any selected unit has residents, registration history, passes, activations, reservations, alerts, financial history, or logs, the database blocks the deletion.
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={closeManager} disabled={isPending}>
                    Cancel
                  </Button>
                  <button
                    type="button"
                    onClick={deleteSelected}
                    disabled={selected.size === 0 || isPending}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                    {isPending ? "Deleting..." : `Delete selected (${selected.size})`}
                  </button>
                </div>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
