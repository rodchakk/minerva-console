import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("middleware keeps activation mediation public and Console routes private", () => {
  const source = read("lib/supabase/middleware.ts");
  const publicRouteBlock = source.slice(
    source.indexOf("const isPublicRoute"),
    source.indexOf("if (!user && !isPublicRoute)"),
  );

  assert.match(publicRouteBlock, /pathname === "\/activate"/);
  assert.match(publicRouteBlock, /pathname\.startsWith\("\/activate\/"\)/);
  assert.match(read("app/activate/validate/route.ts"), /export async function POST/);
  assert.match(read("app/activate/complete/route.ts"), /export async function POST/);

  assert.doesNotMatch(publicRouteBlock, /\/products\/entry/);
  assert.doesNotMatch(publicRouteBlock, /\/dashboard/);
});

test("middleware preserves public registration boundary and headers", () => {
  const source = read("lib/supabase/middleware.ts");
  const publicRegistrationBlock = source.slice(
    source.indexOf("const isPublicRegistrationRoute"),
    source.indexOf("if (isPublicRegistrationRoute)"),
  );

  assert.match(publicRegistrationBlock, /pathname === "\/entry\/register"/);
  assert.match(publicRegistrationBlock, /pathname\.startsWith\("\/entry\/register\/"\)/);
  assert.match(source, /protectPublicRegistrationResponse\(NextResponse\.next\(\{ request \}\)\)/);
  assert.match(source, /Cache-Control", "no-store, max-age=0"/);
  assert.match(source, /X-Robots-Tag", "noindex, nofollow"/);
});
