#!/usr/bin/env node
// scripts/brain-capture.mjs
//
// Capture raw output into Brain's Git-backed inbox and update inbox.json.
//
// Pure Node.js (ESM), zero dependencies.
// Usage:
//   node scripts/brain-capture.mjs --title "Run notes" --source codex --file ./notes.md --tag mcb-0004
//   node scripts/brain-capture.mjs --title "Paste" --source gpt --text "Raw output..."
//   Get-Content output.md -Raw | node scripts/brain-capture.mjs --title "Output" --source claude-code --stdin

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { basename, join, relative, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const INBOX_DIR = join(ROOT, "content", "brain", "inbox");
const REGISTRY_PATH = join(ROOT, "content", "brain", "registries", "inbox.json");

const VALID_SOURCES = [
  "claude-code",
  "gpt",
  "codex",
  "gemini",
  "human",
  "other",
];

function parseArgs(argv) {
  const args = {
    related: [],
    tags: [],
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--stdin") {
      args.stdin = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--title" && next) {
      args.title = next;
      i++;
    } else if (arg === "--source" && next) {
      args.source = next;
      i++;
    } else if (arg === "--summary" && next) {
      args.summary = next;
      i++;
    } else if (arg === "--file" && next) {
      args.file = next;
      i++;
    } else if (arg === "--text" && next) {
      args.text = next;
      i++;
    } else if (arg === "--topic" && next) {
      args.tags.push(next);
      i++;
    } else if (arg === "--tag" && next) {
      args.tags.push(next);
      i++;
    } else if (arg === "--related" && next) {
      args.related.push(next);
      i++;
    } else if (arg === "--id" && next) {
      args.id = next;
      i++;
    } else {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage: node scripts/brain-capture.mjs [options]

Required:
  --title  <string>   Title for the inbox item
  --source <string>   claude-code | gpt | codex | gemini | human | other

Raw content, choose exactly one:
  --file   <path>     Read raw output from a file
  --text   <string>   Capture the provided string
  --stdin             Read raw output from standard input

Optional:
  --summary <string>  Registry summary. Defaults to the first raw-content line.
  --topic   <string>  Topic tag. Alias for --tag.
  --tag     <string>  Tag. Repeat or comma-separate values.
  --related <ids>     Related IDs. Repeat or comma-separate values.
  --id      <INB-id>  Override the generated INB-#### ID.
  --dry-run           Print the planned file and registry entry without writing.
  --help, -h          Show this help message.

Examples:
  node scripts/brain-capture.mjs --title "MCB-0004 notes" --source codex --file ./raw-output.md --tag mcb-0004
  Get-Content raw.md -Raw | node scripts/brain-capture.mjs --title "Claude review" --source claude-code --stdin --topic architecture
`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function splitList(values) {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeTag(tag) {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugify(title) {
  const slug = normalizeTag(title).slice(0, 72);
  return slug || "untitled";
}

function readRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("content/brain/registries/inbox.json must be an array");
  }
  return parsed;
}

function nextInboxId(entries) {
  const max = entries.reduce((highest, entry) => {
    const match = typeof entry.id === "string" ? entry.id.match(/^INB-(\d+)$/) : null;
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `INB-${String(max + 1).padStart(4, "0")}`;
}

function readRawContent(args) {
  const methods = [args.file, args.text, args.stdin].filter(Boolean);
  if (methods.length !== 1) {
    throw new Error("Choose exactly one raw content option: --file, --text, or --stdin");
  }

  if (args.file) {
    const inputPath = resolve(ROOT, args.file);
    if (!existsSync(inputPath)) {
      throw new Error(`Raw content file does not exist: ${args.file}`);
    }
    return readFileSync(inputPath, "utf8");
  }

  if (typeof args.text === "string") {
    return args.text;
  }

  return readFileSync(0, "utf8");
}

function firstLineSummary(rawContent, source) {
  const firstLine = rawContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return `Raw ${source} capture awaiting triage.`;
  }

  return firstLine.length > 240 ? `${firstLine.slice(0, 237)}...` : firstLine;
}

function markdownList(values) {
  if (values.length === 0) {
    return "(none)";
  }
  return values.map((value) => `\`${value}\``).join(", ");
}

function buildMarkdown({ id, title, source, tags, related, date, rawContent }) {
  const raw = rawContent.endsWith("\n") ? rawContent : `${rawContent}\n`;

  return `# ${title}

> **This is a raw, unprocessed item.** Inbox content is not Brain knowledge.
> It must be triaged and promoted to a typed artifact under
> \`content/brain/{decisions,prompts,projects,agents,docs}/\` by a human
> before it becomes authoritative.

## Metadata

- **ID:** \`${id}\`
- **Source:** \`${source}\`
- **Tags:** ${markdownList(tags)}
- **Related:** ${markdownList(related)}
- **Captured:** ${date}
- **Status:** \`inbox\`

## Raw content

${raw}
## Triage notes

- Worth keeping? yes / no
- If yes, promote to: decision / prompt / project / agent / doc
- Target file:
- Reviewer:

## Promotion record

- Promoted to:
- Registry entry:
- Date:
- Inbox status updated to: \`promoted\` / \`archived\`
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

if (!args.title) {
  fail("--title is required");
}

if (!args.source) {
  fail("--source is required");
}

if (!VALID_SOURCES.includes(args.source)) {
  fail(`--source must be one of: ${VALID_SOURCES.join(", ")}`);
}

let rawContent;
let registry;
try {
  rawContent = readRawContent(args);
  registry = readRegistry();
} catch (error) {
  fail(error.message);
}

if (rawContent.length === 0) {
  fail("Raw content is empty");
}

const date = new Date().toISOString().slice(0, 10);
const id = args.id || nextInboxId(registry);

if (!/^INB-[A-Z0-9-]+$/.test(id)) {
  fail("--id must start with INB- and contain only uppercase letters, numbers, and hyphens");
}

if (registry.some((entry) => entry.id === id)) {
  fail(`Inbox registry already contains ${id}`);
}

const tags = [...new Set(splitList(args.tags).map(normalizeTag).filter(Boolean))];
const related = [...new Set(splitList(args.related))];
const filename = `${id.toLowerCase()}-${slugify(args.title)}.md`;
const filepath = join(INBOX_DIR, filename);
const relPath = `content/brain/inbox/${filename}`;

if (existsSync(filepath)) {
  fail(`Inbox file already exists: ${relPath}`);
}

const summary = args.summary || firstLineSummary(rawContent, args.source);
const entry = {
  id,
  type: "inbox",
  status: "inbox",
  source: args.source,
  title: args.title,
  summary,
  created: date,
  updated: date,
  tags,
  related,
  path: relPath,
};

const markdown = buildMarkdown({
  id,
  title: args.title,
  source: args.source,
  tags,
  related,
  date,
  rawContent,
});

if (args.dryRun) {
  console.log("Dry run: no files written.");
  console.log(`Inbox file: ${relPath}`);
  console.log("Registry entry:");
  console.log(JSON.stringify(entry, null, 2));
  process.exit(0);
}

mkdirSync(INBOX_DIR, { recursive: true });
writeFileSync(filepath, markdown, "utf8");
writeFileSync(REGISTRY_PATH, `${JSON.stringify([...registry, entry], null, 2)}\n`, "utf8");

console.log(`Captured inbox item: ${relPath}`);
console.log(`Updated registry: ${relative(ROOT, REGISTRY_PATH)}`);
console.log(`ID: ${id}`);
console.log(`Source: ${args.source}`);
console.log(`File: ${basename(filepath)}`);
