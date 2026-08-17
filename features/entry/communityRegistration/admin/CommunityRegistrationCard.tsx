"use client";

import { useActionState, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  launchCommunityRegistrationCampaign,
  replaceCommunityRegistrationLink,
  type LaunchCommunityRegistrationCampaignResult,
  type ReplaceCommunityRegistrationLinkResult,
} from "@/features/entry/communityRegistration/admin/actions";
import type {
  CommunityRegistrationAdminCampaign,
  CommunityRegistrationAdminUnit,
} from "@/features/entry/communityRegistration/admin/queries";

type CommunityRegistrationCardProps = {
  campaign: CommunityRegistrationAdminCampaign | null;
  communityId: string;
  communityName: string;
  hasOperationalCampaign: boolean;
  submittedStatuses: readonly string[];
  submittedUnitCount: number;
  totalCampaignUnitCount: number;
  totalUnits: number;
  units: CommunityRegistrationAdminUnit[];
};

const initialState: LaunchCommunityRegistrationCampaignResult | null = null;
const initialReplaceState: ReplaceCommunityRegistrationLinkResult | null = null;

function statusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") return "Campaign open";
  if (normalized === "paused") return "Campaign paused";
  if (normalized === "review") return "In review";
  if (normalized === "confirmed") return "Confirmed";
  if (normalized === "processed") return "Processed";
  if (normalized === "closed") return "Closed";
  return status || "Campaign";
}

function statusTone(status: string): "default" | "success" | "warning" | "info" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") return "success";
  if (normalized === "paused") return "warning";
  if (normalized === "review" || normalized === "confirmed") return "info";
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
  const [selectedUnitIds, setSelectedUnitIds] = useState(
    () => new Set(units.map((unit) => unit.id)),
  );
  const defaultTitle = `Registro de residentes - ${communityName}`;
  const selectedUnitCount = selectedUnitIds.size;
  const canSubmit = selectedUnitCount > 0 && !pending;

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
              {state.data.submittedUnitCount} / {state.data.selectedUnitCount}
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
            Copy or open this secure link now. The capability token is stored
            only as a hash, so the same plaintext link cannot be redisplayed
            after reload without rotating access.
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
          <Badge tone="info">{selectedUnitCount} selected</Badge>
        </div>

        <input type="hidden" name="community_id" value={communityId} />
        <input type="hidden" name="community_name" value={communityName} />
        {Array.from(selectedUnitIds).map((unitId) => (
          <input key={unitId} type="hidden" name="unit_id" value={unitId} />
        ))}

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

        {state && !state.success ? (
          <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-100">
            {state.error}
          </p>
        ) : null}

        {selectedUnitCount === 0 ? (
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
            registration link has been invalidated, and this plaintext
            capability will not be redisplayed after reload.
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

export function CommunityRegistrationCard({
  campaign,
  communityId,
  communityName,
  hasOperationalCampaign,
  submittedStatuses,
  submittedUnitCount,
  totalCampaignUnitCount,
  totalUnits,
  units,
}: CommunityRegistrationCardProps) {
  const [showLaunchDialog, setShowLaunchDialog] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const progressTotal = campaign ? totalCampaignUnitCount : totalUnits;
  const canStart = !hasOperationalCampaign && units.length > 0;
  const submittedStatusText = useMemo(
    () => submittedStatuses.join(", "),
    [submittedStatuses],
  );

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

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Units submitted
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {submittedUnitCount} / {progressTotal}
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
            Submitted states
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-white" title={submittedStatusText}>
            {submittedStatusText}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
          {campaign
            ? "Reload shows campaign status and progress. The original secure link is not redisplayed because only the token hash is stored."
            : "Launch a secure public registration link for selected existing units."}
        </p>

        {!hasOperationalCampaign ? (
          <Button
            type="button"
            onClick={() => setShowLaunchDialog(true)}
            disabled={!canStart}
            title={
              units.length === 0
                ? "Create units before launching registration."
                : "Start a resident registration campaign."
            }
          >
            Start registration campaign
          </Button>
        ) : campaign ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowReplaceDialog(true)}
          >
            Replace registration link
          </Button>
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
    </section>
  );
}
