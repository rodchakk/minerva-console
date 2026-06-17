#!/usr/bin/env node
// scripts/brain-promote.mjs
//
// Promote an existing Brain inbox item into approved Brain knowledge.
//
// Pure Node.js (ESM), zero dependencies.
// Usage:
//   node scripts/brain-promote.mjs --inbox-id INB-0001 --target decisions --id DEC-0005 --title "Title" --summary "Summary" --tags "brain,v0" --yes
//   node scripts/brain-promote.mjs --inbox-id INB-0001 --target prompts --id MCB-0010 --title "Title" --summary "Summary" --tags "mission" --yes --force

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const BRAIN_DIR = join(ROOT, "content", "brain");
const REGISTRY_DIR = join(BRAIN_DIR, "registries");
const INBOX_REGISTRY_PATH = join(REGISTRY_DIR, "inbox.json");

const VALID_TARGETS = ["decisions", "prompts", "projects", "agents"];

const TARGET_TO_TYPE = {
  decisions: "decision",
  prompts: "prompt",
  projects: "project",
  agents: "agent",
};

// ─── Argument parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--yes") {
      args.yes = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--inbox-id" && next) {
      args.inboxId = next;
      i++;
    } else if (arg === "--target" && next) {
      args.target = next;
      i++;
    } else if (arg === "--id" && next) {
      args.id = next;
      i++;
    } else if (arg === "--title" && next) {
      args.title = next;
      i++;
    } else if (arg === "--summary" && next) {
      args.summary = next;
      i++;
    } else if (arg === "--tags" && next) {
      args.tags = next;
      i++;
    } else {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage: node scripts/brain-promote.mjs [options]

Required:
  --inbox-id <string>   ID of the inbox item to promote (e.g. INB-0001)
  --target   <string>   Target registry: decisions | prompts | projects | agents
  --id       <string>   ID for the promoted entry (e.g. DEC-0005)
  --title    <string>   Title for the promoted entry
  --summary  <string>   Summary for the promoted entry
  --tags     <string>   Comma-separated tags (e.g. "brain,architecture,v0")
  --yes                 Confirm promotion (required)

Optional:
  --force               Overwrite if target id or file already exists
  --dry-run             Print planned changes without writing
  --help, -h            Show this help message

Examples:
  node scripts/brain-promote.mjs \\
    --inbox-id INB-0001 \\
    --target decisions \\
    --id DEC-0005 \\
    --title "Brain remains Git-backed in v0" \\
    --summary "Decision approved from inbox review." \\
    --tags "brain,architecture,v0" \\
    --yes
`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeTag(tag) {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitTags(tagString) {
  return tagString
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map(normalizeTag)
    .filter(Boolean);
}

function slugify(id) {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeFilename(id) {
  const slug = slugify(id);
  if (!slug) fail("Could not create a safe filename from the provided id");
  return `${slug}.md`;
}

function readJsonRegistry(path) {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Registry must be a JSON array: ${relative(ROOT, path)}`);
  }
  return parsed;
}

function writeJsonRegistry(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function validatePathInside(filePath, baseDir) {
  const resolved = resolve(filePath);
  const resolvedBase = resolve(baseDir);
  if (!resolved.startsWith(resolvedBase)) {
    fail(`Path escapes content/brain/: ${filePath}`);
  }
}

// ─── Build promoted Markdown ─────────────────────────────────────────────────

function buildPromotedMarkdown({
  title,
  inboxId,
  target,
  timestamp,
  summary,
  inboxPath,
  inboxSource,
  inboxTopic,
  rawContent,
}) {
  const sourceLines = [];
  sourceLines.push(`* Inbox ID: \`${inboxId}\``);
  sourceLines.push(`* Source path: \`${inboxPath}\``);
  if (inboxSource) sourceLines.push(`* Source: \`${inboxSource}\``);
  if (inboxTopic) sourceLines.push(`* Topic: \`${inboxTopic}\``);

  return `# ${title}

> Promoted from: ${inboxId}
> Target: ${target}
> Promoted: ${timestamp}
> Status: approved

## Summary

${summary}

## Approved Knowledge

TODO: Human should refine this section after promotion.

## Source Inbox Item

${sourceLines.join("\n")}

## Original Raw Material

${rawContent}
`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

let args;
try {
  args = parseArgs(process.argv);
} catch (error) {
  fail(error.message);
}

if (args.help) {
  printHelp();
  process.exit(0);
}

// Validate required args
if (!args.inboxId) fail("--inbox-id is required");
if (!args.target) fail("--target is required");
if (!args.id) fail("--id is required");
if (!args.title) fail("--title is required");
if (!args.summary) fail("--summary is required");
if (!args.tags) fail("--tags is required");
if (!args.yes) fail("--yes is required to confirm promotion");

if (!VALID_TARGETS.includes(args.target)) {
  fail(`--target must be one of: ${VALID_TARGETS.join(", ")}`);
}

// Read inbox registry
let inboxRegistry;
try {
  inboxRegistry = readJsonRegistry(INBOX_REGISTRY_PATH);
} catch (error) {
  fail(`Failed to read inbox registry: ${error.message}`);
}

// Find the inbox item
const inboxItem = inboxRegistry.find((entry) => entry.id === args.inboxId);
if (!inboxItem) {
  fail(`Inbox item not found: ${args.inboxId}`);
}

// Validate inbox Markdown path
if (!inboxItem.path) {
  fail(`Inbox item ${args.inboxId} has no path`);
}

const inboxMarkdownPath = join(ROOT, inboxItem.path);
validatePathInside(inboxMarkdownPath, BRAIN_DIR);

if (!existsSync(inboxMarkdownPath)) {
  fail(`Inbox Markdown file does not exist: ${inboxItem.path}`);
}

// Read inbox Markdown content
const rawContent = readFileSync(inboxMarkdownPath, "utf8");

// Read target registry
const targetRegistryPath = join(REGISTRY_DIR, `${args.target}.json`);
let targetRegistry;
try {
  targetRegistry = readJsonRegistry(targetRegistryPath);
} catch (error) {
  fail(`Failed to read target registry: ${error.message}`);
}

// Check for duplicate target id
if (targetRegistry.some((entry) => entry.id === args.id)) {
  if (!args.force) {
    fail(`Target registry already contains ${args.id}. Use --force to overwrite.`);
  }
  targetRegistry = targetRegistry.filter((entry) => entry.id !== args.id);
}

// Build target Markdown path
const targetDir = join(BRAIN_DIR, args.target);
const targetFilename = safeFilename(args.id);
const targetFilePath = join(targetDir, targetFilename);
const targetRelPath = `content/brain/${args.target}/${targetFilename}`;

validatePathInside(targetFilePath, BRAIN_DIR);

// Check for duplicate file
if (existsSync(targetFilePath)) {
  if (!args.force) {
    fail(`Target Markdown file already exists: ${targetRelPath}. Use --force to overwrite.`);
  }
}

// Build everything
const timestamp = new Date().toISOString();
const date = timestamp.slice(0, 10);
const tags = [...new Set(splitTags(args.tags))];

const promotedMarkdown = buildPromotedMarkdown({
  title: args.title,
  inboxId: args.inboxId,
  target: args.target,
  timestamp,
  summary: args.summary,
  inboxPath: inboxItem.path,
  inboxSource: inboxItem.source || null,
  inboxTopic: inboxItem.tags?.find(Boolean) || null,
  rawContent,
});

const targetEntry = {
  id: args.id,
  type: TARGET_TO_TYPE[args.target],
  status: "approved",
  title: args.title,
  summary: args.summary,
  created: date,
  updated: date,
  tags,
  related: [args.inboxId],
  path: targetRelPath,
};

// Update inbox item
const inboxIdx = inboxRegistry.findIndex((entry) => entry.id === args.inboxId);
inboxRegistry[inboxIdx] = {
  ...inboxRegistry[inboxIdx],
  status: "promoted",
  updated: date,
  related: [...new Set([...(inboxRegistry[inboxIdx].related || []), args.id])],
};

// Dry run
if (args.dryRun) {
  console.log("Dry run: no files written.\n");
  console.log(`Promoted target: ${args.target} → ${args.id}`);
  console.log(`Would create: ${targetRelPath}`);
  console.log(`Would update: content/brain/registries/${args.target}.json`);
  console.log(`Would update: content/brain/registries/inbox.json`);
  console.log("\nTarget registry entry:");
  console.log(JSON.stringify(targetEntry, null, 2));
  console.log("\nUpdated inbox entry:");
  console.log(JSON.stringify(inboxRegistry[inboxIdx], null, 2));
  process.exit(0);
}

// Write files
mkdirSync(targetDir, { recursive: true });
writeFileSync(targetFilePath, promotedMarkdown, "utf8");
writeJsonRegistry(targetRegistryPath, [...targetRegistry, targetEntry]);
writeJsonRegistry(INBOX_REGISTRY_PATH, inboxRegistry);

// Print summary
console.log(`\nPromotion complete.\n`);
console.log(`  Promoted target:  ${args.target} → ${args.id}`);
console.log(`  Created Markdown: ${targetRelPath}`);
console.log(`  Updated registry: content/brain/registries/${args.target}.json`);
console.log(`  Updated inbox:    content/brain/registries/inbox.json`);
console.log(`  Inbox item:       ${args.inboxId} → status: promoted`);
console.log(`\nNext steps:`);
console.log(`  1. Review and refine ${targetRelPath}`);
console.log(`  2. Fill in the "Approved Knowledge" section with distilled content`);
console.log(`  3. Verify at /brain/${args.target}/${args.id} after build`);
console.log(`  4. Commit the changes to Git`);
