"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { manageUnitRelationship } from "@/features/entry/communities/unitRelationshipActions";

type Option = { id: string; label: string };
type Link = { id: string; unitId: string; label: string };
type Responsibility = { id: string; userId: string; label: string; role: string; active: boolean };

export function UnitRelationshipsPanel({
  communityId, unitId, unitLabel, units, people, links, responsibilities,
}: {
  communityId: string; unitId: string; unitLabel: string; units: Option[]; people: Option[];
  links: Link[]; responsibilities: Responsibility[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function run(input: Parameters<typeof manageUnitRelationship>[0]) {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await manageUnitRelationship(input);
        if (result.success) router.refresh();
        setMessage(result.success ? "Saved." : result.error ?? "Could not save changes.");
      } catch {
        setMessage("Could not confirm the change. Refresh this detail before retrying.");
      }
    });
  }
  return <section className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5" aria-label="Unit relationships">
    <div><h2 className="text-lg font-semibold text-white">Related units</h2>
      {links.length ? <ul className="mt-2 space-y-2">{links.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 text-sm"><NextLink href={`/products/entry/communities/${communityId}/units/${item.unitId}`}>{item.label}</NextLink><button disabled={pending} className="text-rose-200" onClick={() => run({ action: "unlink_units", communityId, unitId, recordId: item.id })}>Unlink</button></li>)}</ul> : <p className="mt-2 text-sm text-[var(--text-muted)]">No related units.</p>}
      <form className="mt-3 flex flex-wrap gap-2" action={(form) => { const otherUnitId = String(form.get("unit") ?? ""); if (otherUnitId) run({ action: "link_units", communityId, unitId, otherUnitId }); }}>
        <select name="unit" defaultValue="" className="min-w-56 rounded-lg border border-[var(--border)] bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Choose a unit to link</option>{units.filter((x) => x.id !== unitId && !links.some((l) => l.unitId === x.id)).map((x) => <option key={x.id} value={x.id}>{x.label} · {x.id.slice(0, 8)}</option>)}</select><button disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Link unit</button>
      </form>
    </div>
    <div><h2 className="text-lg font-semibold text-white">Responsible people</h2>
      {responsibilities.length ? <ul className="mt-2 space-y-2">{responsibilities.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 text-sm"><span>{item.label} · {item.role}{item.active ? "" : " · inactive"}{item.userId ? ` · ${item.userId.slice(0, 8)}` : ""}</span><button disabled={pending} className="text-rose-200" onClick={() => run({ action: "remove_responsible", communityId, unitId, recordId: item.id })}>Remove</button></li>)}</ul> : <p className="mt-2 text-sm text-[var(--text-muted)]">No responsible people.</p>}
      <form className="mt-3 flex flex-wrap gap-2" action={(form) => { const userId = String(form.get("person") ?? ""); if (userId) run({ action: "assign_responsible", communityId, unitId, userId }); }}>
        <select name="person" defaultValue="" className="min-w-56 rounded-lg border border-[var(--border)] bg-slate-950 px-3 py-2 text-sm text-white"><option value="">Choose a community member</option>{people.filter((x) => !responsibilities.some((r) => r.userId === x.id)).map((x) => <option key={x.id} value={x.id}>{x.label} · {x.id.slice(0, 8)}</option>)}</select><button disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Assign</button>
      </form>
    </div>
    <form className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-4" action={(form) => { const label = String(form.get("label") ?? ""); if (label && label !== unitLabel) run({ action: "rename_unit", communityId, unitId, label, expectedLabel: unitLabel }); }}>
      <label className="grid gap-1 text-sm text-[var(--text-muted)]">Visible unit label<input key={unitLabel} name="label" defaultValue={unitLabel} maxLength={120} required className="min-w-56 rounded-lg border border-[var(--border)] bg-slate-950 px-3 py-2 text-white" /></label><button disabled={pending} className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm">Save label</button>
    </form>
    {message && <p role="status" className="text-sm text-violet-100">{message}</p>}
  </section>;
}
