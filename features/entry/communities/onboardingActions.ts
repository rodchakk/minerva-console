"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";

export type OnboardingActionResult =
  | { success: true; message: string }
  | { success: false; error: string; blockers?: string[] };

function extractBlockers(value: unknown): string[] {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const blockers = record.blockers;

  if (!Array.isArray(blockers)) {
    return [];
  }

  return blockers.map((item) => String(item)).filter(Boolean);
}

export async function markActivationQueueReviewedAction(
  communityId: string,
): Promise<OnboardingActionResult> {
  await requireSuperadmin();

  if (!communityId) {
    return { success: false, error: "No community selected." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "mark_activation_queue_reviewed_v1",
      {
        p_community_id: communityId,
      },
    );

    if (error) {
      return {
        success: false,
        error: "Could not mark the activation queue as reviewed.",
      };
    }

    const result = data as Record<string, unknown> | null;

    if (result?.success === false) {
      return {
        success: false,
        error: String(result.error ?? "Could not mark the activation queue as reviewed."),
      };
    }

    revalidatePath(`/products/entry/communities/${communityId}`);
    revalidatePath(`/products/entry/activation`);

    return {
      success: true,
      message: "Activation queue marked as reviewed.",
    };
  } catch {
    return {
      success: false,
      error: "Unexpected error while reviewing activation queue.",
    };
  }
}

export async function completeCommunityOnboardingAction(
  input: {
    communityId: string;
    completionNote?: string;
  },
): Promise<OnboardingActionResult> {
  await requireSuperadmin();

  if (!input.communityId) {
    return { success: false, error: "No community selected." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "complete_community_onboarding_v1",
      {
        p_community_id: input.communityId,
        p_completion_note: input.completionNote?.trim() || null,
      },
    );

    if (error) {
      return {
        success: false,
        error: "Could not complete onboarding.",
      };
    }

    const result = data as Record<string, unknown> | null;

    if (result?.success === false) {
      return {
        success: false,
        error:
          result.error === "readiness_blocked"
            ? "Onboarding is blocked by readiness checks."
            : String(result.error ?? "Could not complete onboarding."),
        blockers: extractBlockers(result),
      };
    }

    revalidatePath(`/products/entry/communities/${input.communityId}`);
    revalidatePath(`/products/entry/communities`);

    return {
      success: true,
      message: "Community onboarding completed and activated.",
    };
  } catch {
    return {
      success: false,
      error: "Unexpected error while completing onboarding.",
    };
  }
}
