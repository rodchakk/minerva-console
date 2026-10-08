"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition } from "react";
import { Check, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FloatingActionMenu } from "@/components/ui/FloatingActionMenu";
import {
  cancelCommunityRegistrationCampaign,
  launchCommunityRegistrationCampaign,
  recoverCommunityRegistrationLink,
  replaceCommunityRegistrationLink,
  type CancelCommunityRegistrationCampaignResult,
  type LaunchCommunityRegistrationCampaignResult,
  type RegistrationMode,
  type ReplaceCommunityRegistrationLinkResult,
} from "@/features/entry/communityRegistration/admin/actions";
import type {
  CommunityRegistrationAdminCampaign,
  CommunityRegistrationAdminProgress,
  CommunityRegistrationAdminUnit,
} from "@/features/entry/communityRegistration/admin/queries";

type CommunityRegistrationCardProps = {
  campaign: CommunityRegistrationAdminCampaign | null;
  communityId: string;
  communityName: string;
  hasOperationalCampaign: boolean;
  registrationProgress: CommunityRegistrationAdminProgress;
  submittedUnitCount: number;
  totalCampaignUnitCount: number;
  totalUnits: number;
  units: CommunityRegistrationAdminUnit[];
};

const initialState: LaunchCommunityRegistrationCampaignResult | null = null;
const initialReplaceState: ReplaceCommunityRegistrationLinkResult | null = null;
const initialCancelState: CancelCommunityRegistrationCampaignResult | null = null;

const registrationPrimaryActionClass =
  "inline-flex h-9 min-w-[152px] items-center justify-center rounded-[7px] border border-[#120539] bg-[#7553FF] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#120539] outline-none transition hover:bg-[#8062FF] focus-visible:ring-2 focus-visible:ring-[#7553FF] disabled:cursor-not-allowed disabled:opacity-45";

const registrationSecondaryActionClass =
  "inline-flex h-9 min-w-[112px] items-center justify-center gap-2 rounded-[7px] border border-[#141119] bg-[#2E2936] px-3 text-xs font-semibold text-white shadow-[0_2px_0_#141119] outline-none transition hover:bg-[#342F3D] focus-visible:ring-2 focus-visible:ring-[#7553FF] disabled:cursor-not-allowed disabled:opacity-45";

function statusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") return "Campaign open";
  if (normalized === "paused") return "Campaign paused";
  if (normalized === "review") return "In review";
  if (normalized === "confirmed") return "Confirmed";
  if (normalized === "processed") return "Processed";
  if (normalized === "closed") return "Closed";
  if (normalized === "cancelled") return "Cancelled";
  return status || "Campaign";
}

function statusTone(status: string): "default" | "success" | "warning" | "info" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") return "success";
  if (normalized === "paused") return "warning";
  if (normalized === "review" || normalized === "confirmed") return "info";
  if (normalized === "cancelled") return "warning";
  return "default";
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <Button type="button" onClick={copyLink}>
      {copied ? "Copied" : "Copy registration link"}
    </Button>
  );
}

function RegistrationProgressSummary({
  progress,
}: {
  progress: CommunityRegistrationAdminProgress;
}) {
  if (!progress.hasKnownTotal) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.012] px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#A9A3B2]">
          Residents received
        </p>
        <p className="mt-2 text-2xl font-semibold text-white">
          {progress.submittedResidents}
        </p>
        <p className="mt-2 text-xs font-semibold text-violet-100">
          Total units unknown
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.012] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-[#A9A3B2]">
        Registration progress
      </p>
      <p className="mt-2 text-3xl font-semibold text-white">
        {progress.percent}%
      </p>
      <p className="mt-1 text-xs leading-5 text-[#A9A3B2]">
        {progress.submittedUnits} of {progress.totalUnits} units submitted
      </p>
      <div
        aria-label="Registration progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress.percent}
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-[#7553FF]"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-violet-100">
        <span>{progress.submittedResidents} residents received</span>
        <span>{progress.remainingUnits} units remaining</span>
      </div>
    </div>
  );
}

function LaunchDialog({
  communityId,
  communityName,
  onClose,
  units,
}: {
  communityId: string;
  communityName: string;
  onClose: () => void;
  units: CommunityRegistrationAdminUnit[];
}) {
  const [state, formAction, pending] = useActionState(
    launchCommunityRegistrationCampaign,
    initialState,
  );
  const [registrationMode, setRegistrationMode] =
    useState<RegistrationMode>("existing_units");
  const [selectedUnitIds, setSelectedUnitIds] = useState(
    () => new Set(units.map((unit) => unit.id)),
  );
  const defaultTitle = `Resident registration - ${communityName}`;
  const selectedUnitCount = selectedUnitIds.size;
  const isExistingUnitsMode = registrationMode === "existing_units";
  const canSubmit = (!isExistingUnitsMode || selectedUnitCount > 0) && !pending;

  function toggleUnit(unitId: string) {
    setSelectedUnitIds((current) => {
      const next = new Set(current);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  }

  if (state?.success) {
    return (
      <Overlay>
        <div className="flex w-full max-w-xl flex-col gap-5 rounded-[10px] border border-[#141119] bg-[#26222F] p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#BEB4FF]">
                Resident registration
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Campaign open
              </h3>
            </div>
            <Badge tone="success">Open</Badge>
          </div>

          <div className="rounded-lg border border-[#141119] bg-[#2E2936] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A9A3B2]">
              Units submitted
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {state.data.registrationMode === "existing_units"
                ? `${state.data.submittedUnitCount} / ${state.data.selectedUnitCount}`
                : state.data.submittedUnitCount}
            </p>
          </div>

          <div>
            <label
              htmlFor="registration-link"
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A9A3B2]"
            >
              Registration link
            </label>
            <input
              id="registration-link"
              readOnly
              value={state.data.registrationUrl}
              className="mt-2 h-11 w-full rounded-lg border border-[#141119] bg-[#2E2936] px-3 font-mono text-xs text-white outline-none"
            />
          </div>

          <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
            This link is now recoverable for future sharing. Copying or opening
            it later will not rotate access.
          </p>

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Done
            </Button>
            <a href={state.data.registrationUrl} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary">
                Open registration
              </Button>
            </a>
            <CopyLinkButton url={state.data.registrationUrl} />
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <form
        action={formAction}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-[10px] border border-[#141119] bg-[#26222F] p-6 shadow-xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#BEB4FF]">
              Resident registration
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Start registration campaign
            </h3>
          </div>
          <Badge tone="info">
            {isExistingUnitsMode
              ? `${selectedUnitCount} selected`
              : "Residents provide units"}
          </Badge>
        </div>

        <input type="hidden" name="community_id" value={communityId} />
        <input type="hidden" name="community_name" value={communityName} />
        <input type="hidden" name="registration_mode" value={registrationMode} />
        {isExistingUnitsMode
          ? Array.from(selectedUnitIds).map((unitId) => (
              <input key={unitId} type="hidden" name="unit_id" value={unitId} />
            ))
          : null}

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9A3B2]">
            How will residents identify their unit?
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              {
                description:
                  "Residents register against units that already exist in ENTRY.",
                label: "Existing units",
                mode: "existing_units" as const,
              },
              {
                description:
                  "Residents enter their unit number with their household information.",
                label: "Residents provide their unit",
                mode: "resident_provided_units" as const,
              },
            ].map((option) => {
              const selected = registrationMode === option.mode;
              return (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() => setRegistrationMode(option.mode)}
                  className={[
                    "min-h-28 rounded-lg border px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-[#7553FF] bg-[rgba(117,83,255,0.08)]"
                      : "border-[#141119] bg-[#2E2936] hover:bg-[#342F3D]",
                  ].join(" ")}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold text-white">
                        {option.label}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-[#A9A3B2]">
                        {option.description}
                      </span>
                    </span>
                    {selected ? (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#7553FF]/20 text-violet-100">
                        <Check aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px]">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9A3B2]">
              Public title
            </span>
            <input
              name="public_title"
              defaultValue={defaultTitle}
              required
              className="mt-2 h-11 w-full rounded-lg border border-[#141119] bg-[#2E2936] px-3 text-sm text-white outline-none focus:border-[#7553FF]"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9A3B2]">
              Resident limit
            </span>
            <input
              name="default_resident_limit"
              type="number"
              min={1}
              max={50}
              defaultValue={3}
              required
              className="mt-2 h-11 w-full rounded-lg border border-[#141119] bg-[#2E2936] px-3 text-sm text-white outline-none focus:border-[#7553FF]"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9A3B2]">
            Public instructions
          </span>
          <textarea
            name="public_instructions"
            rows={3}
            className="mt-2 w-full resize-y rounded-lg border border-[#141119] bg-[#2E2936] px-3 py-3 text-sm text-white outline-none focus:border-[#7553FF]"
          />
        </label>

        {isExistingUnitsMode ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A9A3B2]">
                Participating units
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedUnitIds(new Set(units.map((unit) => unit.id)))}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedUnitIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {units.map((unit) => (
                <label
                  key={unit.id}
                  className="flex items-center gap-3 rounded-lg border border-[#141119] bg-[#2E2936] px-3 py-3 text-sm text-white"
                >
                  <input
                    type="checkbox"
                    checked={selectedUnitIds.has(unit.id)}
                    onChange={() => toggleUnit(unit.id)}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-[#7553FF]"
                  />
                  <span className="min-w-0 truncate">{unit.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-[#141119] bg-[#2E2936] px-4 py-3 text-sm leading-6 text-[#A9A3B2]">
            Use this when the community does not have a complete or reliable unit list yet. Resident submissions remain pending registration data for later review.
          </div>
        )}

        {state && !state.success ? (
          <p className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
            {state.error}
          </p>
        ) : null}

        {isExistingUnitsMode && selectedUnitCount === 0 ? (
          <p className="text-sm text-amber-200">
            Select at least one unit before creating a campaign.
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {pending ? "Creating..." : "Create campaign"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function ReplaceLinkDialog({
  campaign,
  communityId,
  onClose,
}: {
  campaign: CommunityRegistrationAdminCampaign;
  communityId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    replaceCommunityRegistrationLink,
    initialReplaceState,
  );

  if (state?.success) {
    return (
      <Overlay>
        <div className="flex w-full max-w-xl flex-col gap-5 rounded-[10px] border border-[#141119] bg-[#26222F] p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#BEB4FF]">
                Resident registration
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Replacement link ready
              </h3>
            </div>
            <Badge tone="success">Replaced</Badge>
          </div>

          <div>
            <label
              htmlFor="replacement-registration-link"
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A9A3B2]"
            >
              Registration link
            </label>
            <input
              id="replacement-registration-link"
              readOnly
              value={state.data.registrationUrl}
              className="mt-2 h-11 w-full rounded-lg border border-[#141119] bg-[#2E2936] px-3 font-mono text-xs text-white outline-none"
            />
          </div>

          <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
            Copy or open this secure replacement link now. The previous
            registration link has been invalidated, and this replacement can be
            recovered for future sharing.
          </p>

          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              Done
            </Button>
            <a href={state.data.registrationUrl} target="_blank" rel="noreferrer">
              <Button type="button" variant="secondary">
                Open registration
              </Button>
            </a>
            <CopyLinkButton url={state.data.registrationUrl} />
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <form
        action={formAction}
        className="flex w-full max-w-lg flex-col gap-5 rounded-[10px] border border-[#141119] bg-[#26222F] p-6 shadow-xl"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#BEB4FF]">
            Resident registration
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Replace registration link
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#A9A3B2]">
            {campaign.publicTitle}
          </p>
        </div>

        <input type="hidden" name="campaign_id" value={campaign.id} />
        <input type="hidden" name="community_id" value={communityId} />

        <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
          Creating a replacement link invalidates the previous registration
          link. Use this only when the current plaintext link is unavailable or
          should no longer be used.
        </p>

        {state && !state.success ? (
          <p className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Replacing..." : "Replace registration link"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function CancelRegistrationDialog({
  campaign,
  communityId,
  onCancelled,
  onClose,
}: {
  campaign: CommunityRegistrationAdminCampaign;
  communityId: string;
  onCancelled: () => void;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    cancelCommunityRegistrationCampaign,
    initialCancelState,
  );

  if (state?.success) {
    return (
      <Overlay>
        <div className="flex w-full max-w-lg flex-col gap-5 rounded-[10px] border border-[#141119] bg-[#26222F] p-6 shadow-xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#BEB4FF]">
              Resident registration
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Registration cancelled
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#A9A3B2]">
              Previously received registrations were preserved.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.012] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#A9A3B2]">
                Units preserved
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {state.data.preservedUnitCount}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.012] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#A9A3B2]">
                Submissions preserved
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {state.data.preservedSubmissionCount}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={onCancelled}>
              Done
            </Button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      <form
        action={formAction}
        className="flex w-full max-w-lg flex-col gap-5 rounded-[10px] border border-[#141119] bg-[#26222F] p-6 shadow-xl"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#BEB4FF]">
            Resident registration
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Cancel registration campaign?
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#A9A3B2]">
            {campaign.publicTitle}
          </p>
        </div>

        <input type="hidden" name="campaign_id" value={campaign.id} />
        <input type="hidden" name="community_id" value={communityId} />

        <p className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
          The registration link will stop accepting new submissions. Previously
          received registrations will be preserved.
        </p>

        {state && !state.success ? (
          <p className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
            {state.error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Keep campaign
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Cancelling..." : "Cancel registration"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}

function ActiveRegistrationLinkControls({
  campaign,
  communityId,
  onCancel,
  onReplace,
}: {
  campaign: CommunityRegistrationAdminCampaign;
  communityId: string;
  onCancel: () => void;
  onReplace: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function recoverLink(onSuccess: (url: string) => Promise<void> | void) {
    setMessage(null);
    setCopied(false);

    startTransition(async () => {
      const result = await recoverCommunityRegistrationLink({
        campaignId: campaign.id,
        communityId,
      });

      if (!result.success) {
        setMessage(result.error);
        return;
      }

      try {
        await onSuccess(result.data.registrationUrl);
      } catch {
        setMessage("Could not use the recovered registration link.");
      }
    });
  }

  function copyCurrentLink() {
    setMenuOpen(false);
    recoverLink(async (url) => {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    });
  }

  function openCurrentLink() {
    setMenuOpen(false);
    setMessage(null);
    setCopied(false);

    const opened = window.open("about:blank", "_blank");
    if (!opened) {
      setMessage("Browser blocked the registration page popup.");
      return;
    }
    opened.opener = null;

    startTransition(async () => {
      const result = await recoverCommunityRegistrationLink({
        campaignId: campaign.id,
        communityId,
      });

      if (!result.success) {
        opened.close();
        setMessage(result.error);
        return;
      }

      opened.location.href = result.data.registrationUrl;
    });
  }

  if (!campaign.activeCampaignAccessRecoverable) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onReplace}
          className={registrationSecondaryActionClass}
        >
          Replace link
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center rounded-[7px] border border-[rgba(255,102,126,0.22)] bg-[rgba(255,102,126,0.06)] px-3 text-xs font-semibold text-[#FFC1CB]"
        >
          Cancel campaign
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((value) => !value)}
        className={registrationSecondaryActionClass}
      >
        <MoreHorizontal className="size-4" aria-hidden />
        Actions
      </button>

      <FloatingActionMenu
        anchorRef={triggerRef}
        className="w-60 border-[#141119] bg-[#24202B] p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.44)]"
        onClose={() => setMenuOpen(false)}
        open={menuOpen}
      >
        <button
          type="button"
          role="menuitem"
          onClick={copyCurrentLink}
          disabled={isPending}
          className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium text-[#D3CEDA] hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
        >
          {copied ? "Copied" : isPending ? "Preparing..." : "Copy registration link"}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={openCurrentLink}
          disabled={isPending}
          className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium text-[#D3CEDA] hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
        >
          Open registration
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setMenuOpen(false);
            onReplace();
          }}
          className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium text-[#D3CEDA] hover:bg-white/[0.04] hover:text-white"
        >
          Replace registration link
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setMenuOpen(false);
            onCancel();
          }}
          className="block w-full rounded-md px-3 py-2 text-left text-xs font-medium text-[#E99AA7] hover:bg-[rgba(255,102,126,0.07)] hover:text-[#FFC1CB]"
        >
          Cancel registration
        </button>
      </FloatingActionMenu>

      {message ? (
        <p className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-[rgba(255,102,126,0.24)] bg-[#2E2936] px-3 py-2 text-xs text-[#FFC1CB] shadow-xl">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function CommunityRegistrationCard({
  campaign,
  communityId,
  communityName,
  hasOperationalCampaign,
  registrationProgress,
  submittedUnitCount,
  totalCampaignUnitCount,
  totalUnits,
  units,
}: CommunityRegistrationCardProps) {
  const router = useRouter();
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const progressTotal = campaign ? totalCampaignUnitCount : totalUnits;
  const hasKnownCampaignTotal = registrationProgress.hasKnownTotal;
  const canStart = !hasOperationalCampaign;
  const campaignOpen = campaign?.status.trim().toLowerCase() === "open";
  const canCancelCampaign = ["open", "paused"].includes(
    campaign?.status.trim().toLowerCase() ?? "",
  );
  const canOpenReview = Boolean(campaign && submittedUnitCount > 0);
  const unitSubmittedText =
    campaign && !hasKnownCampaignTotal
      ? String(submittedUnitCount)
      : `${submittedUnitCount} / ${progressTotal}`;

  return (
    <section
      id="resident-registration"
      className="relative overflow-visible rounded-[10px] border border-[#141119] bg-[#24202B] p-4 before:absolute before:left-0 before:top-0 before:h-px before:w-16 before:bg-[#7553FF] lg:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#BEB4FF]">
            Resident registration
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {campaign ? statusLabel(campaign.status) : "No active registration campaign"}
          </h2>
          {campaign ? (
            <p className="mt-1 text-sm leading-6 text-[#A9A3B2]">
              {campaign.publicTitle}
            </p>
          ) : null}
        </div>
        {campaign ? (
          <Badge tone={statusTone(campaign.status)}>{campaign.status}</Badge>
        ) : (
          <Badge tone="default">Not started</Badge>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.012] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#A9A3B2]">
            Units submitted
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {unitSubmittedText}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.012] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#A9A3B2]">
            Participating units
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {campaign && !hasKnownCampaignTotal
              ? "Unknown"
              : campaign
                ? totalCampaignUnitCount
                : totalUnits}
          </p>
        </div>
        <RegistrationProgressSummary progress={registrationProgress} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-[#A9A3B2]">
          {campaign
            ? campaignOpen
              ? "Open campaign link sharing is available without rotating access when the current link is recoverable."
              : "Registration sharing is available only while the campaign is open."
            : "Launch a secure public registration link for resident registration."}
        </p>

        {!hasOperationalCampaign ? (
          <button
            type="button"
            onClick={() => setShowLaunchDialog(true)}
            disabled={!canStart}
            title={
              canStart
                ? "Start a resident registration campaign."
                : "An operational registration campaign already exists."
            }
            className={registrationPrimaryActionClass}
          >
            Start registration
          </button>
        ) : campaign ? (
          <div className="flex flex-wrap gap-2">
            {canOpenReview ? (
              <Link
                href={`/products/entry/communities/${communityId}/registration`}
                className={registrationPrimaryActionClass}
              >
                Review registrations
              </Link>
            ) : null}
            {campaignOpen ? (
              <ActiveRegistrationLinkControls
                campaign={campaign}
                communityId={communityId}
                onCancel={() => setShowCancelDialog(true)}
                onReplace={() => setShowReplaceDialog(true)}
              />
            ) : null}
            {!campaignOpen && canCancelCampaign ? (
              <button
                type="button"
                onClick={() => setShowCancelDialog(true)}
                className={registrationSecondaryActionClass}
              >
                Cancel registration
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showLaunchDialog ? (
        <LaunchDialog
          communityId={communityId}
          communityName={communityName}
          onClose={() => setShowLaunchDialog(false)}
          units={units}
        />
      ) : null}

      {showReplaceDialog && campaign ? (
        <ReplaceLinkDialog
          campaign={campaign}
          communityId={communityId}
          onClose={() => setShowReplaceDialog(false)}
        />
      ) : null}

      {showCancelDialog && campaign ? (
        <CancelRegistrationDialog
          campaign={campaign}
          communityId={communityId}
          onCancelled={() => {
            setShowCancelDialog(false);
            router.refresh();
          }}
          onClose={() => setShowCancelDialog(false)}
        />
      ) : null}
    </section>
  );
}