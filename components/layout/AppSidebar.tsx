"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Bell,
  ChevronRight,
  ChevronsLeft,
  ChevronsUpDown,
  CircleGauge,
  Hexagon,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/supabase/utils";

type AppSidebarProps = {
  email?: string | null;
  isOpen: boolean;
  onClose: () => void;
};

type NavItem = {
  disabled?: boolean;
  label: string;
  href: string | null;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const minervaNavItems: NavItem[] = [
  { label: "Control Center", href: "/dashboard", icon: LayoutDashboard },
  { label: "Seshat", href: "/seshat", icon: CircleGauge },
  { label: "Reminders", href: "/reminders", icon: Bell },
];

const entryNavItems: NavItem[] = [
  { label: "Operations", href: "/products/entry", icon: LayoutDashboard },
  { label: "Communities", href: "/products/entry/communities", icon: Building2 },
  { label: "Users", href: "/products/entry/users", icon: Users },
  { label: "Messages", href: "/products/entry/messages", icon: MessageSquare },
  { label: "Tickets", href: "/products/entry/tickets", icon: LifeBuoy },
  { label: "Settings", href: "/products/entry/settings", icon: SlidersHorizontal },
];

const systemNavGroup: NavGroup = {
  id: "system",
  label: "SYSTEM",
  items: [{ label: "Settings", href: "/settings", icon: SlidersHorizontal }],
};

const minervaNavGroups: NavGroup[] = [
  {
    id: "minerva",
    label: "MINERVA",
    items: minervaNavItems,
  },
  systemNavGroup,
];

const entryNavGroups: NavGroup[] = [{ id: "entry", label: "ENTRY", items: entryNavItems }];

function isItemActive(pathname: string, href: string): boolean {
  if (!href) {
    return false;
  }

  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (href === "/brain") {
    return pathname === "/brain";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isEntryContext(pathname: string) {
  return pathname === "/products/entry" || pathname.startsWith("/products/entry/") || pathname.startsWith("/activate");
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  if (group.id === "entry") {
    return isEntryContext(pathname);
  }

  return group.items.some((item) => item.href && isItemActive(pathname, item.href));
}

function getItemAccent(groupId: string, href: string | null) {
  if (groupId === "entry" || href?.startsWith("/products/entry")) {
    return {
      icon: "text-[var(--console-accent)]",
      rail: "bg-[var(--console-accent)]",
      ring: "focus-visible:ring-[var(--console-accent)]/40",
    };
  }

  if (groupId === "brain" || href?.startsWith("/brain")) {
    return {
      icon: "text-sky-300",
      rail: "bg-sky-300",
      ring: "focus-visible:ring-sky-300/40",
    };
  }

  return {
    icon: "text-[#ff6b6b]",
    rail: "bg-[#ff4d4d]",
    ring: "focus-visible:ring-[#ff4d4d]/40",
  };
}

function SidebarNav({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const navGroups = isEntryContext(pathname) ? entryNavGroups : minervaNavGroups;

  const toggleGroup = (groupId: string, currentIsOpen: boolean) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !currentIsOpen,
    }));
  };

  return (
    <nav className="mt-5 flex-1 space-y-4 overflow-y-auto pr-0.5">
      {navGroups.map((group, groupIndex) => {
        const activeGroup = isGroupActive(group, pathname);
        const isPrimaryContextGroup = group.id === "minerva" || group.id === "entry";
        const isGroupExpanded = isPrimaryContextGroup
          ? true
          : openGroups[group.id] ?? activeGroup;

        return (
          <div key={group.id} className="space-y-1">
            {groupIndex > 0 ? (
              <div className="my-3 border-t border-white/[0.12]" />
            ) : null}

            {group.id === "minerva" || group.id === "entry" ? (
              <p className="px-2 py-1.5 text-[13px] font-semibold uppercase leading-4 tracking-[0.14em] text-slate-400">
                {group.label}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => toggleGroup(group.id, isGroupExpanded)}
                aria-expanded={isGroupExpanded}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] font-semibold uppercase leading-4 tracking-[0.14em] text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      isGroupExpanded ? "rotate-90 text-slate-300" : "text-slate-500",
                    )}
                  />
                  <span className="truncate">{group.label}</span>
                </span>
              </button>
            )}

            {isGroupExpanded ? (
              <div className={cn("mt-1 space-y-0.5", group.id === "system" ? "pl-1.5" : "")}>
                {group.items.map((item) => {
                  const active = item.href ? isItemActive(pathname, item.href) : false;
                  const Icon = item.icon;
                  const accent = getItemAccent(group.id, item.href);

                  if (item.disabled || !item.href) {
                    return (
                      <div
                        key={item.label}
                        className="group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] font-medium leading-4 text-slate-500"
                      >
                        <Icon className="h-4 w-4 shrink-0 stroke-[1.75]" />
                        <span className="truncate">{item.label}</span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] font-medium leading-4 transition-colors focus-visible:outline-none focus-visible:ring-1",
                        accent.ring,
                        active
                          ? "bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]"
                          : "text-slate-300 hover:bg-white/[0.04] hover:text-white",
                      )}
                    >
                      {active ? (
                        <span
                          className={cn(
                            "absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full",
                            accent.rail,
                          )}
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors stroke-[1.75]",
                          active
                            ? accent.icon
                            : "text-slate-400 group-hover:text-slate-200",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function AppSidebar({ email, isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const isSyntheticEmail = email
    ? email.endsWith("@entry.local") || email.endsWith("@entry.internal")
    : false;
  const displayEmail = email && !isSyntheticEmail ? email : null;

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-x-0 bottom-0 top-[61px] z-30 bg-slate-950/70 backdrop-blur-xs lg:hidden"
        />
      ) : null}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-[61px] z-40 flex w-64 flex-col border-r border-white/[0.14] bg-[#20242b] px-3.5 py-3.5 text-[var(--console-text)] shadow-[inset_-1px_0_0_rgba(255,255,255,0.04),18px_0_46px_rgba(0,0,0,0.18)] transition-transform lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-0.5 py-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 text-[#ff6b6b]">
              <Hexagon className="h-3.5 w-3.5 stroke-[1.75]" />
            </div>
            <div>
              <span className="block whitespace-nowrap text-[12px] font-bold uppercase leading-4 tracking-[0.12em] text-slate-100">
                Minerva Console
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Collapse navigation"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--console-text-muted)] transition-colors hover:bg-white/[0.04] hover:text-white lg:hidden"
          >
            <ChevronsLeft className="h-4 w-4 stroke-[1.75]" />
          </button>
        </div>

        <SidebarNav key={pathname} pathname={pathname} onClose={onClose} />

        <div className="mt-auto pt-2">
          <div className="my-2 border-t border-white/[0.12]" />
          <div className="flex items-center justify-between rounded-lg border border-white/[0.12] bg-white/[0.04] px-2.5 py-2 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#ff4d4d]/25 bg-[#ff4d4d]/10 font-semibold text-slate-100">
                {(displayEmail ? displayEmail[0] : "M")?.toUpperCase() ?? "M"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-4 text-slate-200">
                  Minerva Console
                </p>
                {displayEmail ? (
                  <p className="truncate text-[11px] text-[var(--console-text-muted)]">
                    {displayEmail}
                  </p>
                ) : null}
              </div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--console-text-soft)]" />
          </div>
        </div>
      </aside>
    </>
  );
}
