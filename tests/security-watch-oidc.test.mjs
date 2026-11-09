import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { validGitHubClaims, verifyGitHubOidcJwt } from "../scripts/security-watch-oidc.mjs";

const now = 1794192000;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-kid", alg: "RS256", use: "sig" };
const jwks = { keys: [jwk] };
const claims = {
  iss: "https://token.actions.githubusercontent.com",
  aud: "minerva-security-watch-ingest-v1",
  sub: "repo:rodchakk/minerva-console:ref:refs/heads/master",
  repository: "rodchakk/minerva-console",
  repository_id: "1227208062",
  ref: "refs/heads/master",
  workflow_ref: "rodchakk/minerva-console/.github/workflows/security-watch.yml@refs/heads/master",
  event_name: "schedule",
  run_id: "42551997122",
  run_attempt: "1",
  iat: now - 20, nbf: now - 20, exp: now + 280
};
function jwt(payload, overrideHeader = {}) {
  const encodedHeader = Buffer.from(JSON.stringify({ kid: "test-kid", alg: "RS256", typ: "JWT", ...overrideHeader })).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signed = encodedHeader + "." + encodedPayload;
  const signature = sign("RSA-SHA256", Buffer.from(signed), privateKey).toString("base64url");
  return signed + "." + signature;
}

test("valid GitHub OIDC identity authorizes only intended workflow+repo+run", () => {
  assert.equal(validGitHubClaims(claims, now), true);
  assert.deepEqual(verifyGitHubOidcJwt(jwt(claims), jwks, now), { runId: "gh-42551997122-1" });
  assert.deepEqual(verifyGitHubOidcJwt(jwt({ ...claims, event_name: "workflow_dispatch" }), jwks, now), { runId: "gh-42551997122-1" });
});

test("wrong issuer, audience, branch, repo ID, workflow and event all fail closed", () => {
  const wrong = [
    { iss: "https://attacker.example" }, { aud: "wrong" },
    { sub: "repo:rodchakk/minerva-console:pull_request" },
    { repository: "attacker/minerva-console" }, { repository_id: "0000000000" },
    { ref: "refs/heads/feature" },
    { workflow_ref: "rodchakk/minerva-console/.github/workflows/evil.yml@refs/heads/master" },
    { event_name: "pull_request" }
  ];
  for (const patch of wrong) {
    assert.equal(verifyGitHubOidcJwt(jwt({ ...claims, ...patch }), jwks, now), null, JSON.stringify(patch));
  }
});

test("expired, future, long-lived and invalid-signature tokens are rejected", () => {
  assert.equal(verifyGitHubOidcJwt(jwt(claims), jwks, now + 500), null);
  assert.equal(verifyGitHubOidcJwt(jwt({ ...claims, iat: now + 120 }), jwks, now), null);
  assert.equal(verifyGitHubOidcJwt(jwt({ ...claims, exp: now + 4000 }), jwks, now), null);
  assert.equal(verifyGitHubOidcJwt(jwt(claims), { keys: [] }, now), null);
  assert.equal(verifyGitHubOidcJwt(jwt(claims).slice(0, -6) + "abcdef", jwks, now), null);
  assert.equal(verifyGitHubOidcJwt(jwt(claims, { alg: "none" }), jwks, now), null);
  assert.equal(verifyGitHubOidcJwt("not-a-jwt", jwks, now), null);
});
