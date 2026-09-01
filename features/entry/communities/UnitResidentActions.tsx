"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, MoreVertical, Power, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CommunityUnitResident } from "@/features/entry/communities/detailQueries";
import {
  setResidentPasswordAction,
} from "@/features/entry/communities/unitActions";
import { setCommunityUserActiveStatusAction } from "@/features/entry/users/actions";

type UnitResidentActionsProps = {
  communityId: string;
  resident: CommunityUnitResident;
};

type ModalState = "password" | "status" | null;

export function UnitResidentActions({
  communityId,
  resident,
}: UnitResidentActionsProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function closeModal() {
    if (isPending) return;
    setModal(null);
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  function openModal(nextModal: ModalState) {
    setMenuOpen(false);
    setMessage(null);
    setError(null);
    setModal(nextModal);
  }

  function submitPassword() {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await setResidentPasswordAction({
        communityId,
        password,
        userId: resident.userId,
      });

      if (!result.success) {
        setError(result.error ?? "Could not update the password.");
        return;
      }

      setMessage("Password updated.");
      setModal(null);
      setPassword("");
      setConfirmPassword("");
    });
  }

  function submitStatus() {
    setError(null);
    startTransition(async () => {
      const result = await setCommunityUserActiveStatusAction({
        communityId,
        isActive: !resident.isActive,
        userId: resident.userId,
      });

      if (!result.success) {
        setError(result.error ?? "Could not update the account status.");
        return;
      }

      setMessage(resident.isActive ? "Account deactivated." : "Account reactivated.");
      setModal(null);
      router.refresh();
    });
  }

  return (
    <div className="relative flex items-center gap-2">
      {message ? (
        <span className="text-xs font-semibold text-emerald-300">{message}</span>
      ) : null}
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:border-violet-400/30 hover:text-white"
        aria-label={`Open actions for ${resident.fullName}`}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-10 z-20 w-52 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/6"
            onClick={() => openModal("password")}
          >
            <KeyRound className="h-4 w-4 text-violet-200" aria-hidden />
            Reset password
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/6"
            onClick={() => openModal("status")}
          >
            {resident.isActive ? (
              <Power className="h-4 w-4 text-rose-300" aria-hidden />
            ) : (
              <RotateCcw className="h-4 w-4 text-emerald-300" aria-hidden />
            )}
            {resident.isActive ? "Deactivate account" : "Reactivate account"}
          </button>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close resident action"
            className="absolute inset-0"
            onClick={closeModal}
          />
          <section className="relative z-10 w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
                  Resident account
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {modal === "password"
                    ? `Reset ${resident.fullName}`
                    : resident.isActive
                      ? `Deactivate ${resident.fullName}?`
                      : `Reactivate ${resident.fullName}?`}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {modal === "password" ? (
              <div className="mt-5 grid gap-4">
                <label>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    New password
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
                  />
                </label>
                <label>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Confirm password
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                {resident.isActive
                  ? `${resident.fullName} will no longer be able to access ENTRY. Their resident record remains linked to this unit.`
                  : `${resident.fullName} will regain ENTRY access for this community.`}
              </div>
            )}

            {error ? (
              <div className="mt-4 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-white/8 pt-4">
              <Button type="button" variant="ghost" onClick={closeModal} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={modal === "status" && resident.isActive ? "danger" : "primary"}
                onClick={modal === "password" ? submitPassword : submitStatus}
                disabled={isPending}
              >
                {isPending
                  ? "Working..."
                  : modal === "password"
                    ? "Set password"
                    : resident.isActive
                      ? "Deactivate account"
                      : "Reactivate account"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
