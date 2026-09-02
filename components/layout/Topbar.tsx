"use client";

import { LogOut, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/features/auth/actions";

type TopbarProps = {
  email: string | null;
  onOpenSidebar: () => void;
};

export function Topbar({ email, onOpenSidebar }: TopbarProps) {
  const pathname = usePathname();
  const crumbs = getBreadcrumbs(pathname);

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
            {crumbs.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="contents">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                <span
                  className={
                    index === crumbs.length - 1 ? "font-medium text-slate-100" : ""
                  }
                >
                  {crumb}
                </span>
              </span>
            ))}
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

function getBreadcrumbs(pathname: string) {
  if (pathname === "/dashboard") {
    return ["Minerva Console", "Control Center"];
  }

  if (pathname === "/products/add") {
    return ["Minerva Console", "Products", "Add Product"];
  }

  if (pathname === "/seshat") {
    return ["Minerva Console", "Seshat"];
  }

  if (pathname === "/reminders") {
    return ["Minerva Console", "Reminders"];
  }

  if (pathname === "/logs") {
    return ["Minerva Console", "Logs"];
  }

  if (pathname === "/products") {
    return ["Minerva Console", "Products"];
  }

  if (pathname.startsWith("/products/entry/tickets")) {
    return ["Minerva Console", "ENTRY", "Tickets"];
  }

  if (pathname.startsWith("/products/entry/communities")) {
    return ["Minerva Console", "ENTRY", "Communities"];
  }

  if (pathname.startsWith("/products/entry/users")) {
    return ["Minerva Console", "ENTRY", "Users"];
  }

  if (pathname.startsWith("/products/entry/messages")) {
    return ["Minerva Console", "ENTRY", "Messages"];
  }

  if (pathname.startsWith("/products/entry/settings")) {
    return ["Minerva Console", "ENTRY", "Settings"];
  }

  if (pathname === "/products/entry") {
    return ["Minerva Console", "ENTRY", "Operations"];
  }

  if (pathname.startsWith("/brain")) {
    const section = pathname.split("/").filter(Boolean)[1];
    return [
      "Minerva Console",
      "Brain",
      section ? section[0].toUpperCase() + section.slice(1) : "Overview",
    ];
  }

  if (pathname === "/settings") {
    return ["Minerva Console", "System", "Settings"];
  }

  return ["Minerva Console"];
}
