// Brain v0 — content loader (the seam).
//
// This is the ONLY module the app uses to read Brain content.
// Today it reads JSON registries from `content/brain/registries/`.
// In v1 it will be re-implemented against Neon Postgres without changing
// the public function signatures — UI code will not change.
//
// Hard rules:
//   * No imports from `features/entry/**`.
//   * No Supabase client imports.
//   * No env vars.
//   * No new dependencies.

import projectsData from "@/content/brain/registries/projects.json";
import decisionsData from "@/content/brain/registries/decisions.json";
import promptsData from "@/content/brain/registries/prompts.json";
import agentsData from "@/content/brain/registries/agents.json";
import inboxData from "@/content/brain/registries/inbox.json";

import type {
  AgentEntry,
  DecisionEntry,
  InboxEntry,
  ProjectEntry,
  PromptEntry,
} from "@/features/brain/lib/types";

function byUpdatedDesc<T extends { updated: string }>(a: T, b: T): number {
  // Lexicographic compare works for ISO date strings.
  if (a.updated === b.updated) return 0;
  return a.updated < b.updated ? 1 : -1;
}

export function getProjects(): ProjectEntry[] {
  return (projectsData as ProjectEntry[]).slice().sort(byUpdatedDesc);
}

export function getDecisions(): DecisionEntry[] {
  return (decisionsData as DecisionEntry[]).slice().sort(byUpdatedDesc);
}

export function getPrompts(): PromptEntry[] {
  return (promptsData as PromptEntry[]).slice().sort(byUpdatedDesc);
}

export function getAgents(): AgentEntry[] {
  return (agentsData as AgentEntry[]).slice().sort(byUpdatedDesc);
}

export function getInbox(): InboxEntry[] {
  return (inboxData as InboxEntry[]).slice().sort(byUpdatedDesc);
}

export type BrainCounts = {
  projects: number;
  decisions: number;
  prompts: number;
  agents: number;
  inbox: number;
};

export function getBrainCounts(): BrainCounts {
  return {
    projects: getProjects().length,
    decisions: getDecisions().length,
    prompts: getPrompts().length,
    agents: getAgents().length,
    inbox: getInbox().length,
  };
}
