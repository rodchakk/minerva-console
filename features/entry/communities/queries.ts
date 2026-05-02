import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import {
  coerceBoolean,
  coerceNumber,
  coerceString,
} from "@/lib/supabase/utils";

export type CommunityListItem = {
  city: string;
  id: string;
  isActive: boolean;
  name: string;
  totalMembers: number;
  totalUnits: number;
  unitLabel: string;
  allowFrequentAccess: boolean;
  allowMessages: boolean;
  allowReservations: boolean;
};

export async function listCommunities(): Promise<CommunityListItem[]> {
  await requireSuperadmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_superadmin_communities_v1");

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      city: coerceString(record.city, "Not set"),
      id:
        coerceString(record.community_id) ||
        coerceString(record.id) ||
        crypto.randomUUID(),
      isActive: coerceBoolean(record.is_active),
      name: coerceString(record.name, "Untitled community"),
      totalMembers: coerceNumber(record.total_members),
      totalUnits: coerceNumber(record.total_units),
      unitLabel: coerceString(record.unit_label, "Casas"),
      allowFrequentAccess: coerceBoolean(record.allow_frequent_access),
      allowMessages: coerceBoolean(record.allow_messages),
      allowReservations: coerceBoolean(record.allow_reservations),
    };
  });
}
