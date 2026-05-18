"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { createClient } from "@/lib/supabase/server";
import { coerceString } from "@/lib/supabase/utils";

const VALID_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type CampaignPreviewCounts = {
  ready: number;
  missingEmail: number;
  alreadyInvited: number;
  alreadyActivated: number;
};

/**
 * Returns bucketed counts of the activation queue for a community, using
 * the same classification rules as start_onboarding_email_campaign_v1.
 * Always queries the FULL queue (ignores any UI status filter) so the
 * counts shown in the launch modal match what the RPC will produce.
 */
export async function getCampaignPreview(
  communityId: string,
): Promise<CampaignPreviewCounts> {
  await requireSuperadmin();

  const empty: CampaignPreviewCounts = {
    ready: 0,
    missingEmail: 0,
    alreadyInvited: 0,
    alreadyActivated: 0,
  };

  if (!communityId) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_resident_activation_queue_v1", {
    p_community_id: communityId,
    p_status: null,
  });
  if (error || !Array.isArray(data)) return empty;

  let ready = 0;
  let missingEmail = 0;
  let alreadyInvited = 0;
  let alreadyActivated = 0;

  for (const item of data as Array<Record<string, unknown>>) {
    const status = coerceString(item.status, "pending").trim().toLowerCase();
    if (status === "activated" || status === "skipped") {
      alreadyActivated += 1;
      continue;
    }
    if (status === "invited") {
      alreadyInvited += 1;
      continue;
    }
    const email = coerceString(item.email).trim();
    if (!email || !VALID_EMAIL_RE.test(email)) {
      missingEmail += 1;
      continue;
    }
    ready += 1;
  }

  return { ready, missingEmail, alreadyInvited, alreadyActivated };
}

export type LaunchCampaignSummary = {
  campaign_id: string;
  status: string;
  dry_run: boolean;
  total: number;
  ready_to_send: number;
  skipped_missing_email: number;
  already_invited: number;
  already_activated: number;
};

export type LaunchCampaignActionResult =
  | { success: true; data: LaunchCampaignSummary }
  | {
      success: false;
      error: string;
      code?: "active_campaign_exists" | "community_not_found" | "unauthorized" | "unknown";
    };

const ACTIVE_CAMPAIGN_RE = /active_campaign_exists/i;

function mapRpcError(error: { code?: string | null; message?: string | null }): LaunchCampaignActionResult {
  const message = error.message ?? "";
  if (error.code === "P0409" || ACTIVE_CAMPAIGN_RE.test(message)) {
    return {
      success: false,
      code: "active_campaign_exists",
      error:
        "There is already an active onboarding campaign for this community. Wait for it to finish or cancel it first.",
    };
  }
  if (error.code === "42501" || /unauthorized/i.test(message)) {
    return {
      success: false,
      code: "unauthorized",
      error: "Access denied. Superadmin permission required.",
    };
  }
  if (/community_not_found/i.test(message)) {
    return {
      success: false,
      code: "community_not_found",
      error: "Community not found.",
    };
  }
  return {
    success: false,
    code: "unknown",
    error: "Failed to launch onboarding campaign. Please try again.",
  };
}

export async function launchOnboardingCampaign(input: {
  communityId: string;
  sendRatePerMinute?: number;
  includeAlreadyInvited?: boolean;
  name?: string;
}): Promise<LaunchCampaignActionResult> {
  await requireSuperadmin();

  const communityId = input.communityId?.trim() ?? "";
  if (!communityId) {
    return { success: false, code: "unknown", error: "No community selected." };
  }

  const rate = Number.isFinite(input.sendRatePerMinute)
    ? Math.max(1, Math.min(120, Math.floor(input.sendRatePerMinute as number)))
    : 10;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_onboarding_email_campaign_v1", {
    p_community_id: communityId,
    p_send_rate_per_minute: rate,
    p_include_already_invited: Boolean(input.includeAlreadyInvited),
    p_name: input.name?.trim() || null,
    p_dry_run: true,
  });

  if (error) {
    return mapRpcError(error);
  }

  revalidatePath("/products/entry/activation");

  const raw = (data ?? {}) as Record<string, unknown>;
  const summary: LaunchCampaignSummary = {
    campaign_id: String(raw.campaign_id ?? ""),
    status: String(raw.status ?? "running"),
    dry_run: Boolean(raw.dry_run ?? true),
    total: Number(raw.total ?? 0),
    ready_to_send: Number(raw.ready_to_send ?? 0),
    skipped_missing_email: Number(raw.skipped_missing_email ?? 0),
    already_invited: Number(raw.already_invited ?? 0),
    already_activated: Number(raw.already_activated ?? 0),
  };

  return { success: true, data: summary };
}
