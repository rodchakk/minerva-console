import "server-only";

import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { NextRequest } from "next/server";
import {
  outriderHeaders,
  jsonOutriderResponse,
} from "@/features/entry/outrider/public/requestSecurity";

const RATE_LIMIT_PREFIX = "entry-outrider:rl";
const RATE_LIMIT_TIMEOUT_MS = 1500;

const RATE_LIMIT_POLICIES = {
  pageRead: { limit: 60, window: "10 m" },
  saveHourly: { limit: 120, window: "1 h" },
  saveShort: { limit: 20, window: "1 m" },
  submitHourly: { limit: 6, window: "1 h" },
  submitShort: { limit: 3, window: "10 m" },
  uploadHourly: { limit: 40, window: "1 h" },
  uploadShort: { limit: 12, window: "10 m" },
} as const;

type Policy = keyof typeof RATE_LIMIT_POLICIES;

type RateLimitDecision =
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

function isVercelRuntime() {
  return (
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "production"
  );
}

function canUseLocalBypass() {
  return !isVercelRuntime() && process.env.NODE_ENV !== "production";
}

function getNamespace() {
  return (process.env.VERCEL_ENV || process.env.NODE_ENV || "local")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .toLowerCase();
}

function getRuntimeConfiguration() {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  const hmacSecret =
    process.env.ENTRY_OUTRIDER_RATE_LIMIT_SECRET?.trim() ||
    process.env.ENTRY_CR_RATE_LIMIT_SECRET?.trim() ||
    "";

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
    localBypass: canUseLocalBypass(),
  };
}

function getRedis(input: { redisToken: string; redisUrl: string }) {
  if (
    cachedRedis &&
    cachedRedis.token === input.redisToken &&
    cachedRedis.url === input.redisUrl
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
  namespace: string;
  policy: Policy;
  redis: Redis;
}) {
  const cacheKey = `${input.namespace}:${input.policy}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;

  const policy = RATE_LIMIT_POLICIES[input.policy];
  const limiter = new Ratelimit({
    analytics: false,
    enableProtection: false,
    ephemeralCache: false,
    limiter: Ratelimit.slidingWindow(policy.limit, policy.window),
    prefix: `${RATE_LIMIT_PREFIX}:${input.namespace}:${input.policy}`,
    redis: input.redis,
    timeout: RATE_LIMIT_TIMEOUT_MS,
  });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

function getNetworkIdentity(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  if (isVercelRuntime()) {
    return forwardedFor || null;
  }

  return (
    request.headers.get("x-entry-outrider-local-client-id")?.trim() ||
    forwardedFor ||
    "local-development-client"
  );
}

function retryAfterSeconds(reset: number) {
  const seconds = Math.ceil((reset - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.max(1, seconds) : 60;
}

export async function enforceOutriderRateLimit(
  request: NextRequest,
  input: {
    policies: Policy[];
    tokenHash: string;
  },
): Promise<RateLimitDecision> {
  const networkIdentity = getNetworkIdentity(request);
  if (!networkIdentity) {
    console.warn("entry_outrider_rate_limit_failure=missing_network_identity");
    return {
      allowed: false,
      reason: "infrastructure_unavailable",
      status: 503,
    };
  }

  const config = getRuntimeConfiguration();
  if (!config.configured) {
    return config.localBypass
      ? { allowed: true, localBypass: true }
      : {
          allowed: false,
          reason: "infrastructure_unavailable",
          status: 503,
        };
  }

  const namespace = getNamespace();
  const redis = getRedis({
    redisToken: config.redisToken,
    redisUrl: config.redisUrl,
  });

  for (const policy of input.policies) {
    const digest = createHmac("sha256", config.hmacSecret)
      .update(namespace)
      .update("\0")
      .update(policy)
      .update("\0")
      .update(networkIdentity)
      .update("\0")
      .update(input.tokenHash)
      .digest("hex");
    const limiter = getLimiter({ namespace, policy, redis });

    try {
      const result = await limiter.limit(digest);
      if (result.reason === "timeout") {
        return {
          allowed: false,
          reason: "infrastructure_unavailable",
          status: 503,
        };
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
      console.warn("entry_outrider_rate_limit_failure=redis_exception", error);
      return {
        allowed: false,
        reason: "infrastructure_unavailable",
        status: 503,
      };
    }
  }

  return { allowed: true };
}

export function isOutriderRateLimitDenied(
  decision: RateLimitDecision,
): decision is Extract<RateLimitDecision, { allowed: false }> {
  return decision.allowed === false;
}

export function outriderRateLimitResponse(decision: RateLimitDecision) {
  const headers: Record<string, string> = outriderHeaders();
  if (decision.allowed === false && decision.reason === "rate_limited") {
    headers["Retry-After"] = String(decision.retryAfterSeconds);
  }

  return jsonOutriderResponse(
    {
      error:
        decision.allowed === false && decision.reason === "rate_limited"
          ? "rate_limited"
          : "service_unavailable",
      message:
        decision.allowed === false && decision.reason === "rate_limited"
          ? "Has realizado demasiadas solicitudes. Espera un momento e intentalo nuevamente."
          : "No pudimos procesar la solicitud en este momento. Intentalo nuevamente.",
    },
    decision.allowed === false ? decision.status : 503,
  );
}
