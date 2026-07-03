#!/usr/bin/env node
// scripts/brain-export-context-packs.mjs
//
// Generate scoped, deterministic Minerva Core Brain context packs.
//
// Pure Node.js (ESM), zero dependencies. Reads only known files under
// content/brain/** plus the exporter script itself for mission handoff context.
// This is not RAG, embeddings, a database, an agent engine, or automation.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { extname, join, relative, sep } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const BRAIN_DIR = join(ROOT, "content", "brain");
const EXPORTS_DIR = join(BRAIN_DIR, "exports");
const PACKS_DIR = join(EXPORTS_DIR, "packs");
const PACK_GENERATOR = "scripts/brain-export-context-packs.mjs";
const LEGACY_EXPORTER = "scripts/brain-export-context.mjs";
const LOCAL_PACK_LIMIT = 25000;

const AUTHORITY =
  "Git/GitHub and the source files remain authority. This pack is a generated handoff artifact and may lag master.";

const DEFAULT_PACKS = [
  { type: "full", target: "all" },
  { type: "mission", id: "MCB-0020" },
  { type: "agent", role: "implementer" },
  { type: "project", id: "PRJ-0001" },
  { type: "review", id: "MCB-0020" },
  { type: "local", id: "MCB-0023" },
];

const PACK_TYPES = new Set(["full", "mission", "agent", "project", "review", "local"]);

function relPosix(absPath) {
  return relative(ROOT, absPath).split(sep).join("/");
}

function abs(relPath) {
  return join(ROOT, relPath);
}

function existsRel(relPath) {
  return existsSync(abs(relPath));
}

function readRel(relPath) {
  return readFileSync(abs(relPath), "utf8").trimEnd();
}

function uniqueSorted(paths) {
  return [...new Set(paths)].sort();
}

function readJson(relPath) {
  return JSON.parse(readFileSync(abs(relPath), "utf8"));
}

function registryEntry(registryRelPath, id) {
  if (!existsRel(registryRelPath)) return null;
  const entries = readJson(registryRelPath);
  if (!Array.isArray(entries)) return null;
  return entries.find((entry) => entry && entry.id === id) ?? null;
}

function collectFiles(dir, extensions) {
  const out = [];
  if (!existsSync(dir)) return out;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = relPosix(full);

    if (rel === "content/brain/exports/packs" || rel.startsWith("content/brain/exports/packs/")) {
      continue;
    }
    if (rel === "content/brain/exports/brain-context.md") {
      continue;
    }
    if (rel.startsWith("content/brain/exports/") && rel !== "content/brain/exports/README.md") {
      continue;
    }

    if (entry.isDirectory()) {
      out.push(...collectFiles(full, extensions));
    } else if (extensions.includes(extname(entry.name))) {
      out.push(rel);
    }
  }

  return out;
}

function markdownFilesUnder(relDir) {
  return collectFiles(abs(relDir), [".md"]);
}

function registryFiles() {
  return collectFiles(join(BRAIN_DIR, "registries"), [".json"]);
}

function matchingMissionDoc(id) {
  return `content/brain/missions/${id.toLowerCase()}.md`;
}

function existing(paths) {
  return paths.filter((relPath) => existsRel(relPath));
}

function entryKnowledgeFiles() {
  return existing([
    "content/brain/projects/entry.md",
    "content/brain/projects/entry-product-foundation.md",
    "content/brain/projects/entry-implementation-map.md",
    "content/brain/projects/entry-current-work.md",
    "content/brain/projects/entry-known-issues.md",
    "content/brain/projects/entry-voice-mvp.md",
    "content/brain/projects/entry-sales-and-leads.md",
    "content/brain/projects/entry-next-missions.md",
  ]);
}

function buildFullPack() {
  return {
    type: "full",
    target: "all",
    output: "content/brain/exports/packs/full.md",
    notes: [
      "Full pack mirrors the monolithic Brain context selection as scoped pack output.",
      "Generated exports are excluded to avoid recursive self-inclusion; exports/README.md is included when present.",
    ],
    sources: uniqueSorted([
      ...registryFiles(),
      ...markdownFilesUnder("content/brain"),
    ]),
  };
}

function buildMissionPack(id) {
  const mission = registryEntry("content/brain/registries/missions.json", id);
  const missionPath = mission?.path ?? matchingMissionDoc(id);

  return {
    type: "mission",
    target: id,
    output: `content/brain/exports/packs/mission-${id}.md`,
    notes: [
      "Mission pack is scoped for the assigned implementer role.",
      "Related reports and mission docs are included when they exist on disk.",
    ],
    sources: uniqueSorted(existing([
      "content/brain/harness/00_PROJECT_CHARTER.md",
      "content/brain/harness/04_WORKFLOW.md",
      "content/brain/harness/09_V0_FREEZE.md",
      "content/brain/loop/PROTOCOL.md",
      "content/brain/loop/ROLES.md",
      "content/brain/loop/contracts/README.md",
      "content/brain/loop/contracts/implementer.md",
      "content/brain/loop/runbooks/close-a-mission.md",
      "content/brain/loop/roadmaps/ROADMAP.md",
      "content/brain/registries/missions.json",
      missionPath,
      "content/brain/missions/mcb-0017.md",
      "content/brain/missions/mcb-0018.md",
      "content/brain/missions/mcb-0019.md",
      "content/brain/loop/reports/fable/mcb-0017-readiness-audit.md",
      "content/brain/loop/reports/claude/mcb-0018-agent-report.md",
      "content/brain/loop/reports/claude/mcb-0019-agent-report.md",
      LEGACY_EXPORTER,
      PACK_GENERATOR,
    ])),
  };
}

function buildAgentPack(role) {
  return {
    type: "agent",
    target: role,
    output: `content/brain/exports/packs/agent-${role}.md`,
    notes: [
      "Agent pack contains role rules, templates, and guardrail/workflow context only.",
    ],
    sources: uniqueSorted(existing([
      "content/brain/harness/00_PROJECT_CHARTER.md",
      "content/brain/harness/04_WORKFLOW.md",
      "content/brain/harness/09_V0_FREEZE.md",
      "content/brain/loop/PROTOCOL.md",
      "content/brain/loop/ROLES.md",
      "content/brain/loop/contracts/README.md",
      `content/brain/loop/contracts/${role}.md`,
      "content/brain/loop/templates/mission-brief.md",
      "content/brain/loop/templates/agent-report.md",
      "content/brain/loop/runbooks/close-a-mission.md",
    ])),
  };
}

function buildProjectPack(id) {
  const project = registryEntry("content/brain/registries/projects.json", id);
  const projectPath = project?.path ?? "content/brain/projects/entry.md";

  return {
    type: "project",
    target: id,
    output: `content/brain/exports/packs/project-${id}.md`,
    notes: [
      "Project pack is read-only knowledge. It must not include ENTRY runtime files or operational data.",
      "The project registry JSON is included so the target entry can be inspected in context.",
    ],
    sources: uniqueSorted(existing([
      "content/brain/registries/projects.json",
      projectPath,
      ...entryKnowledgeFiles(),
      "content/brain/decisions/dec-0005-non-mcb-product-captures.md",
      "content/brain/harness/00_PROJECT_CHARTER.md",
      "content/brain/harness/09_V0_FREEZE.md",
    ])),
  };
}

function buildReviewPack(id) {
  const mission = registryEntry("content/brain/registries/missions.json", id);
  const missionPath = mission?.path ?? matchingMissionDoc(id);

  return {
    type: "review",
    target: id,
    output: `content/brain/exports/packs/review-${id}.md`,
    notes: [
      "Review pack is scoped for PR review and audit.",
      "Expected checks: npm run brain:export-context; npm run brain:export-packs; npm run brain:guardrails; npm run brain:check-relations; npx tsc --noEmit.",
      "Single-pack CLI checks should cover mission, agent, project, review, and local pack generation when those commands exist.",
    ],
    sources: uniqueSorted(existing([
      "content/brain/harness/00_PROJECT_CHARTER.md",
      "content/brain/harness/09_V0_FREEZE.md",
      "content/brain/loop/PROTOCOL.md",
      "content/brain/loop/ROLES.md",
      "content/brain/loop/contracts/reviewer-ci.md",
      "content/brain/loop/contracts/adversarial-auditor.md",
      "content/brain/loop/templates/review-report.md",
      "content/brain/loop/runbooks/close-a-mission.md",
      "content/brain/loop/roadmaps/ROADMAP.md",
      "content/brain/registries/missions.json",
      missionPath,
      "content/brain/loop/reports/codex/mcb-0020-agent-report.md",
    ])),
  };
}

function buildLocalPack(id) {
  return {
    type: "local",
    target: id,
    output: `content/brain/exports/packs/local-${id}.md`,
    limit: LOCAL_PACK_LIMIT,
    notes: [
      "Local pack is capped at 25,000 characters by the generator.",
      "Local model output is unverified. It has no authority until a human captures and promotes it through the inbox workflow.",
      "No secrets, ENTRY operational data, Seshat operational data, database access, RAG, embeddings, or automation are included.",
    ],
    sources: uniqueSorted(existing([
      "content/brain/harness/00_PROJECT_CHARTER.md",
      "content/brain/harness/04_WORKFLOW.md",
      "content/brain/harness/09_V0_FREEZE.md",
      "content/brain/loop/contracts/local-triage-assistant.md",
      "content/brain/loop/roadmaps/ROADMAP.md",
      "content/brain/registries/inbox.json",
    ])),
  };
}

function buildPack(spec) {
  switch (spec.type) {
    case "full":
      return buildFullPack();
    case "mission":
      return buildMissionPack(spec.id);
    case "agent":
      return buildAgentPack(spec.role);
    case "project":
      return buildProjectPack(spec.id);
    case "review":
      return buildReviewPack(spec.id);
    case "local":
      return buildLocalPack(spec.id);
    default:
      throw new Error(`Unsupported pack type: ${spec.type}`);
  }
}

function fenceFor(content) {
  const matches = content.match(/`{3,}/g) ?? [];
  const longest = matches.reduce((max, run) => Math.max(max, run.length), 2);
  return "`".repeat(Math.max(3, longest + 1));
}

function languageFor(relPath) {
  return relPath.endsWith(".json") ? "json" : "text";
}

function sourceBlock(relPath) {
  const content = readRel(relPath);
  const fence = fenceFor(content);
  const language = languageFor(relPath);
  return [
    "---",
    "",
    `## Source: ${relPath}`,
    "",
    `${fence}${language}`,
    content,
    fence,
    "",
  ].join("\n");
}

function renderPack(pack) {
  const parts = [
    "# Minerva Core Brain Context Pack",
    "",
    `- Pack type: ${pack.type}`,
    `- Pack target: ${pack.target}`,
    `- Generated by: ${PACK_GENERATOR}`,
    "- Source: content/brain/** selected by deterministic pack recipe",
    `- Authority: ${AUTHORITY}`,
    "",
    "## Included Sources",
    "",
  ];

  if (pack.sources.length === 0) {
    parts.push("- _No source files found._");
  } else {
    for (const relPath of pack.sources) {
      parts.push(`- ${relPath}`);
    }
  }

  if (pack.notes?.length) {
    parts.push("", "## Pack Notes", "");
    for (const note of pack.notes) {
      parts.push(`- ${note}`);
    }
  }

  parts.push("", "## Context", "");
  for (const relPath of pack.sources) {
    parts.push(sourceBlock(relPath));
  }

  return `${parts.join("\n").trimEnd()}\n`;
}

function applyHardCap(content, limit) {
  if (!limit || content.length <= limit) return content;

  const note = "\n[TRUNCATED: local pack size cap reached]\n";
  const allowed = limit - note.length;
  if (allowed <= 0) return note.slice(0, limit);

  const contextStart = content.indexOf("\n## Context\n");
  const boundary = content.lastIndexOf("\n---\n", allowed);
  const cutAt = boundary > contextStart ? boundary : allowed;
  return `${content.slice(0, cutAt).trimEnd()}${note}`;
}

function writePack(pack) {
  const outputPath = abs(pack.output);
  if (!existsSync(PACKS_DIR)) mkdirSync(PACKS_DIR, { recursive: true });

  const rendered = applyHardCap(renderPack(pack), pack.limit);
  writeFileSync(outputPath, rendered, "utf8");
  return pack.output;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function specsFromArgs(argv) {
  if (argv.length === 0) return DEFAULT_PACKS;

  const args = parseArgs(argv);
  const type = args.type;
  if (!type) throw new Error("Missing required --type for single-pack generation");
  if (!PACK_TYPES.has(type)) {
    throw new Error(`Invalid --type "${type}". Expected one of: ${[...PACK_TYPES].join(", ")}`);
  }

  if (type === "full") return [{ type, target: "all" }];
  if (type === "agent") {
    if (!args.role) throw new Error("Missing required --role for agent pack");
    return [{ type, role: args.role }];
  }
  if (!args.id) throw new Error(`Missing required --id for ${type} pack`);
  return [{ type, id: args.id }];
}

function main() {
  if (!existsSync(BRAIN_DIR)) {
    console.error("Error: content/brain does not exist");
    process.exit(1);
  }

  let specs;
  try {
    specs = specsFromArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  const generated = [];
  for (const spec of specs) {
    const pack = buildPack(spec);
    generated.push(writePack(pack));
  }

  for (const relPath of generated) {
    console.log(`wrote ${relPath}`);
  }
}

main();
