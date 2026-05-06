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
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-[var(--sidebar)] px-4 py-5 text-[var(--sidebar-foreground)] shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-transform lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="rounded-[22px] border border-white/10 bg-white/6 p-4">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-200">
              Minerva Console
            </p>
            <span className="inline-flex items-center rounded-full bg-violet-500/14 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200 ring-1 ring-inset ring-violet-400/20">
              ENTRY
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            ENTRY operating workspace for onboarding, users, messages, and setup.
          </p>
        </div>

        <nav className="mt-6 flex-1 space-y-2">
          {navSections.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center rounded-2xl px-4 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-violet-500/16 text-white ring-1 ring-inset ring-violet-400/20"
                    : "text-slate-300 hover:bg-white/6 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="rounded-[22px] border border-white/8 bg-[var(--sidebar-muted)] p-4 text-sm leading-6 text-slate-300">
          ENTRY is the live operating surface today, with the shell ready for
          future Minerva products when they are real.
        </div>
      </aside>
    </>
  );
}
