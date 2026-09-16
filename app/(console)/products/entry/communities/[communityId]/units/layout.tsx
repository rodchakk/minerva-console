import type { ReactNode } from "react";
import { UnitBulkDeleteManager } from "@/features/entry/communities/UnitBulkDeleteManager";
import { createClient } from "@/lib/supabase/server";

export default async function CommunityUnitsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ communityId: string }>;
}) {
  const { communityId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("houses")
    .select("id,house_label")
    .eq("community_id", communityId)
    .order("house_label", { ascending: true });

  const units = Array.isArray(data)
    ? data
        .map((row) => ({
          id: typeof row.id === "string" ? row.id : "",
          label: typeof row.house_label === "string" ? row.house_label.trim() : "",
        }))
        .filter((unit) => unit.id && unit.label)
    : [];

  return (
    <>
      <UnitBulkDeleteManager communityId={communityId} units={units} />
      {children}
    </>
  );
}
