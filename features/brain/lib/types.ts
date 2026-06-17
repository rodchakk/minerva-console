// Brain v0 — Git-backed, read-only types.
//
// This module is the single typed surface for Brain registry entries.
// It must not import from `features/entry/**` and must not depend on Supabase.
// These shapes are intended to stay stable so UI code never sees the
// underlying Git-backed source.

export type EntryStatus = "draft" | "approved" | "archived";

export type InboxStatus = "inbox" | "triaged" | "promoted" | "archived";

export type MissionStatus = "planned" | "in_progress" | "completed";

export type RegistryKind =
  | "project"
  | "decision"
  | "prompt"
  | "agent"
  | "inbox"
  | "mission";

export type RegistryKindPlural =
  | "projects"
  | "decisions"
  | "prompts"
  | "agents"
  | "inbox"
  | "missions";

export const PLURAL_TO_SINGULAR: Record<RegistryKindPlural, RegistryKind> = {
  projects: "project",
  decisions: "decision",
  prompts: "prompt",
  agents: "agent",
  inbox: "inbox",
  missions: "mission",
};

type BaseEntry = {
  id: string;
  title: string;
  summary: string;
  /** ISO 8601 date string, e.g. "2026-06-16". */
  created: string;
  /** ISO 8601 date string. */
  updated: string;
  tags: string[];
  /** IDs of related entries — drives the future graph view. */
  related: string[];
  /** Optional pointer to a long-form file under `content/brain/**`. */
  path?: string;
};

export type ProjectEntry = BaseEntry & {
  type: "project";
  status: EntryStatus;
};

export type DecisionEntry = BaseEntry & {
  type: "decision";
  status: EntryStatus;
};

export type PromptEntry = BaseEntry & {
  type: "prompt";
  status: EntryStatus;
  /** Free-form version label, e.g. "v1", "2026-06-16". */
  version?: string;
};

export type AgentEntry = BaseEntry & {
  type: "agent";
  status: EntryStatus;
};

export type InboxEntry = BaseEntry & {
  type: "inbox";
  status: InboxStatus;
  /** Where the raw output came from. */
  source: "claude-code" | "gpt" | "codex" | "gemini" | "human" | "other";
};

export type MissionEntry = BaseEntry & {
  type: "mission";
  status: MissionStatus;
  agent: string;
  branch: string;
  pr: string;
  commit: string;
  phase: string;
};

export type AnyEntry =
  | ProjectEntry
  | DecisionEntry
  | PromptEntry
  | AgentEntry
  | InboxEntry
  | MissionEntry;
