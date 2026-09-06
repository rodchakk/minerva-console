"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Copy, Eye, EyeOff, MoreHorizontal, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ENTRY_ADMIN_TEMP_PASSWORD_HELPER } from "@/features/entry/passwordPolicy";
import {
  createGuardAction,
  promoteResidentAdminAction,
  type StaffUserItem,
} from "@/features/entry/staff/actions";
import { cn } from "@/lib/supabase/utils";

type OperatorFilter = "all" | "admins" | "guards";

type DirectoryOperator = {
  accountMode: string;
  contact: string;
  fullName: string;
  houseLabel: string;
  id: string;
  initials: string;
  isActive: boolean;
  role: "ADMIN" | "GUARD";
  subtitle: string;
};

function SubmitButton({
  children,
  disabled = false,
}: {
  children: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Working..." : children}
    </Button>
  );
}

function StatusMessage({ message, ok }: { message?: string; ok?: boolean }) {
  if (!message) return null;

  return (
    <p className={ok ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>
      {message}
    </p>
  );
}

function getInitials(fullName: string) {
  const parts = fullName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "OP";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function getGuardAccountMode(user: StaffUserItem) {
  const normalizedMode = user.accountMode.trim().toLowerCase();

  if (normalizedMode === "individual") return "Individual";
  if (normalizedMode === "shared") return "Shared";
  return "Guard account";
}

function mapOperator(user: StaffUserItem): DirectoryOperator {
  const role = user.role.toUpperCase() === "ADMIN" ? "ADMIN" : "GUARD";

  return {
    accountMode:
      role === "ADMIN" ? "Resident admin" : getGuardAccountMode(user),
    contact: user.contact,
    fullName: user.fullName,
    houseLabel: role === "ADMIN" ? user.houseLabel : "No unit linked",
    id: user.id,
    initials: getInitials(user.fullName),
    isActive: user.isActive,
    role,
    subtitle: role === "ADMIN" ? "Resident admin" : "Guard account",
  };
}

function MetricCard({
  eyebrow,
  hint,
  icon,
  value,
}: {
  eyebrow: string;
  hint: string;
  icon: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_12px_32px_rgba(2,6,23,0.18)]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-violet-400/15 bg-violet-500/10 text-xs font-semibold text-violet-100">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function SegmentedButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-semibold transition",
        active
          ? "border border-violet-400/35 bg-violet-500/18 text-white"
          : "border border-transparent text-[var(--text-muted)] hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function OperatorRow({ operator }: { operator: DirectoryOperator }) {
  return (
    <tr className="border-t border-white/6 text-sm text-[var(--text-muted)]">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-violet-400/15 bg-violet-500/10 text-sm font-semibold text-violet-100">
            {operator.initials}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-white">{operator.fullName}</p>
            <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
              {operator.subtitle}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <Badge tone={operator.role === "ADMIN" ? "info" : "default"}>
          {operator.role === "ADMIN" ? "Resident admin" : "Guard"}
        </Badge>
      </td>
      <td className="px-4 py-4 text-slate-200">{operator.contact}</td>
      <td className="px-4 py-4">
        {operator.houseLabel || "No unit linked"}
      </td>
      <td className="px-4 py-4">{operator.accountMode}</td>
      <td className="px-4 py-4">
        <Badge tone={operator.isActive ? "success" : "default"}>
          {operator.isActive ? "Active" : "Inactive"}
        </Badge>
      </td>
      <td className="px-4 py-4 text-right">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/8 bg-white/4 text-[var(--text-muted)] transition hover:border-violet-300/30 hover:text-white"
          aria-label={`Operator actions for ${operator.fullName}`}
          title={`Operator actions for ${operator.fullName}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
      </td>
    </tr>
  );
}

export function StaffOperatorsPanel({
  admins,
  communityId,
  guards,
  residents,
}: {
  admins: StaffUserItem[];
  communityId: string;
  guards: StaffUserItem[];
  residents: StaffUserItem[];
}) {
  const [promoteState, promoteAction] = useActionState(
    promoteResidentAdminAction,
    {},
  );
  const [guardState, guardAction] = useActionState(createGuardAction, {});
  const [filter, setFilter] = useState<OperatorFilter>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [addType, setAddType] = useState<"admin" | "guard">("admin");
  const [guardAccountType, setGuardAccountType] = useState<"individual" | "shared">("individual");
  const [guardPassword, setGuardPassword] = useState("");
  const [showGuardPassword, setShowGuardPassword] = useState(false);
  const [copiedGuardPassword, setCopiedGuardPassword] = useState(false);
  const hasEligibleResidents = residents.length > 0;

  const combinedOperators = useMemo(() => {
    return [...admins.map(mapOperator), ...guards.map(mapOperator)];
  }, [admins, guards]);

  const filteredOperators = useMemo(() => {
    return combinedOperators.filter((operator) => {
      if (filter === "admins") return operator.role === "ADMIN";
      if (filter === "guards") return operator.role === "GUARD";
      return true;
    });
  }, [combinedOperators, filter]);

  async function copyGuardPassword() {
    if (!guardPassword) return;
    await navigator.clipboard.writeText(guardPassword);
    setCopiedGuardPassword(true);
    window.setTimeout(() => setCopiedGuardPassword(false), 1600);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          eyebrow="Total operators"
          value={combinedOperators.length}
          hint="Admins and guards combined"
          icon="OPS"
        />
        <MetricCard
          eyebrow="Resident admins"
          value={admins.length}
          hint="Selected from active residents"
          icon="ADM"
        />
        <MetricCard
          eyebrow="Guard accounts"
          value={guards.length}
          hint="Individual or shared accounts"
          icon="GRD"
        />
        <MetricCard
          eyebrow="Eligible residents"
          value={residents.length}
          hint="Eligible to be resident admins"
          icon="ELG"
        />
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_14px_36px_rgba(2,6,23,0.18)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Operators directory
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              Create and manage resident admins and guard accounts in one place.
            </p>
          </div>

          <Button onClick={() => setComposerOpen((open) => !open)}>
            {composerOpen ? (
              <X className="mr-2 h-4 w-4" aria-hidden />
            ) : (
              <Plus className="mr-2 h-4 w-4" aria-hidden />
            )}
            {composerOpen ? "Close" : "Add operator"}
          </Button>
        </div>

        <div className="mt-5 rounded-lg border border-white/8 bg-white/[0.025] px-4 py-3.5">
          <p className="text-sm leading-6 text-slate-200">
            Resident admins are selected from active residents. Guard accounts can
            be individual or shared depending on how access is managed.
          </p>
        </div>

        {composerOpen ? (
          <div className="mt-5 rounded-xl border border-white/10 bg-[var(--surface-strong)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
                  Add operator
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Create access without leaving the directory
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg border border-white/10 bg-white/4 p-1">
                  <SegmentedButton
                    active={addType === "admin"}
                    onClick={() => setAddType("admin")}
                  >
                    Resident admin
                  </SegmentedButton>
                  <SegmentedButton
                    active={addType === "guard"}
                    onClick={() => setAddType("guard")}
                  >
                    Guard account
                  </SegmentedButton>
                </div>

                <Button variant="secondary" onClick={() => setComposerOpen(false)}>
                  <X className="mr-2 h-4 w-4" aria-hidden />
                  Close
                </Button>
              </div>
            </div>

            {addType === "admin" ? (
              <form action={promoteAction} className="mt-5 space-y-4">
                <input type="hidden" name="communityId" value={communityId} />
                <label className="block text-sm font-semibold text-white">
                  Active resident
                  <select
                    name="userId"
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                    defaultValue=""
                    disabled={!hasEligibleResidents}
                  >
                    <option value="" disabled>
                      {hasEligibleResidents
                        ? "Select active resident"
                        : "No eligible residents available"}
                    </option>
                    {residents.map((resident) => (
                      <option key={resident.id} value={resident.id}>
                        {resident.fullName} - {resident.houseLabel} - {resident.contact}
                      </option>
                    ))}
                  </select>
                </label>

                {!hasEligibleResidents ? (
                  <p className="text-sm text-amber-200">
                    No active residents available. Import or activate residents
                    before assigning a community admin.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <SubmitButton disabled={!hasEligibleResidents}>
                    Make resident admin
                  </SubmitButton>
                  <StatusMessage
                    message={promoteState.message}
                    ok={promoteState.ok}
                  />
                </div>
              </form>
            ) : (
              <form action={guardAction} className="mt-5 grid max-w-3xl gap-4 sm:grid-cols-2">
                <input type="hidden" name="communityId" value={communityId} />
                <input type="hidden" name="accountType" value={guardAccountType} />

                <div className="sm:col-span-2">
                  <p className="text-sm font-semibold text-white">Account type</p>
                  <div className="mt-2 inline-flex rounded-lg border border-white/10 bg-white/4 p-1">
                    {(["individual", "shared"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setGuardAccountType(value)}
                        className={cn(
                          "rounded-md px-3 py-2 text-sm font-semibold transition",
                          guardAccountType === value
                            ? "border border-violet-400/35 bg-violet-500/18 text-white"
                            : "border border-transparent text-[var(--text-muted)] hover:text-white",
                        )}
                      >
                        {value === "individual" ? "Individual" : "Shared"}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block text-sm font-semibold text-white">
                  Name
                  <input
                    name="fullName"
                    autoComplete="off"
                    className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[var(--surface)] px-3 text-sm text-slate-100 outline-none transition focus:border-violet-400/50"
                  />
                </label>

                <label className="block text-sm font-semibold text-white">
                  Username
                  <input
                    name="username"
                    autoCapitalize="none"
                    autoComplete="off"
                    className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[var(--surface)] px-3 text-sm text-slate-100 outline-none transition focus:border-violet-400/50"
                  />
                </label>

                <label className="block text-sm font-semibold text-white">
                  Temporary password
                  <div className="mt-2 flex overflow-hidden rounded-md border border-white/10 bg-[var(--surface)] focus-within:border-violet-400/50">
                    <input
                      name="password"
                      type={showGuardPassword ? "text" : "password"}
                      value={guardPassword}
                      onChange={(event) => {
                        setGuardPassword(event.target.value);
                        setCopiedGuardPassword(false);
                      }}
                      autoComplete="new-password"
                      className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-100 outline-none placeholder:text-[var(--text-muted)]"
                      placeholder={ENTRY_ADMIN_TEMP_PASSWORD_HELPER}
                    />
                    <button
                      type="button"
                      title={showGuardPassword ? "Hide password" : "Show password"}
                      aria-label={showGuardPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowGuardPassword((current) => !current)}
                      className="grid h-10 w-10 place-items-center border-l border-white/8 text-[var(--text-muted)] transition hover:text-white"
                    >
                      {showGuardPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                    <button
                      type="button"
                      title="Copy password"
                      aria-label="Copy password"
                      disabled={!guardPassword}
                      onClick={copyGuardPassword}
                      className="grid h-10 w-10 place-items-center border-l border-white/8 text-[var(--text-muted)] transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {copiedGuardPassword ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </label>

                <label className="block text-sm font-semibold text-white">
                  Phone <span className="font-normal text-[var(--text-muted)]">optional</span>
                  <input
                    name="phone"
                    inputMode="tel"
                    autoComplete="off"
                    className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[var(--surface)] px-3 text-sm text-slate-100 outline-none transition focus:border-violet-400/50"
                  />
                </label>

                <label className="block text-sm font-semibold text-white sm:col-span-2">
                  Description / note <span className="font-normal text-[var(--text-muted)]">optional</span>
                  <input
                    name="description"
                    autoComplete="off"
                    className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[var(--surface)] px-3 text-sm text-slate-100 outline-none transition focus:border-violet-400/50"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-3 border-t border-white/8 pt-4 sm:col-span-2">
                  <SubmitButton>Create guard</SubmitButton>
                  <StatusMessage message={guardState.message} ok={guardState.ok} />
                </div>
              </form>
            )}
          </div>
        ) : null}

        <div className="mt-5 rounded-lg border border-white/8 bg-white/[0.025] px-4 py-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Current operators</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {combinedOperators.length === 0
                  ? "Create a resident admin or guard account to continue."
                  : "Review the current resident admins and guard accounts for this community."}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <span>Operator type</span>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as OperatorFilter)}
                className="h-10 rounded-md border border-white/10 bg-[var(--surface-strong)] px-3 text-sm text-white outline-none transition focus:border-violet-300/40"
              >
                <option value="all">All operator types</option>
                <option value="admins">Resident admins</option>
                <option value="guards">Guard accounts</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-white/8 bg-white/[0.025]">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-4 font-semibold">Name</th>
                  <th className="px-4 py-4 font-semibold">Role</th>
                  <th className="px-4 py-4 font-semibold">Login / contact</th>
                  <th className="px-4 py-4 font-semibold">Linked unit</th>
                  <th className="px-4 py-4 font-semibold">Account mode</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOperators.length > 0 ? (
                  filteredOperators.map((operator) => (
                    <OperatorRow key={operator.id} operator={operator} />
                  ))
                ) : combinedOperators.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center">
                      <p className="text-lg font-semibold text-white">
                        No operators added yet.
                      </p>
                      <p className="mt-2 text-sm text-[var(--text-muted)]">
                        Create a resident admin or guard account to continue.
                      </p>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-sm text-[var(--text-muted)]"
                    >
                      No operators found for the selected type.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/8 px-4 py-4 text-sm text-[var(--text-muted)] lg:flex-row lg:items-center lg:justify-between">
            <p>
              Showing {filteredOperators.length} of {combinedOperators.length} operators
            </p>
            <p>
              {filter === "all"
                ? "All operator types"
                : filter === "admins"
                  ? "Resident admins only"
                  : "Guard accounts only"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
