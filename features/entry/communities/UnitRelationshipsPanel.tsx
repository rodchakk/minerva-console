"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, CheckCircle2, Link2, Pencil, Search, Settings2, UserRound, X, AlertCircle } from "lucide-react";
import { manageUnitRelationship, searchCommunityMemberOptions, searchRelationshipUnits } from "@/features/entry/communities/unitRelationshipActions";

type Option = { id: string; label: string };
type Link = { id: string; unitId: string; label: string; warning: string | null };
type Responsibility = { id: string; userId: string; label: string; role: string; active: boolean; warning: string | null };
type Feedback = { tone: "success" | "error"; text: string };

const inputStyle = "h-10 w-full min-w-0 rounded-md border border-white/10 bg-[#201C27] px-3 text-sm text-white outline-none placeholder:text-[#8F879D] focus:border-[#9D83FF]";
const actionStyle = "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[#6542DD] bg-[#7553FF] px-4 text-xs font-semibold text-white transition hover:bg-[#8669FF] disabled:cursor-not-allowed disabled:opacity-45";
const secondaryStyle = "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-white/15 px-3 text-xs font-semibold text-[#E7E5EA] transition hover:border-white/30 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40";

function shortLabel(label: string) {
  const boundary = label.indexOf(" · ");
  return boundary < 0 ? label : label.slice(0, boundary);
}

export function UnitRelationshipsPanel({
  communityId, unitId, unitLabel, units, people, peopleHasMore, links, responsibilities, selectorError,
}: {
  communityId: string; unitId: string; unitLabel: string; units: Option[]; people: Option[];
  peopleHasMore: boolean; links: Link[]; responsibilities: Responsibility[]; selectorError: string | null;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [unitSearch, setUnitSearch] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [searchedUnits, setSearchedUnits] = useState<Option[] | null>(null);
  const [searchedPeople, setSearchedPeople] = useState<Option[] | null>(null);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [personPage, setPersonPage] = useState(0);
  const [searchedPeopleHasMore, setSearchedPeopleHasMore] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  const availableUnits = (searchedUnits ?? units).filter((item) => item.id !== unitId && !links.some((link) => link.unitId === item.id));
  const availablePeople = (searchedPeople ?? people).filter((item) => !responsibilities.some((responsibility) => responsibility.userId === item.id));
  const hasMorePeople = searchedPeopleHasMore ?? peopleHasMore;

  function run(input: Parameters<typeof manageUnitRelationship>[0], successText: string) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await manageUnitRelationship(input);
        if (!result.success) {
          setFeedback({ tone: "error", text: result.error ?? "Could not save this change." });
          return;
        }
        setSearchedUnits(null);
        setSearchedPeople(null);
        setSelectedUnit("");
        setSelectedPerson("");
        setUnitSearch("");
        setPersonSearch("");
        setPersonPage(0);
        setSearchedPeopleHasMore(null);
        setFeedback({ tone: "success", text: successText });
        router.refresh();
      } catch {
        setFeedback({ tone: "error", text: "Could not confirm the change. Refresh this page before trying again." });
      }
    });
  }

  function searchUnits() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await searchRelationshipUnits(communityId, unitSearch);
        setSearchedUnits(result.options);
        setSelectedUnit("");
        if (result.error) setFeedback({ tone: "error", text: result.error });
      } catch {
        setFeedback({ tone: "error", text: "Could not search units. Please try again." });
      }
    });
  }

  function searchPeople() {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await searchCommunityMemberOptions(communityId, personSearch, 0);
        setSearchedPeople(result.options);
        setSelectedPerson("");
        setPersonPage(0);
        setSearchedPeopleHasMore(result.hasMore);
        if (result.error) setFeedback({ tone: "error", text: result.error });
      } catch {
        setFeedback({ tone: "error", text: "Could not search people. Please try again." });
      }
    });
  }

  function loadPeoplePage(page: number) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await searchCommunityMemberOptions(communityId, "", page * 100);
        setPersonSearch("");
        setSearchedPeople(result.options);
        setSelectedPerson("");
        setPersonPage(page);
        setSearchedPeopleHasMore(result.hasMore);
        if (result.error) setFeedback({ tone: "error", text: result.error });
      } catch {
        setFeedback({ tone: "error", text: "Could not load community members. Please try again." });
      }
    });
  }

  return (
    <section aria-label="Unit relationships" className="space-y-4 rounded-[10px] border border-[rgba(155,125,229,0.25)] bg-[#282230] p-4 sm:p-5">
      {feedback && (
        <div role={feedback.tone === "error" ? "alert" : "status"} className={feedback.tone === "success"
          ? "flex items-start gap-3 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-3 text-emerald-100"
          : "flex items-start gap-3 rounded-lg border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-rose-100"}>
          {feedback.tone === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{feedback.tone === "success" ? "Change saved" : "Could not save change"}</p>
            <p className="mt-0.5 text-xs">{feedback.text}</p>
          </div>
          <button type="button" aria-label="Dismiss message" onClick={() => setFeedback(null)} className="shrink-0 text-current/70 hover:text-current"><X className="size-4" aria-hidden /></button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#7553FF]/15 text-[#C6B5FF]">
            <Link2 className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Relationships &amp; responsibilities</h2>
            <p className="mt-1 text-xs leading-5 text-[#B8B0C4]">Related units stay independent. Linking them does not change residents, QR passes or access.</p>
            <p className="text-xs leading-5 text-[#B8B0C4]">Responsible people are administrative contacts, not automatically residents of linked units.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Relationship summary">
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white"><Building2 className="size-4 text-[#BCA5FF]" aria-hidden /><strong>{links.length}</strong> related {links.length === 1 ? "unit" : "units"}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-white"><UserRound className="size-4 text-[#BCA5FF]" aria-hidden /><strong>{responsibilities.length}</strong> responsible {responsibilities.length === 1 ? "person" : "people"}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="min-w-0 space-y-3 rounded-lg border border-white/10 bg-[#24202B] p-4" aria-labelledby="unit-links-heading">
          <div>
            <h3 id="unit-links-heading" className="flex items-center gap-2 text-base font-semibold text-white"><Building2 className="size-4 text-[#BC9AFF]" aria-hidden />Related units</h3>
            <p className="mt-1 text-xs leading-5 text-[#A9A3B2]">Connect another house or apartment without merging either unit.</p>
          </div>
          <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); searchUnits(); }}>
            <label className="relative min-w-[190px] flex-1">
              <span className="sr-only">Search units by name or UUID</span>
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-[#8F879D]" aria-hidden />
              <input value={unitSearch} onChange={(event) => setUnitSearch(event.currentTarget.value)} placeholder="Search units by name or UUID" className={inputStyle + " pl-9"} />
            </label>
            <button type="submit" disabled={pending} className={secondaryStyle}>Search</button>
          </form>
          <div className="flex flex-wrap gap-2">
            <label className="min-w-[190px] flex-1">
              <span className="sr-only">Unit to link</span>
              <select value={selectedUnit} onChange={(event) => setSelectedUnit(event.currentTarget.value)} disabled={pending} className={inputStyle}>
                <option value="">Choose a unit to link</option>
                {availableUnits.map((item) => <option key={item.id} value={item.id}>{shortLabel(item.label)}</option>)}
              </select>
            </label>
            <button type="button" disabled={pending || !selectedUnit} className={actionStyle} onClick={() => {
              const target = availableUnits.find((item) => item.id === selectedUnit);
              if (!target) return;
              run({ action: "link_units", communityId, unitId, otherUnitId: target.id }, shortLabel(target.label) + " is now related to " + unitLabel + ".");
            }}>+ Link unit</button>
          </div>
          {searchedUnits && availableUnits.length === 0 && <p className="text-xs text-[#A9A3B2]">No other units match this search.</p>}
          {links.length ? <ul className="space-y-2">{links.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-md bg-white/[0.05]"><Building2 className="size-4 text-[#D9CBFF]" aria-hidden /></div>
                <div className="min-w-0">
                  <NextLink className="break-words text-sm font-semibold text-white underline-offset-2 hover:text-[#CAB8FF] hover:underline" href={`/products/entry/communities/${communityId}/units/${item.unitId}`}>{shortLabel(item.label)}</NextLink>
                  {item.warning && <p className="mt-1 text-xs text-amber-200">{item.warning}</p>}
                </div>
              </div>
              <button type="button" disabled={pending} className={secondaryStyle} onClick={() => {
                if (!window.confirm("Unlink " + shortLabel(item.label) + " from " + unitLabel + "? Both units will remain unchanged.")) return;
                run({ action: "unlink_units", communityId, unitId, recordId: item.id }, shortLabel(item.label) + " was unlinked from " + unitLabel + ".");
              }}>Unlink</button>
            </li>
          ))}</ul> : <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-[#A9A3B2]">No related units yet. Choose a unit above to link it.</p>}
        </section>

        <section className="min-w-0 space-y-3 rounded-lg border border-white/10 bg-[#24202B] p-4" aria-labelledby="responsible-people-heading">
          <div>
            <h3 id="responsible-people-heading" className="flex items-center gap-2 text-base font-semibold text-white"><UserRound className="size-4 text-[#BC9AFF]" aria-hidden />Responsible people</h3>
            <p className="mt-1 text-xs leading-5 text-[#A9A3B2]">Assign community members as administrative contacts for this unit only.</p>
          </div>
          <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); searchPeople(); }}>
            <label className="relative min-w-[190px] flex-1">
              <span className="sr-only">Search community members by name, email or UUID</span>
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-[#8F879D]" aria-hidden />
              <input value={personSearch} onChange={(event) => setPersonSearch(event.currentTarget.value)} placeholder="Search people by name, email or UUID" className={inputStyle + " pl-9"} />
            </label>
            <button type="submit" disabled={pending} className={secondaryStyle}>Search</button>
          </form>
          <div className="flex flex-wrap gap-2">
            <label className="min-w-[190px] flex-1">
              <span className="sr-only">Person to assign</span>
              <select value={selectedPerson} onChange={(event) => setSelectedPerson(event.currentTarget.value)} disabled={pending} className={inputStyle}>
                <option value="">Choose a community member</option>
                {availablePeople.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <button type="button" disabled={pending || !selectedPerson} className={actionStyle} onClick={() => {
              const target = availablePeople.find((item) => item.id === selectedPerson);
              if (!target) return;
              run({ action: "assign_responsible", communityId, unitId, userId: target.id }, shortLabel(target.label) + " is now a responsible contact for " + unitLabel + ".");
            }}>+ Assign responsible</button>
          </div>
          {searchedPeople && availablePeople.length === 0 && <p className="text-xs text-[#A9A3B2]">No other community members match this search.</p>}
          {personSearch === "" && (personPage > 0 || hasMorePeople) && <div className="flex items-center gap-2 text-xs">
            <button type="button" disabled={pending || personPage === 0} className={secondaryStyle} onClick={() => loadPeoplePage(personPage - 1)}>Previous</button>
            <span className="text-[#A9A3B2]">Page {personPage + 1}</span>
            <button type="button" disabled={pending || !hasMorePeople} className={secondaryStyle} onClick={() => loadPeoplePage(personPage + 1)}>Next</button>
          </div>}
          {responsibilities.length ? <ul className="space-y-2">{responsibilities.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#7553FF]/30 text-xs font-semibold text-white">{item.label.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="break-words text-sm font-semibold text-white">{item.label}</span><span className="rounded-full bg-[#7553FF]/20 px-2 py-0.5 text-[10px] text-[#D4C5FF]">{item.role === "RESIDENT" ? "Resident" : item.role}</span>{!item.active && <span className="rounded-full border border-amber-400/20 px-2 py-0.5 text-[10px] text-amber-200">Inactive</span>}</div>
                  {item.warning && <p className="mt-1 text-xs text-amber-200">{item.warning}</p>}
                </div>
              </div>
              <button type="button" disabled={pending} className={secondaryStyle} onClick={() => {
                if (!window.confirm("Remove " + item.label + " as a responsible contact for " + unitLabel + "? Their resident account will not change.")) return;
                run({ action: "remove_responsible", communityId, unitId, recordId: item.id }, item.label + " is no longer a responsible contact for " + unitLabel + ".");
              }}>Remove</button>
            </li>
          ))}</ul> : <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-[#A9A3B2]">No responsible people assigned yet. This does not affect the unit's residents.</p>}
        </section>
      </div>

      {selectorError && <p role="alert" className="text-xs text-amber-200">Some assignment options could not be loaded. Existing relationships are still visible.</p>}
      <details className="group border-t border-white/10 pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[#B8B0C4] hover:text-white"><Settings2 className="size-4" aria-hidden />Edit unit label <span className="text-[10px] font-normal">(advanced)</span></summary>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const label = String(data.get("label") ?? "").trim(); if (label && label !== unitLabel) run({ action: "rename_unit", communityId, unitId, label, expectedLabel: unitLabel }, "Unit label changed from " + unitLabel + " to " + label + "."); }}>
          <label className="grid min-w-[190px] max-w-sm flex-1 gap-1 text-xs text-[#A9A3B2]">Visible unit label<input key={unitLabel} name="label" defaultValue={unitLabel} maxLength={120} required className={inputStyle} /></label>
          <button type="submit" disabled={pending} className={secondaryStyle}><Pencil className="size-4" aria-hidden />Save label</button>
        </form>
        <p className="mt-2 text-[11px] text-[#A9A3B2]">Renaming changes only the visible label, not this unit's ID. Protected activations or duplicate labels can prevent a rename.</p>
      </details>
    </section>
  );
}
