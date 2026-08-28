import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildEntryResetUrl } from "../app/reset-password/bridgeUrl.ts";
import {
  ENTRY_PASSWORD_RESET_DEEP_LINK,
  PRODUCTION_PASSWORD_RESET_URL,
  resolveConfiguredPasswordResetRedirect,
  resolvePasswordResetRedirect,
} from "../features/entry/passwordResetRedirectPolicy.ts";

const root = process.cwd();
const productionEnv = { NODE_ENV: "production", VERCEL_ENV: "production" };
const developmentEnv = { NODE_ENV: "development" };

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("production password reset falls back to console reset bridge", () => {
  assert.equal(
    resolvePasswordResetRedirect({
      env: productionEnv,
      residentBaseUrl: "https://console.minervatechs.com",
    }),
    PRODUCTION_PASSWORD_RESET_URL,
  );
});

test("production password reset rejects localhost and loopback overrides", () => {
  for (const configuredRedirect of [
    "http://localhost:3000/reset-password",
    "https://localhost/reset-password",
    "http://127.0.0.1:3000/reset-password",
    "https://127.1/reset-password",
    "http://[::1]:3000/reset-password",
    ENTRY_PASSWORD_RESET_DEEP_LINK,
  ]) {
    assert.equal(
      resolvePasswordResetRedirect({
        configuredRedirect,
        env: productionEnv,
        residentBaseUrl: "http://localhost:3000",
      }),
      PRODUCTION_PASSWORD_RESET_URL,
      configuredRedirect,
    );
  }
});

test("production password reset accepts valid HTTPS override", () => {
  assert.equal(
    resolveConfiguredPasswordResetRedirect(
      "https://console.minervatechs.com/reset-password",
      productionEnv,
    ),
    PRODUCTION_PASSWORD_RESET_URL,
  );

  assert.equal(
    resolvePasswordResetRedirect({
      configuredRedirect: "https://entry.example.com/account/recover",
      env: productionEnv,
      residentBaseUrl: "https://console.minervatechs.com",
    }),
    "https://entry.example.com/account/recover",
  );
});

test("local development password reset can use localhost", () => {
  assert.equal(
    resolvePasswordResetRedirect({
      configuredRedirect: "http://localhost:3000/reset-password",
      env: developmentEnv,
      residentBaseUrl: "http://localhost:3000",
    }),
    "http://localhost:3000/reset-password",
  );

  assert.equal(
    resolvePasswordResetRedirect({
      env: developmentEnv,
      residentBaseUrl: "http://127.0.0.1:3000",
    }),
    "http://127.0.0.1:3000/reset-password",
  );
});

test("reset bridge preserves Supabase recovery query and hash payload", () => {
  const search = "?code=pkce-code&next=%2Fresident";
  const hash =
    "#access_token=redacted-access&refresh_token=redacted-refresh&type=recovery";

  assert.equal(
    buildEntryResetUrl(search, hash),
    "entry://reset-password?code=pkce-code&next=%2Fresident#access_token=redacted-access&refresh_token=redacted-refresh&type=recovery",
  );
});

test("reset bridge does not render recovery payload into static hrefs or logs", () => {
  const page = read("app/reset-password/page.tsx");

  assert.doesNotMatch(page, /href=\{entryResetUrl\}/);
  assert.doesNotMatch(page, /console\.(log|info|warn|error)/);
  assert.match(page, /window\.location\.replace\(entryResetUrl\)/);
  assert.match(page, /window\.location\.assign\(buildCurrentEntryResetUrl\(\)\)/);
});

test("Field username recovery-code flow remains separate from email reset", () => {
  const actions = read("features/entry/field/peopleActions.ts");
  const emailReset = actions.indexOf("resetPasswordForEmail");
  const recoveryCode = actions.indexOf('"admin-generate-recovery-code"');

  assert.ok(emailReset > -1);
  assert.ok(recoveryCode > -1);
  assert.ok(emailReset < recoveryCode);
  assert.match(actions, /canSendResidentResetEmail\(resident\)/);
  assert.match(actions, /canUseResidentRecoveryCode\(resident\)/);
});

test("password reset actions do not log reset URLs or recovery tokens", () => {
  for (const file of [
    "features/entry/field/peopleActions.ts",
    "features/entry/users/actions.ts",
    "features/entry/passwordResetRedirect.ts",
    "features/entry/passwordResetRedirectPolicy.ts",
  ]) {
    const source = read(file);

    assert.doesNotMatch(source, /console\.(log|info|warn|error)/, file);
    assert.doesNotMatch(source, /access_token|refresh_token|token_hash/i, file);
  }
});
