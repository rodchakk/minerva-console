import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/features/auth/actions";

type TopbarProps = {
  email: string | null;
  onOpenSidebar: () => void;
};

export function Topbar({ email, onOpenSidebar }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-[rgba(9,9,15,0.84)] px-4 py-4 backdrop-blur-xl lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/6 text-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          ☰
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-200">
            ENTRY operations
          </p>
          <p className="text-sm font-medium text-slate-200">
            Signed in as {email ?? "superadmin"}
          </p>
        </div>
      </div>

      <form action={signOutAction}>
        <Button variant="secondary" type="submit">
          Sign out
        </Button>
      </form>
    </header>
  );
}
