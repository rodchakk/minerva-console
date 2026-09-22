import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function createPatronatoReviewToken() {
  return randomBytes(32).toString("base64url");
}

export function hashPatronatoReviewToken(token: string) {
  return createHash("sha256").update(token.trim(), "utf8").digest("hex");
}
