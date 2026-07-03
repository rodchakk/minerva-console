#!/usr/bin/env node
// scripts/brain-loop-state.mjs
//
// Generate a deterministic Minerva Core Brain loop state snapshot.
//
// Pure Node.js (ESM), zero dependencies. Reads local Brain loop folders,
// missions.json, and ROADMAP.md, then writes one Markdown report. This is not
// an agent engine, scheduler, automation system, database, RAG, embeddings, or
// a UI feature.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { basename, join, relative, sep } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const OUTPUT_REL = "content/brain/loop/state/LOOP_STATE.md";
const OUTPUT_FILE = join(ROOT, OUTPUT_REL);
const MISSIONS_JSON_REL = "content/brain/registries/missions.json";
const ROADMAP_REL = "content/brain/loop/roadmaps/ROADMAP.md";

const FOLDERS = [
  ["Planned", "content/brain/loop/missions/01_todo"],
  ["Active", "content/brain/loop/missions/02_active"],
  ["Review", "content/brain/loop/missions/03_review"],
  ["Done", "content/brain/loop/missions/04_done"],
  ["Blocked", "content/brain/loop/missions/05_blocked"],
];

const LEDGER_STATUSES = ["planned", "in_progress", "completed", "blocked"];

function relPosix(absPath) {
  return relative(ROOT, absPath).split(sep).join("/");
}

function abs(relPath) {
  return join(ROOT, relPath);
}

function requireFile(relPath) {
  const full = abs(relPath);
  if (!existsSync(full)) {
    throw new Error(`Required file is missing: ${relPath}`);
  }
  return readFileSync(full, "utf8");
}

function readJson(relPath) {
  try {
    return JSON.parse(requireFile(relPath));
  } catch (error) {
    throw new Error(`Could not read ${relPath}: ${error.message}`);
  }
}

function normalize(value) {
  if (value === undefined || value === null || value === "") return "unknown";
  return String(value);
}

function statusStartsDone(status) {
  return normalize(status).trim().toLowerCase().startsWith("done");
}

function isPlanned(status) {
  return normalize(status).trim().toLowerCase() === "planned";
}

function missionIdFromText(text) {
  const match = text.match(/MCB-\d{4}(?:\.\d+)?/i);
  return match ? match[0].toUpperCase() : null;
}

function missionSortKey(id) {
  const match = String(id).match(/^MCB-(\d+)(?:\.(\d+))?$/i);
  if (!match) return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, id];
  return [Number(match[1]), match[2] === undefined ? 0 : Number(match[2]), id];
}

function compareMissionIds(a, b) {
  const left = missionSortKey(a);
  const right = missionSortKey(b);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }
  return 0;
}

function missionLabel(id, title) {
  return `${id} - ${normalize(title)}`;
}

function markdownFilesIn(relDir) {
  const dir = abs(relDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .filter((name) => name.toLowerCase() !== "readme.md")
    .sort((a, b) => a.localeCompare(b))
    .map((name) => `${relDir}/${name}`);
}

function folderSnapshot() {
  return FOLDERS.map(([label, relDir]) => ({
    label,
    relDir,
    files: markdownFilesIn(relDir),
  }));
}

function parseRoadmap(content) {
  const lines = content.split(/\r?\n/);
  const items = [];
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^##\s+(MCB-\d{4}(?:\.\d+)?)\s+(.+?)\s*$/);
    if (heading) {
      const title = heading[2].trim().replace(/^\S+\s+/, "");
      current = {
        id: heading[1].toUpperCase(),
        title,
        status: "unknown",
      };
      items.push(current);
      continue;
    }

    if (!current) continue;
    if (line.startsWith("## ")) {
      current = null;
      continue;
    }

    const status = line.match(/^-\s+\*\*Status:\*\*\s*(.+?)\s*$/);
    if (status && current.status === "unknown") {
      current.status = status[1].trim();
    }
  }

  return items;
}

function ledgerStatusCounts(missions) {
  const counts = {
    planned: 0,
    in_progress: 0,
    completed: 0,
    blocked: 0,
    "unknown/other": 0,
  };

  for (const mission of missions) {
    const status = normalize(mission.status);
    if (LEDGER_STATUSES.includes(status)) {
      counts[status] += 1;
    } else {
      counts["unknown/other"] += 1;
    }
  }

  return counts;
}

function recentMissions(missions) {
  return [...missions]
    .sort((a, b) => compareMissionIds(a.id, b.id))
    .slice(-8);
}

function byId(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function filesContainingMissionIds(files) {
  const out = [];
  for (const relPath of files) {
    const id = missionIdFromText(basename(relPath));
    if (id) out.push({ id, relPath });
  }
  return out;
}

function crossChecks({ missions, roadmapItems, folders }) {
  const findings = [];
  const ledgerById = byId(missions);
  const roadmapById = byId(roadmapItems);
  const activeOrReviewFiles = folders
    .filter((folder) => folder.relDir.endsWith("/02_active") || folder.relDir.endsWith("/03_review"))
    .flatMap((folder) => folder.files);
  const reviewFiles = folders.find((folder) => folder.relDir.endsWith("/03_review"))?.files ?? [];
  const doneFiles = folders.find((folder) => folder.relDir.endsWith("/04_done"))?.files ?? [];
  const activeReviewNames = new Set(
    activeOrReviewFiles.map((file) => basename(file).toLowerCase()),
  );

  for (const mission of missions) {
    const roadmap = roadmapById.get(mission.id);
    if (mission.status === "completed" && roadmap && !statusStartsDone(roadmap.status)) {
      findings.push(
        `[mismatch] ${mission.id} is completed in missions.json, but ROADMAP.md status is ${normalize(roadmap.status)}.`,
      );
    }
  }

  for (const item of roadmapItems) {
    const ledger = ledgerById.get(item.id);
    if (statusStartsDone(item.status) && normalize(ledger?.status) !== "completed") {
      findings.push(
        `[mismatch] ${item.id} is done in ROADMAP.md, but missions.json status is ${normalize(ledger?.status)}.`,
      );
    }
  }

  for (const mission of missions) {
    if (mission.status !== "in_progress") continue;
    const id = mission.id.toLowerCase();
    const found = [...activeReviewNames].some((name) => name.includes(id));
    if (!found) {
      findings.push(
        `[info] ${mission.id} is in_progress in missions.json, but no active/review folder filename contains that ID.`,
      );
    }
  }

  for (const file of filesContainingMissionIds(reviewFiles)) {
    const status = normalize(ledgerById.get(file.id)?.status);
    if (status !== "in_progress") {
      findings.push(
        `[mismatch] ${file.relPath} is in the review folder, but missions.json status for ${file.id} is ${status}.`,
      );
    }
  }

  for (const file of filesContainingMissionIds(doneFiles)) {
    const status = normalize(ledgerById.get(file.id)?.status);
    if (status !== "completed") {
      findings.push(
        `[mismatch] ${file.relPath} is in the done folder, but missions.json status for ${file.id} is ${status}.`,
      );
    }
  }

  for (const mission of missions) {
    const missionPath = normalize(mission.path);
    if (/^content\/brain\/missions\/mcb-\d{4}(?:-\d+)?\.md$/i.test(missionPath)) {
      if (!existsSync(abs(missionPath))) {
        findings.push(`[mismatch] ${mission.id} registry path is missing on disk: ${missionPath}.`);
      }
    }
  }

  for (const mission of missions) {
    if (mission.status !== "completed") continue;
    const pr = normalize(mission.pr);
    const commit = normalize(mission.commit);
    if (pr === "unknown" || commit === "unknown") {
      findings.push(
        `[mismatch] ${mission.id} is completed but has missing/unknown PR or commit metadata (pr: ${pr}, commit: ${commit}).`,
      );
    }
  }

  return findings;
}

function currentFocus(missions, roadmapItems) {
  const active = [...missions]
    .filter((mission) => mission.status === "in_progress")
    .sort((a, b) => compareMissionIds(a.id, b.id));

  if (active.length > 0) {
    return active.map((mission) => `- ${missionLabel(mission.id, mission.title)} - inferred from missions.json status in_progress.`);
  }

  const planned = roadmapItems.find((item) => isPlanned(item.status));
  if (planned) {
    return [`- ${missionLabel(planned.id, planned.title)} - inferred from first planned ROADMAP.md item.`];
  }

  return ["_No active focus detected._"];
}

function recommendedNext(missions, roadmapItems) {
  const ledger = byId(missions);
  const mcb0021 = ledger.get("MCB-0021");
  const roadmap0021Index = roadmapItems.findIndex((item) => item.id === "MCB-0021");
  const mcb0021Roadmap = roadmap0021Index >= 0 ? roadmapItems[roadmap0021Index] : null;
  const mcb0021Active =
    mcb0021?.status === "in_progress" ||
    normalize(mcb0021Roadmap?.status).toLowerCase() === "in_progress";

  if (mcb0021Active && roadmap0021Index >= 0) {
    const next = roadmapItems
      .slice(roadmap0021Index + 1)
      .find((item) => isPlanned(item.status));
    if (next) return `- ${missionLabel(next.id, next.title)} - first planned roadmap mission after active MCB-0021.`;
  }

  const planned = roadmapItems.find((item) => isPlanned(item.status));
  if (planned) return `- ${missionLabel(planned.id, planned.title)} - first planned roadmap mission.`;

  return "_No next mission found in roadmap._";
}

function renderList(items) {
  return items.length > 0 ? items.join("\n") : "_None._";
}

function renderSnapshot({ missions, folders, roadmapItems, findings }) {
  const counts = ledgerStatusCounts(missions);
  const recent = recentMissions(missions);
  const folderCounts = folders
    .map((folder) => `${folder.label}: ${folder.files.length}`)
    .join("; ");

  const parts = [
    "# Minerva Core Brain Loop State",
    "",
    "- Generated by: scripts/brain-loop-state.mjs",
    "- Source: content/brain/loop/**, content/brain/registries/missions.json, content/brain/loop/roadmaps/ROADMAP.md",
    "- Authority: Git/GitHub and source files remain authority. This snapshot is generated and may lag master.",
    "",
    "## Summary",
    "",
    `- Mission ledger entries: ${missions.length}`,
    `- Ledger statuses: planned ${counts.planned}, in_progress ${counts.in_progress}, completed ${counts.completed}, blocked ${counts.blocked}, unknown/other ${counts["unknown/other"]}`,
    `- Loop folder mission files: ${folderCounts}`,
    `- Roadmap missions: ${roadmapItems.length}`,
    `- Cross-check findings: ${findings.length}`,
    "",
    "## Folder State",
    "",
  ];

  for (const folder of folders) {
    parts.push(`### ${folder.label} - ${folder.relDir}`, "");
    parts.push(renderList(folder.files.map((file) => `- ${file}`)), "");
  }

  parts.push(
    "## Mission Ledger State",
    "",
    "### Counts By Status",
    "",
    `- planned: ${counts.planned}`,
    `- in_progress: ${counts.in_progress}`,
    `- completed: ${counts.completed}`,
    `- blocked: ${counts.blocked}`,
    `- unknown/other: ${counts["unknown/other"]}`,
    "",
    "### Recent Missions",
    "",
  );

  for (const mission of recent) {
    parts.push(
      `- ${normalize(mission.id)} - ${normalize(mission.status)} - PR ${normalize(mission.pr)} - commit ${normalize(mission.commit)}`,
    );
  }

  parts.push("", "## Roadmap State", "");
  if (roadmapItems.length === 0) {
    parts.push("_No roadmap missions found._");
  } else {
    for (const item of roadmapItems) {
      parts.push(`- ${missionLabel(item.id, item.title)} - ${normalize(item.status)}`);
    }
  }

  parts.push("", "## Cross-Checks", "");
  parts.push(findings.length > 0 ? findings.map((finding) => `- ${finding}`).join("\n") : "_No mismatches detected._");

  parts.push(
    "",
    "## Current Focus",
    "",
    "Inferred from local files only; external GitHub state may differ.",
    "",
    renderList(currentFocus(missions, roadmapItems)),
    "",
    "## Recommended Next Mission",
    "",
    recommendedNext(missions, roadmapItems),
    "",
    "## Notes",
    "",
    "- Re-run with `npm run brain:loop-state`.",
    "- This file is generated. Do not treat it as authority over Git, GitHub, missions.json, ROADMAP.md, or human review.",
    "- Cross-check findings are report content only; this CLI does not exit nonzero for mismatches.",
    "",
  );

  return `${parts.join("\n").trimEnd()}\n`;
}

function main() {
  let missions;
  let roadmapContent;
  try {
    missions = readJson(MISSIONS_JSON_REL);
    roadmapContent = requireFile(ROADMAP_REL);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(missions)) {
    console.error(`Error: ${MISSIONS_JSON_REL} must be a JSON array`);
    process.exit(1);
  }

  const folders = folderSnapshot();
  const roadmapItems = parseRoadmap(roadmapContent);
  const findings = crossChecks({ missions, roadmapItems, folders });
  const rendered = renderSnapshot({ missions, folders, roadmapItems, findings });

  const checkMode = process.argv.includes("--check");

  if (checkMode) {
    if (!existsSync(OUTPUT_FILE)) {
      console.error(`Error: LOOP_STATE.md is missing. Run "npm run brain:loop-state" to generate it.`);
      process.exit(1);
    }
    const current = readFileSync(OUTPUT_FILE, "utf8");
    if (current !== rendered) {
      console.error(`Error: LOOP_STATE.md differs from current expected output. Run "npm run brain:loop-state" to update it.`);
      process.exit(1);
    }
    console.log("LOOP_STATE.md is up to date.");
    process.exit(0);
  }

  const outputDir = join(ROOT, "content", "brain", "loop", "state");
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  writeFileSync(OUTPUT_FILE, rendered, "utf8");
  console.log(`wrote ${relPosix(OUTPUT_FILE)}`);
}

main();
