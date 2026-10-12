"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight, Boxes, ChevronLeft, ChevronRight, FileClock, Menu,
  Settings2, Users, X, Building2, CircleGauge,
} from "lucide-react";
import { EntryPushSessionSync } from "@/features/entry/push/EntryPushSessionSync";
import { EntryPushSignOutForm } from "@/features/entry/push/EntryPushSignOutForm";

type Props = {
  children: React.ReactNode;
  email: string | null;
  previewReadOnly?: boolean;
};

const nav = [
  { label: "Products", href: "/products", icon: Boxes },
  { label: "Clients", href: "/customers", icon: Building2 },
  { label: "Team & access", href: "/users", icon: Users },
  { label: "Activity", href: "/logs", icon: FileClock },
  { label: "Settings", href: "/settings", icon: Settings2 },
];

const financeNav = [{ label: "SESHAT", href: "/seshat", icon: CircleGauge }];

function active(pathname: string, href: string) {
  if (href === "/products") return pathname === href || pathname === "/dashboard" || pathname === "/products/add";
  return pathname === href || pathname.startsWith(href + "/");
}

export function MinervaShell({ children, email, previewReadOnly = false }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentPage = [...nav, ...financeNav].find((item) => active(pathname, item.href))?.label ?? "Workspace";
  const syntheticEmail = !!email && (email.endsWith("@entry.local") || email.endsWith("@entry.internal"));
  const accountInitial = email && !syntheticEmail ? email.charAt(0).toUpperCase() : "M";

  return (
    <div className={"minerva-core-theme" + (collapsed ? " minerva-collapsed" : "")}>
      <header className="minerva-topbar">
        <EntryPushSessionSync surface="console" />
        <button
          type="button"
          className="minerva-mobile-menu"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={17} />
        </button>
        <Link href="/products" className="minerva-topbar-brand" aria-label="Minerva Console products">
          <span className="minerva-brand-emblem" aria-hidden="true" />
          <span className="minerva-brand-name">MINERVA CONSOLE</span>
        </Link>
        <div className="minerva-topbar-org">
          <small>Workspace</small>
          <span>Minerva Technologies</span>
          <ChevronRight size={13} className="text-[#8F879D]" aria-hidden="true" />
          <span className="text-[#8F879D]">/</span>
          <span className="text-[#DBD5E2]">{currentPage}</span>
        </div>
        <div className="minerva-topbar-right">
          <span className="minerva-identity" aria-label="Signed-in account">{accountInitial}</span>
          <EntryPushSignOutForm />
        </div>
      </header>

      {mobileOpen ? (
        <button type="button" aria-label="Close navigation" className="minerva-mobile-scrim"
          onClick={() => setMobileOpen(false)} />
      ) : null}
      <aside className={"minerva-sidebar" + (mobileOpen ? " is-mobile-open" : "")} aria-label="Minerva navigation">
        <p className="minerva-sidebar-label">WORKSPACE</p>
        <nav className="minerva-nav" aria-label="Main">
          {nav.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={label}
              aria-current={active(pathname, href) ? "page" : undefined}
              className="minerva-nav-link"
              onClick={() => setMobileOpen(false)}
            >
              <Icon aria-hidden="true" />
              <span className="minerva-nav-label">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="minerva-sidebar-rule" />
        <p className="minerva-sidebar-label">FINANCE</p>
        <nav className="minerva-nav" aria-label="Finance">
          {financeNav.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={label}
              aria-current={active(pathname, href) ? "page" : undefined}
              className="minerva-nav-link"
              onClick={() => setMobileOpen(false)}
            >
              <Icon aria-hidden="true" />
              <span className="minerva-nav-label">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="minerva-sidebar-rule" />
        <nav className="minerva-nav" aria-label="Internal tools">
          <Link href="/brain" className="minerva-nav-link" title="Minerva Brain"
            aria-current={pathname.startsWith("/brain") ? "page" : undefined}
            onClick={() => setMobileOpen(false)}>
            <ArrowUpRight aria-hidden="true" />
            <span className="minerva-nav-label">Minerva Brain</span>
          </Link>
        </nav>
        <div className="minerva-sidebar-bottom">
          <p className="minerva-sidebar-note">Minerva Technologies · Internal workspace</p>
          <button type="button" className="minerva-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}>
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>
        {mobileOpen ? (
          <button type="button" className="absolute right-2 top-2 p-2 text-[#A9A3B2] md:hidden"
            aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={18}/></button>
        ) : null}
      </aside>

      <div className="minerva-content-shell">
        {previewReadOnly ? (
          <div className="sticky top-14 z-30 border-y border-amber-300/60 bg-amber-300 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.24em] text-slate-950">
            PREVIEW · READ ONLY
          </div>
        ) : null}
        <main id="minerva-main" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
