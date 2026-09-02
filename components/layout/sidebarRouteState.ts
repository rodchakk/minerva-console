export function isItemActive(pathname: string, href: string | null): boolean {
  if (!href) {
    return false;
  }

  if (href === "/dashboard" || href === "/brain" || href === "/products/entry") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isEntryContext(pathname: string) {
  return (
    pathname === "/products/entry" ||
    pathname.startsWith("/products/entry/") ||
    pathname.startsWith("/activate")
  );
}
