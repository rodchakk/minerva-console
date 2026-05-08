import "server-only";

import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import { coerceBoolean, coerceString } from "@/lib/supabase/utils";

export type EntryMessagesCommunity = {
  city: string;
  id: string;
  isActive: boolean;
  name: string;
  unitLabel: string;
};

export type EntryMessagesPageData = {
  communities: EntryMessagesCommunity[];
  loadError?: string | null;
};

export async function getEntryMessagesPageData(): Promise<EntryMessagesPageData> {
  await requireSuperadmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .select("id,name,city,is_active,unit_label")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    return {
      communities: [],
      loadError: error.message,
    };
  }

  const communities = Array.isArray(data)
    ? data
        .map((item) => {
          const record = item as Record<string, unknown>;
          const id = coerceString(record.id);

          if (!id) {
            return null;
          }

          return {
            city: coerceString(record.city),
            id,
            isActive: coerceBoolean(record.is_active),
            name: coerceString(record.name, "Untitled community"),
            unitLabel: coerceString(record.unit_label, "Casas"),
          };
        })
        .filter(
          (community): community is EntryMessagesCommunity => community !== null,
        )
    : [];

  return {
    communities,
    loadError: null,
  };
}
