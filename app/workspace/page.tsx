import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { requireConsoleMember } from "@/features/auth/consoleAccess";
import { signOutAction } from "@/features/auth/actions";

function label(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function WorkspacePage() {
  const context = await requireConsoleMember();

  return (
    <main className="min-h-screen bg-[var(--console-bg)] px-4 py-8 text-[var(--console-text)] sm:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-lg border border-white/[0.10] bg-[#10151b] p-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-[#ff6b6b]">
              <ShieldCheck className="h-5 w-5 stroke-[1.75]" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff6b6b]">
                Minerva Console
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white">
                Your Console access is active.
              </h1>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-white/[0.10] bg-white/[0.025] p-3">
              <p className="text-xs text-[var(--console-text-muted)]">Email</p>
              <p className="mt-1 truncate text-sm font-semibold text-white">
                {context.user.email ?? "Unavailable"}
              </p>
            </div>
            <div className="rounded-md border border-white/[0.10] bg-white/[0.025] p-3">
              <p className="text-xs text-[var(--console-text-muted)]">Role</p>
              <p className="mt-1 text-sm font-semibold text-white">{label(context.role)}</p>
            </div>
            <div className="rounded-md border border-white/[0.10] bg-white/[0.025] p-3">
              <p className="text-xs text-[var(--console-text-muted)]">Membership status</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {label(context.memberStatus)}
              </p>
            </div>
          </div>
          <p className="mt-5 rounded-md border border-white/[0.10] bg-white/[0.025] px-3 py-3 text-sm leading-6 text-[var(--console-text-muted)]">
            No product modules have been assigned yet. Product and module permissions
            are managed separately from account access.
          </p>
        </section>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
