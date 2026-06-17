import {
  getProjects,
  getDecisions,
  getPrompts,
  getAgents,
  getInbox,
  getMissions,
} from "@/features/brain/lib/content";
import { readBrainMarkdown } from "@/features/brain/lib/markdown";
import type { AnyEntry, RegistryKindPlural } from "@/features/brain/lib/types";

export type BrainSearchItem = {
  id: string;
  kind: RegistryKindPlural;
  title: string;
  summary: string;
  status: string;
  type: string;
  tags: string[];
  related: string[];
  path?: string;
  source?: string;
  topic?: string;
  agent?: string;
  branch?: string;
  pr?: string;
  commit?: string;
  phase?: string;
  href: string;
  markdownText?: string;
};

export type BrainSearchResult = BrainSearchItem & {
  score: number;
};

export type BrainSearchParams = {
  q?: string;
  kind?: string;
  tag?: string;
  status?: string;
};

const KIND_MAP: Record<string, RegistryKindPlural> = {
  project: "projects",
  decision: "decisions",
  prompt: "prompts",
  agent: "agents",
  inbox: "inbox",
  mission: "missions",
};

function entryToSearchItem(entry: AnyEntry, kind: RegistryKindPlural): BrainSearchItem {
  const item: BrainSearchItem = {
    id: entry.id,
    kind,
    title: entry.title,
    summary: entry.summary,
    status: entry.status,
    type: entry.type,
    tags: entry.tags,
    related: entry.related,
    path: entry.path,
    href: `/brain/${kind}/${entry.id}`,
  };

  if ("source" in entry) {
    item.source = entry.source;
  }

  if ("agent" in entry) {
    item.agent = entry.agent;
    item.branch = entry.branch;
    item.pr = entry.pr;
    item.commit = entry.commit;
    item.phase = entry.phase;
  }

  if (entry.path) {
    const doc = readBrainMarkdown(entry.path);
    if (doc) {
      item.markdownText = doc.body;
    }
  }

  return item;
}

export function getBrainSearchIndex(): BrainSearchItem[] {
  const items: BrainSearchItem[] = [];

  const registries: [RegistryKindPlural, AnyEntry[]][] = [
    ["projects", getProjects()],
    ["decisions", getDecisions()],
    ["prompts", getPrompts()],
    ["agents", getAgents()],
    ["inbox", getInbox()],
    ["missions", getMissions()],
  ];

  for (const [kind, entries] of registries) {
    for (const entry of entries) {
      items.push(entryToSearchItem(entry, kind));
    }
  }

  return items;
}

function scoreMatch(item: BrainSearchItem, terms: string[]): number {
  if (terms.length === 0) return 1;

  let score = 0;
  const titleLower = item.title.toLowerCase();
  const summaryLower = item.summary.toLowerCase();
  const idLower = item.id.toLowerCase();
  const tagsLower = item.tags.map((t) => t.toLowerCase());
  const kindLower = item.kind.toLowerCase();
  const sourceLower = item.source?.toLowerCase() ?? "";
  const topicLower = item.topic?.toLowerCase() ?? "";
  const agentLower = item.agent?.toLowerCase() ?? "";
  const branchLower = item.branch?.toLowerCase() ?? "";
  const prLower = item.pr?.toLowerCase() ?? "";
  const commitLower = item.commit?.toLowerCase() ?? "";
  const phaseLower = item.phase?.toLowerCase() ?? "";
  const pathLower = item.path?.toLowerCase() ?? "";
  const markdownLower = item.markdownText?.toLowerCase() ?? "";

  for (const term of terms) {
    let matched = false;

    if (idLower.includes(term)) {
      score += 10;
      matched = true;
    }
    if (titleLower.includes(term)) {
      score += 8;
      matched = true;
    }
    if (tagsLower.some((t) => t.includes(term))) {
      score += 6;
      matched = true;
    }
    if (kindLower.includes(term)) {
      score += 4;
      matched = true;
    }
    if (summaryLower.includes(term)) {
      score += 3;
      matched = true;
    }
    if (sourceLower.includes(term)) {
      score += 2;
      matched = true;
    }
    if (topicLower.includes(term)) {
      score += 2;
      matched = true;
    }
    if (
      agentLower.includes(term) ||
      branchLower.includes(term) ||
      prLower.includes(term) ||
      commitLower.includes(term) ||
      phaseLower.includes(term)
    ) {
      score += 2;
      matched = true;
    }
    if (pathLower.includes(term)) {
      score += 1;
      matched = true;
    }
    if (markdownLower.includes(term)) {
      score += 1;
      matched = true;
    }

    if (!matched) return 0;
  }

  return score;
}

export function searchBrain(params: BrainSearchParams): BrainSearchResult[] {
  let items = getBrainSearchIndex();

  if (params.kind) {
    const kindPlural = KIND_MAP[params.kind] ?? params.kind;
    items = items.filter((item) => item.kind === kindPlural);
  }

  if (params.tag) {
    const tagLower = params.tag.toLowerCase();
    items = items.filter((item) =>
      item.tags.some((t) => t.toLowerCase() === tagLower),
    );
  }

  if (params.status) {
    const statusLower = params.status.toLowerCase();
    items = items.filter((item) => item.status.toLowerCase() === statusLower);
  }

  const terms = params.q
    ? params.q
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 0)
    : [];

  const results: BrainSearchResult[] = [];

  for (const item of items) {
    const score = scoreMatch(item, terms);
    if (score > 0) {
      results.push({ ...item, score });
    }
  }

  results.sort((a, b) => b.score - a.score);

  return results;
}

export function getBrainTags(): { tag: string; count: number }[] {
  const index = getBrainSearchIndex();
  const tagCounts = new Map<string, number>();

  for (const item of index) {
    for (const tag of item.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function getBrainKinds(): string[] {
  return ["projects", "decisions", "prompts", "agents", "inbox", "missions"];
}

export function getBrainStatuses(): string[] {
  const index = getBrainSearchIndex();
  const statuses = new Set<string>();

  for (const item of index) {
    statuses.add(item.status);
  }

  return Array.from(statuses).sort();
}
