import { ShieldCheck, UserCircle } from "lucide-react";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { EntryPushSignOutForm } from "@/features/entry/push/EntryPushSignOutForm";

export default async function FieldAccountPage() {
  const { user } = await requireSuperadmin();

  return (
    <div className="space-y-5">
      <section className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--console-accent)]">
          Field
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--console-text)]">
          Account
        </h1>
      </section>

      <section className="rounded-lg border border-[var(--console-border)] bg-[var(--console-surface)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--console-accent-border)] bg-[var(--console-accent-subtle)] text-[var(--console-accent)]">
            <UserCircle aria-hidden="true" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[var(--console-text)]">
              {user.email ?? "Minerva operator"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--console-text-muted)]">
              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[var(--console-accent)]" />
              Superadmin
            </p>
          </div>
        </div>
      </section>

      <EntryPushSignOutForm field />
    </div>
  );
}
