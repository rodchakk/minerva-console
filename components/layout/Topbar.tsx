import { LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/features/auth/actions";

type TopbarProps = {
  email: string | null;
  onOpenSidebar: () => void;
};

export function Topbar({ email, onOpenSidebar }: TopbarProps) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-[var(--console-border)] bg-[var(--console-sidebar)] px-4 py-3 backdrop-blur-md lg:px-7">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--console-border)] bg-[var(--console-surface-raised)] text-slate-200 hover:bg-white/[0.04] lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4 stroke-[1.75]" />
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--console-text-muted)]">
            <span>Minerva Console</span>
            <span aria-hidden="true">/</span>
            <span>ENTRY</span>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-100">Operations</span>
          </div>
          <p className="sr-only">
            Signed in as {email ?? "superadmin"}
          </p>
        </div>
      </div>

      <form action={signOutAction} className="shrink-0">
        <Button variant="secondary" type="submit" className="min-w-24 gap-2">
          Sign out
          <LogOut className="h-4 w-4 stroke-[1.75]" />
        </Button>
      </form>
    </header>
  );
}
