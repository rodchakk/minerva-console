"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Eye, EyeOff, Plus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  prepareConsoleResidentAccess,
  type PrepareConsoleResidentAccessResult,
} from "@/features/entry/activation/consoleResidentAccessActions";
import {
  ResidentAccessModePicker,
  type ResidentAccessMode,
} from "@/features/entry/activation/ResidentAccessModePicker";
import {
  createQuickResidentAction,
  type CreateResidentResult,
} from "@/features/entry/communities/unitActions";
import type { CommunityUnitHouseOption } from "@/features/entry/communities/detailQueries";
import { ENTRY_ADMIN_TEMP_PASSWORD_HELPER } from "@/features/entry/passwordPolicy";

type ResidentQuickCreateProps = {
  communityId: string;
  fixedUnitId?: string;
  houses: CommunityUnitHouseOption[];
  triggerClassName?: string;
  triggerLabel?: string;
};

type FlowResult =
  | { kind: "quick"; value: CreateResidentResult }
  | { kind: "prepared"; value: PrepareConsoleResidentAccessResult };

export function ResidentQuickCreate({
  communityId,
  fixedUnitId,
  houses,
  triggerClassName,
  triggerLabel = "Create resident",
}: ResidentQuickCreateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accessMode, setAccessMode] = useState<ResidentAccessMode>("email");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [unitId, setUnitId] = useState(fixedUnitId ?? "");
  const [result, setResult] = useState<FlowResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formId = fixedUnitId ? `unit-${fixedUnitId}` : "community";

  const selectedUnit = useMemo(
    () => houses.find((house) => house.id === (fixedUnitId ?? unitId)) ?? null,
    [fixedUnitId, houses, unitId],
  );
  const activeHouses = useMemo(
    () => houses.filter((house) => house.isActive),
    [houses],
  );
  const fixedUnitInactive = Boolean(fixedUnitId && selectedUnit && !selectedUnit.isActive);

  function resetForm() {
    setAccessMode("email");
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setUnitId(fixedUnitId ?? "");
    setResult(null);
    setCopied(false);
    setCopiedPassword(false);
    setShowPassword(false);
  }

  function close() {
    if (isPending) return;
    setOpen(false);
    resetForm();
  }

  function setMode(mode: ResidentAccessMode) {
    setAccessMode(mode);
    setResult(null);
    setCopied(false);
  }

  function submit() {
    setResult(null);
    setCopied(false);
    setCopiedPassword(false);

    const targetUnitId = fixedUnitId ?? unitId;

    if (!fullName.trim()) {
      setResult({
        kind: "prepared",
        value: { success: false, error: "Resident name is required." },
      });
      return;
    }

    if (!targetUnitId) {
      setResult({
        kind: "prepared",
        value: { success: false, error: "Select a unit before continuing." },
      });
      return;
    }

    if (selectedUnit && !selectedUnit.isActive) {
      setResult({
        kind: "prepared",
        value: {
          success: false,
          error: "Activate this unit before creating or inviting a resident.",
        },
      });
      return;
    }

    if (accessMode === "email" && !email.trim()) {
      setResult({
        kind: "prepared",
        value: { success: false, error: "Email is required for an email invitation." },
      });
      return;
    }

    startTransition(async () => {
      if (accessMode === "quick") {
        const nextResult = await createQuickResidentAction({
          communityId,
          fullName,
          password,
          unitId: targetUnitId,
        });

        setResult({ kind: "quick", value: nextResult });
        if (nextResult.success) router.refresh();
        return;
      }

      const nextResult = await prepareConsoleResidentAccess({
        communityId,
        unitId: targetUnitId,
        fullName,
        email,
        phone,
        mode: accessMode,
      });

      setResult({ kind: "prepared", value: nextResult });
      if (nextResult.success) router.refresh();
    });
  }

  async function copySuccessDetails() {
    if (!result?.value.success) return;

    if (result.kind === "quick" && result.value.credentials) {
      await navigator.clipboard.writeText(
        [
          `Resident: ${result.value.credentials.residentName}`,
          `Unit: ${result.value.credentials.unitLabel}`,
          `Login: ${result.value.credentials.login}`,
          `Password: ${result.value.credentials.password}`,
        ].join("\n"),
      );
      setCopied(true);
      return;
    }

    if (result.kind === "prepared" && result.value.mode === "pin" && result.value.pin) {
      await navigator.clipboard.writeText(
        [
          `Resident: ${result.value.residentName ?? fullName}`,
          `Unit: ${result.value.unitLabel ?? selectedUnit?.label ?? ""}`,
          `ENTRY activation PIN: ${result.value.pin}`,
          'Open ENTRY and choose "Activate account".',
        ].join("\n"),
      );
      setCopied(true);
    }
  }

  async function copyDraftPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopiedPassword(true);
    window.setTimeout(() => setCopiedPassword(false), 1600);
  }

  const flowError = result && !result.value.success ? result.value.error : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={fixedUnitInactive}
        title={fixedUnitInactive ? "Activate this unit before adding residents." : undefined}
        className={`${
          triggerClassName ??
          "inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-[var(--primary)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)]"
        } disabled:cursor-not-allowed disabled:opacity-55`}
      >
        <Plus className="h-4 w-4" aria-hidden />
        {triggerLabel}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close resident creation"
            className="absolute inset-0"
            onClick={close}
          />
          <section className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-violet-400/20 bg-violet-500/12 text-violet-100">
                  <UserPlus className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
                    ENTRY user creation
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-white">
                    Create ENTRY user
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {result?.value.success ? (
              <div className="mt-5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/16 text-emerald-200">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-white">
                      {result.kind === "quick"
                        ? "Resident created"
                        : result.value.mode === "email"
                          ? result.value.emailSent
                            ? "Invitation sent"
                            : "Resident prepared for activation"
                          : "Activation PIN ready"}
                    </p>
                    <p className="mt-1 text-sm text-emerald-100/90">
                      {result.kind === "quick"
                        ? `${result.value.credentials?.residentName ?? fullName} · ${result.value.credentials?.unitLabel ?? selectedUnit?.label ?? ""}`
                        : `${result.value.residentName ?? fullName} · ${result.value.unitLabel ?? selectedUnit?.label ?? ""}`}
                    </p>
                  </div>
                </div>

                {result.kind === "quick" && result.value.credentials ? (
                  <dl className="mt-4 grid gap-3 rounded-lg border border-white/8 bg-black/18 p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--text-muted)]">Login</dt>
                      <dd className="font-semibold text-white">{result.value.credentials.login}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--text-muted)]">Password</dt>
                      <dd className="font-semibold text-white">{result.value.credentials.password}</dd>
                    </div>
                  </dl>
                ) : null}

                {result.kind === "prepared" && result.value.mode === "email" ? (
                  <div className="mt-4 rounded-lg border border-white/8 bg-black/18 p-3 text-sm">
                    <p className="text-[var(--text-muted)]">Email</p>
                    <p className="mt-1 font-semibold text-white">{result.value.email}</p>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                      The resident is now tracked in Activation Queue and completes activation through the normal ENTRY PIN flow.
                    </p>
                  </div>
                ) : null}

                {result.kind === "prepared" && result.value.mode === "pin" ? (
                  <div className="mt-4 rounded-lg border border-violet-400/20 bg-black/18 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Activation PIN
                    </p>
                    <p className="mt-2 font-mono text-3xl font-bold tracking-[0.28em] text-violet-100">
                      {result.value.pin}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      Share this PIN with the resident. It expires in 7 days.
                    </p>
                  </div>
                ) : null}

                {result.kind === "prepared" && result.value.warning ? (
                  <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                    {result.value.warning}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap justify-end gap-3">
                  {(result.kind === "quick" && result.value.credentials) ||
                  (result.kind === "prepared" && result.value.mode === "pin" && result.value.pin) ? (
                    <Button type="button" variant="secondary" onClick={copySuccessDetails}>
                      <Copy className="mr-2 h-4 w-4" aria-hidden />
                      {copied ? "Copied" : "Copy details"}
                    </Button>
                  ) : null}
                  <Button type="button" onClick={resetForm}>
                    Add another
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-5">
                <div>
                  <p className="mb-2 text-sm leading-6 text-[var(--text-muted)]">
                    Choose how you want to create this resident.
                  </p>
                  <ResidentAccessModePicker value={accessMode} onChange={setMode} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Resident name *
                    </span>
                    <input
                      id={`entry-quick-resident-full-name-${formId}`}
                      name="entry_quick_resident_full_name"
                      autoComplete="off"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
                      placeholder="Full name"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Unit *
                    </span>
                    {fixedUnitId ? (
                      <div className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm font-semibold text-white">
                        {fixedUnitInactive
                          ? `${selectedUnit?.label ?? "Selected unit"} - activate unit first`
                          : selectedUnit?.label ?? "Selected unit"}
                      </div>
                    ) : (
                      <select
                        id={`entry-quick-resident-unit-${formId}`}
                        name="entry_quick_resident_unit"
                        autoComplete="off"
                        value={unitId}
                        onChange={(event) => setUnitId(event.target.value)}
                        className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
                      >
                        <option value="">Select unit</option>
                        {houses.map((house) => (
                          <option key={house.id} value={house.id} disabled={!house.isActive}>
                            {house.label}
                            {house.isActive ? "" : " (inactive)"}
                          </option>
                        ))}
                      </select>
                    )}
                    {!fixedUnitId && activeHouses.length === 0 ? (
                      <p className="mt-2 text-sm text-amber-200">
                        Activate a unit before adding residents.
                      </p>
                    ) : null}
                  </label>

                  {accessMode === "email" ? (
                    <>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          Email *
                        </span>
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
                          placeholder="resident@example.com"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          Phone
                        </span>
                        <input
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
                          placeholder="+504..."
                        />
                      </label>
                    </>
                  ) : null}

                  {accessMode === "pin" ? (
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Phone (optional)
                      </span>
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
                        placeholder="+504..."
                      />
                    </label>
                  ) : null}

                  {accessMode === "quick" ? (
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Temporary password *
                      </span>
                      <div className="flex overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] focus-within:border-violet-400/50">
                        <input
                          id={`entry-quick-resident-password-${formId}`}
                          name="entry_quick_resident_temporary_password"
                          autoComplete="new-password"
                          value={password}
                          onChange={(event) => {
                            setPassword(event.target.value);
                            setCopiedPassword(false);
                          }}
                          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-[var(--text-muted)]"
                          type={showPassword ? "text" : "password"}
                          placeholder={ENTRY_ADMIN_TEMP_PASSWORD_HELPER}
                        />
                        <button
                          type="button"
                          title={showPassword ? "Hide password" : "Show password"}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((current) => !current)}
                          className="grid h-11 w-11 place-items-center border-l border-white/8 text-[var(--text-muted)] transition hover:text-white"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                        <button
                          type="button"
                          title="Copy password"
                          aria-label="Copy password"
                          disabled={!password}
                          onClick={copyDraftPassword}
                          className="grid h-11 w-11 place-items-center border-l border-white/8 text-[var(--text-muted)] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {copiedPassword ? (
                            <Check className="h-4 w-4" aria-hidden />
                          ) : (
                            <Copy className="h-4 w-4" aria-hidden />
                          )}
                        </button>
                      </div>
                    </label>
                  ) : null}
                </div>

                {flowError ? (
                  <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                    {flowError}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3 border-t border-white/8 pt-4">
                  <Button type="button" variant="ghost" onClick={close} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={submit} disabled={isPending}>
                    {isPending
                      ? "Working..."
                      : accessMode === "email"
                        ? "Send invitation"
                        : accessMode === "pin"
                          ? "Generate PIN"
                          : "Create active user"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
