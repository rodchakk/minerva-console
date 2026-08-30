import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("ENTRY Preview read-only boundary is centralized", () => {
  const boundary = read("features/entry/deploymentBoundary.ts");

  assert.match(boundary, /VERCEL_ENV === "preview"/);
  assert.match(boundary, /ENTRY_PREVIEW_READ_ONLY/);
  assert.match(boundary, /PREVIEW · READ ONLY/);
  assert.match(boundary, /https:\/\/console\.minervatechs\.com/);
});

test("Production resident-facing URLs cannot fall back to request host", () => {
  const boundary = read("features/entry/deploymentBoundary.ts");
  const productionBranch = boundary.indexOf("if (isProductionRuntime())");
  const defaultHost = boundary.indexOf("DEFAULT_PRODUCTION_RESIDENT_BASE_URL");
  const requestHeaderRead = boundary.indexOf('requestHeaders.get("x-forwarded-host")');

  assert.ok(productionBranch >= 0, "missing Production runtime branch");
  assert.ok(defaultHost >= 0, "missing canonical Production default");
  assert.ok(requestHeaderRead >= 0, "missing local request-host fallback");
  assert.ok(
    productionBranch < requestHeaderRead,
    "Production handling must happen before any request-host fallback",
  );

  for (const path of [
    "features/entry/communityRegistration/admin/actions.ts",
    "features/entry/communityRegistration/review/actions.ts",
    "features/entry/activation/emailActions.ts",
    "features/entry/users/actions.ts",
  ]) {
    const source = read(path);
    assert.match(source, /getResidentFacingBaseUrl|getPasswordResetRedirectTo/);
    assert.doesNotMatch(source, /getRegistrationBaseUrl|getActivationBaseUrl/);
  }
});

test("ENTRY mutating Server Actions reject Preview before writes", () => {
  for (const path of [
    "features/entry/activation/createUserActions.ts",
    "features/entry/activation/emailActions.ts",
    "features/entry/activation/pinActions.ts",
    "features/entry/communities/actions.ts",
    "features/entry/communities/onboardingActions.ts",
    "features/entry/communities/statusActions.ts",
    "features/entry/communities/unitActions.ts",
    "features/entry/communityRegistration/admin/actions.ts",
    "features/entry/communityRegistration/review/actions.ts",
    "features/entry/messages/actions.ts",
    "features/entry/onboardingCampaigns/actions.ts",
    "features/entry/staff/actions.ts",
    "features/entry/users/actions.ts",
  ]) {
    const source = read(path);
    assert.match(
      source,
      /getEntryPreviewReadOnlyError|requireEntryMutationAllowed/,
      `${path} must use the central Preview write guard`,
    );
  }
});

test("public mutation routes reject Preview server-side", () => {
  for (const path of [
    "app/(public)/entry/register/[slug]/submit/route.ts",
    "app/(public)/entry/register/[slug]/correct/submit/route.ts",
    "app/activate/complete/route.ts",
    "app/activate/validate/route.ts",
  ]) {
    const source = read(path);
    const body = source.slice(source.indexOf("export async function POST"));
    const guard = body.indexOf("getEntryPreviewReadOnlyError");
    const rpcOrSubmit = Math.min(
      ...["submitCommunityRegistrationHousehold", "resubmitCommunityRegistrationHousehold", ".rpc("]
        .map((needle) => body.indexOf(needle))
        .filter((index) => index >= 0),
    );

    assert.ok(guard >= 0, `${path} must import/use the central Preview guard`);
    assert.ok(
      rpcOrSubmit < 0 || guard < rpcOrSubmit,
      `${path} must check Preview before mutating`,
    );
  }
});

test("activation page no longer performs client-side Supabase mutations", () => {
  const source = read("app/activate/page.tsx");

  assert.doesNotMatch(source, /@\/lib\/supabase\/client/);
  assert.doesNotMatch(source, /\.rpc\(/);
  assert.match(source, /\/activate\/complete/);
});

test("Console Preview read-only indicator is global and unmistakable", () => {
  assert.match(read("app/(console)/layout.tsx"), /getEntryDeploymentBoundary/);
  assert.match(read("components/layout/Shell.tsx"), /PREVIEW · READ ONLY/);
});
