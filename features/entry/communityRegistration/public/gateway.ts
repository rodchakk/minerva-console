import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { HouseholdSubmissionResident } from "./submissionPayload";

export type PublicRegistrationCampaign =
  | {
      available: false;
    }
  | {
      available: true;
      closesAt: string | null;
      communityName: string;
      defaultResidentLimit: number;
      publicInstructions: string | null;
      publicTitle: string;
    };

export type PublicRegistrationUnitLookup =
  | {
      available: false;
    }
  | {
      available: true;
      residentLimit: number;
      unitLabel: string;
    };

export type PublicRegistrationSubmission =
  | {
      reason: "try_again" | "unavailable";
      submitted: false;
    }
  | {
      submitted: true;
    };

type CampaignRpcResult = {
  available?: boolean;
  closes_at?: string | null;
  community_name?: string | null;
  default_resident_limit?: number | null;
  public_instructions?: string | null;
  public_title?: string | null;
};

type UnitLookupRpcResult = {
  can_start?: boolean;
  effective_resident_limit?: number | null;
  unit_label?: string | null;
};

type SubmissionRpcResult = {
  accepted?: boolean;
  error_code?: string | null;
};

export async function resolveCommunityRegistrationCampaign(input: {
  publicSlug: string;
  tokenHash: string;
}): Promise<PublicRegistrationCampaign> {
  if (!input.publicSlug || !input.tokenHash) {
    return { available: false };
  }

  let data: unknown;
  let error: unknown;

  try {
    const supabase = createAdminClient();
    const response = await supabase.rpc("resolve_community_registration_campaign_v1", {
      p_public_slug: input.publicSlug,
      p_campaign_token_hash: input.tokenHash,
    });
    data = response.data;
    error = response.error;
  } catch {
    return { available: false };
  }

  if (error || !data || typeof data !== "object") {
    return { available: false };
  }

  const result = data as CampaignRpcResult;
  if (result.available !== true) {
    return { available: false };
  }

  return {
    available: true,
    closesAt: result.closes_at ?? null,
    communityName: result.community_name?.trim() || "Comunidad ENTRY",
    defaultResidentLimit: Number(result.default_resident_limit ?? 0),
    publicInstructions: result.public_instructions ?? null,
    publicTitle: result.public_title?.trim() || "Registro de residentes",
  };
}

export async function lookupCommunityRegistrationUnit(input: {
  publicSlug: string;
  tokenHash: string;
  unitLabel: string;
}): Promise<PublicRegistrationUnitLookup> {
  const unitLabel = input.unitLabel.trim();

  if (!input.publicSlug || !input.tokenHash || !unitLabel) {
    return { available: false };
  }

  let data: unknown;
  let error: unknown;

  try {
    const supabase = createAdminClient();
    const response = await supabase.rpc("lookup_community_registration_unit_v1", {
      p_campaign_token_hash: input.tokenHash,
      p_public_slug: input.publicSlug,
      p_unit_label: unitLabel,
    });
    data = response.data;
    error = response.error;
  } catch {
    return { available: false };
  }

  if (error || !data || typeof data !== "object") {
    return { available: false };
  }

  const result = data as UnitLookupRpcResult;
  if (result.can_start !== true) {
    return { available: false };
  }

  const returnedUnitLabel = result.unit_label?.trim();
  const residentLimit = Number(result.effective_resident_limit ?? 0);

  if (!returnedUnitLabel || !Number.isFinite(residentLimit) || residentLimit <= 0) {
    return { available: false };
  }

  return {
    available: true,
    residentLimit,
    unitLabel: returnedUnitLabel,
  };
}

export async function submitCommunityRegistrationHousehold(input: {
  publicSlug: string;
  residents: HouseholdSubmissionResident[];
  tokenHash: string;
  unitLabel: string;
}): Promise<PublicRegistrationSubmission> {
  const unitLabel = input.unitLabel.trim();

  if (
    !input.publicSlug ||
    !input.tokenHash ||
    !unitLabel ||
    input.residents.length < 1
  ) {
    return { reason: "unavailable", submitted: false };
  }

  let data: unknown;
  let error: unknown;

  try {
    const supabase = createAdminClient();
    const response = await supabase.rpc(
      "submit_community_registration_household_v1",
      {
        p_campaign_token_hash: input.tokenHash,
        p_public_slug: input.publicSlug,
        p_residents: input.residents,
        p_technical_metadata: {},
        p_unit_label: unitLabel,
      },
    );
    data = response.data;
    error = response.error;
  } catch {
    return { reason: "try_again", submitted: false };
  }

  if (error || !data || typeof data !== "object") {
    return { reason: "try_again", submitted: false };
  }

  const result = data as SubmissionRpcResult;
  if (result.accepted === true) {
    return { submitted: true };
  }

  if (
    result.error_code === "ENTRY_CR_CAMPAIGN_UNAVAILABLE" ||
    result.error_code === "ENTRY_CR_UNIT_UNAVAILABLE"
  ) {
    return { reason: "unavailable", submitted: false };
  }

  return { reason: "try_again", submitted: false };
}
