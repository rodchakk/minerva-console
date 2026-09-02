import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  validateConfiguredHttpUrl,
  validateNativeModulePath,
} from "../features/control-center/connectionSafety.ts";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

test("connection Server Action requires Console authorization first", () => {
  const source = read("features/control-center/actions.ts");
  const authIndex = source.indexOf("await requireSuperadmin()");
  const firstFormReadIndex = source.indexOf('getString(formData, "connectionMode")');

  assert.ok(authIndex >= 0, "action must call requireSuperadmin");
  assert.ok(firstFormReadIndex >= 0, "test must find first form read");
  assert.ok(
    authIndex < firstFormReadIndex,
    "authorization must happen before processing user-provided values",
  );
});

test("connection Server Action performs no live outbound request or writes", () => {
  const source = read("features/control-center/actions.ts");

  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /method: "POST"|\.insert\(|\.upsert\(|\.update\(/);
  assert.doesNotMatch(source, /features\/brain/);
});

test("native module configuration validates without network access", () => {
  const result = validateNativeModulePath("/products/entry");

  assert.equal(result.ok, true);
});

test("native module configuration requires an internal products route", () => {
  for (const value of [
    "https://product.example.com",
    "//product.example.com",
    "/dashboard",
    "/products\\entry",
  ]) {
    const result = validateNativeModulePath(value);

    assert.equal(result.ok, false, `${value} should be rejected`);
  }
});

test("link-only configuration validates public http or https URL structure without network access", () => {
  for (const value of [
    "https://product.example.com/admin",
    "http://product.example.com/admin",
  ]) {
    const result = validateConfiguredHttpUrl(value, {
      fieldLabel: "Admin/module URL",
    });

    assert.equal(result.ok, true, `${value} should be accepted`);
  }
});

test("Overview API configuration accepts valid public HTTPS-style configuration", () => {
  const result = validateConfiguredHttpUrl(
    "https://product.example.com/api/minerva/overview",
    {
      fieldLabel: "Overview endpoint",
      productionRequiresHttps: true,
    },
  );

  assert.equal(result.ok, true);
});

test("production Overview API rejects HTTP", () => {
  const result = validateConfiguredHttpUrl(
    "http://product.example.com/api/minerva/overview",
    {
      fieldLabel: "Overview endpoint",
      productionRequiresHttps: true,
    },
  );

  assert.equal(result.ok, false);
  assert.match(result.detail, /must use https/);
});

test("configured URLs reject embedded credentials", () => {
  const result = validateConfiguredHttpUrl(
    "https://user:password@product.example.com/api/minerva/overview",
    {
      fieldLabel: "Overview endpoint",
    },
  );

  assert.equal(result.ok, false);
  assert.match(result.detail, /must not include username or password/);
});

test("localhost and private literal hosts remain rejected", () => {
  for (const value of [
    "https://localhost/api/minerva/overview",
    "https://127.0.0.1/api/minerva/overview",
    "https://10.0.0.4/api/minerva/overview",
    "https://172.20.10.4/api/minerva/overview",
    "https://192.168.1.8/api/minerva/overview",
    "https://[::1]/api/minerva/overview",
    "https://[fc00::1]/api/minerva/overview",
    "https://[fe80::1]/api/minerva/overview",
  ]) {
    const result = validateConfiguredHttpUrl(value, {
      fieldLabel: "Overview endpoint",
    });

    assert.equal(result.ok, false, `${value} should be rejected`);
  }
});
