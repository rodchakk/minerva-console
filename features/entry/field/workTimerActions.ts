"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getCommunitiesWithProgressResult } from "@/features/entry/communities/queries";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import {
  isFieldWorkClassification,
  isFieldWorkLocation,
  type FieldWorkClassification,
  type FieldWorkLocation,
} from "@/features/entry/field/workTimerModel";
import { createClient } from "@/lib/supabase/server";

export type FieldWorkTimerActionResult = {
  error?: string;
  success: boolean;
};

function revalidateWorkTimer() {
  revalidatePath("/field/entry");
  revalidatePath("/field/entry/work-timer");
}

function cleanNotes(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 2000);
}

async function resolveCommunity(communityId: string | null) {
  if (!communityId) {
    return {
      communityId: null,
      communityName: null,
    };
  }

  const communities = await getCommunitiesWithProgressResult();
  const community =
    communities.items.find((item) => item.id === communityId) ?? null;

  if (!community) {
    throw new Error("Selected community is not available to Field.");
  }

  return {
    communityId: community.id,
    communityName: community.name,
  };
}

export async function startFieldWorkSession(input: {
  classification: FieldWorkClassification;
  communityId: string | null;
  notes: string;
  workLocation: FieldWorkLocation;
}): Promise<FieldWorkTimerActionResult> {
  const { user } = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  if (!isFieldWorkClassification(input.classification)) {
    return { error: "Choose a valid work classification.", success: false };
  }

  if (!isFieldWorkLocation(input.workLocation)) {
    return { error: "Choose onsite or remote work.", success: false };
  }

  let community;
  try {
    community = await resolveCommunity(input.communityId?.trim() || null);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid community.",
      success: false,
    };
  }

  const supabase = await createClient();
  const { data: activeSession, error: activeError } = await supabase
    .from("entry_field_work_sessions")
    .select("id")
    .eq("staff_user_id", user.id)
    .is("stopped_at", null)
    .limit(1)
    .maybeSingle();

  if (activeError) {
    return { error: activeError.message, success: false };
  }

  if (activeSession) {
    return { error: "Stop the active timer before starting another.", success: false };
  }

  const { error } = await supabase.from("entry_field_work_sessions").insert({
    classification: input.classification,
    community_id: community.communityId,
    community_name_snapshot: community.communityName,
    notes: cleanNotes(input.notes),
    product_area: "entry",
    staff_email_snapshot: user.email,
    staff_user_id: user.id,
    started_at: new Date().toISOString(),
    work_location: input.workLocation,
  });

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateWorkTimer();
  return { success: true };
}

export async function stopFieldWorkSession(input: {
  sessionId: string;
}): Promise<FieldWorkTimerActionResult> {
  const { user } = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    return { error: previewReadOnlyError, success: false };
  }

  const sessionId = input.sessionId.trim();
  if (!sessionId) {
    return { error: "Active session is required.", success: false };
  }

  const supabase = await createClient();
  const { data: session, error: readError } = await supabase
    .from("entry_field_work_sessions")
    .select("id,started_at")
    .eq("id", sessionId)
    .eq("staff_user_id", user.id)
    .is("stopped_at", null)
    .maybeSingle();

  if (readError || !session) {
    return {
      error: readError?.message ?? "Active timer was not found.",
      success: false,
    };
  }

  const stoppedAt = new Date();
  const startedAt = new Date(String(session.started_at));
  const durationSeconds = Number.isNaN(startedAt.getTime())
    ? 0
    : Math.max(0, Math.floor((stoppedAt.getTime() - startedAt.getTime()) / 1000));

  const { error } = await supabase
    .from("entry_field_work_sessions")
    .update({
      duration_seconds: durationSeconds,
      stopped_at: stoppedAt.toISOString(),
    })
    .eq("id", sessionId)
    .eq("staff_user_id", user.id)
    .is("stopped_at", null);

  if (error) {
    return { error: error.message, success: false };
  }

  revalidateWorkTimer();
  return { success: true };
}
