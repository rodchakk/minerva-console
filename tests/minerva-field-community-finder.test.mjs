import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  filterFieldCommunities,
} from "../features/entry/field/communitySearch.ts";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const fieldEntryFiles = [
  "app/(field)/field/entry/page.tsx",
  "app/(field)/field/entry/communities/[communityId]/page.tsx",
  "features/entry/field/CommunityFinder.tsx",
  "features/entry/field/communitySearch.ts",
  "features/entry/field/formatting.ts",
];

test("/field/entry uses the authorized community list query and removes foundation scaffolding", () => {
  const page = read("app/(field)/field/entry/page.tsx");

  assert.match(page, /listCommunitiesWithProgress/);
  assert.match(page, /CommunityFinder/);
  assert.doesNotMatch(page, /Surface|Mode|Product \/ ENTRY|Field foundation/);
});

test("Field community finder search matches community name and city", () => {
  const communities = [
    {
      activationPendingCount: 0,
      city: "Tegucigalpa",
      completedTasks: 3,
      href: "/field/entry/communities/alpha",
      id: "alpha",
      isActive: true,
      name: "Residencial Aurora",
      nextStepLabel: "Complete setup",
      setupLabel: "Complete",
      statusLabel: "Active",
      totalMembers: 42,
      totalTasks: 3,
      totalUnits: 12,
    },
    {
      activationPendingCount: 2,
      city: "San Pedro Sula",
      completedTasks: 2,
      href: "/field/entry/communities/beta",
      id: "beta",
      isActive: true,
      name: "Las Palmas",
      nextStepLabel: "Review activation queue",
      setupLabel: "Activation review",
      statusLabel: "Setup",
      totalMembers: 8,
      totalTasks: 3,
      totalUnits: 5,
    },
  ];

  assert.deepEqual(
    filterFieldCommunities(communities, "aurora").map((item) => item.id),
    ["alpha"],
  );
  assert.deepEqual(
    filterFieldCommunities(communities, "pedro").map((item) => item.id),
    ["beta"],
  );
  assert.deepEqual(
    filterFieldCommunities(communities, "").map((item) => item.id),
    ["alpha", "beta"],
  );
});

test("community finder cards link only to Field community routes", () => {
  const page = read("app/(field)/field/entry/page.tsx");
  const finder = read("features/entry/field/CommunityFinder.tsx");

  assert.match(page, /\/field\/entry\/communities\/\$\{encodeURIComponent\(community\.id\)\}/);
  assert.doesNotMatch(page, /\/products\/entry/);
  assert.doesNotMatch(finder, /\/products\/entry/);
});

test("Field community detail uses existing authorized server queries", () => {
  const detail = read("app/(field)/field/entry/communities/[communityId]/page.tsx");

  assert.match(detail, /getCommunityWithProgress/);
  assert.match(detail, /getCommunityOnboardingDetail/);
  assert.match(detail, /getCommunityDetailPreviews/);
  assert.match(detail, /allowMessages: false/);
  assert.match(detail, /notFound\(\)/);
});

test("Field overview renders aggregate counts without personal data fields", () => {
  for (const file of fieldEntryFiles) {
    const source = read(file);

    assert.doesNotMatch(source, /email|phone|username|fullName|ownerName|houseLabel|contact/i, file);
    assert.doesNotMatch(source, /previews\.users\.items|\.map\(\(user|users\.items/i, file);
  }
});

test("Field overview does not silently turn unavailable aggregate counts into zero", () => {
  const detail = read("app/(field)/field/entry/communities/[communityId]/page.tsx");

  assert.match(detail, /state === "unavailable"/);
  assert.match(detail, /value: "Unavailable"/);
  assert.match(detail, /Preview unavailable/);
});

test("Field community pages stay read-only and do not link to desktop management", () => {
  const forbiddenPatterns =
    /createCommunity|addCommunity|createGuard|promoteResident|completeCommunity|replaceCommunity|recoverCommunity|signOutAction|form action|\/products\/entry|activation\?|registration campaign|qr|settings mutation/i;

  for (const file of fieldEntryFiles) {
    assert.doesNotMatch(read(file), forbiddenPatterns, file);
  }
});

test("ENTRY bottom navigation remains active for nested Field routes", () => {
  const nav = read("components/field/FieldNav.tsx");

  assert.match(nav, /pathname\.startsWith\(`\$\{href\}\/`\)/);
  assert.match(nav, /href: "\/field\/entry"/);
});
