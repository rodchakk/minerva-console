import { headers } from "next/headers";

const DEFAULT_PRODUCTION_RESIDENT_BASE_URL = "https://console.minervatechs.com";

export const ENTRY_PREVIEW_READ_ONLY_MESSAGE =
  "PREVIEW · READ ONLY: ENTRY writes are blocked in Vercel Preview. Use Production for live operations.";

function truthy(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? "");
}

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function configuredResidentBaseUrl() {
  return normalizeBaseUrl(
    process.env.ENTRY_PUBLIC_RESIDENT_BASE_URL ||
      process.env.NEXT_PUBLIC_MINERVA_CONSOLE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL,
  );
}

function isProductionRuntime() {
  return (
    process.env.VERCEL_ENV === "production" ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production")
  );
}

function isLocalHost(host: string) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
}

function isVercelPreviewHost(host: string) {
  return /\.vercel\.app(?::\d+)?$/i.test(host) && host !== "console.minervatechs.com";
}

export function isEntryPreviewReadOnly() {
  return process.env.VERCEL_ENV === "preview" || truthy(process.env.ENTRY_PREVIEW_READ_ONLY);
}

export function getEntryPreviewReadOnlyError() {
  return isEntryPreviewReadOnly() ? ENTRY_PREVIEW_READ_ONLY_MESSAGE : null;
}

export function requireEntryMutationAllowed() {
  const error = getEntryPreviewReadOnlyError();
  if (error) {
    throw new Error(error);
  }
}

export function getEntryDeploymentBoundary() {
  return {
    previewReadOnly: isEntryPreviewReadOnly(),
  };
}

export async function getResidentFacingBaseUrl() {
  const configured = configuredResidentBaseUrl();

  if (isProductionRuntime()) {
    return configured || DEFAULT_PRODUCTION_RESIDENT_BASE_URL;
  }

  if (configured) {
    return configured;
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host && isLocalHost(host) ? "http" : "https");

  if (host && !isEntryPreviewReadOnly() && !isVercelPreviewHost(host)) {
    return `${protocol}://${host}`;
  }

  throw new Error(
    "Resident-facing ENTRY links require ENTRY_PUBLIC_RESIDENT_BASE_URL, NEXT_PUBLIC_MINERVA_CONSOLE_URL, or NEXT_PUBLIC_SITE_URL outside local development.",
  );
}
