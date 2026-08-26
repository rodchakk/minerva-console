import { LogOut, ShieldCheck, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/features/auth/actions";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";

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
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/5 text-[var(--console-text)]">
            <UserCircle aria-hidden="true" className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-[var(--console-text)]">
              {user.email ?? "Minerva operator"}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--console-text-muted)]">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              Superadmin
            </p>
          </div>
        </div>
      </section>

      <form action={signOutAction}>
        <Button
          type="submit"
          variant="secondary"
          className="min-h-12 w-full gap-2 border-[var(--console-border-strong)] bg-[var(--console-surface)] text-[var(--console-text)] hover:bg-[var(--console-surface-hover)]"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Sign out
        </Button>
      </form>
    </div>
  );
}
