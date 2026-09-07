import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { coerceString } from "@/lib/supabase/utils";

export type OutriderRecentActivityItem = {
  actorType: string;
  communityId: string;
  communityName: string;
  createdAt: string;
  eventType: string;
  id: string;
  metadata: Record<string, unknown>;
  outriderId: string;
};

type Row = Record<string, unknown>;

function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

export async function listRecentOutriderActivity(
  limit = 6,
): Promise<OutriderRecentActivityItem[]> {
  await requireSuperadmin();

  const supabase = createAdminClient();
  const safeLimit = Math.min(12, Math.max(1, Math.floor(limit)));
  const { data: eventData, error } = await supabase
    .from("community_outrider_events")
    .select("id,outrider_id,event_type,actor_type,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) return [];

  const events = asRows(eventData);
  const outriderIds = Array.from(
    new Set(events.map((event) => coerceString(event.outrider_id)).filter(Boolean)),
  );

  if (outriderIds.length === 0) return [];

  const { data: sessionData } = await supabase
    .from("community_outrider_sessions")
    .select("id,community_id")
    .in("id", outriderIds);

  const sessions = new Map(
    asRows(sessionData).map((row) => [
      coerceString(row.id),
      coerceString(row.community_id),
    ]),
  );
  const communityIds = Array.from(
    new Set(Array.from(sessions.values()).filter(Boolean)),
  );

  const { data: communityData } = communityIds.length
    ? await supabase
        .from("communities")
        .select("id,name")
        .in("id", communityIds)
    : { data: [] as unknown[] };

  const communities = new Map(
    asRows(communityData).map((row) => [
      coerceString(row.id),
      coerceString(row.name, "Unknown community"),
    ]),
  );

  return events
    .map((event) => {
      const id = coerceString(event.id);
      const outriderId = coerceString(event.outrider_id);
      const communityId = sessions.get(outriderId) ?? "";
      const createdAt = coerceString(event.created_at);

      if (!id || !outriderId || !communityId || !createdAt) return null;

      return {
        actorType: coerceString(event.actor_type, "outrider"),
        communityId,
        communityName: communities.get(communityId) ?? "Unknown community",
        createdAt,
        eventType: coerceString(event.event_type, "operational_update"),
        id,
        metadata:
          event.metadata && typeof event.metadata === "object"
            ? (event.metadata as Record<string, unknown>)
            : {},
        outriderId,
      } satisfies OutriderRecentActivityItem;
    })
    .filter((item): item is OutriderRecentActivityItem => item !== null);
}
