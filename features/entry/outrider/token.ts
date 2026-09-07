import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const OUTRIDER_LINK_AAD = "entry-outrider-link:v1";
const PAYLOAD_VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  return Buffer.from(padded, "base64");
}

function getEncryptionKey() {
  const configured =
    process.env.ENTRY_OUTRIDER_LINK_ENCRYPTION_KEY?.trim() ||
    process.env.ENTRY_CR_CAMPAIGN_LINK_ENCRYPTION_KEY?.trim() ||
    "";

  if (!configured) {
    throw new Error("Missing ENTRY_OUTRIDER_LINK_ENCRYPTION_KEY.");
  }

  if (/^[a-f0-9]{64}$/i.test(configured)) {
    return Buffer.from(configured, "hex");
  }

  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(configured) && configured.length % 4 !== 1) {
    const decoded = decodeBase64Url(configured.replace(/=+$/, ""));
    if (decoded.length === 32) return decoded;
  }

  throw new Error("ENTRY_OUTRIDER_LINK_ENCRYPTION_KEY must encode 32 bytes.");
}

export function makeOutriderToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOutriderToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function encryptOutriderToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(OUTRIDER_LINK_AAD, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PAYLOAD_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptOutriderToken(payload: string) {
  const [version, ivBase64, tagBase64, ciphertextBase64, extra] =
    payload.trim().split(":");
  if (
    version !== PAYLOAD_VERSION ||
    !ivBase64 ||
    !tagBase64 ||
    !ciphertextBase64 ||
    extra
  ) {
    throw new Error("Invalid Outrider encrypted token payload.");
  }

  const iv = decodeBase64Url(ivBase64);
  const tag = decodeBase64Url(tagBase64);
  const ciphertext = decodeBase64Url(ciphertextBase64);

  if (iv.byteLength !== IV_BYTES || tag.byteLength !== TAG_BYTES) {
    throw new Error("Invalid Outrider encrypted token payload.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv,
  );
  decipher.setAAD(Buffer.from(OUTRIDER_LINK_AAD, "utf8"));
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function timingSafeHashEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
