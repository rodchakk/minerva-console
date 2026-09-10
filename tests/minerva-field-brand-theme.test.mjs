import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("Minerva Field scopes the Minerva red identity without recoloring Console", () => {
  const globals = read("app/globals.css");
  const shell = read("components/field/FieldShell.tsx");

  assert.match(globals, /--console-accent:\s*#6d63ff/);
  assert.match(
    globals,
    /\.minerva-field-theme\s*\{[\s\S]*?--console-accent:\s*#ff4055/,
  );
  assert.match(globals, /--console-accent-subtle:\s*rgba\(255, 64, 85, 0\.12\)/);
  assert.match(globals, /--console-accent-border:\s*rgba\(255, 64, 85, 0\.32\)/);
  assert.match(shell, /className="minerva-field-theme /);
  assert.match(shell, /field-brand-badge/);
});

test("Field navigation and primary surfaces use the scoped accent consistently", () => {
  const nav = read("components/field/FieldNav.tsx");
  const home = read("app/(field)/field/page.tsx");
  const entry = read("app/(field)/field/entry/page.tsx");
  const account = read("app/(field)/field/account/page.tsx");

  assert.match(nav, /border-\[var\(--console-accent-border\)\]/);
  assert.match(nav, /text-\[var\(--console-accent\)\]/);
  assert.match(home, /text-\[var\(--console-accent\)\] opacity-70/);
  assert.match(entry, /const arrowClass[\s\S]*text-\[var\(--console-accent\)\]/);
  assert.match(account, /bg-\[var\(--console-accent-subtle\)\]/);
});

test("production Field branding does not add marketing slogans", () => {
  const surfaces = [
    read("components/field/FieldShell.tsx"),
    read("app/(field)/field/page.tsx"),
    read("app/(field)/field/entry/page.tsx"),
    read("app/(field)/field/account/page.tsx"),
  ]
    .join("\n")
    .toLowerCase();

  assert.doesNotMatch(surfaces, /people places safer together|brighter tomorrow/);
});
