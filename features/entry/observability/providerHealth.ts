import "server-only";

import { getSupabaseEnv } from "@/lib/supabase/utils";

export type EntryPrimaryProviderState =
  | "healthy"
  | "degraded"
  | "down"
  | "unknown";

export type EntryContinuityProviderState =
  | "ready"
  | "standby"
  | "down"
  | "not_configured"
  | "unknown";

export type EntryProviderHealth = {
  checkedAt: string;
  primary: {
    provider: "Supabase";
    state: EntryPrimaryProviderState;
    latencyMs: number | null;
    httpStatus: number | null;
    endpoint: "auth_health";
    failureKind: "http_5xx" | "timeout" | "network" | "http_4xx" | null;
  };
  continuity: {
    provider: "Cloudflare";
    state: EntryContinuityProviderState;
    latencyMs: number | null;
    httpStatus: number | null;
    configured: boolean;
    writesEnabled: boolean | null;
    reconciliationEnabled: boolean | null;
  };
  attribution: {
    kind: "primary_provider" | "continuity_provider" | "none" | "unknown";
    title: string;
    explanation: string;
  };
};

type FetchResult = {
  response: Response | null;
  latencyMs: number;
  failureKind: "timeout" | "network" | null;
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<FetchResult> {
  const controller = new AbortController();
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });

    return {
      response,
      latencyMs: Date.now() - startedAt,
      failureKind: null,
    };
  } catch (cause) {
    const timeoutFailure =
      cause instanceof Error &&
      (cause.name === "AbortError" ||
        cause.message.toLowerCase().includes("timeout"));

    return {
      response: null,
      latencyMs: Date.now() - startedAt,
      failureKind: timeoutFailure ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeSupabase(): Promise<EntryProviderHealth["primary"]> {
  let url: string;

  try {
    url = getSupabaseEnv().url.replace(/\/+$/, "");
  } catch {
    return {
      endpoint: "auth_health",
      failureKind: null,
      httpStatus: null,
      latencyMs: null,
      provider: "Supabase",
      state: "unknown",
    };
  }

  const result = await fetchWithTimeout(
    `${url}/auth/v1/health`,
    {
      headers: {
        accept: "application/json",
      },
      method: "GET",
    },
    3_500,
  );

  if (!result.response) {
    return {
      endpoint: "auth_health",
      failureKind: result.failureKind,
      httpStatus: null,
      latencyMs: result.latencyMs,
      provider: "Supabase",
      state: "down",
    };
  }

  const status = result.response.status;

  if (status >= 500) {
    return {
      endpoint: "auth_health",
      failureKind: "http_5xx",
      httpStatus: status,
      latencyMs: result.latencyMs,
      provider: "Supabase",
      state: "down",
    };
  }

  if (status >= 400) {
    return {
      endpoint: "auth_health",
      failureKind: "http_4xx",
      httpStatus: status,
      latencyMs: result.latencyMs,
      provider: "Supabase",
      state: "degraded",
    };
  }

  return {
    endpoint: "auth_health",
    failureKind: null,
    httpStatus: status,
    latencyMs: result.latencyMs,
    provider: "Supabase",
    state: "healthy",
  };
}

function continuityBaseUrl() {
  return String(
    process.env.ENTRY_CONTINUITY_URL ??
      process.env.NEXT_PUBLIC_ENTRY_CONTINUITY_URL ??
      "",
  )
    .trim()
    .replace(/\/+$/, "");
}

async function probeContinuity(): Promise<EntryProviderHealth["continuity"]> {
  const baseUrl = continuityBaseUrl();

  if (!baseUrl) {
    return {
      configured: false,
      httpStatus: null,
      latencyMs: null,
      provider: "Cloudflare",
      reconciliationEnabled: null,
      state: "not_configured",
      writesEnabled: null,
    };
  }

  const result = await fetchWithTimeout(
    `${baseUrl}/health`,
    {
      headers: {
        accept: "application/json",
      },
      method: "GET",
    },
    3_500,
  );

  if (!result.response) {
    return {
      configured: true,
      httpStatus: null,
      latencyMs: result.latencyMs,
      provider: "Cloudflare",
      reconciliationEnabled: null,
      state: "down",
      writesEnabled: null,
    };
  }

  const status = result.response.status;
  if (status >= 500) {
    return {
      configured: true,
      httpStatus: status,
      latencyMs: result.latencyMs,
      provider: "Cloudflare",
      reconciliationEnabled: null,
      state: "down",
      writesEnabled: null,
    };
  }

  let payload: Record<string, unknown> = {};
  try {
    const candidate = await result.response.json();
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      payload = candidate as Record<string, unknown>;
    }
  } catch {
    payload = {};
  }

  const writesEnabled =
    typeof payload.writes_enabled === "boolean"
      ? payload.writes_enabled
      : null;
  const reconciliationEnabled =
    typeof payload.reconciliation_enabled === "boolean"
      ? payload.reconciliation_enabled
      : null;

  const ready =
    result.response.ok &&
    payload.ok === true &&
    writesEnabled === true &&
    reconciliationEnabled === true;

  return {
    configured: true,
    httpStatus: status,
    latencyMs: result.latencyMs,
    provider: "Cloudflare",
    reconciliationEnabled,
    state: ready ? "ready" : result.response.ok ? "standby" : "unknown",
    writesEnabled,
  };
}

function attribution(
  primary: EntryProviderHealth["primary"],
  continuity: EntryProviderHealth["continuity"],
): EntryProviderHealth["attribution"] {
  if (primary.state === "down") {
    return {
      kind: "primary_provider",
      title: "Primary provider unavailable",
      explanation:
        "Minerva can reach this health view, but ENTRY's primary Supabase infrastructure is not responding normally. This points to an upstream dependency failure rather than an ENTRY business-rule error.",
    };
  }

  if (primary.state === "degraded") {
    return {
      kind: "primary_provider",
      title: "Primary provider degraded",
      explanation:
        "Supabase is reachable but its health probe is returning an unexpected response. Treat the primary dependency as degraded until the probe returns healthy.",
    };
  }

  if (primary.state === "healthy" && continuity.state === "down") {
    return {
      kind: "continuity_provider",
      title: "Primary healthy; continuity provider unavailable",
      explanation:
        "ENTRY's primary Supabase dependency is responding, but the independent continuity service cannot currently be reached.",
    };
  }

  if (primary.state === "healthy") {
    return {
      kind: "none",
      title: "Primary provider healthy",
      explanation:
        continuity.state === "ready"
          ? "Supabase is healthy and the independent continuity service is ready."
          : "Supabase is healthy. The continuity service is either in standby or not configured yet.",
    };
  }

  return {
    kind: "unknown",
    title: "Provider attribution unavailable",
    explanation:
      "The independent provider probes do not currently provide enough evidence to attribute the condition.",
  };
}

export async function getEntryProviderHealth(): Promise<EntryProviderHealth> {
  const [primary, continuity] = await Promise.all([
    probeSupabase(),
    probeContinuity(),
  ]);

  return {
    attribution: attribution(primary, continuity),
    checkedAt: new Date().toISOString(),
    continuity,
    primary,
  };
}
