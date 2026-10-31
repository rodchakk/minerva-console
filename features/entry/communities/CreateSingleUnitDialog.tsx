"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Home, X } from "lucide-react";
import { createSingleCommunityUnitAction } from "@/features/entry/communities/singleUnitActions";

type CreateSingleUnitDialogProps = {
  communityId: string;
  communityName: string;
  open: boolean;
  onClose: () => void;
  onCreated: (unitLabel: string) => void;
};

export function CreateSingleUnitDialog({
  communityId,
  communityName,
  open,
  onClose,
  onCreated,
}: CreateSingleUnitDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [unitLabel, setUnitLabel] = useState("");
  const [reference, setReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  function close() {
    if (isSubmitting) return;
    setUnitLabel("");
    setReference("");
    setError(null);
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const label = unitLabel.trim();
    if (!label) {
      setError("Unit name is required.");
      return;
    }

    if (reference.trim().length > 160) {
      setError("Reference must be 160 characters or fewer.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createSingleCommunityUnitAction({
        communityId,
        unitLabel: label,
        publicReference: reference,
      });

      if (!result.success) {
        setError(result.error ?? "Could not create the unit.");
        return;
      }

      setUnitLabel("");
      setReference("");
      onCreated(result.unitLabel ?? label);
      onClose();
    } catch {
      setError("Could not create the unit. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="create-entry-unit-title"
      aria-describedby="create-entry-unit-description"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) close();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[540px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-[#494052] bg-[#292431] p-0 text-[#E7E5EA] shadow-[0_32px_100px_rgba(0,0,0,0.65)] backdrop:bg-black/75 backdrop:backdrop-blur-[3px]"
    >
      <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#BEB4FF]">
              ENTRY · UNITS
            </p>
            <h2 id="create-entry-unit-title" className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Create unit
            </h2>
            <p id="create-entry-unit-description" className="mt-1.5 text-sm leading-5 text-[#A9A3B2]">
              Add one unit to {communityName}.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            aria-label="Close unit creation"
            className="grid size-8 shrink-0 place-items-center rounded-md border border-[#141119] bg-[#2E2936] text-[#A9A3B2] transition hover:text-white disabled:opacity-50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="px-5 py-5 sm:px-6">
        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#CFC6D8]">
              Unit name <span className="text-[#BEB4FF]">*</span>
            </span>
            <input
              autoFocus
              required
              maxLength={120}
              value={unitLabel}
              onChange={(event) => {
                setUnitLabel(event.target.value);
                setError(null);
              }}
              placeholder="e.g. Casa 12, Torre A-101"
              disabled={isSubmitting}
              className="h-11 w-full rounded-lg border border-[#494052] bg-[#211D29] px-3.5 text-sm text-white outline-none transition placeholder:text-[#83798E] focus:border-[#947CFF] focus:ring-2 focus:ring-[#7553FF]/20 disabled:opacity-60"
            />
            <span className="mt-1.5 block text-xs text-[#9C93A6]">
              The name used to identify this unit across ENTRY.
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#CFC6D8]">
              Resident-facing reference <span className="font-normal normal-case tracking-normal text-[#9C93A6]">· Optional</span>
            </span>
            <input
              maxLength={160}
              value={reference}
              onChange={(event) => {
                setReference(event.target.value);
                setError(null);
              }}
              placeholder="e.g. Calle principal, junto al parque"
              disabled={isSubmitting}
              className="h-11 w-full rounded-lg border border-[#494052] bg-[#211D29] px-3.5 text-sm text-white outline-none transition placeholder:text-[#83798E] focus:border-[#947CFF] focus:ring-2 focus:ring-[#7553FF]/20 disabled:opacity-60"
            />
            <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-[#9C93A6]">
              <span>Helps residents recognize their unit during registration.</span>
              <span className="shrink-0 tabular-nums">{reference.length}/160</span>
            </div>
          </label>
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/[0.08] px-3 py-2.5 text-xs text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-3 border-t border-white/[0.08] pt-4">
          <div className="mr-auto hidden items-center gap-2 text-xs text-[#9C93A6] sm:flex">
            <Home className="size-4 text-[#BEB4FF]" aria-hidden />
            One unit at a time
          </div>
          <button
            type="button"
            onClick={close}
            disabled={isSubmitting}
            className="h-10 rounded-[7px] border border-[#141119] bg-[#2E2936] px-4 text-sm font-semibold text-white transition hover:bg-[#352F3E] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !unitLabel.trim()}
            className="h-10 rounded-[7px] border border-[#120539] bg-[#7553FF] px-5 text-sm font-semibold text-white shadow-[0_2px_0_#120539] transition hover:bg-[#6845F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BEB4FF] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create unit"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
