"use client";

import Link from "next/link";
import { Home, ShieldCheck, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const FIELD_COMPOSER_MODE_EVENT = "minerva-field-composer-mode";

const items = [
  { href: "/field", label: "Home", icon: Home },
  { href: "/field/entry", label: "ENTRY", icon: ShieldCheck },
  { href: "/field/account", label: "Account", icon: UserCircle },
];

function isActive(pathname: string, href: string) {
  if (href === "/field") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function FieldNav() {
  const pathname = usePathname();
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    const handleComposerMode = (event: Event) => {
      const customEvent = event as CustomEvent<{ open?: boolean }>;
      setComposerOpen(Boolean(customEvent.detail?.open));
    };

    window.addEventListener(FIELD_COMPOSER_MODE_EVENT, handleComposerMode);
    return () => {
      window.removeEventListener(FIELD_COMPOSER_MODE_EVENT, handleComposerMode);
    };
  }, []);

  if (composerOpen) return null;

  return (
    <nav
      data-field-nav
      aria-label="Field navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--console-border)] bg-[rgba(20,20,20,0.94)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-3 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold transition-colors",
                active
                  ? "bg-[var(--console-accent-subtle)] text-[var(--console-text)]"
                  : "text-[var(--console-text-muted)] hover:bg-white/5 hover:text-[var(--console-text)]",
              ].join(" ")}
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
