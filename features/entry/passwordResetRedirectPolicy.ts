export const ENTRY_PASSWORD_RESET_DEEP_LINK = "entry://reset-password";
export const PRODUCTION_PASSWORD_RESET_URL =
  "https://console.minervatechs.com/reset-password";

type RuntimeEnv = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

function isProductionRuntime(env: RuntimeEnv) {
  return (
    env.VERCEL_ENV === "production" ||
    (!env.VERCEL_ENV && env.NODE_ENV === "production")
  );
}

function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    /^127(?:\.\d{1,3}){0,3}$/.test(normalized)
  );
}

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isProductionSafeResetUrl(value: string) {
  const url = parseHttpUrl(value);

  return !!url && url.protocol === "https:" && !isLoopbackHost(url.hostname);
}

export function resolveConfiguredPasswordResetRedirect(
  configuredRedirect: string | undefined,
  env: RuntimeEnv = process.env,
) {
  const trimmed = configuredRedirect?.trim();

  if (!trimmed || trimmed === ENTRY_PASSWORD_RESET_DEEP_LINK) {
    return null;
  }

  if (!isProductionRuntime(env)) {
    return trimmed;
  }

  return isProductionSafeResetUrl(trimmed) ? trimmed : null;
}

export function resolvePasswordResetRedirect(input: {
  configuredRedirect?: string;
  env?: RuntimeEnv;
  residentBaseUrl: string;
}) {
  const env = input.env ?? process.env;
  const configured = resolveConfiguredPasswordResetRedirect(
    input.configuredRedirect,
    env,
  );

  if (configured) {
    return configured;
  }

  const baseUrl = trimTrailingSlash(input.residentBaseUrl.trim());
  const fallback = `${baseUrl}/reset-password`;

  if (!isProductionRuntime(env)) {
    return fallback;
  }

  return isProductionSafeResetUrl(fallback)
    ? fallback
    : PRODUCTION_PASSWORD_RESET_URL;
}
