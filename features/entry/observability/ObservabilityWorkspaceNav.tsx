"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BellRing,
  FileSearch,
  Gauge,
  LayoutDashboard,
  ServerCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/supabase/utils";

type ObservabilityNavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
};

const items: ObservabilityNavItem[] = [
  {
    href: "/products/entry/observability",
    icon: LayoutDashboard,
    label: "Overview",
    description: "Health & incidents",
  },
  {
    href: "/products/entry/observability/notifications",
    icon: BellRing,
    label: "Communications",
    description: "Push & email",
  },
  {
    href: "/products/entry/observability/background",
    icon: ServerCog,
    label: "Background",
    description: "Workers & queues",
  },
  {
    href: "/products/entry/observability/performance",
    icon: Gauge,
    label: "Performance",
    description: "Latency & usage",
  },
  {
    href: "/products/entry/observability/diagnostics",
    icon: FileSearch,
    label: "Diagnostics",
    description: "History & bundles",
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/products/entry/observability") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ObservabilityWorkspaceNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const withCurrentFilters = (href: string) => {
    const params = new URLSearchParams();
    const range = searchParams.get("range");
    const community = searchParams.get("community");

    if (range && range !== "24h") params.set("range", range);
    if (community) params.set("community", community);

    const query = params.toString();
    return query ? `${href}?${query}` : href;
  };

  return (
    <aside className="min-w-0 lg:sticky lg:top-[76px] lg:self-start">
      <div className="overflow-hidden rounded-[10px] border border-[#141119] bg-[#24202B]">
        <div className="border-b border-[#141119] px-3.5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A9A3B2]">
            Observability
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            ENTRY monitors
          </p>
        </div>

        <nav
          aria-label="ENTRY observability sections"
          className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible"
        >
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={withCurrentFilters(item.href)}
                className={cn(
                  "group relative flex min-w-[9.5rem] items-center gap-2.5 rounded-[7px] border px-3 py-2.5 transition-colors lg:min-w-0",
                  active
                    ? "border-[#7553FF]/45 bg-[#7553FF]/14 text-white"
                    : "border-transparent text-slate-300 hover:border-white/8 hover:bg-white/[0.035] hover:text-white",
                )}
              >
                {active ? (
                  <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r bg-[#7553FF]" />
                ) : null}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 stroke-[1.75]",
                    active ? "text-[#A997FF]" : "text-slate-400 group-hover:text-slate-200",
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {item.label}
                  </span>
                  <span className="mt-0.5 hidden truncate text-[10px] text-[#A9A3B2] lg:block">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
