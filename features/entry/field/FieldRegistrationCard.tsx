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
  if (normalized === "open") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  }
  if (normalized === "paused") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
  if (normalized === "review" || normalized === "confirmed") {
    return "border-sky-300/30 bg-sky-300/10 text-sky-100";
  }
  return "border-white/12 bg-white/[0.03] text-[var(--console-text-muted)]";
}

function UnitProgressLink({ communityId }: { communityId: string }) {
  return (
    <Link
      href={`/field/entry/communities/${encodeURIComponent(communityId)}/registration`}
      className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/[0.06] active:bg-white/[0.08]"
    >
      <span>View unit progress</span>
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </Link>
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

  function handleCopy() {
    if (!campaign) return;
    setMessage(null);
    setCopied(false);

    startTransition(async () => {
      const result = await recoverCommunityRegistrationLink({
        campaignId: campaign.id,
        communityId,
      });

      if (!result.success) {
        setMessage(result.error || "Could not recover link.");
        return;
      }

      try {
        await navigator.clipboard.writeText(result.data.registrationUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } catch {
        setMessage("Could not copy link to clipboard.");
      }
    });
  }

  function handleShare() {
    if (!campaign) return;
    setMessage(null);

    startTransition(async () => {
      const result = await recoverCommunityRegistrationLink({
        campaignId: campaign.id,
        communityId,
      });

      if (!result.success) {
        setMessage(result.error || "Could not recover link.");
        return;
      }

      try {
        await navigator.share({
          title: campaign.publicTitle,
          text: `Registro de residentes - ${communityName}`,
          url: result.data.registrationUrl,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setMessage("Could not share registration link.");
      }
    });
  }

  function handleOpen() {
    if (!campaign) return;
    setMessage(null);
    setOpening(true);

    const win = window.open("about:blank", "_blank");
    if (!win) {
      setOpening(false);
      setMessage("Browser blocked the registration page popup.");
      return;
    }
    win.opener = null;

    startTransition(async () => {
      const result = await recoverCommunityRegistrationLink({
        campaignId: campaign.id,
        communityId,
      });

      if (!result.success) {
        win.close();
        setOpening(false);
        setMessage(result.error || "Could not recover link.");
        return;
      }

      win.location.href = result.data.registrationUrl;
      setOpening(false);
    });
  }

  // STATE 1: NO CAMPAIGN (ONLY when campaign === null)
  if (stateKind === "no_campaign" || !campaign) {
    return (
      <section
        aria-labelledby="field-registration-title"
        className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
              Resident registration
            </p>
            <h2
              id="field-registration-title"
              className="mt-1 text-xl font-semibold text-[var(--console-text)]"
            >
              Not started
            </h2>
          </div>
          {isReadOnlyPreview ? (
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-xs font-bold text-amber-100">
              Preview read-only
            </span>
          ) : units.length === 0 ? (
            <span className="rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-xs font-bold text-[var(--console-text-muted)]">
              Needs units
            </span>
          ) : (
            <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-2.5 py-1 text-xs font-bold text-sky-100">
              Ready to start
            </span>
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-[var(--console-text-muted)]">
          No resident registration campaign is active for this community.
        </p>

        {isReadOnlyPreview ? (
          <p className="mt-2 text-xs text-amber-200">
            Registration campaign creation is unavailable in read-only Preview mode.
          </p>
        ) : units.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--console-text-soft)]">
            Unit records are required before starting a registration campaign.
          </p>
        ) : (
          <p className="mt-2 text-xs text-[var(--console-text-soft)]">
            {formatFieldCount(units.length)} community unit(s) available for registration campaign creation.
          </p>
        )}

        {canLaunchNewCampaign ? (
          <Link
            href={`/field/entry/communities/${communityId}/registration/start`}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            <span>Start registration</span>
          </Link>
        ) : null}
      </section>
    );
  }

  // STATE 2: CAMPAIGN EXISTS BUT IS NOT OPEN (e.g. closed, processed, paused, review, confirmed)
  if (stateKind === "non_open_campaign") {
    return (
      <section
        aria-labelledby="field-registration-title"
        className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
              Resident registration
            </p>
            <h2
              id="field-registration-title"
              className="mt-1 text-xl font-semibold text-[var(--console-text)]"
            >
              {campaign.publicTitle}
            </h2>
          </div>
          <span
            className={[
              "rounded-full border px-2.5 py-1 text-xs font-bold",
              campaignStatusToneClass(campaign.status),
            ].join(" ")}
          >
            {campaignStatusLabel(campaign.status)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
              Submitted
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--console-text)]">
              {formatFieldCount(submittedUnitCount)} / {formatFieldCount(totalCampaignUnitCount)}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
              Participating
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--console-text)]">
              {formatFieldCount(totalCampaignUnitCount)} units
            </p>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-[var(--console-text-muted)]">
          Registration link sharing is available only while the campaign is open.
        </p>

        <UnitProgressLink communityId={communityId} />

        {isReadOnlyPreview ? (
          <p className="mt-2 text-xs text-amber-200">
            Registration campaign creation is unavailable in read-only Preview mode.
          </p>
        ) : canLaunchNewCampaign ? (
          <Link
            href={`/field/entry/communities/${communityId}/registration/start`}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 active:bg-white/15"
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            <span>Start new registration</span>
          </Link>
        ) : null}
      </section>
    );
  }

  // STATE 4: OPEN + UNRECOVERABLE LEGACY LINK
  if (stateKind === "open_unrecoverable") {
    return (
      <section
        aria-labelledby="field-registration-title"
        className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
              Resident registration
            </p>
            <h2
              id="field-registration-title"
              className="mt-1 text-xl font-semibold text-[var(--console-text)]"
            >
              {campaign.publicTitle}
            </h2>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-100">
            Open
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
              Submitted
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--console-text)]">
              {formatFieldCount(submittedUnitCount)} / {formatFieldCount(totalCampaignUnitCount)}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
              Participating
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--console-text)]">
              {formatFieldCount(totalCampaignUnitCount)} units
            </p>
          </div>
        </div>

        <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          The current registration link cannot be recovered from Field. It must be
          replaced from Console before it can be re-shared.
        </p>

        <UnitProgressLink communityId={communityId} />
      </section>
    );
  }

  // STATE 3: OPEN + RECOVERABLE LINK
  return (
    <section
      aria-labelledby="field-registration-title"
      className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
            Resident registration
          </p>
          <h2
            id="field-registration-title"
            className="mt-1 text-xl font-semibold text-[var(--console-text)]"
          >
            {campaign.publicTitle}
          </h2>
        </div>
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-100">
          Open
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
            Submitted
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--console-text)]">
            {formatFieldCount(submittedUnitCount)} / {formatFieldCount(totalCampaignUnitCount)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
            Participating
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--console-text)]">
            {formatFieldCount(totalCampaignUnitCount)} units
          </p>
        </div>
      </div>

      {message ? (
        <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm leading-6 text-rose-100">
          {message}
        </p>
      ) : null}

      <UnitProgressLink communityId={communityId} />

      <div className="mt-4 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleCopy}
          disabled={isPending}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 active:bg-white/15 disabled:opacity-50"
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
          <span>{copied ? "Copied" : isPending ? "Preparing link…" : "Copy registration link"}</span>
        </button>

        {canShare ? (
          <button
            type="button"
            onClick={handleShare}
            disabled={isPending}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 active:bg-white/15 disabled:opacity-50"
          >
            <Share2 aria-hidden="true" className="h-4 w-4" />
            <span>{isPending ? "Preparing link…" : "Share registration link"}</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleOpen}
          disabled={isPending || opening}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 active:bg-white/15 disabled:opacity-50"
        >
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
          <span>{opening || isPending ? "Opening registration…" : "Open registration"}</span>
        </button>
      </div>
    </section>
  );
}
