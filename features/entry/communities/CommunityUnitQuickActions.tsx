"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { CommunityUnitPreview } from "@/features/entry/communities/detailQueries";
import {
  setCommunityUnitActiveStatusAction,
  updateCommunityUnitAction,
} from "@/features/entry/communities/unitActions";

type CommunityUnitQuickActionsProps = {
  communityId: string;
  unit: CommunityUnitPreview;
};

type ModalState = "edit" | "status" | null;
type UnitLabelDraft = {
  label: string;
  unitId: string;
};

export function CommunityUnitQuickActions({
  communityId,
  unit,
}: CommunityUnitQuickActionsProps) {
  const router = useRouter();
  const [modalState, setModalState] = useState<ModalState>(null);
  const [unitLabelDraft, setUnitLabelDraft] = useState<UnitLabelDraft>(() => ({
    label: unit.label,
    unitId: unit.id,
  }));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const unitLabel = unitLabelDraft.unitId === unit.id ? unitLabelDraft.label : unit.label;

  function setUnitLabel(label: string) {
    setUnitLabelDraft({ label, unitId: unit.id });
  }

  function closeModal() {
    if (isPending) {
      return;
    }

    setModalState(null);
    setErrorMessage(null);
  }

  function submitEdit() {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await updateCommunityUnitAction({
        communityId,
        unitId: unit.id,
        unitLabel,
      });

      if (!result.success) {
        setErrorMessage(result.error ?? "Could not update the unit.");
        return;
      }

      setModalState(null);
      setSuccessMessage("Unit updated successfully.");
      router.refresh();
    });
  }

  function submitStatusChange() {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await setCommunityUnitActiveStatusAction({
        communityId,
        isActive: !unit.isActive,
        unitId: unit.id,
      });

      if (!result.success) {
        setErrorMessage(
          result.error ??
            (unit.isActive
              ? "Could not disable the unit."
              : "Could not enable the unit."),
        );
        return;
      }

      setModalState(null);
      setSuccessMessage(
        unit.isActive
          ? "Unit disabled successfully. Linked resident account states were not changed."
          : "Unit enabled successfully. Linked resident account states were not changed.",
      );
      router.refresh();
    });
  }

  return (
    <>
      {modalState ? (
        <button
          type="button"
          aria-label="Close unit action modal"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          onClick={closeModal}
        />
      ) : null}

      <div className="space-y-3">
        {successMessage ? (
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {successMessage}
          </div>
        ) : null}

        {errorMessage && !modalState ? (
          <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => {
              setUnitLabel(unit.label);
              setSuccessMessage(null);
              setErrorMessage(null);
              setModalState("edit");
            }}
            className="rounded-lg border border-white/8 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white transition hover:border-violet-300/40 hover:bg-white/8"
          >
            Edit unit
          </button>

          <button
            type="button"
            onClick={() => {
              setSuccessMessage(null);
              setErrorMessage(null);
              setModalState("status");
            }}
            className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold transition ${
              unit.isActive
                ? "border-amber-400/20 bg-amber-500/10 text-amber-100 hover:border-amber-300/40"
                : "border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:border-emerald-300/40"
            }`}
          >
            {unit.isActive ? "Deactivate unit" : "Activate unit"}
          </button>

        </div>
      </div>

      {modalState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.42)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
              {modalState === "edit"
                ? "Edit unit"
                : unit.isActive
                ? "Deactivate unit"
                : "Activate unit"}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-white">{unit.label}</h3>

            {modalState === "edit" ? (
              <div className="mt-5 space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">Unit label</span>
                  <input
                    value={unitLabel}
                    onChange={(event) => setUnitLabel(event.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-[var(--primary)]"
                  />
                </label>
                <p className="text-sm text-[var(--text-muted)]">
                  This updates the unit label shown across the community workspace.
                </p>
              </div>
            ) : (
              <div
                className={`mt-5 rounded-lg px-4 py-4 text-sm ${
                  unit.isActive
                    ? "border border-amber-400/20 bg-amber-500/10 text-amber-100"
                    : "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
                }`}
              >
                {unit.isActive
                  ? "This will mark this unit as inactive in ENTRY. Linked resident account states are not changed."
                  : "This will reactivate this unit in ENTRY. Linked resident account states are not changed."}
              </div>
            )}

            {errorMessage ? (
              <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
              <Button type="button" variant="ghost" disabled={isPending} onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={modalState === "status" && unit.isActive ? "danger" : "primary"}
                disabled={isPending}
                onClick={modalState === "edit" ? submitEdit : submitStatusChange}
              >
                {isPending
                  ? modalState === "edit"
                    ? "Saving..."
                    : unit.isActive
                      ? "Deactivating..."
                      : "Activating..."
                  : modalState === "edit"
                    ? "Save changes"
                    : unit.isActive
                      ? "Deactivate unit"
                      : "Activate unit"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
