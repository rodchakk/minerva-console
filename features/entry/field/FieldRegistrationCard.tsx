"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { ArrowRight, Copy, ExternalLink, Play, Share2 } from "lucide-react";
import { recoverCommunityRegistrationLink } from "@/features/entry/communityRegistration/admin/actions";
import type { CommunityRegistrationAdminState } from "@/features/entry/communityRegistration/admin/queries";
import { formatFieldCount } from "@/features/entry/field/formatting";
import {
  getFieldRegistrationStateKind,
  isRegistrationLaunchEligible,
} from "@/features/entry/field/registrationState";

type FieldRegistrationCardProps = {
  communityId: string;
  communityName: string;
  isReadOnlyPreview?: boolean;
  registrationState: CommunityRegistrationAdminState;
};

function subscribe() {
  return () => {};
}

function getShareSnapshot() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function getServerSnapshot() {
  return false;
}

function campaignStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") return "Open";
  if (normalized === "paused") return "Paused";
  if (normalized === "review") return "In review";
  if (normalized === "confirmed") return "Confirmed";
  if (normalized === "processed") return "Processed";
  if (normalized === "closed") return "Closed";
  return status || "Campaign";
}

function campaignStatusToneClass(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "open") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (normalized === "paused") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  if (normalized === "review" || normalized === "confirmed") {
    return "border-sky-300/30 bg-sky-300/10 text-sky-100";
  }
  return "border-white/12 bg-white/[0.03] text-[var(--console-text-muted)]";
}

function UnitProgressLink({ communityId }: { communityId: string }) {
  return (
    <Link
      href={`/field/entry/communities/${encodeURIComponent(communityId)}/registration`}
      className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--console-text-muted)] transition-colors hover:text-[var(--console-text)]"
    >
      <span>View unit progress</span>
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </Link>
  );
}

function RegistrationProgress({ submitted, total }: { submitted: number; total: number }) {
  const percentage = total > 0 ? Math.min(100, Math.round((submitted / total) * 100)) : 0;

  return (
    <div className="mt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-[var(--console-text)]">
            {formatFieldCount(submitted)} of {formatFieldCount(total)}
          </p>
          <p className="mt-1 text-xs text-[var(--console-text-muted)]">units completed</p>
        </div>
        <span className="text-xs font-semibold text-[var(--console-text-soft)]">{percentage}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-[var(--console-accent)]"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function FieldRegistrationCard({
  communityId,
  communityName,
  isReadOnlyPreview = false,
  registrationState,
}: FieldRegistrationCardProps) {
  const { campaign, hasOperationalCampaign, submittedUnitCount, totalCampaignUnitCount, units } =
    registrationState;
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canShare = useSyncExternalStore(subscribe, getShareSnapshot, getServerSnapshot);
  const stateKind = getFieldRegistrationStateKind(campaign);
  const canLaunchNewCampaign = isRegistrationLaunchEligible({
    hasOperationalCampaign,
    isReadOnlyPreview,
    unitCount: units.length,
  });

  function recoverLink(onSuccess: (registrationUrl: string) => Promise<void> | void) {
    if (!campaign) return;
    setMessage(null);
    startTransition(async () => {
      const result = await recoverCommunityRegistrationLink({
        campaignId: campaign.id,
        communityId,
      });
      if (!result.success) {
        setMessage(result.error || "Could not recover registration link.");
        return;
      }
      await onSuccess(result.data.registrationUrl);
    });
  }

  function handleCopy() {
    setCopied(false);
    recoverLink(async (registrationUrl) => {
      try {
        await navigator.clipboard.writeText(registrationUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } catch {
        setMessage("Could not copy link to clipboard.");
      }
    });
  }

  function handleShare() {
    recoverLink(async (registrationUrl) => {
      try {
        await navigator.share({
          title: campaign?.publicTitle || `Registro de residentes - ${communityName}`,
          text: `Registro de residentes - ${communityName}`,
          url: registrationUrl,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setMessage("Could not share registration link.");
      }
    });
  }

  function handleOpen() {
    if (!campaign) return;
    setOpening(true);
    const win = window.open("about:blank", "_blank");
    if (!win) {
      setOpening(false);
      setMessage("Browser blocked the registration page popup.");
      return;
    }
    win.opener = null;
    recoverLink((registrationUrl) => {
      win.location.href = registrationUrl;
      setOpening(false);
    });
  }

  if (stateKind === "no_campaign" || !campaign) {
    return (
      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">Registration</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--console-text)]">Not started</h2>
          </div>
          <span className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-xs font-bold text-[var(--console-text-muted)]">
            {units.length > 0 ? "Ready" : "Needs units"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
          No resident registration campaign is active for this community.
        </p>
        {canLaunchNewCampaign ? (
          <Link
            href={`/field/entry/communities/${communityId}/registration/start`}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white"
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            Start registration
          </Link>
        ) : null}
      </section>
    );
  }

  if (stateKind === "non_open_campaign") {
    return (
      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">Registration</p>
            <h2 className="mt-1 break-words text-lg font-semibold text-[var(--console-text)]">{campaign.publicTitle}</h2>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${campaignStatusToneClass(campaign.status)}`}>
            {campaignStatusLabel(campaign.status)}
          </span>
        </div>
        <RegistrationProgress submitted={submittedUnitCount} total={totalCampaignUnitCount} />
        <p className="mt-3 text-xs leading-5 text-[var(--console-text-soft)]">
          Link sharing is available only while registration is open.
        </p>
        <UnitProgressLink communityId={communityId} />
        {canLaunchNewCampaign ? (
          <Link
            href={`/field/entry/communities/${communityId}/registration/start`}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)]"
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            Start new registration
          </Link>
        ) : null}
      </section>
    );
  }

  if (stateKind === "open_unrecoverable") {
    return (
      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">Registration</p>
            <h2 className="mt-1 break-words text-lg font-semibold text-[var(--console-text)]">{campaign.publicTitle}</h2>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-100">Open</span>
        </div>
        <RegistrationProgress submitted={submittedUnitCount} total={totalCampaignUnitCount} />
        <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-5 text-amber-100">
          This legacy link must be replaced from Console before it can be shared again.
        </p>
        <UnitProgressLink communityId={communityId} />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">Registration</p>
          <h2 className="mt-1 break-words text-lg font-semibold text-[var(--console-text)]">Resident registration</h2>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-100">Open</span>
      </div>

      <RegistrationProgress submitted={submittedUnitCount} total={totalCampaignUnitCount} />
      <p className="mt-2 text-xs text-[var(--console-text-soft)]">
        {formatFieldCount(totalCampaignUnitCount)} participating units
      </p>

      {message ? (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm leading-5 text-rose-100">{message}</p>
      ) : null}
      {isReadOnlyPreview ? (
        <p className="mt-3 text-xs leading-5 text-amber-200">Preview is read-only. Link viewing is available; mutations remain disabled.</p>
      ) : null}

      {canShare ? (
        <button
          type="button"
          onClick={handleShare}
          disabled={isPending}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          <Share2 aria-hidden="true" className="h-4 w-4" />
          {isPending ? "Preparing link..." : "Share registration link"}
        </button>
      ) : null}

      <div className={`mt-${canShare ? "2" : "4"} grid grid-cols-2 gap-2`}>
        <button
          type="button"
          onClick={handleCopy}
          disabled={isPending}
          className={`${canShare ? "" : "bg-[var(--console-accent)] text-white"} flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] px-3 text-sm font-semibold text-[var(--console-text)] disabled:opacity-50`}
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={handleOpen}
          disabled={isPending || opening}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] px-3 text-sm font-semibold text-[var(--console-text)] disabled:opacity-50"
        >
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
          {opening ? "Opening..." : "Open"}
        </button>
      </div>
      <UnitProgressLink communityId={communityId} />
    </section>
  );
}
