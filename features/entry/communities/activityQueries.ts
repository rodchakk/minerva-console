import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceString,
} from "@/lib/supabase/utils";

export type CommunityAdminActivityPreview = {
  actorName: string;
  actorRole: string;
  actionType: string;
  createdAt: string;
  createdAtRaw: string;
  id: string;
  metadata: Record<string, unknown>;
  summary: string;
  targetId: string;
  targetType: string;
};

export type CommunityAdminActivityResult = {
  error?: string;
  items: CommunityAdminActivityPreview[];
  state: "live" | "empty" | "unavailable";
  total: number;
};

const DEFAULT_LIMIT = 40;

function formatDateTime(value: string) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export async function getCommunityAdminActivityPreview(
  communityId: string,
  limit = DEFAULT_LIMIT,
): Promise<CommunityAdminActivityResult> {
  await requireSuperadmin();

  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc("list_community_admin_activity", {
      p_community_id: communityId,
      p_limit: limit,
      p_offset: 0,
    });

    if (error) {
      return {
        error: error.message,
        items: [],
        state: "unavailable",
        total: 0,
      };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return {
        items: [],
        state: "empty",
        total: 0,
      };
    }

    const items = data
      .map((item) => {
        const record = item as Record<string, unknown>;
        const createdAtRaw = coerceString(record.created_at);
        const summary =
          coerceString(record.summary) || "Admin activity recorded";
        const actionType =
          coerceString(record.action_type) || "admin_activity";
        const id =
          coerceString(record.id) ||
          `${actionType}-${createdAtRaw}-${coerceString(record.target_id)}`;

        return {
          actorName: coerceString(record.actor_name) || "Admin",
          actorRole: coerceString(record.actor_role) || "Admin",
          actionType,
          createdAt: formatDateTime(createdAtRaw),
          createdAtRaw,
          id,
          metadata: normalizeMetadata(record.metadata),
          summary,
          targetId: coerceString(record.target_id),
          targetType: coerceString(record.target_type) || "activity",
        };
      })
      .filter((item) => item.id);

    return {
      items,
      state: items.length > 0 ? "live" : "empty",
      total: items.length,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Activity unavailable",
      items: [],
      state: "unavailable",
      total: 0,
    };
  }
}
