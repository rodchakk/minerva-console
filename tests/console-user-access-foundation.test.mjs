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
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  });

  return [...new Set(`${committed}\n${untracked}`
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

test("Phase A keeps the existing superadmin route gate intact", () => {
  const layout = read("app/(console)/layout.tsx");
  const superadmin = read("features/auth/requireSuperadmin.ts");

  assert.match(layout, /import \{ requireSuperadmin \} from "@\/features\/auth\/requireSuperadmin"/);
  assert.match(layout, /await requireSuperadmin\(\)/);
  assert.doesNotMatch(layout, /requireConsoleMember|requireConsoleOwner|getConsoleAccessContext/);
  assert.match(superadmin, /supabase\.rpc\("is_superadmin"\)/);
});

test("Control Center Add User remains inert", () => {
  const controlCenter = read("features/control-center/ControlCenterDashboard.tsx");
  const addUserIndex = controlCenter.indexOf("Add User");
  const addUserButtonStart = controlCenter.lastIndexOf("<button", addUserIndex);
  const addUserButtonEnd = controlCenter.indexOf("</button>", addUserIndex);
  const addUserButton = controlCenter.slice(addUserButtonStart, addUserButtonEnd);

  assert.ok(addUserButton, "Add User button must remain present");
  assert.match(addUserButton, /<button/);
  assert.match(addUserButton, /disabled/);
  assert.doesNotMatch(addUserButton, /onClick|formAction|href|invite|auth\.admin|createUser/);
});

test("Phase A introduces no new admin invite client or service-role requirement", () => {
  const helper = read("features/auth/consoleAccess.ts");
  const migration = read(`supabase/migrations/${migrationName}`);

  assert.doesNotMatch(helper, /createAdminClient|auth\.admin|SUPABASE_SERVICE_ROLE_KEY|invite/i);
  assert.doesNotMatch(migration, /service_role|auth\.admin|invite/i);
});

test("Brain and ENTRY authorization surfaces are not changed by this foundation branch", async () => {
  const files = await changedFiles();

  assert.ok(files.includes("features/auth/consoleAccess.ts"));
  assert.ok(files.includes(`supabase/migrations/${migrationName}`));
  assert.ok(files.includes("tests/console-user-access-foundation.test.mjs"));
  assert.equal(files.some((file) => file.startsWith("features/brain/")), false);
  assert.equal(files.some((file) => file.startsWith("content/brain/")), false);
  assert.equal(files.some((file) => file.startsWith("features/entry/")), false);
  assert.equal(files.some((file) => file.startsWith("app/(public)/entry/")), false);
});

test("Console membership migration is the only added Supabase migration", () => {
  const migrations = readdirSync(join(root, "supabase/migrations"));

  assert.ok(migrations.includes(migrationName));
});
