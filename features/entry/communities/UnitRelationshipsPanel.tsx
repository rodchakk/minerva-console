"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, CheckCircle2, Link2, Pencil, Search, Settings2, UserRound, X, AlertCircle, ChevronDown } from "lucide-react";
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
    <details aria-label="Unit connections" className="group shrink-0 overflow-hidden rounded-[9px] border border-white/10 bg-[#24202B] open:border-[#5E4B79]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3.5 text-white transition hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B6A0FF] [&::-webkit-details-marker]:hidden">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#55436C] bg-[#382D4B] text-[#CBB8FF]">
          <Link2 className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Unit connections</span>
          <span className="mt-0.5 block text-[11px] text-[#AEA3BB]">Optional administrative relationships · No impact on resident access</span>
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-[#C5BACD]">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">{links.length} linked {links.length === 1 ? "unit" : "units"}</span>
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">{responsibilities.length} responsible {responsibilities.length === 1 ? "person" : "people"}</span>
        </span>
        <span className="ml-1 text-xs font-semibold text-[#CBB8FF]">
          <span className="group-open:hidden">Manage</span>
          <span className="hidden group-open:inline">Close</span>
        </span>
        <ChevronDown className="size-4 text-[#BAADD0] transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div className="space-y-4 border-t border-white/10 px-4 py-4">
        {feedback && (
          <div role={feedback.tone === "error" ? "alert" : "status"} className={feedback.tone === "success"
            ? "flex items-start gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2.5 text-emerald-100"
            : "flex items-start gap-2 rounded-md border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2.5 text-rose-100"}>
            {feedback.tone === "success" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{feedback.tone === "success" ? "Change saved" : "Could not save change"}</p>
              <p className="mt-0.5 text-xs">{feedback.text}</p>
            </div>
            <button type="button" aria-label="Dismiss message" onClick={() => setFeedback(null)} className="shrink-0 text-current/70 hover:text-current"><X className="size-4" aria-hidden /></button>
          </div>
        )}
        <p className="text-xs leading-5 text-[#AAA0B4]">Linked units remain independent. A responsible contact applies to this unit only and is not automatically assigned to linked units.</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="min-w-0 space-y-2" aria-labelledby="unit-links-heading">
            <div>
              <h3 id="unit-links-heading" className="text-sm font-semibold text-white">Related units <span className="font-normal text-[#A9A0B5]">· {links.length}</span></h3>
              <p className="mt-1 text-xs text-[#9F95AC]">Units connected to {unitLabel}</p>
            </div>
            {links.length ? (
              <ul className="divide-y divide-white/[0.09]">
                {links.map((item) => <li key={item.id} className="flex items-center gap-2 py-2 text-xs">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-white/[0.045] text-[#BDAAE4]"><Building2 className="size-3.5" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <NextLink href={"/products/entry/communities/" + communityId + "/units/" + item.unitId} className="break-words font-semibold text-white hover:text-[#CEBBFF] hover:underline">{shortLabel(item.label)}</NextLink>
                    {item.warning && <p className="mt-1 text-amber-200">{item.warning}</p>}
                  </div>
                  <button type="button" disabled={pending} className="px-2 py-1 text-[11px] text-[#BFB3C9] hover:text-rose-200 disabled:opacity-40" onClick={() => {
                    if (!window.confirm("Unlink " + shortLabel(item.label) + " from " + unitLabel + "? Both units remain independent.")) return;
                    run({ action: "unlink_units", communityId, unitId, recordId: item.id }, shortLabel(item.label) + " was unlinked from " + unitLabel + ".");
                  }}>Remove</button>
                </li>)}
              </ul>
            ) : <p className="py-2 text-xs text-[#9F95AC]">No related units yet.</p>}
            <form className="flex flex-wrap gap-2 pt-2" onSubmit={(event) => { event.preventDefault(); searchUnits(); }}>
              <label className="relative min-w-[170px] flex-1">
                <span className="sr-only">Search units by name or UUID</span>
                <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-[#8F879D]" aria-hidden />
                <input value={unitSearch} onChange={(event) => setUnitSearch(event.currentTarget.value)} placeholder="Search units by name" className={inputStyle + " pl-8"} />
              </label>
              <button type="submit" disabled={pending} className={secondaryStyle}>Search</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <label className="min-w-[170px] flex-1">
                <span className="sr-only">Choose another unit</span>
                <select value={selectedUnit} disabled={pending} onChange={(event) => setSelectedUnit(event.currentTarget.value)} className={inputStyle}>
                  <option value="">Choose another unit...</option>
                  {availableUnits.map((item) => <option key={item.id} value={item.id}>{shortLabel(item.label)}</option>)}
                </select>
              </label>
              <button type="button" disabled={pending || !selectedUnit} className={secondaryStyle} onClick={() => {
                const target = availableUnits.find((item) => item.id === selectedUnit);
                if (target) run({ action: "link_units", communityId, unitId, otherUnitId: target.id }, shortLabel(target.label) + " is now related to " + unitLabel + ".");
              }}>+ Link</button>
            </div>
            {searchedUnits && !availableUnits.length && <p className="text-xs text-[#AAA0B4]">No other available units match your search.</p>}
            <p className="text-[11px] text-[#8F859B]">This unit and existing links are excluded from the selector.</p>
          </section>

          <section className="min-w-0 space-y-2 border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" aria-labelledby="responsible-people-heading">
            <div>
              <h3 id="responsible-people-heading" className="text-sm font-semibold text-white">Responsible contacts <span className="font-normal text-[#A9A0B5]">· {responsibilities.length}</span></h3>
              <p className="mt-1 text-xs text-[#9F95AC]">People responsible for this unit only</p>
            </div>
            {responsibilities.length ? (
              <ul className="divide-y divide-white/[0.09]">
                {responsibilities.map((item) => <li key={item.id} className="flex items-center gap-2 py-2 text-xs">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#7553FF]/20 text-[11px] font-semibold text-[#DCCEFF]">{item.label.slice(0,1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <span className="break-words font-semibold text-white">{item.label}</span>
                    <span className="ml-2 rounded-full bg-[#7553FF]/15 px-1.5 py-0.5 text-[10px] text-[#C8B6FF]">{item.role === "RESIDENT" ? "Resident" : item.role}</span>
                    {!item.active && <span className="ml-2 text-amber-200">Inactive</span>}
                    {item.warning && <p className="mt-1 text-amber-200">{item.warning}</p>}
                  </div>
                  <button type="button" disabled={pending} className="px-2 py-1 text-[11px] text-[#BFB3C9] hover:text-rose-200 disabled:opacity-40" onClick={() => {
                    if (!window.confirm("Remove " + item.label + " as responsible contact for " + unitLabel + "? Their resident account will not change.")) return;
                    run({ action: "remove_responsible", communityId, unitId, recordId: item.id }, item.label + " is no longer responsible for " + unitLabel + ".");
                  }}>Remove</button>
                </li>)}
              </ul>
            ) : <p className="py-2 text-xs text-[#9F95AC]">No responsible contacts yet.</p>}
            <form className="flex flex-wrap gap-2 pt-2" onSubmit={(event) => { event.preventDefault(); searchPeople(); }}>
              <label className="relative min-w-[170px] flex-1">
                <span className="sr-only">Search community people by name, email or UUID</span>
                <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-[#8F879D]" aria-hidden />
                <input value={personSearch} onChange={(event) => setPersonSearch(event.currentTarget.value)} placeholder="Search people by name or email" className={inputStyle + " pl-8"} />
              </label>
              <button type="submit" disabled={pending} className={secondaryStyle}>Search</button>
            </form>
            <div className="flex flex-wrap gap-2">
              <label className="min-w-[170px] flex-1">
                <span className="sr-only">Choose responsible contact</span>
                <select value={selectedPerson} disabled={pending} onChange={(event) => setSelectedPerson(event.currentTarget.value)} className={inputStyle}>
                  <option value="">Select community member...</option>
                  {availablePeople.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <button type="button" disabled={pending || !selectedPerson} className={secondaryStyle} onClick={() => {
                const target = availablePeople.find((item) => item.id === selectedPerson);
                if (target) run({ action: "assign_responsible", communityId, unitId, userId: target.id }, shortLabel(target.label) + " is now a responsible contact for " + unitLabel + ".");
              }}>+ Assign</button>
            </div>
            {!personSearch && (personPage > 0 || hasMorePeople) && <div className="flex items-center gap-2 text-xs text-[#9F95AC]">
              <button type="button" disabled={pending || personPage === 0} className={secondaryStyle} onClick={() => loadPeoplePage(personPage - 1)}>Previous</button>
              <span>Page {personPage + 1}</span>
              <button type="button" disabled={pending || !hasMorePeople} className={secondaryStyle} onClick={() => loadPeoplePage(personPage + 1)}>Next</button>
            </div>}
            {searchedPeople && !availablePeople.length && <p className="text-xs text-[#AAA0B4]">No available community members match your search.</p>}
            <p className="text-[11px] text-[#8F859B]">Responsibility is per unit and never inherited automatically.</p>
          </section>
        </div>
        {selectorError && <p role="alert" className="text-xs text-amber-200">Some options could not be loaded. Existing connections are still shown.</p>}
        <details className="border-t border-white/10 pt-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs text-[#A99CB9] hover:text-white"><Settings2 className="size-3.5" aria-hidden />Edit unit label (advanced)</summary>
          <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => {
            event.preventDefault();
            const label = String(new FormData(event.currentTarget).get("label") ?? "").trim();
            if (label && label !== unitLabel) run({ action: "rename_unit", communityId, unitId, label, expectedLabel: unitLabel }, "Unit label changed from " + unitLabel + " to " + label + ".");
          }}>
            <label className="grid min-w-[170px] max-w-sm flex-1 gap-1 text-xs text-[#9F95AC]">Visible unit label<input key={unitLabel} name="label" defaultValue={unitLabel} maxLength={120} required className={inputStyle} /></label>
            <button type="submit" disabled={pending} className={secondaryStyle}><Pencil className="size-3.5" aria-hidden />Save label</button>
          </form>
          <p className="mt-2 text-[11px] text-[#94899D]">Renaming does not change unit identity and may be blocked by pending activations or duplicate labels.</p>
        </details>
      </div>
    </details>
  );
}
