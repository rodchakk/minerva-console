import type { NextRequest } from "next/server";
import {
  getCampaignAccessCookieName,
  normalizePublicSlug,
  readCampaignAccessCookieValue,
} from "@/features/entry/communityRegistration/public/accessState";
import {
  lookupCommunityRegistrationUnit,
  resolveCommunityRegistrationUnitPrefix,
  submitCommunityRegistrationHousehold,
} from "@/features/entry/communityRegistration/public/gateway";
import {
  enforceInitialSubmissionRateLimit,
  isRateLimitDenied,
  rateLimitJsonResponse,
} from "@/features/entry/communityRegistration/public/rateLimit";
import {
  hasSameOriginBoundary,
  jsonRegistrationResponse,
} from "@/features/entry/communityRegistration/public/requestSecurity";
import { parseHouseholdSubmissionBody } from "@/features/entry/communityRegistration/public/submissionPayload";
import { canonicalizeCommunityUnitLabel } from "@/features/entry/communityRegistration/public/unitLabelPrefix";
import { getEntryPreviewReadOnlyError } from "@/features/entry/deploymentBoundary";

export const dynamic = "force-dynamic";

// Transport security ceiling only. The backend RPC remains the authority for
// resident-count limits through the campaign/unit effective resident limit.
const MAX_SUBMISSION_BODY_BYTES = 1024 * 1024;

type PublicSubmissionResponse =
  | {
      submitted: true;
    }
  | {
      error:
        | "access_required"
        | "already_registered"
        | "invalid_request"
        | "payload_too_large"
        | "rate_limited"
        | "service_unavailable"
        | "try_again"
        | "unavailable";
      submitted: false;
    };

type JsonBodyResult =
  | {
      body: unknown;
      ok: true;
    }
  | {
      error: "invalid_request" | "payload_too_large";
      ok: false;
    };

function submissionResponse(body: PublicSubmissionResponse, status = 200) {
  return jsonRegistrationResponse(body, status);
}

function hasJsonContentType(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.split(";")[0]?.trim() === "application/json";
}

async function readJsonBody(request: NextRequest): Promise<JsonBodyResult> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_SUBMISSION_BODY_BYTES) {
    return { error: "payload_too_large", ok: false };
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return { error: "invalid_request", ok: false };
  }

  if (new TextEncoder().encode(rawBody).length > MAX_SUBMISSION_BODY_BYTES) {
    return { error: "payload_too_large", ok: false };
  }

  try {
    return { body: JSON.parse(rawBody) as unknown, ok: true };
  } catch {
    return { error: "invalid_request", ok: false };
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const previewReadOnlyError = getEntryPreviewReadOnlyError();

  if (previewReadOnlyError) {
    return submissionResponse(
      { error: "service_unavailable", submitted: false },
      403,
    );
  }

  if (!hasSameOriginBoundary(request)) {
    return submissionResponse({ error: "access_required", submitted: false }, 403);
  }

  if (!hasJsonContentType(request)) {
    return submissionResponse({ error: "invalid_request", submitted: false }, 415);
  }

  const { slug: rawSlug } = await context.params;
  const slug = normalizePublicSlug(rawSlug);

  if (!slug) {
    return submissionResponse({ error: "access_required", submitted: false }, 404);
  }

  const accessState = readCampaignAccessCookieValue({
    cookieValue: request.cookies.get(getCampaignAccessCookieName(slug))?.value,
    slug,
  });

  if (!accessState) {
    return submissionResponse({ error: "access_required", submitted: false }, 401);
  }

  const rateLimitDecision = await enforceInitialSubmissionRateLimit({
    rateLimitSessionId: accessState.rateLimitSessionId,
    slug,
    tokenHash: accessState.tokenHash,
  });

  if (isRateLimitDenied(rateLimitDecision)) {
    return rateLimitJsonResponse(rateLimitDecision, { includeSubmitted: true });
  }

  const jsonBody = await readJsonBody(request);
  if (!jsonBody.ok) {
    return submissionResponse(
      { error: jsonBody.error, submitted: false },
      jsonBody.error === "payload_too_large" ? 413 : 400,
    );
  }

  const parsedBody = parseHouseholdSubmissionBody(jsonBody.body);
  if (!parsedBody.ok) {
    return submissionResponse({ error: "invalid_request", submitted: false }, 400);
  }

  // Re-resolve the unit server-side before submission instead of trusting the
  // browser's label. This preserves exact labels for existing-unit campaigns
  // while allowing resident-provided units to be canonicalized below.
  const unitLookup = await lookupCommunityRegistrationUnit({
    publicSlug: slug,
    tokenHash: accessState.tokenHash,
    unitLabel: parsedBody.body.unitLabel,
  });

  if (!unitLookup.available) {
    return submissionResponse(
      {
        error:
          unitLookup.reason === "already_registered"
            ? "already_registered"
            : "unavailable",
        submitted: false,
      },
      409,
    );
  }

  let submissionUnitLabel = unitLookup.unitLabel;

  if (unitLookup.registrationMode === "resident_provided_units") {
    const unitLabelPrefix = await resolveCommunityRegistrationUnitPrefix({
      publicSlug: slug,
    });

    if (!unitLabelPrefix) {
      return submissionResponse({ error: "unavailable", submitted: false }, 409);
    }

    submissionUnitLabel = canonicalizeCommunityUnitLabel(
      unitLabelPrefix,
      submissionUnitLabel,
    );

    if (!submissionUnitLabel) {
      return submissionResponse({ error: "invalid_request", submitted: false }, 400);
    }
  }

  const submission = await submitCommunityRegistrationHousehold({
    publicSlug: slug,
    residents: parsedBody.body.residents,
    tokenHash: accessState.tokenHash,
    unitLabel: submissionUnitLabel,
    unitReference: parsedBody.body.unitReference,
  });

  if (submission.submitted) {
    return submissionResponse({ submitted: true });
  }

  return submissionResponse(
    {
      error:
        submission.reason === "already_registered"
          ? "already_registered"
          : submission.reason === "unavailable"
            ? "unavailable"
            : "try_again",
      submitted: false,
    },
    submission.reason === "unavailable" || submission.reason === "already_registered"
      ? 409
      : 502,
  );
}
