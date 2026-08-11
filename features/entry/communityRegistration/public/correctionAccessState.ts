import "server-only";

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { normalizePublicSlug } from "./accessState";

const CORRECTION_ACCESS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 2;

type CorrectionAccessPayload = {
  editTokenHash: string;
  expiresAt: string;
  issuedAt: number;
  slug: string;
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
      "Missing ENTRY_CR_COOKIE_SECRET for correction access cookies.",
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

export function hashCorrectionToken(token: string) {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}

export function getCorrectionAccessCookieName(slug: string) {
  const slugHash = createHash("sha256")
    .update(normalizePublicSlug(slug), "utf8")
    .digest("hex")
    .slice(0, 16);

  return `entry_cr_correction_${slugHash}`;
}

export function getCorrectionAccessCookiePath(slug: string) {
  return `/entry/register/${encodeURIComponent(normalizePublicSlug(slug))}/correct`;
}

export function getCorrectionAccessMaxAgeSeconds(expiresAt: string) {
  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return 0;

  const remainingSeconds = Math.floor((expiresAtMs - Date.now()) / 1000);
  if (remainingSeconds <= 0) return 0;

  return Math.min(remainingSeconds, CORRECTION_ACCESS_SESSION_MAX_AGE_SECONDS);
}

export function createCorrectionAccessCookieValue(input: {
  editTokenHash: string;
  expiresAt: string;
  slug: string;
}) {
  const payload: CorrectionAccessPayload = {
    editTokenHash: input.editTokenHash,
    expiresAt: input.expiresAt,
    issuedAt: Date.now(),
    slug: normalizePublicSlug(input.slug),
    v: 1,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

export function readCorrectionAccessCookieValue(input: {
  cookieValue?: string;
  slug: string;
}) {
  if (!input.cookieValue) return null;

  const [body, signature] = input.cookieValue.split(".");
  if (!body || !signature) return null;

  try {
    if (!safeEqual(signature, sign(body))) return null;

    const payload = JSON.parse(
      base64UrlDecode(body),
    ) as Partial<CorrectionAccessPayload>;
    if (payload.v !== 1) return null;
    if (payload.slug !== normalizePublicSlug(input.slug)) return null;
    if (
      typeof payload.editTokenHash !== "string" ||
      payload.editTokenHash.length < 32
    ) {
      return null;
    }
    if (typeof payload.expiresAt !== "string") return null;
    if (getCorrectionAccessMaxAgeSeconds(payload.expiresAt) <= 0) return null;
    if (typeof payload.issuedAt !== "number") return null;

    const ageSeconds = (Date.now() - payload.issuedAt) / 1000;
    if (
      ageSeconds < 0 ||
      ageSeconds > CORRECTION_ACCESS_SESSION_MAX_AGE_SECONDS
    ) {
      return null;
    }

    return {
      editTokenHash: payload.editTokenHash,
      expiresAt: payload.expiresAt,
      slug: payload.slug,
    };
  } catch {
    return null;
  }
}
