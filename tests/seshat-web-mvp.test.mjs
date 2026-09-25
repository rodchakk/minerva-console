import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("Seshat uses a dedicated public Supabase browser configuration", () => {
  const source = read("features/seshat/supabase.ts");

  assert.match(source, /NEXT_PUBLIC_SESHAT_SUPABASE_URL/);
  assert.match(source, /NEXT_PUBLIC_SESHAT_SUPABASE_ANON_KEY/);
  assert.match(source, /storageKey:\s*"minerva-console-seshat-auth"/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE|service_role/i);
  assert.doesNotMatch(source, /@\/lib\/supabase\/client|@\/lib\/supabase\/server/);
});

test("Seshat financial writes go through the existing database RPCs", () => {
  const source = read("features/seshat/financialEngine.ts");

  assert.match(source, /\.rpc\("generate_invoice"/);
  assert.match(source, /\.rpc\("record_payment"/);
  assert.match(source, /\.rpc\("get_due_client_service_occurrences"/);
  assert.match(source, /\.rpc\("run_client_service_billing"/);
  assert.doesNotMatch(source, /\.from\("invoice_items"\)\.insert/);
  assert.doesNotMatch(source, /\.from\("payments"\)\.insert/);
});

test("primary Seshat web routes exist", () => {
  for (const route of [
    "app/(console)/seshat/page.tsx",
    "app/(console)/seshat/clients/page.tsx",
    "app/(console)/seshat/clients/new/page.tsx",
    "app/(console)/seshat/services/page.tsx",
    "app/(console)/seshat/expenses/page.tsx",
    "app/(console)/seshat/invoices/page.tsx",
    "app/(console)/seshat/invoices/new/page.tsx",
    "app/(console)/seshat/billing/page.tsx",
    "app/(console)/seshat/settings/page.tsx",
  ]) {
    assert.equal(existsSync(join(root, route)), true, `${route} should exist`);
  }
});

test("Control Center opens Seshat at the native route", () => {
  const source = read("features/control-center/productRegistry.ts");

  assert.match(source, /id:\s*"seshat"/);
  assert.match(source, /href:\s*"\/seshat"/);
  assert.match(source, /adminUrl:\s*"\/seshat"/);
  assert.doesNotMatch(source, /Route", value: "Reserved"/);
});
