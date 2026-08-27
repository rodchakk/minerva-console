export const DEFAULT_POST_LOGIN_DESTINATION = "/dashboard";

const FIELD_ROOT = "/field";
const FIELD_PREFIX = `${FIELD_ROOT}/`;
const SAME_ORIGIN_BASE = "https://minerva.local";
const UNSAFE_REDIRECT_CHARACTERS = /[\u0000-\u001f\u007f\\]/;

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
