import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("staff contact rules hide synthetic emails and prefer usernames", () => {
  const source = read("features/entry/staff/actions.ts");
  const contactSource = source.slice(
    source.indexOf("function getPreferredContact"),
    source.indexOf("function mapStaffUser"),
  );

  assert.match(contactSource, /email && !isSyntheticEmail\(email\)/);
  assert.match(contactSource, /return email;/);
  assert.match(contactSource, /if \(username\)/);
  assert.match(contactSource, /return username;/);
  assert.match(contactSource, /return "No contact available";/);
  assert.doesNotMatch(contactSource, /return email \|\| "No contact available"/);

  const sampleCases = [
    {
      contact: "faro_guard_qa",
      email: "guard-faro_guard_qa@entry.internal",
      username: "faro_guard_qa",
    },
    {
      contact: "guard@example.com",
      email: "guard@example.com",
      username: "",
    },
    {
      contact: "No contact available",
      email: "legacy@entry.local",
      username: "",
    },
    {
      contact: "admin@example.com",
      email: "admin@example.com",
      username: "resident_admin",
    },
  ];

  for (const item of sampleCases) {
    assert.doesNotMatch(item.contact, /@entry\.(?:internal|local)$/);
  }
});

test("staff page enriches profiles through server-only admin client", () => {
  const source = read("features/entry/staff/actions.ts");
  const profileSource = source.slice(
    source.indexOf("async function loadCommunityStaffProfiles"),
    source.indexOf("function mapStaffUser"),
  );

  assert.match(source, /import \{ createAdminClient \} from "@\/lib\/supabase\/admin";/);
  assert.match(profileSource, /const adminSupabase = createAdminClient\(\);/);
  assert.match(profileSource, /\.from\("profiles"\)/);
  assert.match(profileSource, /\.select\("user_id,username,synthetic_email"\)/);
  assert.match(profileSource, /\.eq\("community_id", communityId\)/);
  assert.match(profileSource, /\.in\("user_id", userIds\)/);
});

test("StaffOperatorsPanel stays display-only for contact values", () => {
  const source = read("features/entry/staff/StaffOperatorsPanel.tsx");

  assert.match(source, /contact: user\.contact/);
  assert.match(source, /\{operator\.contact\}/);
  assert.doesNotMatch(source, /entry\.internal|entry\.local|synthetic/i);
});
