export const DEFAULT_POST_LOGIN_DESTINATION = "/dashboard";
export const MEMBER_POST_LOGIN_DESTINATION = "/workspace";

const FIELD_ROOT = "/field";
const FIELD_PREFIX = `${FIELD_ROOT}/`;
const SAME_ORIGIN_BASE = "https://minerva.local";
const UNSAFE_REDIRECT_CHARACTERS = /[\u0000-\u001f\u007f\\]/;
const OWNER_ROUTE_ROOTS = new Set([
  "/brain",
  "/clients",
  "/dashboard",
  "/field",
  "/finance",
  "/invoices",
  "/logs",
  "/products",
  "/reminders",
  "/reports",
  "/settings",
  "/seshat",
  "/users",
]);

export function getSafePostLoginDestination(
  next: FormDataEntryValue | string | null | undefined,
) {
  if (typeof next !== "string") {
    return DEFAULT_POST_LOGIN_DESTINATION;
  }

  const value = next.trim();

  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    UNSAFE_REDIRECT_CHARACTERS.test(value)
  ) {
    return DEFAULT_POST_LOGIN_DESTINATION;
  }

  let parsed: URL;

  try {
    parsed = new URL(value, SAME_ORIGIN_BASE);
  } catch {
    return DEFAULT_POST_LOGIN_DESTINATION;
  }

  if (parsed.origin !== SAME_ORIGIN_BASE) {
    return DEFAULT_POST_LOGIN_DESTINATION;
  }

  if (parsed.pathname !== FIELD_ROOT && !parsed.pathname.startsWith(FIELD_PREFIX)) {
    return DEFAULT_POST_LOGIN_DESTINATION;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function isOwnerRoute(pathname: string) {
  for (const root of OWNER_ROUTE_ROOTS) {
    if (pathname === root || pathname.startsWith(`${root}/`)) {
      return true;
    }
  }

  return false;
}

export function getSafeOwnerPostLoginDestination(
  next: FormDataEntryValue | string | null | undefined,
) {
  if (typeof next !== "string") {
    return DEFAULT_POST_LOGIN_DESTINATION;
  }

  const value = next.trim();

  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    UNSAFE_REDIRECT_CHARACTERS.test(value)
  ) {
    return DEFAULT_POST_LOGIN_DESTINATION;
  }

  let parsed: URL;

  try {
    parsed = new URL(value, SAME_ORIGIN_BASE);
  } catch {
    return DEFAULT_POST_LOGIN_DESTINATION;
  }

  if (parsed.origin !== SAME_ORIGIN_BASE || !isOwnerRoute(parsed.pathname)) {
    return DEFAULT_POST_LOGIN_DESTINATION;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function getConsolePostLoginDestination(
  role: "owner" | "builder" | "viewer",
  next: FormDataEntryValue | string | null | undefined,
) {
  if (role === "owner") {
    return getSafeOwnerPostLoginDestination(next);
  }

  return MEMBER_POST_LOGIN_DESTINATION;
}
