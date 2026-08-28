export function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    /^127(?:\.\d{1,3}){0,3}$/.test(normalized)
  );
}

export function getUrlHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}
