"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw, Share2, UserPlus } from "lucide-react";
import {
  createFieldQuickResident,
  type FieldQuickResidentCreateResult,
} from "@/features/entry/field/quickResidentActions";

type FieldQuickResidentFormProps = {
  communityId: string;
  communityName: string;
  isReadOnlyPreview: boolean;
  unitId: string;
  unitLabel: string;
};

type Phase = "form" | "confirm" | "success";

function subscribe() {
  return () => {};
}

function getShareSnapshot() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function getServerSnapshot() {
  return false;
}

function generateSecurePassword() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `Entry!${suffix}`;
}

function buildCredentialsMessage(input: {
  communityName: string;
  loginIdentity: string;
  password: string;
  residentName: string;
  unitLabel: string;
}) {
  return [
    "ENTRY resident access",
    `Resident: ${input.residentName}`,
    `Community: ${input.communityName}`,
    `Unit: ${input.unitLabel}`,
    `Login: ${input.loginIdentity}`,
    `Password: ${input.password}`,
    "Please sign in and change/store your password securely.",
  ].join("\n");
}

export function FieldQuickResidentForm({
  communityId,
  communityName,
  isReadOnlyPreview,
  unitId,
  unitLabel,
}: FieldQuickResidentFormProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<FieldQuickResidentCreateResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canShare = useSyncExternalStore(subscribe, getShareSnapshot, getServerSnapshot);

  const canContinue = Boolean(
    fullName.trim() &&
      password.length >= 8 &&
      (username.trim() || email.trim()),
  );

  const credentialsMessage = useMemo(() => {
    if (!result?.success || !result.loginIdentity || !result.residentName) {
      return "";
    }

    return buildCredentialsMessage({
      communityName,
      loginIdentity: result.loginIdentity,
      password,
      residentName: result.residentName,
      unitLabel: result.unitLabel || unitLabel,
    });
  }, [communityName, password, result, unitLabel]);

  function handleGeneratePassword() {
    setPassword(generateSecurePassword());
    setShowPassword(true);
    setMessage(null);
  }

  function handleContinue() {
    setMessage(null);

    if (!fullName.trim()) {
      setMessage("Resident name is required.");
      return;
    }

    if (!username.trim() && !email.trim()) {
      setMessage("Enter a username or email for resident sign-in.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setPhase("confirm");
  }

  function handleCreate() {
    setMessage(null);
    setResult(null);

    startTransition(async () => {
      const createResult = await createFieldQuickResident({
        communityId,
        email,
        fullName,
        password,
        phone,
        unitId,
        username,
      });

      setResult(createResult);

      if (!createResult.success) {
        setMessage(createResult.error || "Could not create resident account.");
        setPhase("form");
        return;
      }

      setPhase("success");
    });
  }

  async function handleCopy() {
    if (!credentialsMessage) return;

    try {
      await navigator.clipboard.writeText(credentialsMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setMessage("Could not copy credentials.");
    }
  }

  async function handleShare() {
    if (!credentialsMessage) return;

    try {
      await navigator.share({
        text: credentialsMessage,
        title: "ENTRY resident access",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setMessage("Could not share credentials.");
    }
  }

  if (phase === "success" && result?.success) {
    return (
      <div className="space-y-4">
        <section className="space-y-3 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4">
          <div className="flex items-center gap-2 text-emerald-100">
            <Check aria-hidden="true" className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Resident created</h2>
          </div>
          <p className="text-sm leading-6 text-emerald-100">
            Save or share these credentials now. The password will disappear when you leave or refresh this page.
          </p>
          <div className="space-y-2 rounded-lg border border-emerald-200/20 bg-black/20 p-3">
            <p className="break-words text-base font-semibold text-white">
              {result.residentName}
            </p>
            <p className="break-words text-sm text-emerald-50">
              {result.unitLabel || unitLabel}
            </p>
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
                Login
              </p>
              <p className="mt-1 break-all font-mono text-base text-white">
                {result.loginIdentity}
              </p>
            </div>
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
                Password
              </p>
              <p className="mt-1 break-all font-mono text-xl text-white">{password}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-slate-950"
          >
            <Copy aria-hidden="true" className="h-4 w-4" />
            {copied ? "Copied" : "Copy credentials"}
          </button>
          {canShare ? (
            <button
              type="button"
              onClick={handleShare}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-emerald-200/50 px-4 text-sm font-semibold text-white"
            >
              <Share2 aria-hidden="true" className="h-4 w-4" />
              Share credentials
            </button>
          ) : null}
        </section>

        {message ? (
          <p className="rounded-lg border border-[var(--console-border)] bg-white/[0.03] p-3 text-sm text-[var(--console-text-muted)]">
            {message}
          </p>
        ) : null}

        <Link
          href={`/field/entry/communities/${encodeURIComponent(communityId)}/people/units/${encodeURIComponent(unitId)}`}
          className="flex min-h-12 w-full items-center justify-center rounded-lg border border-[var(--console-border)] bg-white/5 px-4 text-sm font-semibold text-[var(--console-text)]"
        >
          Done
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
          Resident will be linked to
        </p>
        <p className="mt-2 text-base font-semibold text-[var(--console-text)]">{unitLabel}</p>
        <p className="mt-1 text-sm text-[var(--console-text-muted)]">{communityName}</p>
      </section>

      {isReadOnlyPreview ? (
        <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          Preview is read-only. Resident creation is disabled.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          {message}
        </p>
      ) : null}

      {phase === "form" ? (
        <section className="space-y-4 rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
          <div>
            <label htmlFor="resident-name" className="text-sm font-semibold text-[var(--console-text)]">
              Full name
            </label>
            <input
              id="resident-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              disabled={isPending || isReadOnlyPreview}
              className="mt-2 min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-black/20 px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent)] disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="resident-username" className="text-sm font-semibold text-[var(--console-text)]">
              Username
            </label>
            <input
              id="resident-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              disabled={isPending || isReadOnlyPreview}
              placeholder="Preferred when no email"
              className="mt-2 min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-black/20 px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent)] disabled:opacity-60"
            />
            <p className="mt-1 text-xs leading-5 text-[var(--console-text-soft)]">
              Required when no email is provided. Spaces and symbols are normalized automatically.
            </p>
          </div>

          <div>
            <label htmlFor="resident-email" className="text-sm font-semibold text-[var(--console-text)]">
              Email <span className="font-normal text-[var(--console-text-soft)]">(optional)</span>
            </label>
            <input
              id="resident-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoCapitalize="none"
              autoComplete="email"
              disabled={isPending || isReadOnlyPreview}
              className="mt-2 min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-black/20 px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent)] disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="resident-phone" className="text-sm font-semibold text-[var(--console-text)]">
              Phone <span className="font-normal text-[var(--console-text-soft)]">(optional)</span>
            </label>
            <input
              id="resident-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              disabled={isPending || isReadOnlyPreview}
              className="mt-2 min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-black/20 px-3 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent)] disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="resident-password" className="text-sm font-semibold text-[var(--console-text)]">
              Password
            </label>
            <div className="mt-2 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  id="resident-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  disabled={isPending || isReadOnlyPreview}
                  className="min-h-12 w-full rounded-lg border border-[var(--console-border)] bg-black/20 px-3 pr-12 text-base text-[var(--console-text)] outline-none focus:border-[var(--console-accent)] disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={!password}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-md text-[var(--console-text-muted)] disabled:opacity-30"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleGeneratePassword}
                disabled={isPending || isReadOnlyPreview}
                aria-label="Generate password"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--console-border)] bg-white/5 text-[var(--console-text)] disabled:opacity-50"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--console-text-soft)]">
              Minimum 8 characters. You can enter it yourself or generate one.
            </p>
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue || isPending || isReadOnlyPreview}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--console-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            Continue
          </button>
        </section>
      ) : (
        <section className="space-y-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-4">
          <div className="flex items-center gap-2 text-amber-100">
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            <h2 className="text-lg font-semibold">Confirm resident</h2>
          </div>
          <div className="space-y-2 text-sm leading-6 text-amber-50">
            <p><strong>Name:</strong> {fullName.trim()}</p>
            <p><strong>Unit:</strong> {unitLabel}</p>
            <p><strong>Login:</strong> {email.trim() || username.trim()}</p>
            {phone.trim() ? <p><strong>Phone:</strong> {phone.trim()}</p> : null}
            <p><strong>Password:</strong> {"•".repeat(Math.min(password.length, 12))}</p>
          </div>
          <p className="text-sm leading-6 text-amber-100">
            This creates an active RESIDENT account and links it directly to this unit.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPhase("form")}
              disabled={isPending}
              className="min-h-12 rounded-lg border border-amber-200/30 px-3 text-sm font-semibold text-amber-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || isReadOnlyPreview}
              className="min-h-12 rounded-lg bg-amber-300 px-3 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create resident"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
