"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getUserResponsibleUnits, manageUnitRelationship, searchRelationshipUnits } from "@/features/entry/communities/unitRelationshipActions";

export function ResponsibleUnitsForPerson({ communityId, userId }: { communityId: string; userId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getUserResponsibleUnits>> | null>(null);
  const [message, setMessage] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [searchedUnits, setSearchedUnits] = useState<Array<{ id: string; label: string }> | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let current = true;
    getUserResponsibleUnits(communityId, userId).then((result) => { if (current) setData(result); }).catch(() => { if (current) setMessage("Could not load responsible units. Please reopen this detail."); });
    return () => { current = false; };
  }, [communityId, userId]);
  function run(action: "assign_responsible" | "remove_responsible", unitId: string, recordId?: string) {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await manageUnitRelationship({ action, communityId, unitId, userId, recordId });
        if (!result.success) { setMessage(result.error ?? "Could not update responsibility."); return; }
        setMessage("Saved.");
        setSearchedUnits(null);
        setData(await getUserResponsibleUnits(communityId, userId));
      } catch {
        setMessage("Could not confirm the change. Reopen this detail before retrying.");
      }
    });
  }
  function searchUnits() {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await searchRelationshipUnits(communityId, unitSearch);
        setSearchedUnits(result.options);
        if (result.error) setMessage(result.error);
      } catch {
        setMessage("Could not search units. Please try again.");
      }
    });
  }
  if (!data && message) return <p role="alert">{message}</p>;
  if (!data) return <p className="mt-4 text-sm text-[var(--console-text-muted)]">Loading responsible units…</p>;
  if (!data.enabled) return null;
  const assigned = new Set(data.items.map((item) => item.houseId));
  const availableUnits = searchedUnits ?? data.units;
  return <section className="mt-5 border-t border-[var(--console-border)] pt-4">
    <h3 className="font-semibold text-white">Units under responsibility</h3>
    {data.error && <p role="alert" className="mt-2 text-sm text-rose-200">{data.error}</p>}
    {data.items.length ? <ul className="mt-2 space-y-2">{data.items.map((item) => <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
      <div><Link className="text-violet-100 underline" href={`/products/entry/communities/${communityId}/units/${item.houseId}`}>{item.label}</Link>{item.warning && <p className="text-xs text-amber-200">{item.warning}</p>}</div>
      <button type="button" disabled={pending} className="text-rose-200 disabled:opacity-50" onClick={() => run("remove_responsible", item.houseId, item.id)}>Remove</button>
    </li>)}</ul> : <p className="mt-2 text-sm text-[var(--console-text-muted)]">No units assigned.</p>}
    <form className="mt-3 flex max-w-md flex-wrap gap-2" action={searchUnits}>
      <input value={unitSearch} onChange={(event) => setUnitSearch(event.currentTarget.value)} placeholder="Search by unit label or UUID" className="min-w-56 flex-1 rounded-lg border border-[var(--console-border)] bg-slate-950 px-3 py-2 text-white" />
      <button disabled={pending} className="rounded-lg border border-[var(--console-border)] px-3 py-2 text-sm">Search</button>
    </form>
    <label className="mt-3 grid max-w-md gap-1 text-sm text-[var(--console-text-muted)]">Add unit
      <select disabled={pending} defaultValue="" onChange={(event) => { const id = event.currentTarget.value; if (id) run("assign_responsible", id); event.currentTarget.value = ""; }} className="rounded-lg border border-[var(--console-border)] bg-slate-950 px-3 py-2 text-white">
        <option value="">Choose an existing unit</option>{availableUnits.filter((unit) => !assigned.has(unit.id)).map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
      </select>
    </label>
    {message && <p role="status" className="mt-2 text-sm text-violet-100">{message}</p>}
  </section>;
}
