// Brain v0 — relations layer (Git-backed, derived, read-only).
//
// Relations are derived purely from the `related` arrays already present on
// Brain registry entries. Nothing here touches a database, Supabase, or the
// filesystem beyond the existing content loaders. This is not RAG, not
// embeddings, and not an agent engine — it is plain metadata graph derivation.
//
// Note on ID uniqueness: IDs are NOT globally unique across registries. For
// example, `MCB-0001` exists both as a prompt and as a mission. A relation ID
// therefore resolves to every node that shares that ID, and a relation is only
// "broken" when no registry contains the referenced ID.

import {
  getProjects,
  getDecisions,
  getPrompts,
  getAgents,
  getInbox,
  getMissions,
} from "@/features/brain/lib/content";
import type { AnyEntry, RegistryKindPlural } from "@/features/brain/lib/types";

export type BrainRelationNode = {
  id: string;
  kind: RegistryKindPlural;
  title: string;
  type: string;
  status: string;
  href: string;
};

export type BrainRelationGroup = {
  entry: BrainRelationNode;
  /** Entries this entry references via `related`. */
  outgoing: BrainRelationNode[];
  /** Entries that reference this entry via their `related`. */
  incoming: BrainRelationNode[];
  /** `related` IDs on this entry that do not exist in any registry. */
  brokenOutgoing: string[];
};

export type BrokenBrainRelation = {
  sourceId: string;
  sourceKind: RegistryKindPlural;
  sourceTitle: string;
  missingId: string;
  href: string;
};

type RawNode = {
  node: BrainRelationNode;
  related: string[];
};

function nodeKey(node: { kind: RegistryKindPlural; id: string }): string {
  return `${node.kind}:${node.id}`;
}

function toNode(entry: AnyEntry, kind: RegistryKindPlural): BrainRelationNode {
  return {
    id: entry.id,
    kind,
    title: entry.title,
    type: entry.type,
    status: entry.status,
    href: `/brain/${kind}/${entry.id}`,
  };
}

/** Load every Brain entry as a raw node carrying its outgoing `related` IDs. */
function buildRawNodes(): RawNode[] {
  const registries: [RegistryKindPlural, AnyEntry[]][] = [
    ["projects", getProjects()],
    ["decisions", getDecisions()],
    ["prompts", getPrompts()],
    ["agents", getAgents()],
    ["inbox", getInbox()],
    ["missions", getMissions()],
  ];

  const raw: RawNode[] = [];
  for (const [kind, entries] of registries) {
    for (const entry of entries) {
      raw.push({
        node: toNode(entry, kind),
        related: Array.isArray(entry.related) ? entry.related : [],
      });
    }
  }
  return raw;
}

/** Map every ID to all nodes sharing it (IDs can collide across kinds). */
function buildIdIndex(raw: RawNode[]): Map<string, BrainRelationNode[]> {
  const index = new Map<string, BrainRelationNode[]>();
  for (const { node } of raw) {
    const existing = index.get(node.id);
    if (existing) {
      existing.push(node);
    } else {
      index.set(node.id, [node]);
    }
  }
  return index;
}

function buildGroup(
  self: RawNode,
  raw: RawNode[],
  idIndex: Map<string, BrainRelationNode[]>,
): BrainRelationGroup {
  const selfKey = nodeKey(self.node);

  // Outgoing — resolve each related ID to every matching node.
  const outgoing: BrainRelationNode[] = [];
  const brokenOutgoing: string[] = [];
  const outgoingSeen = new Set<string>();
  const brokenSeen = new Set<string>();

  for (const relId of self.related) {
    const matches = idIndex.get(relId);
    if (!matches || matches.length === 0) {
      if (!brokenSeen.has(relId)) {
        brokenSeen.add(relId);
        brokenOutgoing.push(relId);
      }
      continue;
    }
    for (const match of matches) {
      const key = nodeKey(match);
      if (key === selfKey || outgoingSeen.has(key)) continue;
      outgoingSeen.add(key);
      outgoing.push(match);
    }
  }

  // Incoming — any node whose `related` lists this entry's ID.
  const incoming: BrainRelationNode[] = [];
  const incomingSeen = new Set<string>();

  for (const candidate of raw) {
    const candidateKey = nodeKey(candidate.node);
    if (candidateKey === selfKey || incomingSeen.has(candidateKey)) continue;
    if (candidate.related.includes(self.node.id)) {
      incomingSeen.add(candidateKey);
      incoming.push(candidate.node);
    }
  }

  return { entry: self.node, outgoing, incoming, brokenOutgoing };
}

/** Relation groups for every Brain entry, across all registry kinds. */
export function getBrainRelationIndex(): BrainRelationGroup[] {
  const raw = buildRawNodes();
  const idIndex = buildIdIndex(raw);
  return raw.map((r) => buildGroup(r, raw, idIndex));
}

/** Relation group for a single entry, or null if it does not exist. */
export function getEntryRelations(
  kind: RegistryKindPlural,
  id: string,
): BrainRelationGroup | null {
  const raw = buildRawNodes();
  const self = raw.find((r) => r.node.kind === kind && r.node.id === id);
  if (!self) return null;
  const idIndex = buildIdIndex(raw);
  return buildGroup(self, raw, idIndex);
}

/** Every `related` reference that points at a non-existent ID. */
export function getBrokenBrainRelations(): BrokenBrainRelation[] {
  const raw = buildRawNodes();
  const idIndex = buildIdIndex(raw);
  const broken: BrokenBrainRelation[] = [];

  for (const r of raw) {
    const seen = new Set<string>();
    for (const relId of r.related) {
      if (idIndex.has(relId) || seen.has(relId)) continue;
      seen.add(relId);
      broken.push({
        sourceId: r.node.id,
        sourceKind: r.node.kind,
        sourceTitle: r.node.title,
        missingId: relId,
        href: r.node.href,
      });
    }
  }

  return broken;
}
