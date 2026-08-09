import "server-only";

import { createHash, createHmac, timingSafeEqual } from "crypto";

export const CAMPAIGN_ACCESS_MAX_AGE_SECONDS = 60 * 60 * 2;

type CampaignAccessPayload = {
  issuedAt: number;
  slug: string;
  tokenHash: string;
  v: 1;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSigningSecret() {
  const secret = process.env.ENTRY_CR_COOKIE_SECRET;

  if (!secret) {
    throw new Error(
      "Missing ENTRY_CR_COOKIE_SECRET for registration access cookies.",
    );
  }

  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizePublicSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized;
}

export function hashRegistrationToken(token: string) {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function getCampaignAccessCookieName(slug: string) {
  const slugHash = createHash("sha256")
    .update(normalizePublicSlug(slug), "utf8")
    .digest("hex")
    .slice(0, 16);

  return `entry_cr_access_${slugHash}`;
}

export function getCampaignAccessCookiePath(slug: string) {
  return `/entry/register/${encodeURIComponent(normalizePublicSlug(slug))}`;
}

export function createCampaignAccessCookieValue(input: {
  slug: string;
  tokenHash: string;
}) {
  const payload: CampaignAccessPayload = {
    issuedAt: Date.now(),
    slug: normalizePublicSlug(input.slug),
    tokenHash: input.tokenHash,
    v: 1,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function readCampaignAccessCookieValue(input: {
  cookieValue?: string;
  slug: string;
}) {
  if (!input.cookieValue) return null;

  const [body, signature] = input.cookieValue.split(".");
  if (!body || !signature) return null;

  try {
    if (!safeEqual(signature, sign(body))) return null;

    const payload = JSON.parse(base64UrlDecode(body)) as Partial<CampaignAccessPayload>;
    if (payload.v !== 1) return null;
    if (payload.slug !== normalizePublicSlug(input.slug)) return null;
    if (typeof payload.tokenHash !== "string" || payload.tokenHash.length < 32) {
      return null;
    }
    if (typeof payload.issuedAt !== "number") return null;

    const ageSeconds = (Date.now() - payload.issuedAt) / 1000;
    if (ageSeconds < 0 || ageSeconds > CAMPAIGN_ACCESS_MAX_AGE_SECONDS) {
      return null;
    }

    return {
      slug: payload.slug,
      tokenHash: payload.tokenHash,
    };
  } catch {
    return null;
  }
}
