import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/features/auth/actions";

type TopbarProps = {
  email: string | null;
  onOpenSidebar: () => void;
};

export function Topbar({ email, onOpenSidebar }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[rgba(7,9,13,0.96)] px-4 py-3 lg:px-7">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] text-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M3 5.5h14M3 10h14M3 14.5h14" />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
            <span className="font-medium text-slate-300">Minerva Console</span>
            <span aria-hidden="true">›</span>
            <span>ENTRY</span>
            <span aria-hidden="true">›</span>
            <span className="font-medium text-slate-100">Operations</span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Signed in as {email ?? "superadmin"}
          </p>
        </div>
      </div>

      <form action={signOutAction} className="shrink-0">
        <Button variant="secondary" type="submit" className="min-w-24">
          Sign out
        </Button>
      </form>
    </header>
  );
}
