"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/supabase/utils";

type AppSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const navSections = [
  { label: "Overview", href: "/dashboard" },
  { label: "Communities", href: "/products/entry/communities" },
  { label: "Users", href: "/products/entry/users" },
  { label: "Messages", href: "/products/entry/messages" },
  { label: "Settings", href: "/products/entry/settings" },
];

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] px-4 py-4 text-[var(--sidebar-foreground)] transition-transform lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-100">
              Minerva Console
            </p>
            <span className="inline-flex items-center rounded-md border border-violet-400/16 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
              ENTRY
            </span>
          </div>
          <p className="mt-3 text-sm leading-5 text-[var(--text-muted)]">
            Workspace for onboarding, users, messages, and setup.
          </p>
        </div>

        <div className="mt-6">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            ENTRY Operations
          </p>
        </div>

        <nav className="mt-3 flex-1 space-y-1.5">
          {navSections.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-violet-400/18 bg-violet-500/12 text-white"
                    : "border-transparent text-slate-300 hover:border-white/8 hover:bg-white/4 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--sidebar-muted)] p-4 text-sm leading-5 text-[var(--text-muted)]">
          ENTRY is the live operating surface today, with the console ready for
          future Minerva products when they are real.
        </div>
      </aside>
    </>
  );
}
