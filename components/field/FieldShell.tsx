import Link from "next/link";
import { Home, ShieldCheck, UserCircle } from "lucide-react";
import { FieldNav } from "@/components/field/FieldNav";
import { ENTRY_PREVIEW_READ_ONLY_MESSAGE } from "@/features/entry/deploymentBoundary";
import { FieldActiveWorkTimerIndicator } from "@/features/entry/field/FieldActiveWorkTimerIndicator";
import type { FieldActiveWorkTimer } from "@/features/entry/field/workTimerModel";
import { EntryPushSessionSync } from "@/features/entry/push/EntryPushSessionSync";

type FieldShellProps = {
  activeWorkTimer?: FieldActiveWorkTimer | null;
  children: React.ReactNode;
  previewReadOnly?: boolean;
};

const desktopNavItems = [
  { href: "/field", label: "Home", icon: Home },
  { href: "/field/entry", label: "ENTRY", icon: ShieldCheck },
  { href: "/field/account", label: "Account", icon: UserCircle },
];

export function FieldShell({
  activeWorkTimer = null,
  children,
  previewReadOnly = false,
}: FieldShellProps) {
  return (
    <div className="minerva-field-theme min-h-screen bg-[var(--console-bg)] text-[var(--console-text)]">
      <EntryPushSessionSync surface="field" />
      <header className="sticky top-0 z-30 border-b border-[var(--console-border)] bg-[rgba(20,20,20,0.92)] px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link href="/field" className="flex min-w-0 items-center gap-3">
            <span className="field-brand-badge flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white">
              MF
            </span>
            <span className="block text-sm font-semibold text-[var(--console-text)]">
              Minerva Field
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            <FieldActiveWorkTimerIndicator session={activeWorkTimer} />

            <nav aria-label="Field sections" className="hidden items-center gap-1 md:flex">
              {desktopNavItems.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--console-text-muted)] transition-colors hover:bg-[var(--console-accent-subtle)] hover:text-[var(--console-accent)]"
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {previewReadOnly ? (
        <div className="border-b border-amber-300/50 bg-amber-300 px-4 py-2 text-center text-xs font-black uppercase text-slate-950">
          {ENTRY_PREVIEW_READ_ONLY_MESSAGE}
        </div>
      ) : null}

      <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-4xl px-4 pb-28 pt-5 md:px-6 md:pb-8 md:pt-7">
        {children}
      </main>

      <FieldNav />
    </div>
  );
}
