"use server";

import { revalidatePath } from "next/cache";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";
import { hashPatronatoReviewToken } from "@/features/entry/communityRegistration/patronato/token";
import { createAdminClient } from "@/lib/supabase/admin";

export type PatronatoMutationResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

function normalizeIds(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).slice(0, 100);
}

function mapError(message: string | undefined) {
  if (/ENTRY_CR_PATRONATO_ACCESS_(INVALID|EXPIRED)/.test(message ?? "")) {
    return "Este enlace de revisión ya no está disponible. Solicite uno nuevo a Minerva.";
  }

  if (/ENTRY_CR_(REVIEW_NOT_READY|INVALID_REVIEW_STATE|CONFIRMATION_CONFLICT)/.test(message ?? "")) {
    return "Una de las viviendas cambió de estado. Actualice la página y revise nuevamente.";
  }

  return "No se pudo guardar la decisión. Actualice la página e inténtelo de nuevo.";
}

export async function approvePatronatoUnits(input: {
  campaignId: string;
  token: string;
  unitIds: string[];
}): Promise<PatronatoMutationResult> {
  const previewError = getEntryPreviewReadOnlyError();
  if (previewError) {
    return { success: false, error: previewError };
  }

  const campaignId = input.campaignId.trim();
  const token = input.token.trim();
  const unitIds = normalizeIds(input.unitIds);

  if (!campaignId || token.length < 32 || unitIds.length === 0) {
    return { success: false, error: "Seleccione al menos una vivienda válida." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "confirm_community_registration_units_v2",
    {
      p_campaign_id: campaignId,
      p_campaign_unit_ids: unitIds,
      p_patronato_token_hash: hashPatronatoReviewToken(token),
    },
  );

  if (error) {
    return { success: false, error: mapError(error.message) };
  }

  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const confirmed = Number(record.confirmed_count ?? 0);
  const alreadyComplete = Number(record.already_complete_count ?? 0);

  revalidatePath(`/entry/patronato/${encodeURIComponent(token)}`);

  return {
    success: true,
    message:
      alreadyComplete > 0
        ? `${confirmed} aprobadas · ${alreadyComplete} ya estaban aprobadas`
        : `${confirmed} ${confirmed === 1 ? "vivienda aprobada" : "viviendas aprobadas"}`,
  };
}

export async function holdPatronatoUnits(input: {
  campaignId: string;
  token: string;
  unitIds: string[];
}): Promise<PatronatoMutationResult> {
  const previewError = getEntryPreviewReadOnlyError();
  if (previewError) {
    return { success: false, error: previewError };
  }

  const campaignId = input.campaignId.trim();
  const token = input.token.trim();
  const unitIds = normalizeIds(input.unitIds);

  if (!campaignId || token.length < 32 || unitIds.length === 0) {
    return { success: false, error: "Seleccione al menos una vivienda válida." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "set_community_registration_units_patronato_hold_v1",
    {
      p_campaign_id: campaignId,
      p_campaign_unit_ids: unitIds,
      p_patronato_token_hash: hashPatronatoReviewToken(token),
    },
  );

  if (error) {
    return { success: false, error: mapError(error.message) };
  }

  const record =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const held = Number(record.held_count ?? 0);
  const alreadyHeld = Number(record.already_held_count ?? 0);

  revalidatePath(`/entry/patronato/${encodeURIComponent(token)}`);

  return {
    success: true,
    message:
      alreadyHeld > 0
        ? `${held} en espera · ${alreadyHeld} ya estaban en espera`
        : `${held} ${held === 1 ? "vivienda puesta" : "viviendas puestas"} en espera`,
  };
}
