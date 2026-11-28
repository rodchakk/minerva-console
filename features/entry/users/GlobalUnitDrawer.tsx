"use client";

import Link from "next/link";
import { X, Home } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { EntryDrawerTabs, EntryDrawerSection, EntryDrawerField } from "@/features/entry/components/EntryDrawerTabs";
import { CommunityUnitQuickActions } from "@/features/entry/communities/CommunityUnitQuickActions";
import { UnitRelationshipsPanel } from "@/features/entry/communities/UnitRelationshipsPanel";
import { ResidentQuickCreate } from "@/features/entry/communities/ResidentQuickCreate";
import { entryButtonClass } from "@/components/ui/entryButtonStyles";
import { getGlobalUnitAction, type GlobalUnitResult } from "./globalUnitActions";

type Tab = "overview" | "household" | "operational" | "connections" | "actions";
type Detail = NonNullable<Awaited<ReturnType<typeof getGlobalUnitAction>>>;

export function GlobalUnitDrawer({ target, close, openUnit, openUser, navigationError, onBack, onChanged }: {
  target: GlobalUnitResult; close: () => void;
  openUnit: (id: string, label: string) => void;
  openUser: (id: string) => Promise<void>;
  navigationError: string;
  onBack?: () => void; onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => { setRevision(n => n+1); onChanged(); }, [onChanged]);
  useEffect(() => {
    let live = true;
    getGlobalUnitAction(target.communityId, target.id).then(result => {
      if (!live) return;
      setDetail(result);
      setError(result ? "" : "Unit details are unavailable.");
    }).catch(() => { if (live) { setDetail(null); setError("Unable to load this unit."); } });
    return () => { live = false; };
  }, [target.communityId, target.id, revision]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) close(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [close]);
  const unit = detail?.unit;
  const rel = detail?.relationships;
  const links = rel?.enabled ? rel.links : [];
  const people = rel?.enabled ? rel.responsibilities : [];
  const lastAccess = unit?.lastAccess === "Not available" ? "No access recorded" : unit?.lastAccess;
  return <aside className="fixed bottom-5 right-5 top-[76px] z-50 flex w-[440px] flex-col overflow-hidden rounded-[10px] border border-[#141119] bg-[#292431] shadow-[0_24px_70px_rgba(0,0,0,0.45)] max-xl:inset-x-0 max-xl:bottom-0 max-xl:top-[54px] max-xl:w-auto max-xl:rounded-none" aria-label="Unit management">
    <div className="shrink-0 border-b border-[#141119] bg-[#292431] p-4">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#BEB4FF]">{onBack && <button type="button" onClick={onBack} className="mr-3 text-white normal-case">‹ Back</button>}Unit management</p>
          <div className="mt-2 flex gap-3"><Home className="mt-1 size-5 text-[#BEB4FF]"/><div><h2 className="text-base font-semibold text-white">{unit?.label ?? target.label}</h2><p className="text-xs text-[#A9A3B2]">{target.communityName} · Unit details</p></div></div>
        </div>
        <button type="button" aria-label="Close unit details" onClick={close} className="grid size-8 shrink-0 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#8F879D]"><X className="size-4"/></button>
      </div>
      <div className="mt-3 text-xs font-semibold text-[#D3CEDA]">{(unit?.isActive ?? target.isActive) ? "Active" : "Inactive"}{unit && ` · ${unit.pendingActivations} pending activations`}</div>
    </div>
    <EntryDrawerTabs<Tab> label="Unit management sections" tabs={[{id:"overview",label:"Overview"},{id:"household",label:unit ? `Household (${unit.residents.length})` : "Household"},{id:"operational",label:"Operational"},{id:"connections",label:"Unit connections"},{id:"actions",label:"Actions"}]} value={tab} onChange={setTab}/>
    <div role="tabpanel" className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain p-3.5 [scrollbar-gutter:stable]">
      {navigationError && <p role="alert" className="text-xs text-rose-300">{navigationError}</p>}
      {error ? <p role="alert" className="text-xs text-rose-300">{error}</p> : !unit || !detail ? <p className="text-xs text-[#A9A3B2]">Loading unit...</p> : <>
        {tab === "overview" && <>
          <EntryDrawerSection title="Unit information"><EntryDrawerField label="Location reference">{unit.unitReference || "Not registered"}</EntryDrawerField><EntryDrawerField label="Resident-facing reference">{unit.publicReference || "Not registered"}</EntryDrawerField><EntryDrawerField label="Status">{unit.isActive ? "Active":"Inactive"}</EntryDrawerField></EntryDrawerSection>
          <EntryDrawerSection title="Access summary"><EntryDrawerField label="Last access">{lastAccess}</EntryDrawerField><EntryDrawerField label="Pending activation">{unit.pendingActivations}</EntryDrawerField></EntryDrawerSection>
          <EntryDrawerSection title="Unit connections"><EntryDrawerField label="Linked units">{rel?.error ? "Unavailable" : rel?.enabled ? links.length : "Not enabled"}</EntryDrawerField><EntryDrawerField label="Responsible people">{rel?.error ? "Unavailable" : rel?.enabled ? people.length : "Not enabled"}</EntryDrawerField></EntryDrawerSection>
        </>}
        {tab === "household" && <EntryDrawerSection title={`Household · ${unit.residents.length} residents`}>
          {unit.residents.map(r => <button type="button" key={r.userId} onClick={() => void openUser(r.userId)} className="block w-full border-b border-white/5 px-3.5 py-3 text-left hover:bg-white/[0.02]"><span className="block text-sm font-semibold text-white">{r.fullName}</span><span className="block text-xs text-[#A9A3B2]">{r.isPrimary ? "Primary resident" : r.role} · {r.isActive ? "Active" : "Inactive"}</span></button>)}
          {unit.pendingActivationItems.map(r => <div key={r.id} className="border-b border-white/5 px-3.5 py-3"><p className="text-sm font-semibold text-white">{r.residentName}</p><p className="text-xs text-[#BEB4FF]">Pending activation · {r.status}</p></div>)}
          {!unit.residents.length && !unit.pendingActivationItems.length && <p className="p-3 text-xs text-[#A9A3B2]">No residents linked.</p>}
        </EntryDrawerSection>}
        {tab === "operational" && <>
          <EntryDrawerSection title="Operational context"><EntryDrawerField label="Activation queue">{unit.pendingActivations ? `${unit.pendingActivations} pending` : "Queue clear"}</EntryDrawerField><EntryDrawerField label="Access activity">{lastAccess}</EntryDrawerField><EntryDrawerField label="Unit status">{unit.isActive ? "Active":"Inactive"}</EntryDrawerField></EntryDrawerSection>
          {unit.activePassItems.length > 0 && <EntryDrawerSection title="Active passes">{unit.activePassItems.slice(0,6).map(pass => <div key={pass.id} className="px-3.5 py-3"><p className="text-sm text-white">{pass.passName}</p><p className="text-xs text-[#A9A3B2]">{pass.holderName || pass.residentName} · {pass.status}</p></div>)}</EntryDrawerSection>}
        </>}
        {tab === "connections" && (rel?.enabled ? <>
          <UnitRelationshipsPanel communityId={target.communityId} unitId={unit.id} unitLabel={unit.label} units={rel.units} people={rel.people} peopleHasMore={rel.peopleHasMore} links={rel.links} responsibilities={rel.responsibilities} selectorError={rel.selectorError} onChanged={refresh} compact onOpenUnit={openUnit} onOpenUser={id=>void openUser(id)}/>
        </> : <p className="text-xs text-[#A9A3B2]">{rel?.error || "Unit relationships are not enabled for this community."}</p>)}
        {tab === "actions" && <EntryDrawerSection title="Unit actions"><div className="p-3"><CommunityUnitQuickActions communityId={target.communityId} unit={unit} onChanged={refresh}/></div></EntryDrawerSection>}
      </>}
    </div>
    {unit && detail && <footer className="shrink-0 space-y-2 border-t border-[#141119] bg-[#292431] p-3">
      <ResidentQuickCreate communityId={target.communityId} communityName={target.communityName} houses={detail.houses} fixedUnitId={unit.id} onChanged={refresh} triggerClassName={entryButtonClass("primary","w-full")}/>
      <Link href={`/products/entry/communities/${target.communityId}/units/${unit.id}`} className={entryButtonClass("secondary","w-full")}>Open unit details</Link>
      <button type="button" onClick={refresh} className={entryButtonClass("secondary","w-full")}>Refresh unit</button>
    </footer>}
  </aside>;
}
