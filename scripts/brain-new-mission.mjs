#!/usr/bin/env node
// scripts/brain-new-mission.mjs
//
// Create a new Brain mission Markdown file and registry entry.
//
// Pure Node.js (ESM), zero dependencies.
// Usage:
//   node scripts/brain-new-mission.mjs --id MCB-0008 --title "Brain Relationship Map" --summary "Add relation views for Brain knowledge."

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { basename, join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const MISSIONS_DIR = join(ROOT, "content", "brain", "missions");
const REGISTRY_PATH = join(
  ROOT,
  "content",
  "brain",
  "registries",
  "missions.json",
);

function parseArgs(argv) {
  const args = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--") && next) {
      args[arg.slice(2)] = next;
      i++;
    } else {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage: node scripts/brain-new-mission.mjs [options]

Required:
  --id      <MCB-id>   Mission id, e.g. MCB-0008
  --title   <string>   Mission title
  --summary <string>   Short registry summary

Optional:
  --agent  <string>    Agent or operator label
  --phase  <string>    Mission phase, default: planning
  --branch <string>    Git branch
  --pr     <string>    PR number or label if known
  --commit <string>    Commit hash if known
  --tags   <list>      Comma-separated tags

Example:
  node scripts/brain-new-mission.mjs --id MCB-0008 --title "Brain Relationship Map" --summary "Add relation views for Brain knowledge." --agent codex --phase planning --tags "brain,missions,planning"
`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTag(tag) {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeFilename(id) {
  const filename = id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!filename) {
    throw new Error("Mission id cannot produce a safe filename");
  }

  return `${filename}.md`;
}

function readRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("content/brain/registries/missions.json must be an array");
  }
  return parsed;
}

function buildMarkdown({
  id,
  title,
  summary,
  agent,
  phase,
  branch,
  pr,
  commit,
  timestamp,
}) {
  return `# ${id} — ${title}

## Status

Planned.

## Summary

${summary}

## Scope

- Define the scope before implementation starts.

## Branch / PR / Commit

- Branch: ${branch || "unavailable until created."}
- PR: ${pr || "unavailable until opened."}
- Commit: ${commit || "unavailable until committed."}

## Files / Areas

- TBD

## Validation

- TBD

## Outcome

Pending.

## Next Steps

- Create the branch.
- Execute the mission.
- Open a PR and run checks.
- Merge, then update this mission to completed.

## Metadata

- Agent: ${agent || "unassigned"}
- Phase: ${phase}
- Created: ${timestamp}
`;
}

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

for (const required of ["id", "title", "summary"]) {
  if (!args[required]) {
    fail(`--${required} is required`);
  }
}

if (!/^MCB-[A-Z0-9.-]+$/.test(args.id)) {
  fail(
    "--id must start with MCB- and contain only uppercase letters, numbers, dots, or hyphens",
  );
}

let registry;
try {
  registry = readRegistry();
} catch (error) {
  fail(error.message);
}

if (registry.some((entry) => entry.id === args.id)) {
  fail(`Mission registry already contains ${args.id}`);
}

let filename;
try {
  filename = safeFilename(args.id);
} catch (error) {
  fail(error.message);
}

const filepath = join(MISSIONS_DIR, filename);
const relPath = `content/brain/missions/${filename}`;

if (existsSync(filepath)) {
  fail(`Mission file already exists: ${relPath}`);
}

// `created`/`updated` are date-only ISO strings (YYYY-MM-DD) to match the
// type contract, the conventions doc, and every other Brain script.
const date = new Date().toISOString().slice(0, 10);
const tags = [
  ...new Set(splitList(args.tags).map(normalizeTag).filter(Boolean)),
];
const phase = args.phase || "planning";

const entry = {
  id: args.id,
  title: args.title,
  type: "mission",
  status: "planned",
  summary: args.summary,
  created: date,
  updated: date,
  tags,
  related: [],
  path: relPath,
  agent: args.agent || "",
  branch: args.branch || "",
  pr: args.pr || "",
  commit: args.commit || "",
  phase,
};

const markdown = buildMarkdown({
  id: args.id,
  title: args.title,
  summary: args.summary,
  agent: entry.agent,
  phase,
  branch: entry.branch,
  pr: entry.pr,
  commit: entry.commit,
  timestamp: date,
});

mkdirSync(MISSIONS_DIR, { recursive: true });
writeFileSync(filepath, markdown, "utf8");
writeFileSync(
  REGISTRY_PATH,
  `${JSON.stringify([...registry, entry], null, 2)}\n`,
  "utf8",
);

console.log(`Created mission: ${relPath}`);
console.log(`Updated registry: ${relative(ROOT, REGISTRY_PATH)}`);
console.log(`ID: ${args.id}`);
console.log(`File: ${basename(filepath)}`);
