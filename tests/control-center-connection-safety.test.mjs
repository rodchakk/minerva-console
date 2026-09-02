import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  isPublicIpAddress,
  validateOutboundHttpUrl,
} from "../features/control-center/connectionSafety.ts";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function publicResolver() {
  return Promise.resolve([{ address: "93.184.216.34" }]);
}

function privateResolver() {
  return Promise.resolve([{ address: "10.1.2.3" }]);
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

test("connection Server Action rejects redirects instead of following them", () => {
  const source = read("features/control-center/actions.ts");

  assert.match(source, /redirect: "manual"/);
  assert.match(source, /response\.status >= 300 && response\.status < 400/);
});

test("localhost and private IPv4 destinations are rejected", async () => {
  for (const value of [
    "https://localhost/api/minerva/overview",
    "https://127.0.0.1/api/minerva/overview",
    "https://10.0.0.4/api/minerva/overview",
    "https://172.20.10.4/api/minerva/overview",
    "https://192.168.1.8/api/minerva/overview",
  ]) {
    const result = await validateOutboundHttpUrl(value, {
      fieldLabel: "Overview endpoint",
    });

    assert.equal(result.ok, false, `${value} should be rejected`);
  }
});

test("link-local, CGNAT, and reserved IPv4 destinations are rejected", async () => {
  for (const value of [
    "https://169.254.1.8/api/minerva/overview",
    "https://100.64.0.8/api/minerva/overview",
    "https://192.0.2.10/api/minerva/overview",
    "https://198.51.100.10/api/minerva/overview",
    "https://203.0.113.10/api/minerva/overview",
    "https://224.0.0.1/api/minerva/overview",
  ]) {
    const result = await validateOutboundHttpUrl(value, {
      fieldLabel: "Overview endpoint",
    });

    assert.equal(result.ok, false, `${value} should be rejected`);
  }
});

test("private, link-local, loopback, and documentation IPv6 destinations are rejected", async () => {
  for (const value of [
    "https://[::1]/api/minerva/overview",
    "https://[::]/api/minerva/overview",
    "https://[fc00::1]/api/minerva/overview",
    "https://[fd12:3456::1]/api/minerva/overview",
    "https://[fe80::1]/api/minerva/overview",
    "https://[2001:db8::1]/api/minerva/overview",
    "https://[ff02::1]/api/minerva/overview",
  ]) {
    const result = await validateOutboundHttpUrl(value, {
      fieldLabel: "Overview endpoint",
    });

    assert.equal(result.ok, false, `${value} should be rejected`);
  }
});

test("hostname resolution cannot silently permit a private resolved target", async () => {
  const result = await validateOutboundHttpUrl(
    "https://public-looking.example/api/minerva/overview",
    {
      fieldLabel: "Overview endpoint",
      resolveHost: privateResolver,
    },
  );

  assert.equal(result.ok, false);
  assert.match(result.detail, /non-public network address/);
});

test("normal public HTTPS endpoint configuration remains supported", async () => {
  const result = await validateOutboundHttpUrl(
    "https://product.example.com/api/minerva/overview",
    {
      fieldLabel: "Overview endpoint",
      productionRequiresHttps: true,
      resolveHost: publicResolver,
    },
  );

  assert.equal(result.ok, true);
});

test("production Overview API endpoints prefer HTTPS", async () => {
  const result = await validateOutboundHttpUrl(
    "http://product.example.com/api/minerva/overview",
    {
      fieldLabel: "Overview endpoint",
      productionRequiresHttps: true,
      resolveHost: publicResolver,
    },
  );

  assert.equal(result.ok, false);
  assert.match(result.detail, /must use https/);
});

test("IP classifier allows public IPv4 and IPv6 addresses", () => {
  assert.equal(isPublicIpAddress("93.184.216.34"), true);
  assert.equal(isPublicIpAddress("2606:2800:220:1:248:1893:25c8:1946"), true);
});
