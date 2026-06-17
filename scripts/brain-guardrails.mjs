#!/usr/bin/env node
// scripts/brain-guardrails.mjs
//
// Brain v0 boundary enforcement.
//
// Pure Node.js (ESM), zero dependencies.
// Run: node scripts/brain-guardrails.mjs
//
// Checks:
//   1. Brain code must not import features/entry.
//   2. Brain code must not use Supabase.
//   3. Brain code must not reference Neon/database clients.
//   4. Brain registry JSON must be valid and complete.
//   5. Required Brain files must exist.
//
// Scans TypeScript/TSX source files in:
//   features/brain/
//   app/(console)/brain/
// and Brain CLI scripts in:
//   scripts/brain-*.mjs
//
// Markdown docs (.md) are intentionally excluded to avoid false positives
// from documentation that discusses the rules themselves.

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, extname, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

// ─── ANSI colours ────────────────────────────────────────────────────────────
const RED = "\x1b[31m";
const GRN = "\x1b[32m";
const YLW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RST = "\x1b[0m";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively collect all files with the given extensions under a directory. */
function collectFiles(dir, extensions = [".ts", ".tsx"]) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, extensions));
    } else if (extensions.includes(extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

/** Collect Brain-owned CLI scripts. */
function collectBrainScripts() {
  const dir = join(ROOT, "scripts");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => /^brain-.*\.mjs$/.test(entry.name))
    .filter((entry) => entry.name !== "brain-guardrails.mjs")
    .map((entry) => join(dir, entry.name));
}

/** Return only lines that are actual import/require statements (not comments). */
function importLines(src) {
  return src
    .split("\n")
    .map((line, i) => ({ line: line.trimStart(), num: i + 1 }))
    .filter(({ line }) => {
      // Skip single-line comments
      if (line.startsWith("//")) return false;
      // Skip JSDoc / block comment lines
      if (line.startsWith("*")) return false;
      // Only keep lines that look like import/require
      return (
        line.startsWith("import ") ||
        line.startsWith("require(") ||
        line.includes("from \"") ||
        line.includes("from '")
      );
    });
}

/** Check whether the raw source (comments inclusive) contains a pattern —
 *  used for env-var patterns that could appear anywhere, not just imports. */
function anyLine(src, patterns) {
  return src
    .split("\n")
    .map((line, i) => ({ line: line.trimStart(), num: i + 1 }))
    .filter(({ line }) => {
      // Skip comment lines
      if (line.startsWith("//")) return false;
      if (line.startsWith("*")) return false;
      if (line.startsWith("/*")) return false;
      return patterns.some((p) =>
        typeof p === "string" ? line.includes(p) : p.test(line),
      );
    });
}

// ─── Collect Brain source files ───────────────────────────────────────────────
const brainDirs = [
  join(ROOT, "features", "brain"),
  join(ROOT, "app", "(console)", "brain"),
];

const brainFiles = brainDirs.flatMap((d) => collectFiles(d));
const brainScriptFiles = collectBrainScripts();
const brainSourceFiles = [...brainFiles, ...brainScriptFiles];

// ─── Results accumulator ─────────────────────────────────────────────────────
const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function rel(p) {
  return relative(ROOT, p);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 1 — Brain must not import features/entry
// ─────────────────────────────────────────────────────────────────────────────

const ENTRY_PATTERNS = [
  "features/entry",
  "@/features/entry",
];

for (const file of brainSourceFiles) {
  const src = readFileSync(file, "utf8");
  for (const { line, num } of importLines(src)) {
    if (ENTRY_PATTERNS.some((p) => line.includes(p))) {
      fail(
        `[CHECK 1] Forbidden import in ${rel(file)}:${num}\n` +
          `  ${line}\n` +
          `  Brain code must not import from features/entry/**`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 2 — Brain must not use Supabase
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_IMPORT_PATTERNS = [
  "@supabase/",
  "lib/supabase",
  "@/lib/supabase",
];

const SUPABASE_ENV_PATTERNS = [
  "NEXT_PUBLIC_SUPABASE",
  "SUPABASE_SERVICE",
  "SUPABASE_URL",
  "SUPABASE_ANON",
];

for (const file of brainSourceFiles) {
  const src = readFileSync(file, "utf8");

  // Import-only check for library refs
  for (const { line, num } of importLines(src)) {
    if (SUPABASE_IMPORT_PATTERNS.some((p) => line.includes(p))) {
      fail(
        `[CHECK 2] Supabase import in ${rel(file)}:${num}\n` +
          `  ${line}\n` +
          `  Brain code must not import Supabase clients`,
      );
    }
  }

  // Any-line check for env var references
  for (const { line, num } of anyLine(src, SUPABASE_ENV_PATTERNS)) {
    fail(
      `[CHECK 2] Supabase env reference in ${rel(file)}:${num}\n` +
        `  ${line}\n` +
        `  Brain code must not reference Supabase environment variables`,
    );
  }

  // Any-line check for createClient (excluding type-only usage)
  for (const { line, num } of anyLine(src, ["createClient("])) {
    fail(
      `[CHECK 2] Supabase createClient() call in ${rel(file)}:${num}\n` +
        `  ${line}\n` +
        `  Brain code must not call createClient()`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 3 — Brain must not reference Neon / database clients
// ─────────────────────────────────────────────────────────────────────────────

const NEON_IMPORT_PATTERNS = [
  "@neondatabase/",
  "drizzle-orm",
  "drizzle-kit",
  "@prisma/",
  "prisma/client",
  "pgvector",
];

const NEON_ENV_PATTERNS = [
  "DATABASE_URL",
  "DIRECT_DATABASE_URL",
  "NEON_",
  "PGHOST",
  "PGPASSWORD",
  "PGDATABASE",
];

for (const file of brainSourceFiles) {
  const src = readFileSync(file, "utf8");

  for (const { line, num } of importLines(src)) {
    if (NEON_IMPORT_PATTERNS.some((p) => line.includes(p))) {
      fail(
        `[CHECK 3] Database client import in ${rel(file)}:${num}\n` +
          `  ${line}\n` +
          `  Neon/database clients are reserved for v1`,
      );
    }
  }

  for (const { line, num } of anyLine(src, NEON_ENV_PATTERNS)) {
    fail(
      `[CHECK 3] Database env reference in ${rel(file)}:${num}\n` +
        `  ${line}\n` +
        `  DATABASE_URL / Neon env vars must not appear in Brain v0 code`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 4 — Brain registry JSON must be valid and complete
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = [
  "id",
  "title",
  "type",
  "status",
  "summary",
  "created",
  "updated",
  "tags",
  "related",
];

const INBOX_STATUSES = ["inbox", "promoted", "archived"];
const INBOX_SOURCES = [
  "claude-code",
  "gpt",
  "codex",
  "gemini",
  "human",
  "other",
];

function validateInboxEntry(entry, entryLabel, relPath) {
  if (typeof entry.id !== "string" || !entry.id.startsWith("INB-")) {
    fail(`[CHECK 4] ${relPath} - ${entryLabel}.id must start with INB-`);
  }
  if (entry.type !== "inbox") {
    fail(`[CHECK 4] ${relPath} - ${entryLabel}.type must be "inbox"`);
  }
  if (!INBOX_STATUSES.includes(entry.status)) {
    fail(
      `[CHECK 4] ${relPath} - ${entryLabel}.status must be one of: ${INBOX_STATUSES.join(", ")}`,
    );
  }
  if (!INBOX_SOURCES.includes(entry.source)) {
    fail(
      `[CHECK 4] ${relPath} - ${entryLabel}.source must be one of: ${INBOX_SOURCES.join(", ")}`,
    );
  }
  if (typeof entry.path !== "string") {
    fail(`[CHECK 4] ${relPath} - ${entryLabel} is missing required field: "path"`);
  } else if (!entry.path.startsWith("content/brain/inbox/")) {
    fail(`[CHECK 4] ${relPath} - ${entryLabel}.path must stay under content/brain/inbox/`);
  } else if (!entry.path.endsWith(".md")) {
    fail(`[CHECK 4] ${relPath} - ${entryLabel}.path must point to a Markdown file`);
  } else if (!existsSync(join(ROOT, entry.path))) {
    fail(`[CHECK 4] ${relPath} - ${entryLabel}.path does not exist: ${entry.path}`);
  }
}

const REGISTRY_DIR = join(ROOT, "content", "brain", "registries");

if (!existsSync(REGISTRY_DIR)) {
  fail("[CHECK 4] content/brain/registries/ directory does not exist");
} else {
  const jsonFiles = readdirSync(REGISTRY_DIR).filter((f) =>
    f.endsWith(".json"),
  );

  if (jsonFiles.length === 0) {
    warn("[CHECK 4] No JSON files found in content/brain/registries/");
  }

  for (const filename of jsonFiles) {
    const filepath = join(REGISTRY_DIR, filename);
    const relPath = `content/brain/registries/${filename}`;
    let parsed;

    // Parse
    try {
      parsed = JSON.parse(readFileSync(filepath, "utf8"));
    } catch (e) {
      fail(`[CHECK 4] Invalid JSON in ${relPath}: ${e.message}`);
      continue;
    }

    // Must be an array
    if (!Array.isArray(parsed)) {
      fail(
        `[CHECK 4] ${relPath} must be a JSON array, got ${typeof parsed}`,
      );
      continue;
    }

    // Each entry must have required fields
    parsed.forEach((entry, idx) => {
      const entryLabel = entry.id ?? `entry[${idx}]`;
      for (const field of REQUIRED_FIELDS) {
        if (!(field in entry)) {
          fail(
            `[CHECK 4] ${relPath} — ${entryLabel} is missing required field: "${field}"`,
          );
        }
      }
      if ("tags" in entry && !Array.isArray(entry.tags)) {
        fail(
          `[CHECK 4] ${relPath} — ${entryLabel}.tags must be an array`,
        );
      }
      if ("related" in entry && !Array.isArray(entry.related)) {
        fail(
          `[CHECK 4] ${relPath} — ${entryLabel}.related must be an array`,
        );
      }
      if (filename === "inbox.json") {
        validateInboxEntry(entry, entryLabel, relPath);
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 5 — Required Brain files must exist
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_FILES = [
  "content/brain/harness/00_PROJECT_CHARTER.md",
  "content/brain/harness/01_CURRENT_STATE.md",
  "content/brain/harness/02_ARCHITECTURE.md",
  "content/brain/harness/03_DECISIONS.md",
  "content/brain/harness/04_WORKFLOW.md",
  "content/brain/harness/05_AGENT_RULES.md",
  "content/brain/harness/06_PROMPT_LIBRARY.md",
  "content/brain/harness/07_BACKLOG.md",
  "content/brain/harness/08_CHANGELOG.md",
  "content/brain/harness/09_RISKS.md",
  "content/brain/harness/10_HANDOFF_TEMPLATE.md",
  "content/brain/templates/mission-handoff.md",
  "scripts/brain-capture.mjs",
  "scripts/brain-promote.mjs",
  "features/brain/lib/content.ts",
  "features/brain/lib/markdown.ts",
  "features/brain/lib/types.ts",
  "features/brain/lib/search.ts",
  "app/(console)/brain/page.tsx",
];

for (const relPath of REQUIRED_FILES) {
  const full = join(ROOT, relPath);
  if (!existsSync(full)) {
    fail(`[CHECK 5] Required Brain file is missing: ${relPath}`);
  } else {
    const s = statSync(full);
    if (s.size === 0) {
      warn(`[CHECK 5] Required Brain file is empty: ${relPath}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

const totalFiles = brainSourceFiles.length;
const registryFiles = existsSync(REGISTRY_DIR)
  ? readdirSync(REGISTRY_DIR).filter((f) => f.endsWith(".json")).length
  : 0;

console.log(
  `\n${BOLD}Brain guardrails${RST} — ${totalFiles} source file(s) scanned, ${registryFiles} registry file(s) validated, ${REQUIRED_FILES.length} required file(s) checked\n`,
);

if (warnings.length > 0) {
  console.log(`${YLW}${BOLD}Warnings (${warnings.length}):${RST}`);
  for (const w of warnings) {
    console.log(`  ${YLW}⚠${RST}  ${w}`);
  }
  console.log();
}

if (errors.length > 0) {
  console.log(`${RED}${BOLD}Failures (${errors.length}):${RST}`);
  for (const e of errors) {
    console.log(`  ${RED}✖${RST}  ${e}`);
  }
  console.log();
  console.error(`${RED}${BOLD}Brain guardrails FAILED.${RST}\n`);
  process.exit(1);
} else {
  console.log(`${GRN}${BOLD}Brain guardrails passed.${RST}\n`);
}
