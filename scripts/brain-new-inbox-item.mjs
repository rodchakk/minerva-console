#!/usr/bin/env node
// scripts/brain-new-inbox-item.mjs
//
// Create a new Brain inbox Markdown item from the CLI.
//
// Pure Node.js (ESM), zero dependencies.
// Usage: node scripts/brain-new-inbox-item.mjs --title "My item" --source claude-code --topic "architecture"

import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const INBOX_DIR = join(ROOT, "content", "brain", "inbox");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--title" && argv[i + 1]) {
      args.title = argv[++i];
    } else if (argv[i] === "--source" && argv[i + 1]) {
      args.source = argv[++i];
    } else if (argv[i] === "--topic" && argv[i + 1]) {
      args.topic = argv[++i];
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage: node scripts/brain-new-inbox-item.mjs [options]

Options:
  --title  <string>   Title for the inbox item (required)
  --source <string>   Source: claude-code | gpt | codex | gemini | human | other
                      (default: human)
  --topic  <string>   Topic tag (optional)
  --help, -h          Show this help message

Example:
  node scripts/brain-new-inbox-item.mjs --title "Evaluate caching strategy" --source claude-code --topic "architecture"

After creating the file, manually add a matching entry to:
  content/brain/registries/inbox.json
`);
}

const args = parseArgs(process.argv);

if (args.help) {
  printHelp();
  process.exit(0);
}

if (!args.title) {
  console.error("Error: --title is required.\n");
  printHelp();
  process.exit(1);
}

const VALID_SOURCES = [
  "claude-code",
  "gpt",
  "codex",
  "gemini",
  "human",
  "other",
];
const source = args.source || "human";
if (!VALID_SOURCES.includes(source)) {
  console.error(
    `Error: --source must be one of: ${VALID_SOURCES.join(", ")}`,
  );
  process.exit(1);
}

const now = new Date();
const dateStr = now.toISOString().slice(0, 10);
const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
const slug = args.title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 60);

const filename = `${timestamp}_${slug}.md`;
const filepath = join(INBOX_DIR, filename);

const topic = args.topic || "unclassified";

const content = `# ${args.title}

> **This is a raw, unprocessed item.** Inbox content is not Brain knowledge.
> It must be triaged and promoted to a typed artifact under
> \`content/brain/{decisions,prompts,projects,agents,docs}/\` by a human
> before it becomes authoritative.

## Metadata

- **Source:** \`${source}\`
- **Topic:** ${topic}
- **Captured:** ${dateStr}
- **Status:** \`inbox\`

## Raw content

(Paste the raw content here.)

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

if (!existsSync(INBOX_DIR)) {
  mkdirSync(INBOX_DIR, { recursive: true });
}

writeFileSync(filepath, content, "utf8");

const relPath = `content/brain/inbox/${filename}`;

console.log(`\nCreated inbox item: ${relPath}`);
console.log(`\nNext steps:`);
console.log(
  `  1. Edit the file and paste the raw content under "## Raw content"`,
);
console.log(
  `  2. Add a matching entry to content/brain/registries/inbox.json:`,
);
console.log(`
  {
    "id": "INB-XXXX",
    "type": "inbox",
    "status": "inbox",
    "source": "${source}",
    "title": "${args.title}",
    "summary": "",
    "created": "${dateStr}",
    "updated": "${dateStr}",
    "tags": [${args.topic ? `"${topic}"` : ""}],
    "related": [],
    "path": "${relPath}"
  }
`);
console.log(`  3. Commit and push.\n`);
