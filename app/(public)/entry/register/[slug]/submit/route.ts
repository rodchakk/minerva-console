import type { NextRequest } from "next/server";
import {
  getCampaignAccessCookieName,
  normalizePublicSlug,
  readCampaignAccessCookieValue,
} from "@/features/entry/communityRegistration/public/accessState";
import { submitCommunityRegistrationHousehold } from "@/features/entry/communityRegistration/public/gateway";
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

  const submission = await submitCommunityRegistrationHousehold({
    publicSlug: slug,
    residents: parsedBody.body.residents,
    tokenHash: accessState.tokenHash,
    unitLabel: parsedBody.body.unitLabel,
  });

  if (submission.submitted) {
    return submissionResponse({ submitted: true });
  }

  return submissionResponse(
    {
      error: submission.reason === "unavailable" ? "unavailable" : "try_again",
      submitted: false,
    },
    submission.reason === "unavailable" ? 409 : 502,
  );
}
