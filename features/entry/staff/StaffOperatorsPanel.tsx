"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  createGuardAction,
  promoteResidentAdminAction,
  type StaffUserItem,
} from "@/features/entry/staff/actions";

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
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

function UserMiniCard({ user }: { user: StaffUserItem }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
          <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{user.contact}</p>
        </div>
        <Badge tone={user.role.toUpperCase() === "ADMIN" ? "info" : "default"}>
          {user.role}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">{user.houseLabel}</p>
    </div>
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

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
            Resident admins
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">{admins.length}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Residents with admin privileges in the community portal.
          </p>
        </div>

        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
            Guard accounts
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">{guards.length}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Individual or shared gate operation accounts.
          </p>
        </div>

        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
            Eligible residents
          </p>
          <p className="mt-3 text-3xl font-semibold text-white">{residents.length}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Active residents available to promote as community admins.
          </p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[30px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)] xl:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
                Assign resident admin
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Promote an existing resident
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                Community admins keep their resident access and receive admin privileges. This keeps the ENTRY model aligned with neighborhood administrators.
              </p>
            </div>
            <Badge tone={admins.length > 0 ? "success" : "warning"}>
              {admins.length > 0 ? "Ready" : "Required"}
            </Badge>
          </div>

          <form action={promoteAction} className="mt-6 space-y-4">
            <input type="hidden" name="communityId" value={communityId} />
            <label className="block text-sm font-semibold text-white">
              Resident
              <select
                name="userId"
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                defaultValue=""
              >
                <option value="" disabled>
                  Select active resident
                </option>
                {residents.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {resident.fullName} · {resident.houseLabel} · {resident.contact}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton>Make resident admin</SubmitButton>
              <StatusMessage message={promoteState.message} ok={promoteState.ok} />
            </div>
          </form>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {admins.length > 0 ? (
              admins.map((admin) => <UserMiniCard key={admin.id} user={admin} />)
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm text-[var(--text-muted)] md:col-span-2">
                No resident admin assigned yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[30px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(2,6,23,0.2)] xl:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
            Guard account
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">
            Add gate access
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            Individual guard accounts are best for audit history. Shared guard accounts are allowed for communities that want one caseta login.
          </p>

          <form action={guardAction} className="mt-6 space-y-4">
            <input type="hidden" name="communityId" value={communityId} />
            <label className="block text-sm font-semibold text-white">
              Account type
              <select
                name="accountType"
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                defaultValue="individual"
              >
                <option value="individual">Individual guard</option>
                <option value="shared">Shared guard account</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-white">
              Name
              <input
                name="fullName"
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                placeholder="Juan Pérez or Guardia Caseta Principal"
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
            <label className="block text-sm font-semibold text-white">
              Description optional
              <input
                name="description"
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                placeholder="Turno noche, caseta principal, shared device..."
              />
            </label>
            <label className="block text-sm font-semibold text-white">
              Temporary password
              <input
                name="password"
                type="text"
                className="mt-2 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] px-4 py-3 text-slate-100 outline-none transition focus:border-[var(--primary)]"
                placeholder="Minimum 8 characters"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton>Create guard</SubmitButton>
              <StatusMessage message={guardState.message} ok={guardState.ok} />
            </div>
          </form>

          <div className="mt-6 space-y-3">
            {guards.length > 0 ? (
              guards.map((guard) => <UserMiniCard key={guard.id} user={guard} />)
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-white/3 px-4 py-5 text-sm text-[var(--text-muted)]">
                No guard accounts created yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
