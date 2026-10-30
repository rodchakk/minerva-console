"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreateSingleCommunityUnitInput = {
  communityId: string;
  unitLabel: string;
  publicReference: string;
};

export type CreateSingleCommunityUnitResult = {
  success: boolean;
  error?: string;
  unitId?: string;
  unitLabel?: string;
};

const MAX_UNIT_LABEL_LENGTH = 120;
const MAX_PUBLIC_REFERENCE_LENGTH = 160;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Match the existing _cr_normalize_unit_label_v1 collision semantics.
// A name that differs only by punctuation, spacing, or case is not a new unit.
function normalizedUnitLabel(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function createSingleCommunityUnitAction(
  input: CreateSingleCommunityUnitInput,
): Promise<CreateSingleCommunityUnitResult> {
  const actor = await requireSuperadmin();
  const previewReadOnlyError = getEntryPreviewReadOnlyError();
  if (previewReadOnlyError) return { success: false, error: previewReadOnlyError };

  const communityId = input.communityId?.trim() ?? "";
  const unitLabel = input.unitLabel?.trim().replace(/\s+/g, " ") ?? "";
  const publicReference = input.publicReference?.trim() ?? "";

  if (!UUID_PATTERN.test(communityId)) {
    return { success: false, error: "A valid community is required." };
  }

  if (!unitLabel || !normalizedUnitLabel(unitLabel)) {
    return { success: false, error: "Enter a valid unit name (for example, Casa 12)." };
  }

  if (unitLabel.length > MAX_UNIT_LABEL_LENGTH) {
    return { success: false, error: "Unit name must be 120 characters or fewer." };
  }

  if (publicReference.length > MAX_PUBLIC_REFERENCE_LENGTH) {
    return { success: false, error: "Reference must be 160 characters or fewer." };
  }

  const admin = createAdminClient();
  const { data: community, error: communityError } = await admin
    .from("communities")
    .select("id")
    .eq("id", communityId)
    .maybeSingle();

  if (communityError) {
    return { success: false, error: "Could not verify the community. Try again." };
  }
  if (!community) {
    return { success: false, error: "Community not found." };
  }

  // PostgREST pages results; check all existing names, not just the first 1000.
  // Do not use upsert: a duplicate must never overwrite an existing unit.
  const normalizedLabel = normalizedUnitLabel(unitLabel);
  const PAGE_SIZE = 500;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data: existing, error: lookupError } = await admin
      .from("houses")
      .select("house_label")
      .eq("community_id", communityId)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);

    if (lookupError || !existing) {
      return { success: false, error: "Could not verify existing units. Try again." };
    }

    if (existing.some((unit) => normalizedUnitLabel(unit.house_label ?? "") === normalizedLabel)) {
      return { success: false, error: "This unit already exists in this community." };
    }

    if (existing.length < PAGE_SIZE) break;
  }

  // One insert writes both fields atomically. Nothing is added to registration,
  // activation, or resident workflows.
  const { data: created, error: createError } = await admin
    .from("houses")
    .insert({
      community_id: communityId,
      house_label: unitLabel,
      public_reference: publicReference || null,
    })
    .select("id,house_label")
    .single();

  if (createError) {
    if (createError.code === "23505") {
      return { success: false, error: "This unit already exists in this community." };
    }
    console.error("[entry] create single unit failed", {
      communityId,
      code: createError.code,
    });
    return { success: false, error: "Could not create the unit. Try again." };
  }

  const { error: auditError } = await admin.from("superadmin_audit_log").insert({
    action: "community_unit.created",
    actor_user_id: actor.user.id,
    target_id: created.id,
    target_type: "unit",
    metadata: { community_id: communityId, unit_label: unitLabel, has_reference: Boolean(publicReference) },
  });
  if (auditError) {
    console.error("[entry] single unit audit failed", {
      communityId,
      unitId: created.id,
      code: auditError.code,
    });
  }

  revalidatePath(`/products/entry/communities/${communityId}`);
  revalidatePath(`/products/entry/communities/${communityId}/units`);
  revalidatePath(`/products/entry/communities/${communityId}/registration`);

  return { success: true, unitId: created.id, unitLabel: created.house_label };
}
