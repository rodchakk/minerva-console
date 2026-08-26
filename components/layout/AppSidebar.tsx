"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  ChevronRight,
  ChevronsLeft,
  ChevronsUpDown,
  Folder,
  Gauge,
  GitBranch,
  Hexagon,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Network,
  Search,
  SlidersHorizontal,
  Tag,
  Target,
  Terminal,
  Users,
} from "lucide-react";
import { cn } from "@/lib/supabase/utils";

type AppSidebarProps = {
  email?: string | null;
  isOpen: boolean;
  onClose: () => void;
};

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    id: "entry",
    label: "ENTRY",
    items: [
      { label: "Operations", href: "/dashboard", icon: LayoutDashboard },
      { label: "Communities", href: "/products/entry/communities", icon: Building2 },
      { label: "Users", href: "/products/entry/users", icon: Users },
      { label: "Messages", href: "/products/entry/messages", icon: MessageSquare },
      { label: "Settings", href: "/products/entry/settings", icon: SlidersHorizontal },
    ],
  },
  {
    id: "brain",
    label: "BRAIN",
    items: [
      { label: "Overview", href: "/brain", icon: Gauge },
      { label: "Projects", href: "/brain/projects", icon: Folder },
      { label: "Decisions", href: "/brain/decisions", icon: GitBranch },
      { label: "Prompts", href: "/brain/prompts", icon: Terminal },
      { label: "Agents", href: "/brain/agents", icon: Bot },
      { label: "Inbox", href: "/brain/inbox", icon: Inbox },
      { label: "Missions", href: "/brain/missions", icon: Target },
      { label: "Relations", href: "/brain/relations", icon: Network },
      { label: "Search", href: "/brain/search", icon: Search },
      { label: "Tags", href: "/brain/tags", icon: Tag },
    ],
  },
];

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  if (href === "/brain") {
    return pathname === "/brain";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  if (group.id === "entry") {
    return (
      pathname === "/dashboard" ||
      pathname.startsWith("/products/entry") ||
      pathname.startsWith("/activate")
    );
  }
  if (group.id === "brain") {
    return pathname.startsWith("/brain");
  }
  return group.items.some((item) => isItemActive(pathname, item.href));
}

function SidebarNav({
  pathname,
  onClose,
}: {
  pathname: string;
  onClose: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string, currentIsOpen: boolean) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !currentIsOpen,
    }));
  };

  return (
    <nav className="mt-6 flex-1 space-y-4 overflow-y-auto pr-0.5">
      {navGroups.map((group, groupIndex) => {
        const activeGroup = isGroupActive(group, pathname);
        const isGroupExpanded = openGroups[group.id] ?? activeGroup;

        return (
          <div key={group.id} className="space-y-1">
            {groupIndex > 0 ? (
              <div className="my-3 border-t border-white/[0.12]" />
            ) : null}

            <button
              type="button"
              onClick={() => toggleGroup(group.id, isGroupExpanded)}
              aria-expanded={isGroupExpanded}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] font-semibold uppercase leading-4 tracking-[0.14em] text-[var(--console-text-muted)] transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--console-accent)]/40"
            >
              <span className="flex items-center gap-2 min-w-0">
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                    isGroupExpanded ? "rotate-90 text-slate-300" : "text-[var(--console-text-soft)]",
                  )}
                />
                <span className="truncate">{group.label}</span>
              </span>

            </button>

            {isGroupExpanded ? (
              <div className="mt-1 space-y-0.5 pl-1.5">
                {group.items.map((item) => {
                  const active = isItemActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[14px] font-medium leading-4 transition-colors",
                        active
                          ? "bg-white/[0.055] text-white"
                          : "text-[var(--console-text-muted)] hover:bg-white/[0.03] hover:text-slate-200",
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--console-accent)]" />
                      ) : null}
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors stroke-[1.75]",
                          active
                            ? "text-white"
                            : "text-[var(--console-text-soft)] group-hover:text-slate-300",
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
          "fixed bottom-0 left-0 top-[61px] z-40 flex w-64 flex-col border-r border-white/[0.12] bg-[#2a2a2a] px-3.5 py-3.5 text-[var(--console-text)] shadow-[inset_-1px_0_0_rgba(255,255,255,0.02)] transition-transform lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-0.5 py-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--console-border-strong)] bg-[var(--console-surface-raised)] text-[var(--console-accent)]">
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
          <div className="flex items-center justify-between rounded-lg border border-white/[0.12] bg-white/[0.025] px-2.5 py-2 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 font-semibold text-slate-200">
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
