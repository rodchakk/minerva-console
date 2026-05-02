"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/supabase/utils";

type AppSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

const navSections = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Products", href: "/products", group: true },
  { label: "ENTRY", href: "/products/entry", indent: true },
  { label: "Clients", href: "/clients" },
  { label: "Finance", href: "/finance" },
  { label: "Invoices", href: "/invoices" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
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
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-[var(--sidebar)] px-5 py-6 text-[var(--sidebar-foreground)] transition-transform lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="rounded-[24px] bg-white/6 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300">
            Minerva
          </p>
          <h2 className="mt-2 text-xl font-semibold">Console</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Internal command center for products, clients, finance, and reporting.
          </p>
        </div>

        <nav className="mt-8 flex-1 space-y-2">
          {navSections.map((item) => {
            const isActive =
              item.href === "/products"
                ? pathname === "/products" || pathname.startsWith("/products/")
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition",
                  item.group && "mt-5 text-slate-400",
                  item.indent && "ml-3",
                  isActive
                    ? "bg-teal-500/18 text-white"
                    : "text-slate-300 hover:bg-white/6 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="rounded-[24px] bg-[var(--sidebar-muted)] p-4 text-sm leading-6 text-slate-300">
          ENTRY is connected today. The shell is ready for future modules without
          hardwiring the global dashboard to a single product.
        </div>
      </aside>
    </>
  );
}
