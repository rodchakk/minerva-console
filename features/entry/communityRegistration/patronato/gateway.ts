import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PatronatoResident = {
  fullName: string;
  isPrimary: boolean;
  position: number;
};

export type PatronatoReviewState = "pending" | "hold" | "approved" | "processed";

export type PatronatoReviewUnit = {
  holdNote: string | null;
  id: string;
  label: string;
  patronatoConfirmedAt: string | null;
  reference: string | null;
  residentCount: number;
  residents: PatronatoResident[];
  reviewState: PatronatoReviewState;
  reviewedAt: string | null;
  status: string;
};

export type PatronatoReviewSession = {
  available: true;
  campaignId: string;
  campaignStatus: string;
  communityId: string;
  communityName: string;
  expiresAt: string | null;
  publicTitle: string;
  summary: {
    approved: number;
    hold: number;
    pending: number;
    processed: number;
  };
  units: PatronatoReviewUnit[];
};

export type PatronatoReviewResult =
  | PatronatoReviewSession
  | { available: false };

type RecordLike = Record<string, unknown>;

function asRecord(value: unknown): RecordLike {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordLike)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown) {
  const text = asString(value).trim();
  return text || null;
}

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function mapResident(value: unknown): PatronatoResident | null {
  const record = asRecord(value);
  const fullName = asString(record.full_name).trim();
  const position = asNumber(record.position);

  if (!fullName || position <= 0) return null;

  return {
    fullName,
    isPrimary: record.is_primary === true,
    position,
  };
}

function mapUnit(value: unknown): PatronatoReviewUnit | null {
  const record = asRecord(value);
  const id = asString(record.unit_id).trim();
  const label = asString(record.unit_label).trim();
  const rawState = asString(record.review_state).trim();
  const reviewState: PatronatoReviewState =
    rawState === "hold" || rawState === "approved" || rawState === "processed"
      ? rawState
      : "pending";

  if (!id || !label) return null;

  const residents = Array.isArray(record.residents)
    ? record.residents
        .map(mapResident)
        .filter((resident): resident is PatronatoResident => resident !== null)
        .sort((left, right) => left.position - right.position)
    : [];

  return {
    holdNote: asNullableString(record.hold_note),
    id,
    label,
    patronatoConfirmedAt: asNullableString(record.patronato_confirmed_at),
    reference: asNullableString(record.unit_reference),
    residentCount: asNumber(record.resident_count),
    residents,
    reviewState,
    reviewedAt: asNullableString(record.reviewed_at),
    status: asString(record.status).trim(),
  };
}

export async function resolvePatronatoReview(
  tokenHash: string,
): Promise<PatronatoReviewResult> {
  if (!tokenHash) return { available: false };

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(
      "list_community_registration_patronato_units_v1",
      { p_patronato_token_hash: tokenHash },
    );

    if (error) return { available: false };

    const root = asRecord(data);
    if (root.valid !== true) return { available: false };

    const campaignId = asString(root.campaign_id).trim();
    const communityId = asString(root.community_id).trim();
    const communityName = asString(root.community_name).trim();

    if (!campaignId || !communityId || !communityName) {
      return { available: false };
    }

    const summary = asRecord(root.summary);
    const units = Array.isArray(root.units)
      ? root.units
          .map(mapUnit)
          .filter((unit): unit is PatronatoReviewUnit => unit !== null)
      : [];

    return {
      available: true,
      campaignId,
      campaignStatus: asString(root.campaign_status).trim(),
      communityId,
      communityName,
      expiresAt: asNullableString(root.expires_at),
      publicTitle:
        asString(root.public_title).trim() || "Revisión de viviendas",
      summary: {
        approved: asNumber(summary.approved),
        hold: asNumber(summary.hold),
        pending: asNumber(summary.pending),
        processed: asNumber(summary.processed),
      },
      units,
    };
  } catch {
    return { available: false };
  }
}
