"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/supabase/utils";

type AppSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

type NavItem = {
  label: string;
  href: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Console",
    items: [{ label: "Overview", href: "/dashboard" }],
  },
  {
    label: "Products",
    items: [
      { label: "ENTRY Communities", href: "/products/entry/communities" },
      { label: "ENTRY Users", href: "/products/entry/users" },
      { label: "ENTRY Messages", href: "/products/entry/messages" },
      { label: "ENTRY Settings", href: "/products/entry/settings" },
    ],
  },
  {
    label: "Brain",
    items: [
      { label: "Overview", href: "/brain" },
      { label: "Projects", href: "/brain/projects" },
      { label: "Decisions", href: "/brain/decisions" },
      { label: "Prompts", href: "/brain/prompts" },
      { label: "Agents", href: "/brain/agents" },
      { label: "Inbox", href: "/brain/inbox" },
      { label: "Missions", href: "/brain/missions" },
      { label: "Search", href: "/brain/search" },
      { label: "Tags", href: "/brain/tags" },
    ],
  },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/brain") {
    // Avoid matching /brain/* for the Overview row.
    return pathname === "/brain";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
            <span className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200">
              Internal
            </span>
          </div>
          <p className="mt-3 text-sm leading-5 text-[var(--text-muted)]">
            Internal operating surface for Minerva products, intelligence, and systems.
          </p>
        </div>

        <nav className="mt-6 flex-1 space-y-5 overflow-y-auto pr-1">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                {group.label}
              </p>
              <div className="mt-2 space-y-1.5">
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "border-violet-400/18 bg-violet-500/12 text-white"
                          : "border-transparent text-slate-300 hover:border-white/8 hover:bg-white/4 hover:text-white",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--sidebar-muted)] p-4 text-sm leading-5 text-[var(--text-muted)]">
          Brain is the new internal intelligence layer. v0 is Git-backed and read-only.
        </div>
      </aside>
    </>
  );
}
