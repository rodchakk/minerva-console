import Link from "next/link";
import { AlertTriangle, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  inviteConsoleUserAction,
  updateConsoleMemberRoleAction,
  updateConsoleMemberStatusAction,
} from "@/features/console-users/actions";
import { getConsoleUsersPageData } from "@/features/console-users/data";
import { INVITE_DEFAULT_ROLE } from "@/features/console-users/model";
import { cn } from "@/lib/supabase/utils";

type UsersPageProps = {
  searchParams?: Promise<{ invite?: string; result?: string }>;
};

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function ResultBanner({ result }: { result?: string }) {
  if (result !== "invited" && result !== "existing") {
    return null;
  }

  return (
    <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
      {result === "existing"
        ? "Existing auth account granted Console access."
        : "Console invitation sent and membership created."}
    </div>
  );
}

function InvitePanel({ isOpen }: { isOpen: boolean }) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className="rounded-lg border border-white/[0.10] bg-[#10151b] p-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-[#ff6b6b] stroke-[1.75]" />
        <h2 className="text-base font-semibold text-white">Invite Console User</h2>
      </div>
      <form action={inviteConsoleUserAction} className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_180px_auto] lg:items-end">
        <label className="grid gap-1.5 text-sm text-slate-300">
          Display name
          <input
            name="displayName"
            maxLength={120}
            className="h-10 rounded-md border border-white/[0.12] bg-white/[0.025] px-3 text-white outline-none transition focus:border-[#ff4d4d]/50"
            placeholder="Optional"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-slate-300">
          Email
          <input
            name="email"
            type="email"
            required
            className="h-10 rounded-md border border-white/[0.12] bg-white/[0.025] px-3 text-white outline-none transition focus:border-[#ff4d4d]/50"
            placeholder="name@example.com"
          />
        </label>
        <label className="grid gap-1.5 text-sm text-slate-300">
          Role
          <select
            name="role"
            defaultValue={INVITE_DEFAULT_ROLE}
            className="h-10 rounded-md border border-white/[0.12] bg-[#141a20] px-3 text-white outline-none transition focus:border-[#ff4d4d]/50"
          >
            <option value="builder">Builder</option>
            <option value="viewer">Viewer</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <Button type="submit" className="h-10 rounded-md bg-[#ff2d2d] px-4 hover:bg-[#d90f17]">
          Send invite
        </Button>
      </form>
      <div className="mt-3 flex gap-2 rounded-md border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
        <p>Owners have full Minerva Console access, including Brain and user management.</p>
      </div>
    </section>
  );
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const [users, params] = await Promise.all([getConsoleUsersPageData(), searchParams]);
  const inviteOpen = params?.invite === "1";

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 px-0.5 pt-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#ff6b6b]">
            <Users className="h-4 w-4 stroke-[1.75]" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em]">Access</p>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white">
            Console Users
          </h1>
          <p className="mt-1 text-sm leading-6 text-[var(--console-text-muted)]">
            Console membership is separate from ENTRY residents and community roles.
          </p>
        </div>
        <Link
          href={inviteOpen ? "/users" : "/users?invite=1"}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#ff4d4d]/35 bg-white/[0.045] px-3.5 text-sm font-semibold text-white transition hover:border-[#ff4d4d]/50 hover:bg-white/[0.07]"
        >
          <UserPlus className="h-4 w-4 stroke-[1.75]" />
          Add User
        </Link>
      </section>

      <ResultBanner result={params?.result} />
      <InvitePanel isOpen={inviteOpen} />

      <section className="overflow-hidden rounded-lg border border-white/[0.10] bg-[#10151b]">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="border-b border-white/[0.10] text-xs uppercase tracking-[0.12em] text-[var(--console-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Account state</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08]">
              {users.map((user) => (
                <tr key={`${user.source}-${user.userId}`}>
                  <td className="px-4 py-3 text-white">
                    {user.displayName ?? "Not set"}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{user.email ?? "Unavailable"}</td>
                  <td className="px-4 py-3">
                    {user.isEditable ? (
                      <form action={updateConsoleMemberRoleAction}>
                        <input type="hidden" name="userId" value={user.userId} />
                        <select
                          name="role"
                          defaultValue={user.role}
                          className="h-9 rounded-md border border-white/[0.12] bg-[#141a20] px-2 text-slate-100"
                          aria-label={`Role for ${user.email ?? user.userId}`}
                        >
                          <option value="owner">Owner</option>
                          <option value="builder">Builder</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <Button type="submit" variant="ghost" className="ml-2 h-9 rounded-md">
                          Save
                        </Button>
                      </form>
                    ) : (
                      <span className="font-medium text-white">{roleLabel(user.role)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.isEditable ? (
                      <form action={updateConsoleMemberStatusAction}>
                        <input type="hidden" name="userId" value={user.userId} />
                        <select
                          name="status"
                          defaultValue={user.status}
                          className="h-9 rounded-md border border-white/[0.12] bg-[#141a20] px-2 text-slate-100"
                          aria-label={`Status for ${user.email ?? user.userId}`}
                        >
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>
                        <Button type="submit" variant="ghost" className="ml-2 h-9 rounded-md">
                          Save
                        </Button>
                      </form>
                    ) : (
                      <span className="font-medium text-white">{roleLabel(user.status)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-md border px-2 py-1 text-xs font-semibold",
                        user.accountState === "Active"
                          ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100"
                          : "border-amber-300/20 bg-amber-400/10 text-amber-100",
                      )}
                    >
                      {user.accountState}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{user.source}</td>
                  <td className="px-4 py-3 text-[var(--console-text-muted)]">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Bootstrap"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
