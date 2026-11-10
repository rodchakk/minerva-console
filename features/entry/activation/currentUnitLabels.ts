import "server-only";

import { createClient } from "@/lib/supabase/server";

// Only use from superadmin-gated activation actions. This is presentation data:
// the queue's original unit_label remains an immutable onboarding snapshot.
// Live household identity is always house_id, never the label.
export async function getCurrentActivationUnitLabels(
  communityId: string,
  queueIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(queueIds.filter(Boolean))];
  const names = new Map<string, string>();
  if (!communityId || ids.length === 0) return names;

  const db = await createClient();
  const rows: Array<{ id: string; house_id: string | null }> = [];
  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const { data, error } = await db
      .from("resident_activation_queue")
      .select("id,house_id")
      .eq("community_id", communityId)
      .in("id", ids.slice(i, i + batchSize));
    if (error) throw new Error("Could not resolve activation unit identities.");
    for (const row of data ?? []) rows.push(row);
  }

  const houseIds = [...new Set(rows.map((row) => row.house_id).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  ))];
  const currentNames = new Map<string, string>();
  for (let i = 0; i < houseIds.length; i += batchSize) {
    const { data, error } = await db
      .from("houses")
      .select("id,house_label")
      .eq("community_id", communityId)
      .in("id", houseIds.slice(i, i + batchSize));
    if (error) throw new Error("Could not resolve current unit names.");
    for (const row of data ?? []) {
      if (row.house_label) currentNames.set(row.id, row.house_label);
    }
  }
  for (const row of rows) {
    if (!row.house_id) continue;
    const label = currentNames.get(row.house_id);
    if (label) names.set(row.id, label);
  }
  return names;
}
