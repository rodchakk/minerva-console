import { createPublicKey, verify } from "node:crypto";

// GitHub-issued, short-lived identity tokens: no GitHub/Vercel shared static secret.
const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "minerva-security-watch-ingest-v1";
const JWKS_URL = ISSUER + "/.well-known/jwks";
const REPOSITORY = "rodchakk/minerva-console";
const REPOSITORY_ID = "1227208062";
const REF = "refs/heads/master";
const WORKFLOW_REF = REPOSITORY + "/.github/workflows/security-watch.yml@" + REF;
const EVENTS = new Set(["schedule", "workflow_dispatch", "push"]);

function decodePart(segment) {
  if (typeof segment !== "string" || !/^[A-Za-z0-9_-]+$/.test(segment)) return null;
  try { return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")); }
  catch { return null; }
}

export function validGitHubClaims(claims, nowSeconds) {
  if (!claims || typeof claims !== "object") return false;
  if (claims.iss !== ISSUER || claims.aud !== AUDIENCE ||
      claims.sub !== "repo:" + REPOSITORY + ":ref:" + REF ||
      claims.repository !== REPOSITORY || String(claims.repository_id) !== REPOSITORY_ID ||
      claims.ref !== REF || claims.workflow_ref !== WORKFLOW_REF ||
      !EVENTS.has(claims.event_name) ||
      !/^[0-9]{1,20}$/.test(String(claims.run_id ?? "")) ||
      !/^[0-9]{1,5}$/.test(String(claims.run_attempt ?? ""))) return false;
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) ||
      claims.iat > nowSeconds + 30 || nowSeconds - claims.iat > 600 ||
      claims.exp < nowSeconds || claims.exp - claims.iat > 600) return false;
  if (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > nowSeconds + 30)) return false;
  return true;
}

export function verifyGitHubOidcJwt(token, jwks, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string" || token.length < 100 || token.length > 10000) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  const header = decodePart(encodedHeader), claims = decodePart(encodedClaims);
  if (!header || !claims || header.alg !== "RS256" ||
      typeof header.kid !== "string" || header.kid.length > 200 ||
      !validGitHubClaims(claims, nowSeconds) ||
      !Array.isArray(jwks?.keys) || jwks.keys.length > 30) return null;
  const key = jwks.keys.find(k =>
    k.kid === header.kid && k.kty === "RSA" &&
    (!k.alg || k.alg === "RS256") && typeof k.n === "string" &&
    typeof k.e === "string");
  if (!key || !/^[A-Za-z0-9_-]+$/.test(encodedSignature)) return null;
  try {
    const publicKey = createPublicKey({ key, format: "jwk" });
    const isValid = verify("RSA-SHA256", Buffer.from(encodedHeader + "." + encodedClaims),
      publicKey, Buffer.from(encodedSignature, "base64url"));
    if (!isValid) return null;
    return { runId: "gh-" + claims.run_id + "-" + claims.run_attempt };
  } catch { return null; }
}

export async function authenticateGitHubActions(header) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  if (token.length < 100 || token.length > 10000) return null;
  const controller = AbortSignal.timeout(6000);
  const response = await fetch(JWKS_URL, {
    method: "GET", headers: { accept: "application/json" },
    cache: "no-store", signal: controller
  });
  if (!response.ok) return null;
  const keys = await response.json();
  return verifyGitHubOidcJwt(token, keys);
}
