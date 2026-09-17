import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

// Always creates its own disposable container; never accepts a remote DB URL.
const container = `minerva-resident-invite-test-${process.pid}`;
const image = "public.ecr.aws/supabase/postgres:17.6.1.095";
const community = "11111111-1111-1111-1111-111111111111";
const house = "33333333-3333-3333-3333-333333333333";

function docker(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

async function sql(query, allowFailure = false) {
  const result = await docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      "invitation_test",
      "-XAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "VERBOSITY=verbose",
    ],
    query,
  );
  if (!allowFailure) assert.equal(result.code, 0, result.stderr);
  return result;
}

function prepare(email, name = "Concurrent Resident") {
  return `select public.prepare_resident_activation_invite_v1('${community}','${house}','${name}','${email}');`;
}

try {
  const started = await docker([
    "run",
    "--rm",
    "-d",
    "--name",
    container,
    "-e",
    "POSTGRES_PASSWORD=disposable-test-only",
    image,
  ]);
  assert.equal(started.code, 0, started.stderr);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (
      (
        await docker([
          "exec",
          container,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
        ])
      ).code === 0
    ) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "disposable Postgres became ready");
  const created = await docker([
    "exec",
    container,
    "createdb",
    "-h",
    "127.0.0.1",
    "-U",
    "postgres",
    "invitation_test",
  ]);
  assert.equal(created.code, 0, created.stderr);
  for (const file of [
    "supabase/tests/fixtures/resident-activation-schema.sql",
    "supabase/tests/fixtures/resident-activation-importers.sql",
    "supabase/migrations/20260917050344_resident_activation_email_invitation.sql",
    "supabase/tests/resident-activation-email-invitation.sql",
  ])
    await sql(readFileSync(file, "utf8"));
  console.log(
    "PASS: SQL validation, house boundaries, status reuse, Auth conflict, grants, auditing, both bulk writers",
  );

  const pair = await Promise.all([
    sql(
      `set test.superadmin='true'; begin; ${prepare("concurrent@example.com")} select pg_sleep(0.4); commit;`,
    ),
    sql(`set test.superadmin='true'; ${prepare("concurrent@example.com")}`),
  ]);
  const results = pair.map((result) =>
    JSON.parse(result.stdout.split("\n").find((line) => line.startsWith("{"))),
  );
  assert.equal(results[0].queue_id, results[1].queue_id);
  assert.equal(results.filter((result) => result.created).length, 1);
  assert.equal(
    (
      await sql(
        "select count(*) from public.resident_activation_queue where email='concurrent@example.com';",
      )
    ).stdout.trim(),
    "1",
  );
  console.log(
    "PASS: two concurrent preparation calls return one queue_id; exactly one creates the row",
  );

  const bulkRow = (name, email) =>
    JSON.stringify([{ unit_label: "10", resident_name: name, email }]);
  const writers = [
    `select public.confirm_resident_bulk_import_v1('${community}','${bulkRow("Bulk Race One", "bulk-race@example.com")}',false);`,
    `select public.create_resident_activation_queue_bulk_v1('${community}','${bulkRow("Bulk Race Two", "bulk-race@example.com")}');`,
  ];
  const bulkResults = await Promise.all(
    writers.map((query) =>
      sql(
        `set test.superadmin='true'; begin; ${query} select pg_sleep(0.4); commit;`,
        true,
      ),
    ),
  );
  assert.equal(bulkResults.filter((result) => result.code === 0).length, 1);
  assert.match(
    bulkResults.find((result) => result.code !== 0).stderr,
    /23505[\s\S]*ux_raq_live_email_identity/,
  );
  assert.equal(
    (
      await sql(
        "select count(*) from public.resident_activation_queue where email='bulk-race@example.com';",
      )
    ).stdout.trim(),
    "1",
  );
  console.log(
    "PASS: concurrent canonical/legacy bulk writers yield one live row and canonical 23505 conflict",
  );

  const mixed = await Promise.all([
    sql(
      `set test.superadmin='true'; begin; ${prepare("mixed-race@example.com", "Mixed Race")} select pg_sleep(0.4); commit;`,
      true,
    ),
    sql(
      `set test.superadmin='true'; begin; select public.confirm_resident_bulk_import_v1('${community}','${bulkRow("Mixed Race", "mixed-race@example.com")}',false); select pg_sleep(0.4); commit;`,
      true,
    ),
  ]);
  assert.ok(mixed.some((result) => result.code === 0));
  assert.equal(
    (
      await sql(
        "select count(*) from public.resident_activation_queue where email='mixed-race@example.com';",
      )
    ).stdout.trim(),
    "1",
  );
  for (const result of mixed.filter((candidate) => candidate.code !== 0))
    assert.match(result.stderr, /23505/);
  console.log(
    "PASS: concurrent single/bulk preparation cannot create duplicate live invitations",
  );
} finally {
  await docker(["rm", "-f", container]);
}
