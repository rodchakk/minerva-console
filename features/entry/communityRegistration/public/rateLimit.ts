import "server-only";

import { createHmac } from "crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { registrationHeaders } from "./requestSecurity";

const RATE_LIMIT_PREFIX = "entry-cr:rl";
const RATE_LIMIT_TIMEOUT_MS = 1500;

export const RATE_LIMIT_INFRASTRUCTURE_MESSAGE =
  "No pudimos procesar la solicitud en este momento. Inténtalo nuevamente.";
export const RATE_LIMIT_QUOTA_MESSAGE =
  "Has realizado demasiados intentos. Espera un momento e inténtalo nuevamente.";

const RATE_LIMIT_POLICIES = {
  campaignAccessNetwork: { limit: 10, window: "10 m" },
  campaignPageRead: { limit: 30, window: "10 m" },
  correctionAccessNetwork: { limit: 6, window: "10 m" },
  correctionAccessToken: { limit: 10, window: "10 m" },
  correctionPageRead: { limit: 30, window: "10 m" },
  correctionSubmitHourly: { limit: 5, window: "1 h" },
  correctionSubmitShort: { limit: 3, window: "10 m" },
  initialSubmitHourly: { limit: 5, window: "1 h" },
  initialSubmitShort: { limit: 3, window: "10 m" },
  unitLookupNetwork: { limit: 25, window: "15 m" },
  unitLookupSession: { limit: 8, window: "1 m" },
} as const;

type HeaderReader = {
  get(name: string): string | null;
};

type HeaderSource =
  | HeaderReader
  | {
      headers: HeaderReader;
    };

type RuntimeEnv = NodeJS.ProcessEnv;

export type EntryRateLimitPolicy = keyof typeof RATE_LIMIT_POLICIES;
type EntryRateLimitDenied = Extract<
  EntryRateLimitDecision,
  { allowed: false }
>;

type EntryRateLimitCheck = {
  identityParts: readonly string[];
  policy: EntryRateLimitPolicy;
};

type EntryRateLimitInfrastructureFailure =
  | "missing_network_identity"
  | "missing_runtime_configuration"
  | "redis_timeout"
  | "redis_authentication"
  | "redis_network"
  | "redis_exception";

type EntryRateLimitDecision =
  | {
      allowed: true;
      localBypass?: true;
    }
  | {
      allowed: false;
      reason: "infrastructure_unavailable";
      status: 503;
    }
  | {
      allowed: false;
      reason: "rate_limited";
      retryAfterSeconds: number;
      status: 429;
    };

let cachedRedis:
  | {
      redis: Redis;
      token: string;
      url: string;
    }
  | null = null;
const limiterCache = new Map<string, Ratelimit>();

function readHeader(source: HeaderSource, name: string) {
  const headers = "headers" in source ? source.headers : source;
  return headers.get(name);
}

function logRateLimitInfrastructureFailure(
  failure: EntryRateLimitInfrastructureFailure,
) {
  console.warn(`entry_cr_rate_limit_failure=${failure}`);
}

function infrastructureUnavailable(
  failure: EntryRateLimitInfrastructureFailure,
): EntryRateLimitDecision {
  logRateLimitInfrastructureFailure(failure);
  return { allowed: false, reason: "infrastructure_unavailable", status: 503 };
}

function readErrorField(error: unknown, field: "code" | "message" | "name") {
  if (!error || typeof error !== "object" || !(field in error)) return "";
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value.toLowerCase() : "";
}

function readErrorStatus(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const status =
    "status" in error
      ? error.status
      : "statusCode" in error
        ? error.statusCode
        : null;

  return typeof status === "number" || typeof status === "string"
    ? String(status).toLowerCase()
    : "";
}

function errorSearchText(error: unknown, depth = 0): string {
  if (depth > 2) return "";

  const current = [
    readErrorField(error, "code"),
    readErrorField(error, "message"),
    readErrorField(error, "name"),
    readErrorStatus(error),
  ];

  const cause =
    error && typeof error === "object" && "cause" in error
      ? error.cause
      : null;

  return [...current, errorSearchText(cause, depth + 1)].join(" ");
}

function classifyRedisInfrastructureFailure(
  error: unknown,
): EntryRateLimitInfrastructureFailure {
  const text = errorSearchText(error);

  if (
    /\b(401|403)\b/.test(text) ||
    /wrongpass|unauthorized|forbidden|invalid token|authentication/.test(text)
  ) {
    return "redis_authentication";
  }

  if (/timeout|timed out|etimedout|abort/.test(text)) {
    return "redis_timeout";
  }

  if (
    /invalid url|malformed url|fetch failed|network|connect|connection|econn|enotfound|eai_again|dns|socket|tls|certificate/.test(
      text,
    )
  ) {
    return "redis_network";
  }

  return "redis_exception";
}

function isVercelRuntime(env: RuntimeEnv = process.env) {
  return (
    env.VERCEL === "1" ||
    env.VERCEL_ENV === "preview" ||
    env.VERCEL_ENV === "production"
  );
}

function canUseLocalDevelopmentBypass(env: RuntimeEnv = process.env) {
  return !isVercelRuntime(env) && env.NODE_ENV !== "production";
}

function getRateLimitEnvironmentNamespace(env: RuntimeEnv = process.env) {
  const namespace = env.VERCEL_ENV || env.NODE_ENV || "local";
  return namespace.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
}

function getRuntimeConfiguration(env: RuntimeEnv = process.env) {
  const redisUrl = env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  const hmacSecret = env.ENTRY_CR_RATE_LIMIT_SECRET?.trim() ?? "";

  if (redisUrl && redisToken && hmacSecret) {
    return {
      configured: true as const,
      hmacSecret,
      redisToken,
      redisUrl,
    };
  }

  return {
    configured: false as const,
    localBypass: canUseLocalDevelopmentBypass(env),
  };
}

function getRedis(input: { redisToken: string; redisUrl: string }) {
  if (
    cachedRedis &&
    cachedRedis.url === input.redisUrl &&
    cachedRedis.token === input.redisToken
  ) {
    return cachedRedis.redis;
  }

  cachedRedis = {
    redis: new Redis({
      token: input.redisToken,
      url: input.redisUrl,
    }),
    token: input.redisToken,
    url: input.redisUrl,
  };

  limiterCache.clear();
  return cachedRedis.redis;
}

function getLimiter(input: {
  environment: string;
  policy: EntryRateLimitPolicy;
  redis: Redis;
}) {
  const cacheKey = `${input.environment}:${input.policy}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;

  const policy = RATE_LIMIT_POLICIES[input.policy];
  const limiter = new Ratelimit({
    analytics: false,
    enableProtection: false,
    ephemeralCache: false,
    limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
    prefix: `${RATE_LIMIT_PREFIX}:${input.environment}:${input.policy}`,
    redis: input.redis,
    timeout: RATE_LIMIT_TIMEOUT_MS,
  });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

export function deriveRateLimitDigest(input: {
  environment: string;
  identityParts: readonly string[];
  policy: EntryRateLimitPolicy;
  secret: string;
}) {
  return createHmac("sha256", input.secret)
    .update(input.environment)
    .update("\0")
    .update(input.policy)
    .update("\0")
    .update(input.identityParts.join("\0"))
    .digest("hex");
}

export function deriveRateLimitRedisKeyForValidation(input: {
  environment: string;
  identityParts: readonly string[];
  policy: EntryRateLimitPolicy;
  secret: string;
}) {
  const digest = deriveRateLimitDigest(input);
  return `${RATE_LIMIT_PREFIX}:${input.environment}:${input.policy}:${digest}`;
}

function getTrustedClientNetworkIdentity(source: HeaderSource) {
  const forwardedFor = readHeader(source, "x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  if (isVercelRuntime()) {
    return forwardedFor || null;
  }

  return (
    readHeader(source, "x-entry-cr-local-client-id")?.trim() ||
    forwardedFor ||
    "local-development-client"
  );
}

function networkCheck(
  source: HeaderSource,
  policy: EntryRateLimitPolicy,
  slug: string,
): EntryRateLimitCheck | null {
  const networkIdentity = getTrustedClientNetworkIdentity(source);
  if (!networkIdentity) return null;

  return {
    identityParts: ["network", slug, networkIdentity],
    policy,
  };
}

function campaignSessionCheck(
  policy: EntryRateLimitPolicy,
  input: {
    rateLimitSessionId: string;
    slug: string;
    tokenHash: string;
  },
): EntryRateLimitCheck {
  return {
    identityParts: [
      "campaign-session",
      input.slug,
      input.tokenHash,
      input.rateLimitSessionId,
    ],
    policy,
  };
}

function correctionTokenCheck(
  policy: EntryRateLimitPolicy,
  input: {
    editTokenHash: string;
    slug: string;
  },
): EntryRateLimitCheck {
  return {
    identityParts: ["correction-token", input.slug, input.editTokenHash],
    policy,
  };
}

function retryAfterSeconds(reset: number) {
  const seconds = Math.ceil((reset - Date.now()) / 1000);
  if (!Number.isFinite(seconds)) return 60;
  return Math.max(1, seconds);
}

async function enforceEntryRateLimitChecks(
  checks: Array<EntryRateLimitCheck | null>,
): Promise<EntryRateLimitDecision> {
  if (checks.some((check) => check === null)) {
    return infrastructureUnavailable("missing_network_identity");
  }

  const config = getRuntimeConfiguration();
  if (!config.configured) {
    return config.localBypass
      ? { allowed: true, localBypass: true }
      : infrastructureUnavailable("missing_runtime_configuration");
  }

  const environment = getRateLimitEnvironmentNamespace();
  let redis: Redis;

  try {
    redis = getRedis({
      redisToken: config.redisToken,
      redisUrl: config.redisUrl,
    });
  } catch (error) {
    return infrastructureUnavailable(classifyRedisInfrastructureFailure(error));
  }

  for (const check of checks as EntryRateLimitCheck[]) {
    const digest = deriveRateLimitDigest({
      environment,
      identityParts: check.identityParts,
      policy: check.policy,
      secret: config.hmacSecret,
    });
    const limiter = getLimiter({
      environment,
      policy: check.policy,
      redis,
    });

    try {
      const result = await limiter.limit(digest);
      if (result.reason === "timeout") {
        return infrastructureUnavailable("redis_timeout");
      }

      if (!result.success) {
        return {
          allowed: false,
          reason: "rate_limited",
          retryAfterSeconds: retryAfterSeconds(result.reset),
          status: 429,
        };
      }
    } catch (error) {
      return infrastructureUnavailable(classifyRedisInfrastructureFailure(error));
    }
  }

  return { allowed: true };
}

export async function enforceCampaignAccessRateLimit(
  source: HeaderSource,
  input: {
    slug: string;
  },
) {
  return enforceEntryRateLimitChecks([
    networkCheck(source, "campaignAccessNetwork", input.slug),
  ]);
}

export async function enforceCampaignPageReadRateLimit(
  input: {
    rateLimitSessionId: string;
    slug: string;
    tokenHash: string;
  },
) {
  return enforceEntryRateLimitChecks([
    campaignSessionCheck("campaignPageRead", input),
  ]);
}

export async function enforceUnitLookupRateLimit(
  source: HeaderSource,
  input: {
    rateLimitSessionId: string;
    slug: string;
    tokenHash: string;
  },
) {
  return enforceEntryRateLimitChecks([
    campaignSessionCheck("unitLookupSession", input),
    networkCheck(source, "unitLookupNetwork", input.slug),
  ]);
}

export async function enforceInitialSubmissionRateLimit(input: {
  rateLimitSessionId: string;
  slug: string;
  tokenHash: string;
}) {
  return enforceEntryRateLimitChecks([
    campaignSessionCheck("initialSubmitShort", input),
    campaignSessionCheck("initialSubmitHourly", input),
  ]);
}

export async function enforceCorrectionAccessRateLimit(
  source: HeaderSource,
  input: {
    editTokenHash: string;
    slug: string;
  },
) {
  return enforceEntryRateLimitChecks([
    networkCheck(source, "correctionAccessNetwork", input.slug),
    correctionTokenCheck("correctionAccessToken", input),
  ]);
}

export async function enforceCorrectionPageReadRateLimit(input: {
  editTokenHash: string;
  slug: string;
}) {
  return enforceEntryRateLimitChecks([
    correctionTokenCheck("correctionPageRead", input),
  ]);
}

export async function enforceCorrectionSubmissionRateLimit(input: {
  editTokenHash: string;
  slug: string;
}) {
  return enforceEntryRateLimitChecks([
    correctionTokenCheck("correctionSubmitShort", input),
    correctionTokenCheck("correctionSubmitHourly", input),
  ]);
}

export function isRateLimitDenied(
  decision: EntryRateLimitDecision,
): decision is EntryRateLimitDenied {
  return decision.allowed === false;
}

export function rateLimitErrorCode(decision: EntryRateLimitDecision) {
  return decision.allowed === false && decision.reason === "rate_limited"
    ? "rate_limited"
    : "service_unavailable";
}

export function rateLimitMessage(decision: EntryRateLimitDecision) {
  return decision.allowed === false && decision.reason === "rate_limited"
    ? RATE_LIMIT_QUOTA_MESSAGE
    : RATE_LIMIT_INFRASTRUCTURE_MESSAGE;
}

export function rateLimitJsonResponse(
  decision: EntryRateLimitDecision,
  options: {
    includeSubmitted?: boolean;
  } = {},
) {
  const headers: Record<string, string> = registrationHeaders();

  if (decision.allowed === false && decision.reason === "rate_limited") {
    headers["Retry-After"] = String(decision.retryAfterSeconds);
  }

  return NextResponse.json(
    {
      error: rateLimitErrorCode(decision),
      message: rateLimitMessage(decision),
      ...(options.includeSubmitted ? { submitted: false } : {}),
    },
    {
      headers,
      status: decision.allowed === false ? decision.status : 503,
    },
  );
}
