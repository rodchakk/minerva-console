#!/usr/bin/env node
// scripts/brain-check-relations.mjs
//
// Check all `related` references across Brain registries and report broken
// relations (IDs that do not exist in any registry).
//
// Pure Node.js (ESM), zero dependencies. Read-only — never modifies files.
// Run: node scripts/brain-check-relations.mjs
//
// Exit codes:
//   0  no broken relations
//   1  one or more broken relations, or a registry could not be read

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const REGISTRY_DIR = join(ROOT, "content", "brain", "registries");

// ─── ANSI colours ────────────────────────────────────────────────────────────
const RED = "\x1b[31m";
const GRN = "\x1b[32m";
const BOLD = "\x1b[1m";
const RST = "\x1b[0m";

function die(message) {
  console.error(`${RED}Error:${RST} ${message}`);
  process.exit(1);
}

if (!existsSync(REGISTRY_DIR)) {
  die("content/brain/registries/ directory does not exist");
}

const jsonFiles = readdirSync(REGISTRY_DIR).filter((f) => f.endsWith(".json"));

// Build the ID index and the list of all relation references.
const knownIds = new Set();
const references = []; // { sourceId, kind, sourceTitle, relatedId }

for (const filename of jsonFiles) {
  const filepath = join(REGISTRY_DIR, filename);
  // kind is the filename without extension (projects, decisions, ...).
  const kind = filename.replace(/\.json$/, "");

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(filepath, "utf8"));
  } catch (e) {
    die(`Invalid JSON in content/brain/registries/${filename}: ${e.message}`);
  }

  if (!Array.isArray(parsed)) {
    die(`content/brain/registries/${filename} must be a JSON array`);
  }

  for (const entry of parsed) {
    if (entry && typeof entry.id === "string") {
      knownIds.add(entry.id);
    }
  }

  // Second pass collects references (needs the entry shape only).
  for (const entry of parsed) {
    if (!entry || typeof entry.id !== "string") continue;
    const related = Array.isArray(entry.related) ? entry.related : [];
    for (const relatedId of related) {
      references.push({
        sourceId: entry.id,
        kind,
        sourceTitle: typeof entry.title === "string" ? entry.title : "",
        relatedId,
      });
    }
  }
}

// Detect broken references — related IDs absent from every registry.
const broken = references.filter((ref) => !knownIds.has(ref.relatedId));

console.log(
  `\n${BOLD}Brain relation check${RST} — ${jsonFiles.length} registry file(s), ${knownIds.size} entry ID(s), ${references.length} relation reference(s)\n`,
);

if (broken.length === 0) {
  console.log(`${GRN}${BOLD}No broken relations.${RST}\n`);
  process.exit(0);
}

console.log(`${RED}${BOLD}Broken relations (${broken.length}):${RST}`);
for (const ref of broken) {
  console.log(
    `  ${RED}✖${RST}  ${ref.sourceId} (${ref.kind}) references missing ID: ${ref.relatedId}`,
  );
}
console.log();
console.error(`${RED}${BOLD}Brain relation check FAILED.${RST}\n`);
process.exit(1);
