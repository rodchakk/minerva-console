import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function filesUnder(path) {
  const absolutePath = join(root, path);
  return readdirSync(absolutePath).flatMap((entry) => {
    const child = join(path, entry);
    const childAbsolutePath = join(root, child);

    if (statSync(childAbsolutePath).isDirectory()) {
      return filesUnder(child);
    }

    return child;
  });
}

test("Field uses its own route group and superadmin guard", () => {
  const layout = read("app/(field)/field/layout.tsx");
  const shell = read("components/field/FieldShell.tsx");

  assert.match(layout, /requireSuperadmin/);
  assert.match(layout, /getEntryDeploymentBoundary/);
  assert.match(layout, /FieldShell/);
  assert.match(layout, /manifest: "\/field\/manifest\.webmanifest"/);
  assert.match(layout, /statusBarStyle: "black"/);
  assert.doesNotMatch(layout, /black-translucent/);
  assert.match(shell, /ENTRY_PREVIEW_READ_ONLY_MESSAGE/);
  assert.doesNotMatch(layout, /components\/layout\/Shell/);
  assert.doesNotMatch(layout, /Topbar|AppSidebar/);
});

test("Field exposes ENTRY as the only visible product module", () => {
  const modules = read("features/field/modules.ts");
  const moduleData = modules.slice(modules.indexOf("export const FIELD_MODULES"));
  const appFiles = filesUnder("app/(field)/field")
    .concat(filesUnder("components/field"))
    .concat(["features/field/modules.ts"]);

  assert.match(modules, /id: "entry"/);
  assert.match(modules, /href: "\/field\/entry"/);
  assert.equal((moduleData.match(/id: "/g) ?? []).length, 1);

  for (const file of appFiles) {
    assert.doesNotMatch(read(file), /Seshat/i, `${file} must not mention Seshat`);
    assert.doesNotMatch(read(file), /components\/layout\/Shell/);
    assert.doesNotMatch(read(file), /AppSidebar|Topbar/);
  }
});

test("Field manifest is scoped to Field and public through proxy matcher", () => {
  const manifestRoute = read("app/(field)/field/manifest.webmanifest/route.ts");
  const proxy = read("proxy.ts");

  assert.match(manifestRoute, /name: "Minerva Field"/);
  assert.match(manifestRoute, /id: "\/field"/);
  assert.match(manifestRoute, /start_url: "\/field"/);
  assert.match(manifestRoute, /scope: "\/field"/);
  assert.match(manifestRoute, /display: "standalone"/);
  assert.match(manifestRoute, /minerva-field-192\.png/);
  assert.match(manifestRoute, /minerva-field-512\.png/);
  assert.match(proxy, /webmanifest/);
});

test("Field account keeps logout inside the Field surface", () => {
  const account = read("app/(field)/field/account/page.tsx");

  assert.match(account, /signOutAction/);
  assert.match(account, /requireSuperadmin/);
});

test("Field login-return limitation is documented for 001C", () => {
  const recon = read("content/brain/projects/minerva-field-technical-recon.md");

  assert.match(recon, /Known limitation after MINERVA-FIELD-001B/);
  assert.match(recon, /`\/dashboard` instead of the original `\/field` destination/);
  assert.match(recon, /deferred to MINERVA-FIELD-001C/);
});
