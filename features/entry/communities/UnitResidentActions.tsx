"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  KeyRound,
  Mail,
  MoreVertical,
  Power,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FloatingActionMenu } from "@/components/ui/FloatingActionMenu";
import type { CommunityUnitResident } from "@/features/entry/communities/detailQueries";
import {
  listResidentMoveUnitOptionsAction,
  moveResidentToUnitAction,
  type ResidentMoveUnitOption,
} from "@/features/entry/communities/residentMoveActions";
import { setResidentPasswordAction } from "@/features/entry/communities/unitActions";
import { sendCommunityUserPasswordResetEmailAction } from "@/features/entry/users/communityUserActions";
import { setCommunityUserActiveStatusAction } from "@/features/entry/users/actions";

type UnitResidentActionsProps = {
  communityId: string;
  resident: CommunityUnitResident;
  triggerClassName?: string;
  triggerLabel?: string;
};

type ModalState = "move" | "password" | "status" | null;
type PasswordResetMode = "quick" | "email";

function isSyntheticEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return !normalized || normalized.endsWith("@entry.local") || normalized.endsWith("@entry.internal");
}

export function UnitResidentActions({
  communityId,
  resident,
  triggerClassName,
  triggerLabel,
}: UnitResidentActionsProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordResetMode, setPasswordResetMode] = useState<PasswordResetMode>("quick");
  const [moveOptions, setMoveOptions] = useState<ResidentMoveUnitOption[]>([]);
  const [targetHouseId, setTargetHouseId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetMoveState() {
    setMoveOptions([]);
    setTargetHouseId("");
  }

  function closeModal() {
    if (isPending) return;
    setModal(null);
    setPassword("");
    setConfirmPassword("");
    setPasswordResetMode("quick");
    resetMoveState();
    setError(null);
  }

  function openModal(nextModal: Exclude<ModalState, "move" | null>) {
    setMenuOpen(false);
    setMessage(null);
    setError(null);
    resetMoveState();
    setPassword("");
    setConfirmPassword("");
    setPasswordResetMode("quick");
    setModal(nextModal);
  }

  function openMoveModal() {
    setMenuOpen(false);
    setMessage(null);
    setError(null);
    resetMoveState();
    setModal("move");

    startTransition(async () => {
      const result = await listResidentMoveUnitOptionsAction({
        communityId,
        currentHouseId: resident.houseId,
      });

      if (!result.success) {
        setError(result.error ?? "Could not load available units.");
        return;
      }

      setMoveOptions(result.options ?? []);
    });
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

  function submitPasswordResetEmail() {
    setError(null);

    if (isSyntheticEmail(resident.email)) {
      setError("This resident has no real email. Use quick password change instead.");
      return;
    }

    startTransition(async () => {
      const result = await sendCommunityUserPasswordResetEmailAction({
        communityId,
        userId: resident.userId,
      });

      if (!result.success) {
        setError(result.error ?? "Could not send the password recovery email.");
        return;
      }

      setMessage("Password reset email requested. The current password remains valid until recovery is completed.");
      setModal(null);
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

  function submitMove() {
    if (!targetHouseId) {
      setError("Select the unit this resident should move to.");
      return;
    }

    const destination = moveOptions.find((option) => option.id === targetHouseId);
    setError(null);

    startTransition(async () => {
      const result = await moveResidentToUnitAction({
        communityId,
        sourceHouseId: resident.houseId,
        targetHouseId,
        userId: resident.userId,
      });

      if (!result.success) {
        setError(result.error ?? "Could not move the resident.");
        return;
      }

      setMessage(
        destination?.label
          ? `Moved to ${destination.label}.`
          : "Resident moved to the selected unit.",
      );
      setModal(null);
      resetMoveState();
      router.refresh();
    });
  }

  function modalTitle() {
    if (modal === "password") return `Reset ${resident.fullName}`;
    if (modal === "move") return `Move ${resident.fullName}`;
    return resident.isActive
      ? `Deactivate ${resident.fullName}?`
      : `Reactivate ${resident.fullName}?`;
  }

  return (
    <div className="flex items-center gap-2">
      {message ? (
        <span className="text-xs font-semibold text-emerald-300">{message}</span>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className={
          triggerClassName ??
          "grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition hover:border-violet-400/30 hover:text-white"
        }
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={`Open actions for ${resident.fullName}`}
      >
        {triggerLabel ? (
          <span className="inline-flex items-center gap-2">
            {triggerLabel}
            <MoreVertical className="h-4 w-4" aria-hidden />
          </span>
        ) : (
          <MoreVertical className="h-4 w-4" aria-hidden />
        )}
      </button>

      <FloatingActionMenu
        anchorRef={triggerRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        className="w-56 p-1"
      >
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/6"
          onClick={openMoveModal}
        >
          <ArrowRightLeft className="h-4 w-4 text-violet-200" aria-hidden />
          Move to another unit
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-100 hover:bg-white/6"
          onClick={() => openModal("password")}
        >
          <KeyRound className="h-4 w-4 text-violet-200" aria-hidden />
          Reset password
        </button>
        <button
          type="button"
          role="menuitem"
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
      </FloatingActionMenu>

      {modal ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close resident action"
            className="absolute inset-0"
            onClick={closeModal}
          />
          <section className="relative z-10 w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
                  Resident account
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {modalTitle()}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="grid h-9 w-9 place-items-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {modal === "password" ? (
              <div className="mt-5 grid gap-4">
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Password reset method">
                  <button
                    type="button"
                    aria-pressed={passwordResetMode === "quick"}
                    disabled={isPending}
                    onClick={() => {
                      setPasswordResetMode("quick");
                      setPassword("");
                      setConfirmPassword("");
                      setError(null);
                    }}
                    className={`min-h-16 rounded-md border px-3 py-3 text-left transition ${passwordResetMode === "quick" ? "border-[#7553FF] bg-[#7553FF]/10 text-white" : "border-[var(--border)] bg-white/[0.02] text-[var(--text-muted)] hover:text-white"}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4" aria-hidden /> Quick change</span>
                    <span className="mt-1 block text-xs">Set a password now</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={passwordResetMode === "email"}
                    disabled={isPending || isSyntheticEmail(resident.email)}
                    onClick={() => {
                      setPasswordResetMode("email");
                      setPassword("");
                      setConfirmPassword("");
                      setError(null);
                    }}
                    className={`min-h-16 rounded-md border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${passwordResetMode === "email" ? "border-[#7553FF] bg-[#7553FF]/10 text-white" : "border-[var(--border)] bg-white/[0.02] text-[var(--text-muted)] hover:text-white"}`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold"><Mail className="size-4" aria-hidden /> Send email</span>
                    <span className="mt-1 block text-xs">User resets their password</span>
                  </button>
                </div>
                {passwordResetMode === "quick" ? (
                  <div className="grid gap-4">
                        <p className="rounded-lg border border-violet-400/15 bg-violet-500/[0.06] p-3 text-sm leading-5 text-violet-100">
                          Set a new password for {resident.fullName}. The previous password will stop working immediately.
                        </p>
                    <label>
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        New password
                      </span>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
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
                        className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <p className="rounded-lg border border-violet-400/15 bg-violet-500/[0.06] p-3 text-sm leading-5 text-violet-100">
                      Send a secure password recovery email to {resident.fullName}. Their existing password remains valid until they complete the reset in the ENTRY app.
                    </p>
                    <div className="rounded-md border border-[var(--border)] bg-white/[0.025] p-3">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Account email</p>
                      <p className="mt-1 break-all text-sm font-semibold text-white">{resident.email}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : modal === "move" ? (
              <div className="mt-5 grid gap-4">
                <div className="rounded-lg border border-white/8 bg-white/[0.025] px-4 py-3 text-sm">
                  <p className="text-[var(--text-muted)]">Current unit</p>
                  <p className="mt-1 font-semibold text-white">
                    {resident.houseLabel || "No unit linked"}
                  </p>
                </div>

                <label>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Move to
                  </span>
                  <select
                    value={targetHouseId}
                    onChange={(event) => setTargetHouseId(event.target.value)}
                    disabled={isPending || moveOptions.length === 0}
                    className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {isPending
                        ? "Loading units..."
                        : moveOptions.length === 0
                          ? "No other active units available"
                          : "Select destination unit"}
                    </option>
                    {moveOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-lg border border-violet-400/20 bg-violet-500/10 p-4 text-sm leading-6 text-violet-100">
                  This changes the resident&apos;s linked unit. Their login, role,
                  account status, and audit history stay unchanged.
                </div>
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
                onClick={
                  modal === "password"
                    ? passwordResetMode === "email"
                      ? submitPasswordResetEmail
                      : submitPassword
                    : modal === "move"
                      ? submitMove
                      : submitStatus
                }
                disabled={isPending || (modal === "move" && !targetHouseId) || (modal === "password" && passwordResetMode === "email" && isSyntheticEmail(resident.email))}
              >
                {isPending
                  ? "Working..."
                  : modal === "password"
                    ? passwordResetMode === "email"
                      ? "Send reset email"
                      : "Reset password"
                    : modal === "move"
                      ? "Move resident"
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
