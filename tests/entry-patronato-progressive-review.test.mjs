import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Patronato backend supports progressive open-campaign approval and privacy-minimized reads", () => {
  const migration = read(
    "supabase/migrations/20260922064500_entry_patronato_progressive_review.sql",
  );

  assert.match(
    migration,
    /v_campaign\.status not in \('open', 'review'\)/,
  );
  assert.match(migration, /_cr_bind_operational_house_v1/);
  assert.match(migration, /confirm_community_registration_units_v2/);
  assert.match(migration, /patronato_hold/);
  assert.match(
    migration,
    /list_community_registration_patronato_units_v1/,
  );
  assert.doesNotMatch(
    migration.match(
      /create or replace function public\.list_community_registration_patronato_units_v1[\s\S]*?\$function\$;/,
    )?.[0] ?? "",
    /'email'|'phone'/,
  );
  assert.match(migration, /revoke execute[\s\S]*from public, anon, authenticated/);
});

test("public Patronato page is mobile-first, token mediated, and preview read-only", () => {
  const page = read("app/(public)/entry/patronato/[token]/page.tsx");
  const mobile = read(
    "features/entry/communityRegistration/patronato/PatronatoReviewMobile.tsx",
  );
  const actions = read(
    "features/entry/communityRegistration/patronato/actions.ts",
  );

  assert.match(page, /hashPatronatoReviewToken/);
  assert.match(page, /getEntryDeploymentBoundary/);
  assert.match(mobile, /Revisión del Patronato/);
  assert.match(mobile, /Habitantes de la unidad/);
  assert.match(mobile, /Aprobar/);
  assert.match(mobile, /En espera/);
  assert.match(actions, /getEntryPreviewReadOnlyError/);
});

test("Console can generate a secure Patronato link and batch hand off approved units", () => {
  const admin = read(
    "features/entry/communityRegistration/patronato/adminActions.ts",
  );
  const bulk = read(
    "features/entry/communityRegistration/review/bulkActions.ts",
  );

  assert.match(admin, /create_community_registration_patronato_access_v1/);
  assert.match(admin, /PATRONATO_LINK_DAYS = 30/);
  assert.match(bulk, /mark_community_registration_unit_reviewed_v1/);
  assert.match(bulk, /convert_community_registration_unit_to_activation_v1/);
  assert.doesNotMatch(
    bulk.match(
      /prepareApprovedRegistrationUnitsForActivation[\s\S]*$/,
    )?.[0] ?? "",
    /record_community_registration_unit_external_approval_v1/,
  );
});


test("Patronato review bypasses Console session auth but remains no-store", () => {
  const middleware = read("lib/supabase/middleware.ts");

  assert.match(middleware, /pathname === "\/entry\/patronato"/);
  assert.match(middleware, /pathname\.startsWith\("\/entry\/patronato\/"\)/);
  assert.match(middleware, /protectPublicRegistrationResponse/);
});
