"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Share2, UserPlus } from "lucide-react";
import {
  createFieldActivationAccount,
  type FieldCreateAccountResult,
  generateFieldActivationPin,
  type FieldActivationPinResult,
} from "@/features/entry/field/peopleActions";
import {
  isActivationPinEligible,
  type FieldActivationRow,
} from "@/features/entry/field/peopleModel";

type FieldActivationActionsProps = {
  communityId: string;
  communityName: string;
  isReadOnlyPreview: boolean;
  row: FieldActivationRow;
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

function buildActivationMessage(input: {
  communityName: string;
  pin: string;
  residentName: string;
  unitLabel?: string | null;
  username?: string | null;
}) {
  return [
    `ENTRY activation for ${input.residentName}`,
    `Community: ${input.communityName}`,
    input.unitLabel ? `Unit: ${input.unitLabel}` : "",
    input.username ? `Username: ${input.username}` : "",
    `Activation PIN: ${input.pin}`,
    "Open ENTRY and enter this PIN to activate your account.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildAccountCredentialsMessage(input: {
  communityName: string;
  loginIdentity: string;
  residentName: string;
  temporaryPassword: string;
  unitLabel?: string | null;
}) {
  return [
    `ENTRY account for ${input.residentName}`,
    `Community: ${input.communityName}`,
    input.unitLabel ? `Unit: ${input.unitLabel}` : "",
    `Login: ${input.loginIdentity}`,
    `Temporary password: ${input.temporaryPassword}`,
    "Sign in and change your password as soon as possible.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function FieldActivationActions({
  communityId,
  communityName,
  isReadOnlyPreview,
  row,
}: FieldActivationActionsProps) {
  const router = useRouter();
  const [confirmingPin, setConfirmingPin] = useState(false);
  const [confirmingAccount, setConfirmingAccount] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pinResult, setPinResult] = useState<FieldActivationPinResult | null>(
    null,
  );
  const [accountResult, setAccountResult] =
    useState<FieldCreateAccountResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [credentialsCopied, setCredentialsCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canShare = useSyncExternalStore(
    subscribe,
    getShareSnapshot,
    getServerSnapshot,
  );
  const pinEligible = isActivationPinEligible(row);
  const accountEligible = isActivationPinEligible(row);
  const activationMessage = useMemo(() => {
    if (!pinResult?.pin) {
      return "";
    }

    return buildActivationMessage({
      communityName,
      pin: pinResult.pin,
      residentName: pinResult.residentName || row.resident,
      unitLabel: pinResult.unitLabel || row.unit,
      username: pinResult.suggestedUsername,
    });
  }, [communityName, pinResult, row.resident, row.unit]);
  const accountCredentialsMessage = useMemo(() => {
    if (!accountResult?.loginIdentity || !accountResult.temporaryPassword) {
      return "";
    }

    return buildAccountCredentialsMessage({
      communityName,
      loginIdentity: accountResult.loginIdentity,
      residentName: accountResult.residentName || row.resident,
      temporaryPassword: accountResult.temporaryPassword,
      unitLabel: accountResult.unitLabel || row.unit,
    });
  }, [accountResult, communityName, row.resident, row.unit]);

  function handleGeneratePin() {
    setMessage(null);
    setPinResult(null);

    startTransition(async () => {
      const result = await generateFieldActivationPin({
        communityId,
        queueId: row.id,
      });

      if (!result.success) {
        setMessage(result.error || "Could not generate activation PIN.");
        setPinResult(result);
        return;
      }

      setConfirmingPin(false);
      setPinResult(result);
      setMessage("Activation PIN generated.");
    });
  }

  function handleCreateAccount() {
    setMessage(null);
    setAccountResult(null);

    startTransition(async () => {
      const result = await createFieldActivationAccount({
        communityId,
        queueId: row.id,
      });

      if (!result.success) {
        setMessage(result.error || "Could not create account.");
        setAccountResult(result);
        return;
      }

      setConfirmingAccount(false);
      setAccountResult(result);
      setMessage("Account created.");
      router.refresh();
    });
  }

  async function handleCopy() {
    if (!activationMessage) return;

    try {
      await navigator.clipboard.writeText(activationMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setMessage("Could not copy activation message.");
    }
  }

  async function handleShare() {
    if (!activationMessage) return;

    try {
      await navigator.share({
        text: activationMessage,
        title: "ENTRY activation PIN",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setMessage("Could not share activation PIN.");
    }
  }

  async function handleCopyCredentials() {
    if (!accountCredentialsMessage) return;

    try {
      await navigator.clipboard.writeText(accountCredentialsMessage);
      setCredentialsCopied(true);
      window.setTimeout(() => setCredentialsCopied(false), 2200);
    } catch {
      setMessage("Could not copy credentials.");
    }
  }

  async function handleShareCredentials() {
    if (!accountCredentialsMessage) return;

    try {
      await navigator.share({
        text: accountCredentialsMessage,
        title: "ENTRY account credentials",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setMessage("Could not share credentials.");
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
          {message}
        </p>
      ) : null}

      <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-2">
          <KeyRound
            aria-hidden="true"
            className="h-4 w-4 text-[var(--console-accent)]"
          />
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Generate activation PIN
          </h2>
        </div>

        <p className="break-words text-sm leading-6 text-[var(--console-text-muted)]">
          Generate a single activation PIN for {row.resident} in {row.unit}.
          The PIN will be shown once after confirmation.
        </p>

        {isReadOnlyPreview ? (
          <p className="text-xs leading-5 text-amber-200">
            Preview is read-only. PIN generation is disabled.
          </p>
        ) : null}

        {!pinEligible ? (
          <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
            This activation row is not eligible for a new PIN.
          </p>
        ) : !confirmingPin ? (
          <button
            type="button"
            onClick={() => setConfirmingPin(true)}
            disabled={isPending || isReadOnlyPreview}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            Generate activation PIN
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="break-words text-sm leading-6 text-amber-100">
              Confirm PIN generation for {row.resident} in {row.unit}.
            </p>
            <button
              type="button"
              onClick={handleGeneratePin}
              disabled={isPending || isReadOnlyPreview}
              className="min-h-12 w-full rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Generating..." : "Confirm PIN generation"}
            </button>
          </div>
        )}

        {pinResult?.pin ? (
          <div className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
              Activation PIN
            </p>
            <p className="break-all font-mono text-3xl font-semibold text-white">
              {pinResult.pin}
            </p>
            <p className="text-sm leading-6 text-emerald-100">
              Copy or share this now. It may not be shown again.
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-slate-950"
            >
              <Copy aria-hidden="true" className="h-4 w-4" />
              {copied ? "Copied" : "Copy activation message"}
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={handleShare}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200/60 px-4 text-sm font-semibold text-white"
              >
                <Share2 aria-hidden="true" className="h-4 w-4" />
                Share activation message
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-2">
          <UserPlus
            aria-hidden="true"
            className="h-4 w-4 text-[var(--console-accent)]"
          />
          <h2 className="text-lg font-semibold text-[var(--console-text)]">
            Create account now
          </h2>
        </div>

        <p className="break-words text-sm leading-6 text-[var(--console-text-muted)]">
          Create one ENTRY account for {row.resident} in {row.unit}. Temporary
          credentials will be shown once after confirmation.
        </p>

        {isReadOnlyPreview ? (
          <p className="text-xs leading-5 text-amber-200">
            Preview is read-only. Account creation is disabled.
          </p>
        ) : null}

        {!accountEligible ? (
          <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm leading-6 text-[var(--console-text-muted)]">
            This activation row is not eligible for account creation.
          </p>
        ) : !confirmingAccount ? (
          <button
            type="button"
            onClick={() => setConfirmingAccount(true)}
            disabled={isPending || isReadOnlyPreview}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)] transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            Create account now
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="break-words text-sm leading-6 text-amber-100">
              Confirm account creation for {row.resident} in {row.unit}.
            </p>
            <button
              type="button"
              onClick={handleCreateAccount}
              disabled={isPending || isReadOnlyPreview}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-black text-slate-950 transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Check aria-hidden="true" className="h-4 w-4" />
              {isPending ? "Creating..." : "Confirm account creation"}
            </button>
          </div>
        )}

        {accountResult?.success &&
        accountResult.loginIdentity &&
        accountResult.temporaryPassword ? (
          <div className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
              Account created
            </p>
            <div className="grid gap-2 text-sm leading-6 text-emerald-100">
              <p className="break-words">
                Resident: {accountResult.residentName || row.resident}
              </p>
              <p className="break-words">
                Unit: {accountResult.unitLabel || row.unit}
              </p>
              <p className="break-words">
                Login: {accountResult.loginIdentity}
              </p>
              <p className="break-all font-mono text-lg font-semibold text-white">
                Temporary password: {accountResult.temporaryPassword}
              </p>
            </div>
            <p className="text-sm leading-6 text-emerald-100">
              Save or share these credentials now. They may not be shown again.
            </p>
            <button
              type="button"
              onClick={handleCopyCredentials}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-slate-950"
            >
              <Copy aria-hidden="true" className="h-4 w-4" />
              {credentialsCopied ? "Copied" : "Copy credentials"}
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={handleShareCredentials}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200/60 px-4 text-sm font-semibold text-white"
              >
                <Share2 aria-hidden="true" className="h-4 w-4" />
                Share credentials
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
