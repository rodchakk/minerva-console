import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import {
  FieldAccessRoleForm,
  type FieldAccessRole,
} from "@/features/entry/field/FieldAccessRoleForm";
import { getCommunityUsersPage } from "@/features/entry/users/queries";

type FieldRolePageProps = {
  params: Promise<{ communityId: string; userId: string }>;
};

function normalizeRole(value: string): FieldAccessRole | null {
  const normalized = value.trim().toUpperCase();

  if (
    normalized === "ADMIN" ||
    normalized === "GUARD" ||
    normalized === "RESIDENT" ||
    normalized === "UNASSIGNED"
  ) {
    return normalized;
  }

  return null;
}

export default async function FieldEntryAccessRolePage({
  params,
}: FieldRolePageProps) {
  const { communityId, userId } = await params;
  const [operator, data] = await Promise.all([
    requireSuperadmin(),
    getCommunityUsersPage(communityId),
  ]);

  if (!data.community) {
    notFound();
  }

  const user = data.users.find((item) => item.userId === userId);
  const role = user ? normalizeRole(user.role) : null;

  if (!user || !role) {
    notFound();
  }

  const units = data.houses
    .filter((house) => house.isActive)
    .map((house) => ({ id: house.id, label: house.label }));

  return (
    <div className="space-y-4">
      <Link
        href="/field/entry/access"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Access
      </Link>

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--console-accent)]">
          Change role
        </p>
        <h1 className="mt-2 break-words text-3xl font-semibold text-[var(--console-text)]">
          {user.fullName}
        </h1>
        <p className="mt-2 text-sm leading-5 text-[var(--console-text-muted)]">
          {data.community.name} · {user.houseLabel || "No unit linked"}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
            Current role
          </p>
          <p className="mt-1.5 text-base font-semibold text-[var(--console-text)]">
            {role}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--console-text-soft)]">
            Account
          </p>
          <p className="mt-1.5 text-base font-semibold text-[var(--console-text)]">
            {user.isActive ? "Active" : "Inactive"}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--console-border)] bg-white/[0.02] p-4">
        <FieldAccessRoleForm
          communityId={communityId}
          currentHouseId={user.houseId}
          currentRole={role}
          isCurrentUser={operator.user.id === user.userId}
          units={units}
          userId={user.userId}
        />
      </section>
    </div>
  );
}
