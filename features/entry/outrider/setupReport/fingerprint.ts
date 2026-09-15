import "server-only";

import { createHash } from "node:crypto";

export function sha256Hex(bytes: Buffer | Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function inputFingerprintHex(value: unknown) {
  return sha256Hex(stableStringify(value));
}
