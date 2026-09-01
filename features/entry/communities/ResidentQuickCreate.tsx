"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  createQuickResidentAction,
  type CreateResidentResult,
} from "@/features/entry/communities/unitActions";
import type { CommunityUnitHouseOption } from "@/features/entry/communities/detailQueries";

type ResidentQuickCreateProps = {
  communityId: string;
  fixedUnitId?: string;
  houses: CommunityUnitHouseOption[];
  triggerClassName?: string;
  triggerLabel?: string;
};

export function ResidentQuickCreate({
  communityId,
  fixedUnitId,
  houses,
  triggerClassName,
  triggerLabel = "Create resident",
}: ResidentQuickCreateProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [unitId, setUnitId] = useState(fixedUnitId ?? "");
  const [result, setResult] = useState<CreateResidentResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
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
    setFullName("");
    setPassword("");
    setUnitId(fixedUnitId ?? "");
    setResult(null);
    setCopied(false);
  }

  function close() {
    if (isPending) return;
    setOpen(false);
    resetForm();
  }

  function submit() {
    setResult(null);
    setCopied(false);

    if (selectedUnit && !selectedUnit.isActive) {
      setResult({
        error: "Activate this unit before creating a resident account.",
        success: false,
      });
      return;
    }

    startTransition(async () => {
      const nextResult = await createQuickResidentAction({
        communityId,
        fullName,
        password,
        unitId: fixedUnitId ?? unitId,
      });

      setResult(nextResult);

      if (nextResult.success) {
        setFullName("");
        setPassword("");
        router.refresh();
      }
    });
  }

  async function copyCredentials() {
    if (!result?.credentials) return;

    await navigator.clipboard.writeText(
      [
        `Resident: ${result.credentials.residentName}`,
        `Unit: ${result.credentials.unitLabel}`,
        `Login: ${result.credentials.login}`,
        `Password: ${result.credentials.password}`,
      ].join("\n"),
    );
    setCopied(true);
  }

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
          <section className="relative z-10 w-full max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-violet-400/20 bg-violet-500/12 text-violet-100">
                  <UserPlus className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
                    Resident account
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-white">
                    Create resident
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

            {result?.success && result.credentials ? (
              <div className="mt-5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/16 text-emerald-200">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-white">Resident created</p>
                    <p className="mt-1 text-sm text-emerald-100/90">
                      {result.credentials.residentName} · {result.credentials.unitLabel}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 rounded-lg border border-white/8 bg-black/18 p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--text-muted)]">Login</dt>
                    <dd className="font-semibold text-white">{result.credentials.login}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--text-muted)]">Password</dt>
                    <dd className="font-semibold text-white">{result.credentials.password}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap justify-end gap-3">
                  <Button type="button" variant="secondary" onClick={copyCredentials}>
                    <Copy className="mr-2 h-4 w-4" aria-hidden />
                    {copied ? "Copied" : "Copy credentials"}
                  </Button>
                  <Button type="button" onClick={resetForm}>
                    Create another
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Resident name *
                  </span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
                    placeholder="Full name"
                  />
                </label>

                <label className="block">
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
                      Activate a unit before creating residents.
                    </p>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Password *
                  </span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-400/50"
                    type="password"
                    placeholder="Minimum 8 characters"
                  />
                </label>

                {result?.error ? (
                  <div className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                    {result.error}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3 border-t border-white/8 pt-4">
                  <Button type="button" variant="ghost" onClick={close} disabled={isPending}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={submit} disabled={isPending}>
                    {isPending ? "Creating..." : "Create resident"}
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
