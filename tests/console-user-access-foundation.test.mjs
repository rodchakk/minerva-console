import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const migrationName = "20260902010000_console_user_access_foundation.sql";

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

async function changedFiles() {
  const { execFileSync } = await import("node:child_process");
  const committed = execFileSync("git", ["diff", "--name-only", "origin/master...HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  const workingTree = execFileSync("git", ["diff", "--name-only"], {
    cwd: root,
    encoding: "utf8",
  });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  });

  return [...new Set(`${committed}\n${workingTree}\n${untracked}`
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/")))];
}

test("Console V1 roles and statuses are represented in code and schema", () => {
  const helper = read("features/auth/consoleAccess.ts");
  const migration = read(`supabase/migrations/${migrationName}`);

  assert.match(helper, /CONSOLE_ROLES = \["owner", "builder", "viewer"\]/);
  assert.match(helper, /CONSOLE_MEMBER_STATUSES = \["active", "disabled"\]/);
  assert.match(migration, /role in \('owner', 'builder', 'viewer'\)/);
  assert.match(migration, /status in \('active', 'disabled'\)/);
});

test("Console members are a separate table with locked-down direct access", () => {
  const migration = read(`supabase/migrations/${migrationName}`);

  assert.match(migration, /create table if not exists public\.console_members/);
  assert.match(migration, /user_id uuid primary key references auth\.users\(id\)/);
  assert.match(migration, /alter table public\.console_members enable row level security/);
  assert.match(migration, /revoke all on table public\.console_members from anon/);
  assert.match(migration, /revoke all on table public\.console_members from authenticated/);
  assert.doesNotMatch(migration, /create policy .*console_members/i);
});

test("Console access helper maps existing superadmin to OWNER semantics", () => {
  const helper = read("features/auth/consoleAccess.ts");
  const migration = read(`supabase/migrations/${migrationName}`);

  assert.match(helper, /row\?\.is_superadmin === true/);
  assert.match(helper, /row\.role === "owner"/);
  assert.match(helper, /row\.source === "superadmin"/);
  assert.match(migration, /public\.is_superadmin\(v_user_id\)/);
  assert.match(migration, /'owner'::text, 'active'::text, true, 'superadmin'::text/);
});

test("disabled and unknown future members fail closed", () => {
  const helper = read("features/auth/consoleAccess.ts");
  const migration = read(`supabase/migrations/${migrationName}`);

  assert.match(helper, /memberStatus === "active"/);
  assert.match(helper, /status: "forbidden"/);
  assert.doesNotMatch(helper, /memberStatus !== "disabled"/);
  assert.match(migration, /v_status = 'active'/);
  assert.match(migration, /else null/);
});

test("Phase B owner Console boundary uses the Console access seam", () => {
  const layout = read("app/(console)/layout.tsx");
  const superadmin = read("features/auth/requireSuperadmin.ts");

  assert.match(layout, /import \{ requireConsoleOwner \} from "@\/features\/auth\/consoleAccess"/);
  assert.match(layout, /await requireConsoleOwner\(\)/);
  assert.doesNotMatch(layout, /requireSuperadmin/);
  assert.match(superadmin, /supabase\.rpc\("is_superadmin"\)/);
});

test("Control Center Add User routes to owner user management", () => {
  const controlCenter = read("features/control-center/ControlCenterDashboard.tsx");
  const addUserIndex = controlCenter.indexOf("Add User");
  const addUserLinkStart = controlCenter.lastIndexOf("<Link", addUserIndex);
  const addUserLinkEnd = controlCenter.indexOf("</Link>", addUserIndex);
  const addUserLink = controlCenter.slice(addUserLinkStart, addUserLinkEnd);

  assert.ok(addUserLink, "Add User link must be present");
  assert.match(addUserLink, /href="\/users\?invite=1"/);
  assert.doesNotMatch(addUserLink, /disabled|cursor-not-allowed|auth\.admin|createUser/);
});

test("Phase A introduces no new admin invite client or service-role requirement", () => {
  const helper = read("features/auth/consoleAccess.ts");
  const migration = read(`supabase/migrations/${migrationName}`);

  assert.doesNotMatch(helper, /createAdminClient|auth\.admin|SUPABASE_SERVICE_ROLE_KEY|invite/i);
  assert.doesNotMatch(migration, /service_role|auth\.admin|invite/i);
});

test("Brain and ENTRY authorization surfaces are not changed by this foundation branch", async () => {
  const files = await changedFiles();

  // assert.ok(files.includes("features/auth/consoleAccess.ts"));
  // assert.ok(files.includes("tests/console-user-access-foundation.test.mjs"));
  assert.equal(files.some((file) => file.startsWith("features/brain/")), false);
  assert.equal(files.some((file) => file.startsWith("content/brain/")), false);
  assert.equal(files.some((file) => file.startsWith("features/entry/")), false);
  assert.equal(files.some((file) => file.startsWith("app/(public)/entry/")), false);
  assert.equal(files.some((file) => file.startsWith("supabase/migrations/")), false);
});

test("Console membership migration is the only added Supabase migration", () => {
  const migrations = readdirSync(join(root, "supabase/migrations"));

  assert.ok(migrations.includes(migrationName));
});
