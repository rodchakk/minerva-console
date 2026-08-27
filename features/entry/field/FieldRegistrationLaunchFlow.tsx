"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, Play, Share2 } from "lucide-react";
import { launchCommunityRegistrationCampaign } from "@/features/entry/communityRegistration/admin/actions";
import type { CommunityRegistrationAdminUnit } from "@/features/entry/communityRegistration/admin/queries";
import { formatFieldCount } from "@/features/entry/field/formatting";

type FieldRegistrationLaunchFlowProps = {
  communityId: string;
  communityName: string;
  isReadOnlyPreview: boolean;
  units: CommunityRegistrationAdminUnit[];
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

export function FieldRegistrationLaunchFlow({
  communityId,
  communityName,
  isReadOnlyPreview,
  units,
}: FieldRegistrationLaunchFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<"configure" | "confirm" | "success">("configure");
  const [publicTitle, setPublicTitle] = useState(
    `Registro de residentes - ${communityName}`,
  );
  const [defaultResidentLimit, setDefaultResidentLimit] = useState(3);
  const [publicInstructions, setPublicInstructions] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(
    () => new Set(units.map((u) => u.id)),
  );
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [successData, setSuccessData] = useState<{
    publicSlug: string;
    registrationUrl: string;
    selectedUnitCount: number;
  } | null>(null);

  const canShare = useSyncExternalStore(subscribe, getShareSnapshot, getServerSnapshot);
  const selectedUnitCount = selectedUnitIds.size;
  const canContinueToConfirm =
    selectedUnitCount > 0 && publicTitle.trim().length > 0 && !isReadOnlyPreview;

  function toggleUnit(unitId: string) {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  }

  function selectAllUnits() {
    setSelectedUnitIds(new Set(units.map((u) => u.id)));
  }

  function clearAllUnits() {
    setSelectedUnitIds(new Set());
  }

  function handleStartCampaign() {
    setErrorMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append("community_id", communityId);
      formData.append("community_name", communityName);
      formData.append("public_title", publicTitle.trim());
      formData.append("public_instructions", publicInstructions.trim());
      formData.append("default_resident_limit", String(defaultResidentLimit));

      for (const unitId of selectedUnitIds) {
        formData.append("unit_id", unitId);
      }

      const result = await launchCommunityRegistrationCampaign(null, formData);

      if (!result.success) {
        setErrorMessage(result.error || "Could not launch registration campaign.");
        return;
      }

      setSuccessData({
        publicSlug: result.data.publicSlug,
        registrationUrl: result.data.registrationUrl,
        selectedUnitCount: result.data.selectedUnitCount,
      });
      setStep("success");
    });
  }

  function handleCopy() {
    if (!successData) return;
    setCopied(false);

    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(successData.registrationUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      } catch {
        setErrorMessage("Could not copy link to clipboard.");
      }
    });
  }

  function handleShare() {
    if (!successData) return;

    startTransition(async () => {
      try {
        await navigator.share({
          title: publicTitle,
          text: `Registro de residentes - ${communityName}`,
          url: successData.registrationUrl,
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setErrorMessage("Could not share registration link.");
      }
    });
  }

  function handleOpen() {
    if (!successData) return;
    setOpening(true);

    const win = window.open(successData.registrationUrl, "_blank");
    if (!win) {
      setOpening(false);
      setErrorMessage("Browser blocked the registration page popup.");
      return;
    }
    win.opener = null;
    setOpening(false);
  }

  function handleDone() {
    router.push(`/field/entry/communities/${encodeURIComponent(communityId)}`);
    router.refresh();
  }

  // STEP 3: SUCCESS
  if (step === "success" && successData) {
    return (
      <div className="space-y-5">
        <section className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-100">
              <Check aria-hidden="true" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Resident registration
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-emerald-50">
                Campaign open
              </h1>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-emerald-100/90">
            The registration campaign for {communityName} is now open with{" "}
            {formatFieldCount(successData.selectedUnitCount)} participating unit(s).
          </p>
        </section>

        {errorMessage ? (
          <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--console-accent)]">
            Registration link actions
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              disabled={isPending}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
            >
              <Copy aria-hidden="true" className="h-4 w-4" />
              <span>{copied ? "Copied" : "Copy registration link"}</span>
            </button>

            {canShare ? (
              <button
                type="button"
                onClick={handleShare}
                disabled={isPending}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
              >
                <Share2 aria-hidden="true" className="h-4 w-4" />
                <span>Share registration link</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleOpen}
              disabled={opening}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              <span>{opening ? "Opening registration…" : "Open registration"}</span>
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={handleDone}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          Done
        </button>
      </div>
    );
  }

  // STEP 2: CONFIRM
  if (step === "confirm") {
    const selectedUnitsList = units.filter((u) => selectedUnitIds.has(u.id));

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setStep("configure")}
          disabled={isPending}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Back to edit
        </button>

        <section className="pt-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
            Step 2 of 2
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--console-text)]">
            Confirm campaign launch
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
            Review registration settings for {communityName} before starting the campaign.
          </p>
        </section>

        {errorMessage ? (
          <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}

        <section className="space-y-4 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-soft)]">
              Public title
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--console-text)]">
              {publicTitle}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
                Resident limit
              </p>
              <p className="mt-1 text-base font-semibold text-[var(--console-text)]">
                {defaultResidentLimit} per unit
              </p>
            </div>

            <div className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
                Participating units
              </p>
              <p className="mt-1 text-base font-semibold text-[var(--console-text)]">
                {formatFieldCount(selectedUnitCount)} of {formatFieldCount(units.length)}
              </p>
            </div>
          </div>

          {publicInstructions.trim() ? (
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-soft)]">
                Public instructions
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--console-text-muted)]">
                {publicInstructions.trim()}
              </p>
            </div>
          ) : null}

          <div className="pt-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-soft)]">
              Selected units
            </p>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[var(--console-border)] bg-white/[0.02] p-2">
              <div className="flex flex-wrap gap-1.5">
                {selectedUnitsList.map((unit) => (
                  <span
                    key={unit.id}
                    className="rounded-md border border-[var(--console-border)] bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-[var(--console-text)]"
                  >
                    {unit.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setStep("configure")}
            disabled={isPending}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-5 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
          >
            Back to edit
          </button>

          <button
            type="button"
            onClick={handleStartCampaign}
            disabled={isPending}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50"
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            <span>{isPending ? "Creating campaign…" : "Start registration campaign"}</span>
          </button>
        </div>
      </div>
    );
  }

  // STEP 1: CONFIGURE
  return (
    <div className="space-y-5">
      <Link
        href={`/field/entry/communities/${encodeURIComponent(communityId)}`}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Cancel
      </Link>

      <section className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          Step 1 of 2
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--console-text)]">
          Start registration campaign
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--console-text-muted)]">
          Configure title, limits, and participating units for {communityName}.
        </p>
      </section>

      {isReadOnlyPreview ? (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          Registration campaign creation is unavailable in read-only Preview mode.
        </div>
      ) : null}

      <div className="space-y-4 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div>
          <label
            htmlFor="field-public-title"
            className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-soft)]"
          >
            Public title
          </label>
          <input
            id="field-public-title"
            type="text"
            value={publicTitle}
            onChange={(e) => setPublicTitle(e.target.value)}
            disabled={isReadOnlyPreview}
            placeholder="e.g. Registro de residentes - Residencial Aurora"
            className="mt-2 min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent-border)] focus:ring-2 focus:ring-white/5 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="field-resident-limit"
            className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-soft)]"
          >
            Resident limit per unit (1–50)
          </label>
          <input
            id="field-resident-limit"
            type="number"
            min={1}
            max={50}
            value={defaultResidentLimit}
            onChange={(e) =>
              setDefaultResidentLimit(
                Math.max(1, Math.min(50, Math.floor(Number(e.target.value)) || 1)),
              )
            }
            disabled={isReadOnlyPreview}
            className="mt-2 min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-white/[0.03] px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent-border)] focus:ring-2 focus:ring-white/5 disabled:opacity-50"
          />
        </div>

        <div>
          <label
            htmlFor="field-public-instructions"
            className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-soft)]"
          >
            Public instructions (optional)
          </label>
          <textarea
            id="field-public-instructions"
            rows={3}
            value={publicInstructions}
            onChange={(e) => setPublicInstructions(e.target.value)}
            disabled={isReadOnlyPreview}
            placeholder="Instructions shown to residents on the registration page..."
            className="mt-2 w-full resize-y rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm text-[var(--console-text)] outline-none focus:border-[var(--console-accent-border)] focus:ring-2 focus:ring-white/5 disabled:opacity-50"
          />
        </div>

        <div className="pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--console-text-soft)]">
                Participating units
              </p>
              <p className="mt-1 text-sm text-[var(--console-text-muted)]">
                {formatFieldCount(selectedUnitCount)} of {formatFieldCount(units.length)} selected
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllUnits}
                disabled={isReadOnlyPreview}
                className="min-h-9 rounded-lg px-3 text-xs font-semibold text-[var(--console-text)] hover:bg-white/5 disabled:opacity-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearAllUnits}
                disabled={isReadOnlyPreview}
                className="min-h-9 rounded-lg px-3 text-xs font-semibold text-[var(--console-text-soft)] hover:bg-white/5 hover:text-[var(--console-text)] disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>

          {selectedUnitCount === 0 ? (
            <p className="mt-2 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-100">
              Select at least one unit to participate in registration.
            </p>
          ) : null}

          <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-lg border border-[var(--console-border)] bg-white/[0.02] p-2 sm:grid-cols-2">
            {units.map((unit) => {
              const isChecked = selectedUnitIds.has(unit.id);
              return (
                <label
                  key={unit.id}
                  className={[
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    isChecked
                      ? "border-[var(--console-accent-border)] bg-white/[0.05] text-[var(--console-text)]"
                      : "border-[var(--console-border)] bg-white/[0.02] text-[var(--console-text-muted)] hover:bg-white/[0.04]",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleUnit(unit.id)}
                    disabled={isReadOnlyPreview}
                    className="h-5 w-5 rounded border-[var(--console-border)] bg-transparent text-[var(--console-accent)] focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                  />
                  <span className="min-w-0 truncate">{unit.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setStep("confirm")}
        disabled={!canContinueToConfirm}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50"
      >
        Continue to confirmation
      </button>
    </div>
  );
}
