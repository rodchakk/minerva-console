import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import { coerceString } from "@/lib/supabase/utils";

export type EntryOperationalActivitySeverity = "info" | "warning" | "error";

export type EntryOperationalActivityItem = {
  actor: string;
  category: string;
  communityId: string;
  communityName: string;
  detail: string;
  eventId: string;
  eventKey: string;
  eventLabel: string;
  occurredAt: string;
  severity: EntryOperationalActivitySeverity;
  source: string;
};

export type EntryOperationalActivityResult = {
  error?: string;
  items: EntryOperationalActivityItem[];
  state: "live" | "empty" | "unavailable";
};

const DASHBOARD_HIDDEN_EVENT_KEYS = new Set(["facilities_configured"]);

function normalizeSeverity(value: string): EntryOperationalActivitySeverity {
  const normalized = value.trim().toLowerCase();

  if (normalized === "error") {
    return "error";
  }

  if (normalized === "warning") {
    return "warning";
  }

  return "info";
}

function clampLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 15;
  }

  return Math.max(1, Math.min(Math.trunc(limit), 50));
}

export async function getEntryOperationalActivity(
  limit = 15,
): Promise<EntryOperationalActivityResult> {
  await requireSuperadmin();

  const requestedLimit = clampLimit(limit);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_entry_operational_activity_v1", {
    p_limit: Math.min(requestedLimit + 5, 50),
  });

  if (error) {
    return {
      error: error.message,
      items: [],
      state: "unavailable",
    };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return {
      items: [],
      state: "empty",
    };
  }

  const items = data
    .map((item) => {
      const record = item as Record<string, unknown>;
      const eventId = coerceString(record.event_id);
      const occurredAt = coerceString(record.occurred_at);

      if (!eventId || !occurredAt) {
        return null;
      }

      return {
        actor: coerceString(record.actor, "System"),
        category: coerceString(record.category, "operations"),
        communityId: coerceString(record.community_id),
        communityName: coerceString(record.community_name, "ENTRY system"),
        detail: coerceString(record.detail, "Operational update recorded"),
        eventId,
        eventKey: coerceString(record.event_key, "operational_update"),
        eventLabel: coerceString(record.event_label, "Operational update"),
        occurredAt,
        severity: normalizeSeverity(coerceString(record.severity, "info")),
        source: coerceString(record.source, "operations"),
      } satisfies EntryOperationalActivityItem;
    })
    .filter((item): item is EntryOperationalActivityItem => item !== null)
    .filter((item) => !DASHBOARD_HIDDEN_EVENT_KEYS.has(item.eventKey))
    .slice(0, requestedLimit);

  return {
    items,
    state: items.length > 0 ? "live" : "empty",
  };
}

export async function getEntryPublishedMessagesLast24Hours(): Promise<number | null> {
  await requireSuperadmin();

  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("community_messages")
    .select("id", { count: "exact", head: true })
    .is("target_user_id", null)
    .is("deleted_at", null)
    .gte("published_at", since);

  if (error) {
    return null;
  }

  return count ?? 0;
}
