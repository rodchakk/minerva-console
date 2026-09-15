"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
        <div className="flex w-full max-w-xl flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
                Resident registration
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Campaign open
              </h3>
            </div>
            <Badge tone="success">Open</Badge>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
            >
              Registration link
            </label>
            <input
              id="registration-link"
              readOnly
              value={state.data.registrationUrl}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 font-mono text-xs text-white outline-none"
            />
          </div>

          <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
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
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
                    "min-h-28 rounded-xl border px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-violet-400/50 bg-violet-500/10"
                      : "border-[var(--border)] bg-[var(--surface-strong)] hover:bg-[var(--surface-muted)]",
                  ].join(" ")}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold text-white">
                        {option.label}
                      </span>
                      <span className="mt-2 block text-xs leading-5 text-[var(--text-muted)]">
                        {option.description}
                      </span>
                    </span>
                    {selected ? (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-400/20 text-violet-100">
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
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Public title
            </span>
            <input
              name="public_title"
              defaultValue={defaultTitle}
              required
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Resident limit
            </span>
            <input
              name="default_resident_limit"
              type="number"
              min={1}
              max={50}
              defaultValue={3}
              required
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Public instructions
          </span>
          <textarea
            name="public_instructions"
            rows={3}
            className="mt-2 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm text-white outline-none focus:border-violet-400/50"
          />
        </label>

        {isExistingUnitsMode ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-3 text-sm text-white"
              >
                <input
                  type="checkbox"
                  checked={selectedUnitIds.has(unit.id)}
                  onChange={() => toggleUnit(unit.id)}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-[var(--primary)]"
                />
                <span className="min-w-0 truncate">{unit.label}</span>
              </label>
            ))}
          </div>
        </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
            Use this when the community does not have a complete or reliable unit list yet. Resident submissions remain pending registration data for later review.
          </div>
        )}

        {state && !state.success ? (
          <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
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
        <div className="flex w-full max-w-xl flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
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
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
            >
              Registration link
            </label>
            <input
              id="replacement-registration-link"
              readOnly
              value={state.data.registrationUrl}
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-3 font-mono text-xs text-white outline-none"
            />
          </div>

          <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
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
        className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
            Resident registration
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Replace registration link
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {campaign.publicTitle}
          </p>
        </div>

        <input type="hidden" name="campaign_id" value={campaign.id} />
        <input type="hidden" name="community_id" value={communityId} />

        <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
          Creating a replacement link invalidates the previous registration
          link. Use this only when the current plaintext link is unavailable or
          should no longer be used.
        </p>

        {state && !state.success ? (
          <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
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
        <div className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
              Resident registration
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              Registration cancelled
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
              Previously received registrations were preserved.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Units preserved
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {state.data.preservedUnitCount}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
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
        className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
            Resident registration
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Cancel registration campaign?
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {campaign.publicTitle}
          </p>
        </div>

        <input type="hidden" name="campaign_id" value={campaign.id} />
        <input type="hidden" name="community_id" value={communityId} />

        <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
          The registration link will stop accepting new submissions. Previously
          received registrations will be preserved.
        </p>

        {state && !state.success ? (
          <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
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
    recoverLink(async (url) => {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    });
  }

  function openCurrentLink() {
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
      <div className="flex flex-col gap-3">
        <p className="max-w-2xl rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-50/90">
          Current registration link cannot be recovered. Replace the
          registration link once to enable future re-sharing.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onReplace}>
            Replace registration link
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel registration
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={copyCurrentLink} disabled={isPending}>
          {copied ? "Copied" : isPending ? "Preparing..." : "Copy registration link"}
        </Button>
        <Button type="button" variant="secondary" onClick={openCurrentLink} disabled={isPending}>
          Open registration
        </Button>
        <Button type="button" variant="secondary" onClick={onReplace}>
          Replace registration link
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel registration
        </Button>
      </div>
      {message ? (
        <p className="max-w-2xl rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
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
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200">
            Resident registration
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {campaign ? statusLabel(campaign.status) : "No active registration campaign"}
          </h2>
          {campaign ? (
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
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

      {hasKnownCampaignTotal ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Units submitted
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {unitSubmittedText}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Participating units
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {campaign ? totalCampaignUnitCount : totalUnits}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              REGISTRATION PROGRESS
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {registrationProgress.percent}%
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              {`${registrationProgress.submittedUnits} of ${registrationProgress.totalUnits} units submitted`}
            </p>
            <div
              aria-label="Registration progress"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={registrationProgress.percent}
              className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-violet-400"
                style={{ width: `${registrationProgress.percent}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-violet-100">
              <span>{registrationProgress.submittedResidents} residents received</span>
              <span>{registrationProgress.remainingUnits} units remaining</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Units submitted
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {registrationProgress.submittedUnits}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Residents received
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {registrationProgress.submittedResidents}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Total participating units
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">Unknown</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
          {campaign
            ? campaignOpen
              ? "Open campaign link sharing is available without rotating access when the current link is recoverable."
              : "Registration sharing is available only while the campaign is open."
            : "Launch a secure public registration link for resident registration."}
        </p>

        {!hasOperationalCampaign ? (
          <Button
            type="button"
            onClick={() => setShowLaunchDialog(true)}
            disabled={!canStart}
            title={
              canStart
                ? "Start a resident registration campaign."
                : "An operational registration campaign already exists."
            }
          >
            Start registration campaign
          </Button>
        ) : campaign ? (
          <div className="flex flex-wrap gap-2">
            {canOpenReview ? (
              <Link
                href={`/products/entry/communities/${communityId}/registration`}
              >
                <Button type="button">Review registrations</Button>
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancel registration
              </Button>
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
