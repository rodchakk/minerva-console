"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";

export type GeneratePinItem = {
  queue_id: string;
  resident_name: string | null;
  unit_label: string | null;
  phone: string | null;
  email: string | null;
  suggested_username: string | null;
  activation_method: string | null;
  pin: string | null;
  status: "pin_generated" | "skipped" | "failed";
  message: string | null;
};

export type GeneratePinsResult = {
  generated_count: number;
  skipped_count: number;
  failed_count: number;
  items: GeneratePinItem[];
};

export type GeneratePinsActionResult =
  | { success: true; data: GeneratePinsResult }
  | { success: false; error: string };

export async function generateActivationPins(input: {
  communityId: string;
  queueIds: string[];
}): Promise<GeneratePinsActionResult> {
  // requireSuperadmin redirects on failure — no try/catch needed here
  await requireSuperadmin();

  const { communityId, queueIds } = input;

  if (!communityId) {
    return { success: false, error: "No community selected." };
  }

  if (!queueIds.length) {
    return { success: false, error: "No residents selected." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "generate_resident_activation_pins_v1",
      {
        p_community_id: communityId,
        p_queue_ids: queueIds,
      },
    );

    if (error) {
      if (
        error.message?.includes("unauthorized") ||
        error.code === "42501" ||
        error.message?.includes("superadmin_required")
      ) {
        return {
          success: false,
          error: "Access denied. Superadmin permission required.",
        };
      }
      if (error.message?.includes("community_not_found")) {
        return { success: false, error: "Community not found." };
      }
      return {
        success: false,
        error: "Failed to generate PINs. Please try again.",
      };
    }

    revalidatePath("/products/entry/activation");

    const raw = data as Record<string, unknown>;
    const result: GeneratePinsResult = {
      generated_count: Number(raw.generated_count ?? 0),
      skipped_count: Number(raw.skipped_count ?? 0),
      failed_count: Number(raw.failed_count ?? 0),
      items: Array.isArray(raw.items) ? (raw.items as GeneratePinItem[]) : [],
    };

    return { success: true, data: result };
  } catch {
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
