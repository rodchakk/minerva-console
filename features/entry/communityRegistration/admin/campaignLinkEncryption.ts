import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const KEY_ENV_NAME = "ENTRY_CR_CAMPAIGN_LINK_ENCRYPTION_KEY";
const PAYLOAD_VERSION = "v1";
const AAD = Buffer.from("entry-cr-campaign-link:v1", "utf8");
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

function decodeKey(rawKey: string) {
  const value = rawKey.trim();

  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }

  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value) || value.length % 4 === 1) {
    return Buffer.alloc(0);
  }

  return decodeBase64Url(value.replace(/=+$/, ""));
}

function getCampaignLinkEncryptionKey() {
  const rawKey = process.env[KEY_ENV_NAME];

  if (!rawKey) {
    throw new Error(`Missing ${KEY_ENV_NAME}.`);
  }

  const key = decodeKey(rawKey);

  if (key.byteLength !== 32) {
    throw new Error(`${KEY_ENV_NAME} must decode to exactly 32 bytes.`);
  }

  return key;
}

function decodePayloadPart(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Invalid encrypted campaign link payload.");
  }

  return decodeBase64Url(value);
}

export function encryptCampaignRegistrationToken(plaintextToken: string) {
  const key = getCampaignLinkEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {
    authTagLength: TAG_BYTES,
  });
  cipher.setAAD(AAD);

  const ciphertext = Buffer.concat([
    cipher.update(plaintextToken, "utf8"),
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

export function decryptCampaignRegistrationToken(encryptedPayload: string) {
  const [version, ivPart, tagPart, ciphertextPart, extra] =
    encryptedPayload.trim().split(":");

  if (
    version !== PAYLOAD_VERSION ||
    !ivPart ||
    !tagPart ||
    !ciphertextPart ||
    extra
  ) {
    throw new Error("Invalid encrypted campaign link payload.");
  }

  const iv = decodePayloadPart(ivPart);
  const tag = decodePayloadPart(tagPart);
  const ciphertext = decodePayloadPart(ciphertextPart);

  if (iv.byteLength !== IV_BYTES || tag.byteLength !== TAG_BYTES) {
    throw new Error("Invalid encrypted campaign link payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getCampaignLinkEncryptionKey(), iv, {
    authTagLength: TAG_BYTES,
  });
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function timingSafeHashEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.byteLength !== rightBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
