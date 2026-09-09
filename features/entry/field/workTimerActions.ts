"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createClient } from "@/lib/supabase/server";
import {
  isFieldWorkActivityCategory,
  isFieldWorkMode,
  isFieldWorkTargetScope,
} from "@/features/entry/field/workTimerModel";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const TIMER_PATH = "/field/entry/time";

function cleanFormValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function refreshFieldTimerViews() {
  revalidatePath("/field", "layout");
  revalidatePath(TIMER_PATH);
}

export async function startFieldWorkTimer(formData: FormData) {
  await requireSuperadmin();

  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    redirect(`${TIMER_PATH}?error=preview`);
  }

  const targetScope = cleanFormValue(formData.get("targetScope"));
  const communityId = cleanFormValue(formData.get("communityId"));
  const activityCategory = cleanFormValue(formData.get("activityCategory"));
  const workMode = cleanFormValue(formData.get("workMode")) || "ONSITE";
  const note = cleanFormValue(formData.get("note"));

  if (
    !isFieldWorkTargetScope(targetScope) ||
    !isFieldWorkActivityCategory(activityCategory) ||
    !isFieldWorkMode(workMode) ||
    (targetScope === "CLIENT" && !UUID_PATTERN.test(communityId)) ||
    (targetScope === "PRODUCT" && communityId)
  ) {
    redirect(`${TIMER_PATH}?error=start`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("field_work_start_session_v1", {
    p_activity_category: activityCategory,
    p_community_id: targetScope === "CLIENT" ? communityId : null,
    p_note: note || null,
    p_target_scope: targetScope,
    p_work_mode: workMode,
  });

  refreshFieldTimerViews();

  if (error) {
    redirect(`${TIMER_PATH}?error=start`);
  }

  redirect(`${TIMER_PATH}?started=1`);
}

export async function stopFieldWorkTimer(formData: FormData) {
  await requireSuperadmin();

  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    redirect(`${TIMER_PATH}?error=preview`);
  }

  const sessionId = cleanFormValue(formData.get("sessionId"));
  if (!UUID_PATTERN.test(sessionId)) {
    redirect(`${TIMER_PATH}?error=stop`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("field_work_stop_session_v1", {
    p_session_id: sessionId,
  });

  refreshFieldTimerViews();

  if (error) {
    redirect(`${TIMER_PATH}?error=stop`);
  }

  redirect(`${TIMER_PATH}?stopped=${encodeURIComponent(sessionId)}`);
}

export async function cancelFieldWorkTimer(formData: FormData) {
  await requireSuperadmin();

  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) {
    redirect(`${TIMER_PATH}?error=preview`);
  }

  const sessionId = cleanFormValue(formData.get("sessionId"));
  if (!UUID_PATTERN.test(sessionId)) {
    redirect(`${TIMER_PATH}?error=cancel`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("field_work_cancel_session_v1", {
    p_session_id: sessionId,
  });

  refreshFieldTimerViews();

  if (error) {
    redirect(`${TIMER_PATH}?error=cancel`);
  }

  redirect(`${TIMER_PATH}?cancelled=1`);
}
