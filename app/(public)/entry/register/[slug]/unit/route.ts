import type { NextRequest } from "next/server";
import {
  getCampaignAccessCookieName,
  normalizePublicSlug,
  readCampaignAccessCookieValue,
} from "@/features/entry/communityRegistration/public/accessState";
import {
  lookupCommunityRegistrationUnit,
  resolveCommunityRegistrationUnitPrefix,
} from "@/features/entry/communityRegistration/public/gateway";
import {
  enforceUnitLookupRateLimit,
  isRateLimitDenied,
  rateLimitJsonResponse,
} from "@/features/entry/communityRegistration/public/rateLimit";
import {
  hasSameOriginBoundary,
  jsonRegistrationResponse,
} from "@/features/entry/communityRegistration/public/requestSecurity";
import {
  buildCommunityUnitLookupLabel,
  hasCommunityUnitPrefix,
} from "@/features/entry/communityRegistration/public/unitLabelPrefix";

export const dynamic = "force-dynamic";

const MAX_UNIT_LABEL_LENGTH = 120;

function jsonResponse(body: { available: false } | {
  available: true;
  residentLimit: number;
  unitLabel: string;
}, status = 200) {
  return jsonRegistrationResponse(body, status);
}

async function readUnitLabel(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return "";
  }

  if (!body || typeof body !== "object" || !("unitLabel" in body)) {
    return "";
  }

  const unitLabel = (body as { unitLabel?: unknown }).unitLabel;
  return typeof unitLabel === "string" ? unitLabel.trim() : "";
}

function normalizeLookupCandidate(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildUnitLookupCandidates(input: string, unitLabelPrefix: string) {
  const raw = normalizeLookupCandidate(input);
  if (!raw) return [];

  const candidates = new Set<string>();

  if (!hasCommunityUnitPrefix(raw, unitLabelPrefix)) {
    candidates.add(buildCommunityUnitLookupLabel(unitLabelPrefix, raw));
  }

  candidates.add(raw);

  return Array.from(candidates).filter(
    (candidate) => candidate.length <= MAX_UNIT_LABEL_LENGTH,
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  if (!hasSameOriginBoundary(request)) {
    return jsonResponse({ available: false }, 403);
  }

  const { slug: rawSlug } = await context.params;
  const slug = normalizePublicSlug(rawSlug);

  if (!slug) {
    return jsonResponse({ available: false }, 404);
  }

  const accessState = readCampaignAccessCookieValue({
    cookieValue: request.cookies.get(getCampaignAccessCookieName(slug))?.value,
    slug,
  });

  if (!accessState) {
    return jsonResponse({ available: false }, 401);
  }

  const rateLimitDecision = await enforceUnitLookupRateLimit(request, {
    rateLimitSessionId: accessState.rateLimitSessionId,
    slug,
    tokenHash: accessState.tokenHash,
  });

  if (isRateLimitDenied(rateLimitDecision)) {
    return rateLimitJsonResponse(rateLimitDecision);
  }

  const unitLabel = await readUnitLabel(request);
  if (!unitLabel || unitLabel.length > MAX_UNIT_LABEL_LENGTH) {
    return jsonResponse({ available: false });
  }

  const unitLabelPrefix = await resolveCommunityRegistrationUnitPrefix({
    publicSlug: slug,
  });
  if (!unitLabelPrefix) {
    return jsonResponse({ available: false });
  }

  let lookup: Awaited<ReturnType<typeof lookupCommunityRegistrationUnit>> = {
    available: false,
  };

  for (const candidate of buildUnitLookupCandidates(unitLabel, unitLabelPrefix)) {
    lookup = await lookupCommunityRegistrationUnit({
      publicSlug: slug,
      tokenHash: accessState.tokenHash,
      unitLabel: candidate,
    });

    if (lookup.available) {
      break;
    }
  }

  if (!lookup.available) {
    return jsonResponse({ available: false });
  }

  return jsonResponse({
    available: true,
    residentLimit: lookup.residentLimit,
    unitLabel: lookup.unitLabel,
  });
}
