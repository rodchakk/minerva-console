"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
    <div className="rounded-[26px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
      <div className="flex items-center gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(180deg,rgba(103,80,255,0.26),rgba(70,52,190,0.34))] text-lg text-violet-100 ring-1 ring-inset ring-violet-300/20">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100">{eyebrow}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function FilterButton({
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
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-[var(--primary)] text-white shadow-[0_12px_30px_rgba(89,80,243,0.28)]"
          : "text-[var(--text-muted)] hover:text-white",
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
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(180deg,rgba(103,80,255,0.22),rgba(61,44,145,0.4))] text-sm font-semibold text-violet-100 ring-1 ring-inset ring-violet-300/20">
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
          {operator.role}
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
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/4 text-lg text-[var(--text-muted)] transition hover:border-violet-300/30 hover:text-white"
          aria-label={`Operator actions for ${operator.fullName}`}
        >
          ⋯
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OperatorFilter>("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [addType, setAddType] = useState<"admin" | "guard">("admin");
  const hasEligibleResidents = residents.length > 0;

  const combinedOperators = useMemo(() => {
    return [...admins.map(mapOperator), ...guards.map(mapOperator)];
  }, [admins, guards]);

  const filteredOperators = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return combinedOperators.filter((operator) => {
      const matchesQuery =
        !normalizedQuery ||
        operator.fullName.toLowerCase().includes(normalizedQuery) ||
        operator.contact.toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) return false;
      if (filter === "admins") return operator.role === "ADMIN";
      if (filter === "guards") return operator.role === "GUARD";
      return true;
    });
  }, [combinedOperators, filter, query]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          eyebrow="Total operators"
          value={combinedOperators.length}
          hint="Admins and guards combined"
          icon="◎"
        />
        <MetricCard
          eyebrow="Resident admins"
          value={admins.length}
          hint="Selected from active residents"
          icon="◈"
        />
        <MetricCard
          eyebrow="Guard accounts"
          value={guards.length}
          hint="Individual or shared accounts"
          icon="◌"
        />
        <MetricCard
          eyebrow="Eligible residents"
          value={residents.length}
          hint="Eligible to be resident admins"
          icon="◉"
        />
      </section>

      <section className="rounded-[30px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)] xl:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Operators directory
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
              All resident admins and guard accounts in one place. Keep access
              secure and up to date.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border border-violet-400/14 bg-[linear-gradient(180deg,rgba(70,82,165,0.18),rgba(31,40,78,0.28))] px-4 py-4">
          <p className="text-sm leading-6 text-slate-200">
            Resident admins are selected from active residents and receive admin
            privileges.
            <br />
            Guard accounts can be individual or shared, depending on how access
            is managed.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-center">
            <label className="relative block lg:max-w-md lg:flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                ⌕
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or email..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-[var(--surface-strong)] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-violet-300/50"
              />
            </label>

            <div className="inline-flex rounded-full border border-white/10 bg-white/4 p-1">
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                All
              </FilterButton>
              <FilterButton
                active={filter === "admins"}
                onClick={() => setFilter("admins")}
              >
                Admins
              </FilterButton>
              <FilterButton
                active={filter === "guards"}
                onClick={() => setFilter("guards")}
              >
                Guards
              </FilterButton>
            </div>
          </div>

          <Button onClick={() => setComposerOpen((open) => !open)}>
            {composerOpen ? "Close" : "+ Add operator"}
          </Button>
        </div>

        {composerOpen ? (
          <div className="mt-5 rounded-[26px] border border-white/10 bg-[rgba(12,18,38,0.9)] p-5 shadow-[0_18px_40px_rgba(2,6,23,0.24)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
                  Add operator
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">
                  Create access without leaving the directory
                </h3>
              </div>
              <div className="inline-flex rounded-full border border-white/10 bg-white/4 p-1">
                <FilterButton
                  active={addType === "admin"}
                  onClick={() => setAddType("admin")}
                >
                  Resident admin
                </FilterButton>
                <FilterButton
                  active={addType === "guard"}
                  onClick={() => setAddType("guard")}
                >
                  Guard account
                </FilterButton>
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
              <form action={guardAction} className="mt-5 grid gap-4 lg:grid-cols-2">
                <input type="hidden" name="communityId" value={communityId} />
                <label className="block text-sm font-semibold text-white">
                  Account type
                  <select
                    name="accountType"
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                    defaultValue="individual"
                  >
                    <option value="individual">Individual</option>
                    <option value="shared">Shared</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold text-white">
                  Name
                  <input
                    name="fullName"
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                    placeholder="Guardia Caseta Principal"
                  />
                </label>
                <label className="block text-sm font-semibold text-white">
                  Email
                  <input
                    name="email"
                    type="email"
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                    placeholder="guardia@community.com"
                  />
                </label>
                <label className="block text-sm font-semibold text-white">
                  Phone optional
                  <input
                    name="phone"
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                    placeholder="Optional"
                  />
                </label>
                <label className="block text-sm font-semibold text-white lg:col-span-2">
                  Description optional
                  <input
                    name="description"
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                    placeholder="Shared guard account is less precise for audit trails, but allowed."
                  />
                </label>
                <label className="block text-sm font-semibold text-white lg:col-span-2">
                  Temporary password
                  <input
                    name="password"
                    type="text"
                    className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                    placeholder="Minimum 8 characters"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
                  <SubmitButton>Create guard</SubmitButton>
                  <StatusMessage message={guardState.message} ok={guardState.ok} />
                </div>
              </form>
            )}
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-[26px] border border-white/8 bg-[rgba(8,12,24,0.34)]">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-4 font-semibold">Name</th>
                  <th className="px-4 py-4 font-semibold">Type</th>
                  <th className="px-4 py-4 font-semibold">Contact / email</th>
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
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-[var(--text-muted)]"
                    >
                      No operators match the current search or filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/8 px-4 py-4 text-sm text-[var(--text-muted)] lg:flex-row lg:items-center lg:justify-between">
            <p>
              Showing 1 to {filteredOperators.length} of {combinedOperators.length}{" "}
              operators
            </p>
            <p>{filter === "all" ? "All operator types" : `Filtered by ${filter}`}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
