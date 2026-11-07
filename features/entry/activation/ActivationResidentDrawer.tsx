"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ActivationQueueRow } from "@/features/entry/activation/actions";
import { EditActivationEmailModal, EditActivationPhoneModal } from "@/features/entry/activation/ActivationResidentEditors";
import { ManageResidentActivationDialog } from "@/features/entry/activation/ManageResidentActivationDialog";
import { EntryDrawerField, EntryDrawerSection, EntryDrawerTabs } from "@/features/entry/components/EntryDrawerTabs";

export type ActivationResidentDrawerProps = {
  row: ActivationQueueRow;
  communityId: string;
  communityName: string;
  onClose: () => void;
  onChanged?: () => void;
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "R";
}

function statusLabel(value: string) {
  switch (value) {
    case "invited": return "Invited";
    case "pin_generated": return "PIN generated";
    case "activated": return "Activated";
    case "failed": return "Error";
    case "skipped": return "Skipped";
    default: return "Pending";
  }
}

function methodLabel(value: string) {
  switch (value) {
    case "email": return "Email";
    case "phone_pin": return "Phone PIN";
    case "username_pin": return "Username + PIN";
    default: return "Not configured";
  }
}

function followUpLabel(value: string) {
  switch (value) {
    case "needs_follow_up": return "Needs follow-up";
    case "not_invited": return "Not invited";
    case "recent": return "Recently invited";
    case "waiting": return "Waiting";
    case "completed": return "Completed";
    default: return "Pending";
  }
}

function getRecommendation(row: ActivationQueueRow) {
  if (row.status === "activated") return {
    title: "Activation completed",
    description: "This resident has already activated the account.",
  };
  if (row.status === "skipped") return {
    title: "Review skipped resident",
    description: "This record is outside the normal activation flow.",
  };
  if (row.status === "failed") return {
    title: "Review activation error",
    description: row.lastError !== "—" ? row.lastError : "Check the resident information before retrying.",
  };
  if (row.status === "invited") return {
    title: "Wait for resident activation",
    description: "An invitation has already been sent. Resend only after confirming non-delivery with the resident.",
  };
  if (row.status === "pin_generated") return {
    title: "Activation PIN ready",
    description: "A PIN exists for this resident. Generating a new one will replace the previous PIN.",
  };
  return {
    title: "Prepare resident activation",
    description: "Choose the existing email, PIN or active-account creation workflow.",
  };
}

function Progress({ row }: { row: ActivationQueueRow }) {
  const states = [
    { label: "Prepared", done: true },
    { label: "PIN ready", done: ["pin_generated", "invited", "activated"].includes(row.status) },
    { label: "Invite sent", done: ["invited", "activated"].includes(row.status) },
    { label: "Activated", done: row.status === "activated" },
  ];
  return (
    <section className="rounded-lg border border-white/[0.09] bg-white/[0.012] px-3.5 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#B7AEBD]">Activation progress</p>
      <div className="relative mt-4 grid grid-cols-4 gap-1">
        <span aria-hidden className="absolute left-[12%] right-[12%] top-3 h-px bg-white/15" />
        {states.map((stage, index) => (
          <div key={stage.label} className="relative flex min-w-0 flex-col items-center text-center">
            <span className={`grid size-6 place-items-center rounded-full border text-xs font-semibold ${
              stage.done
                ? "border-[#7553FF] bg-[#7553FF] text-white"
                : "border-white/15 bg-[#292431] text-[#A9A3B2]"
            }`}>{stage.done ? "✓" : index + 1}</span>
            <p className={`mt-2 text-[11px] leading-4 ${stage.done ? "text-white" : "text-[#A9A3B2]"}`}>{stage.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ActivationResidentDrawer({
  row, communityId, communityName, onClose, onChanged,
}: ActivationResidentDrawerProps) {
  const [tab, setTab] = useState<"details" | "history">("details");
  const [edit, setEdit] = useState<"email" | "phone" | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const actionable = !["activated", "skipped"].includes(row.status);
  const recommendation = getRecommendation(row);
  const followUpNeeded = row.followUpStatus === "needs_follow_up" || row.invitationAttemptCount >= 5;

  return (
    <>
      <aside aria-label={`Activation details for ${row.resident}`}
        className="fixed bottom-5 right-5 top-[76px] z-40 grid w-[440px] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-[10px] border border-[#141119] bg-[#292431] shadow-[0_24px_70px_rgba(0,0,0,0.45)] max-xl:inset-x-0 max-xl:bottom-0 max-xl:top-[54px] max-xl:w-auto max-xl:rounded-none">
        <header className="border-b border-[#141119] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full border border-violet-400/25 bg-violet-500/10 text-sm font-semibold text-[#D8D1FF]">
                {initials(row.resident)}
              </span>
              <div className="min-w-0">
                <p className="break-words text-[17px] font-semibold leading-6 text-white">{row.resident}</p>
                <p className="mt-1 break-words text-[13px] leading-5 text-[#B7AEBD]">
                  {row.unit}{communityName ? ` · ${communityName}` : ""}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="grid size-8 shrink-0 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#B7AEBD] transition hover:text-white"
              aria-label="Close resident details">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-[4px] border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-[12px] font-semibold text-[#D8D1FF]">{statusLabel(row.status)}</span>
            <span className="rounded-[4px] border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[12px] font-semibold text-rose-200">{followUpLabel(row.followUpStatus)}</span>
          </div>
        </header>

        <EntryDrawerTabs
          label="Resident activation sections"
          tabs={[{ id: "details", label: "Resident details" }, { id: "history", label: "Invitation history" }]}
          value={tab} onChange={setTab}
        />

        <div key={tab} role="tabpanel"
          className="min-h-0 overflow-y-auto overscroll-contain p-3.5 [scrollbar-gutter:stable]">
          {tab === "details" ? (
            <div className="space-y-3.5">
              <Progress row={row}/>
              <EntryDrawerSection title="Resident information">
                <EntryDrawerField label="Unit">{row.unit}</EntryDrawerField>
                <EntryDrawerField label="Username">{row.suggestedUsername}</EntryDrawerField>
                <EntryDrawerField label="Method">{methodLabel(row.method)}</EntryDrawerField>
                <EntryDrawerField label="Created">{row.createdAt}</EntryDrawerField>
              </EntryDrawerSection>
              <EntryDrawerSection title="Contact information">
                <EntryDrawerField label="Phone">
                  <span className="block break-all">{row.phone}</span>
                  {actionable && <button type="button" onClick={() => setEdit("phone")}
                    className="mt-1 text-[12px] font-semibold text-[#C6B6FF] hover:text-white">Edit phone</button>}
                </EntryDrawerField>
                <EntryDrawerField label="Email">
                  <span className="block break-all">{row.email}</span>
                  {actionable && <button type="button" onClick={() => setEdit("email")}
                    className="mt-1 text-[12px] font-semibold text-[#C6B6FF] hover:text-white">Edit email</button>}
                </EntryDrawerField>
              </EntryDrawerSection>
              {row.status === "failed" && row.lastError !== "—" && (
                <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3.5 py-3 text-[13px] text-rose-100">
                  {row.lastError}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/[0.09] bg-white/[0.025] p-3">
                  <p className="text-xs text-[#B7AEBD]">Invitation attempts</p>
                  <p className="mt-2 text-xl font-semibold text-white">{row.invitationAttemptCount}</p>
                </div>
                <div className="rounded-lg border border-white/[0.09] bg-white/[0.025] p-3">
                  <p className="text-xs text-[#B7AEBD]">Days since invitation</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {row.daysSinceLastInvitation ?? "—"}
                  </p>
                </div>
              </div>
              <EntryDrawerSection title="Invitation history">
                <EntryDrawerField label="First invite">{row.firstInvitationSentAt}</EntryDrawerField>
                <EntryDrawerField label="Last invite">{row.lastInvitationSentAt}</EntryDrawerField>
                <EntryDrawerField label="Last PIN">{row.lastPinGeneratedAt}</EntryDrawerField>
                <EntryDrawerField label="Last action">{row.lastActivationAt}</EntryDrawerField>
                <EntryDrawerField label="Channel">{row.lastActivationChannel}</EntryDrawerField>
              </EntryDrawerSection>
              {followUpNeeded && (
                <section className="rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-3.5 py-3.5">
                  <p className="text-[13px] font-semibold text-[#F2D77B]">Needs follow-up</p>
                  <p className="mt-2 text-[13px] leading-5 text-[#DFD0AB]">
                    {row.invitationAttemptCount >= 5
                      ? "Several invitations have already been sent. Confirm the resident contact information before resending."
                      : `The last invitation was sent ${row.daysSinceLastInvitation ?? "several"} days ago. Confirm contact details before resending.`}
                  </p>
                </section>
              )}
              {row.status === "failed" && row.lastError !== "—" ? (
                <p className="text-[13px] text-rose-200">{row.lastError}</p>
              ) : null}
            </div>
          )}
        </div>

        <footer className="border-t border-[#141119] bg-[#292431] p-3">
          <div className="mb-2.5 rounded-lg border border-[rgba(117,83,255,0.18)] bg-[rgba(117,83,255,0.055)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#BEB4FF]">Recommended next action</p>
            <p className="mt-1 text-[13px] font-semibold leading-5 text-white">{recommendation.title}</p>
            <p className="mt-1 text-[12px] leading-4 text-[#B7AEBD]">{recommendation.description}</p>
          </div>
          <button type="button" onClick={() => setManageOpen(true)} disabled={!actionable}
            className="inline-flex h-10 w-full items-center justify-center rounded-[7px] border border-[#120539] bg-[#7553FF] px-3 text-[13px] font-semibold text-white shadow-[0_2px_0_#120539] disabled:cursor-not-allowed disabled:opacity-45">
            Manage activation
          </button>
        </footer>
      </aside>

      {edit === "email" && (
        <EditActivationEmailModal communityId={communityId} row={row}
          onClose={() => setEdit(null)} onChanged={onChanged} />
      )}
      {edit === "phone" && (
        <EditActivationPhoneModal communityId={communityId} row={row}
          onClose={() => setEdit(null)} onChanged={onChanged} />
      )}
      {manageOpen && (
        <ManageResidentActivationDialog
          target={{
            queueId: row.id, communityId, communityName,
            residentName: row.resident, unitLabel: row.unit,
            email: row.email, method: row.method, status: row.status,
          }}
          onClose={() => { setManageOpen(false); onChanged?.(); }}
        />
      )}
    </>
  );
}
